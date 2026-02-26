import { supabase, isSupabaseConfigured } from '../config/supabase';
import { supabaseService } from './supabaseService';
import { ResearchQuery, ResearchResult, UserInteraction, PaperMetadata } from '../types/research';
import axios, { AxiosError } from 'axios';
import { decode as atob } from 'base-64';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { SupabaseClient } from '@supabase/supabase-js';
import { PostgrestResponse } from '@supabase/postgrest-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEMANTIC_SCHOLAR_API = 'https://api.semanticscholar.org/graph/v1';
const PAPERS_WITH_CODE_API = 'https://paperswithcode.com/api/v1';

// Remove hardcoded API key and use public access
const SEMANTIC_SCHOLAR_API_KEY = null; // Public API access

// Optimize constants for better rate limiting
const RATE_LIMIT_DELAY = 3000; // 3s initial delay
const MAX_RETRIES = 5; // Increase max retries
const RETRY_DELAY = 3000; // 3s base retry delay
const BATCH_SIZE = 5; // Reduce from 10 to 5 for faster initial load
const CACHE_DURATION = 1000 * 60 * 60; // Increase to 1 hour from 15 minutes
const MINIMAL_FIELDS = 'title,abstract,url,year,venue,citationCount,authors';
const MAX_CHUNK_SIZE = 100000; // Maximum size for text chunks
const MAX_CONCURRENT_REQUESTS = 1; // Reduce from 2 to 1 to avoid rate limits
const SEMANTIC_SCHOLAR_TIMEOUT = 10000; // Reduce timeout from 20s to 10s

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const USE_LOCAL_API = false; // Set to false since local API is not available

// Cache configuration
const CACHE_EXPIRY = 1000 * 60 * 60 * 24; // Increase to 24 hours
const CACHE_PREFIX = 'pwc_search_';

// Rate limit configuration
const BASE_DELAY = 2000;
const MAX_DELAY = 10000;

// Add request prioritization
const PRIORITY_SOURCE = 'papers_with_code'; // Prioritize PwC API as primary source

// Cache implementation
class CacheManager<T> {
    private cache = new Map<string, { value: T; timestamp: number }>();
    private maxAge: number;

    constructor(maxAge: number = CACHE_DURATION) {
        this.maxAge = maxAge;
    }

    set(key: string, value: T): void {
        this.cache.set(key, { value, timestamp: Date.now() });
    }

    get(key: string): T | undefined {
        const item = this.cache.get(key);
        if (!item) return undefined;

        if (Date.now() - item.timestamp > this.maxAge) {
            this.cache.delete(key);
            return undefined;
        }

        return item.value;
    }

    clear(): void {
        this.cache.clear();
    }
}

// Initialize caches with specific types
const paperDetailsCache = new CacheManager<any>();
const searchResultsCache = new CacheManager<ResearchResult[]>();
const insightsCache = new CacheManager<string[]>();
const conceptsCache = new CacheManager<Array<{
    concept: string;
    explanation: string;
    importance: 'High' | 'Medium' | 'Low';
}>>();
const difficultyCache = new CacheManager<{
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    explanation: string;
    prerequisites: string[];
    estimatedTimeToImplement: string;
    technicalSkills: Array<{ skill: string; level: 'Basic' | 'Intermediate' | 'Advanced' }>;
}>();

class RequestQueue {
    private queue: Array<() => Promise<any>> = [];
    private processing = false;
    private lastRequestTime = 0;
    private readonly minDelay = 3000; // Increase minimum delay between requests
    private rateLimitExpiry: { [key: string]: number } = {};

    async add<T>(request: () => Promise<T>, source: string = 'default'): Promise<T> {
        return new Promise((resolve, reject) => {
            // Prioritize PwC requests
            if (source === PRIORITY_SOURCE) {
                this.queue.unshift(async () => {
                    try {
                        const result = await request();
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
            } else {
                this.queue.push(async () => {
                    try {
                        const result = await request();
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
            }
            this.process();
        });
    }

    private async process() {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            
            if (timeSinceLastRequest < this.minDelay) {
                await delay(this.minDelay - timeSinceLastRequest);
            }

            const request = this.queue.shift();
            if (request) {
                this.lastRequestTime = Date.now();
                await request().catch(console.error);
                // Add additional delay after each request
                await delay(Math.random() * 1000); // Random jitter
            }
        }

        this.processing = false;
    }
}

const requestQueue = new RequestQueue();

const checkSupabase = () => {
    if (!isSupabaseConfigured() || !supabase) {
        throw new Error('Supabase is not configured');
    }
    return supabase;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Add exponential backoff utility
const getBackoffDelay = (retryCount: number): number => {
    return RETRY_DELAY * Math.pow(2, retryCount) * (0.5 + Math.random() * 0.5);
};

const makeApiRequest = async <T>(
    requestFn: () => Promise<T>,
    retryCount = 0
): Promise<T> => {
    try {
        // Add initial delay before making the request
        await delay(RATE_LIMIT_DELAY);
        return await requestFn();
    } catch (error) {
        if (error instanceof AxiosError) {
            // Handle 404 errors separately
            if (error.response?.status === 404) {
                console.warn('Resource not found:', error.config?.url);
                return {} as T;
            }
            
            // Handle rate limiting
            if (error.response?.status === 429 && retryCount < MAX_RETRIES) {
                const backoffDelay = getBackoffDelay(retryCount);
                console.log(`Rate limit hit, retrying in ${Math.round(backoffDelay/1000)} seconds...`);
                await delay(backoffDelay);
                return makeApiRequest(requestFn, retryCount + 1);
            }
            if (error.response?.status === 429) {
                throw new Error('Rate limit exceeded. Please try again in a few minutes.');
            }
        }
        throw error;
    }
};

const cleanJsonResponse = (content: string): string => {
    if (!content) return '';
    
    // First, try to find JSON-like content
    const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!jsonMatch) return '';
    
    return jsonMatch[0]
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .replace(/```json\n?|\n?```/g, '') // Remove markdown code blocks
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
};

const handleOpenRouterResponse = async (response: Response) => {
    if (!response.ok) {
        const data = await response.json();
        if (data.error?.code === 429) {
            throw new Error('Rate limit exceeded. Please try again later or upgrade your plan.');
        }
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('OpenRouter API response:', JSON.stringify(data, null, 2));
    
    // More lenient response validation
    if (!data) {
        throw new Error('Empty response from OpenRouter API');
    }

    // Handle different response formats
    let content = '';
    if (data.choices?.[0]?.message?.content) {
        content = data.choices[0].message.content;
    } else if (data.response) {
        content = data.response;
    } else if (typeof data === 'string') {
        content = data;
    } else if (data.content) {
        content = data.content;
    } else if (data.choices?.[0]?.text) {
        content = data.choices[0].text;
    } else if (data.choices?.[0]?.delta?.content) {
        content = data.choices[0].delta.content;
    }

    console.log('Extracted content:', content);

    if (!content) {
        console.error('No content found in response data:', data);
        throw new Error('No content found in OpenRouter API response');
    }

    return content;
};

const chunkText = (text: string): string[] => {
    const chunks: string[] = [];
    let currentChunk = '';
    const sentences = text.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > MAX_CHUNK_SIZE) {
            chunks.push(currentChunk);
            currentChunk = sentence;
        } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    return chunks;
};

const extractTextFromPDF = async (base64Content: string): Promise<string> => {
    try {
        // Since we already have the base64 content, we can process it directly
        const decodedContent = atob(base64Content);
        
        // Basic text extraction using regex
        const textContent = decodedContent
            .replace(/[^\x20-\x7E\n]/g, ' ') // Keep only printable ASCII characters and newlines
            .replace(/\s+/g, ' ')            // Normalize whitespace
            .trim();

        if (!textContent) {
            throw new Error('No readable text found in PDF');
        }

        return textContent;
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw new Error('Failed to extract text from PDF');
    }
};

const prepareTextForAnalysis = (text: string): string => {
    return text
        .replace(/\s+/g, ' ')           // Normalize whitespace
        .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable characters
        .trim()
        .substring(0, 15000);           // Limit text length for API
};

const handleLocalApiResponse = async (response: Response) => {
    if (!response.ok) {
        const error = await response.text().catch(() => 'Unknown error');
        throw new Error(`Local API error: ${response.status} - ${error}`);
    }
    const data = await response.json();
    return data;
};

const makeLocalApiRequest = async (endpoint: string, prompt: string): Promise<any> => {
    return requestQueue.add(async () => {
        const API_KEY = process.env.OPENROUTER_API_KEY;
        if (!API_KEY) {
            throw new Error('OpenRouter API key is not configured');
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'HTTP-Referer': 'https://stingerai.app',
                'X-Title': 'StingerAI',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-r1-distill-llama-70b:free',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a research paper analysis assistant. Provide concise, structured responses.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000,
                stream: false
            })
        });

        const content = await handleOpenRouterResponse(response);
        try {
            return JSON.parse(cleanJsonResponse(content));
        } catch (e) {
            return content.split('\n').filter(line => line.trim());
        }
    });
};

// Add proper query encoding
const encodeSearchQuery = (query: string): string => {
    return encodeURIComponent(query.trim());
};

export class ResearchService {
    async searchResearch(query: string, offset: number = 0): Promise<ResearchResult[]> {
        try {
            const normalizedQuery = query.trim().toLowerCase();
            if (!normalizedQuery) {
                return [];
            }

            // Use more specific cache key including offset
            const cacheKey = `${CACHE_PREFIX}${normalizedQuery}-${offset}`;
            
            // Try to get from cache first, even if expired in case of API failures
            const cached = await this.getCachedResults(query);
            if (cached) {
                console.log('Returning cached results for:', normalizedQuery);
                return cached;
            }

            console.log('Searching for:', normalizedQuery);
            console.log('Fetching from multiple sources...');

            const supabaseClient = checkSupabase();
            const rateLimitedSources = new Set<string>();

            // Calculate proper page number for PwC API
            const pwcPage = Math.floor(offset / BATCH_SIZE) + 1;
            
            // Use a semaphore to limit concurrent requests
            const semaphore = new Array(MAX_CONCURRENT_REQUESTS).fill(null);
            
            // Fetch from multiple sources in parallel with controlled concurrency
            const results = await Promise.allSettled(
                semaphore.map(async () => {
                    const sources = [
                        // Supabase search
                        Promise.resolve().then(async () => {
                            try {
                                const response = await supabaseClient
                                    .from('research_results')
                                    .select('*')
                                    .textSearch('title', normalizedQuery)
                                    .range(offset, offset + BATCH_SIZE - 1);
                                return response.data || [];
                            } catch (error) {
                                console.error('Supabase search error:', error);
                                return [];
                            }
                        }),

                        // Semantic Scholar search
                        makeApiRequest(() =>
                            axios.get(`${SEMANTIC_SCHOLAR_API}/paper/search`, {
                                params: {
                                    query: normalizedQuery,
                                    offset,
                                    limit: BATCH_SIZE,
                                    fields: MINIMAL_FIELDS
                                },
                                timeout: SEMANTIC_SCHOLAR_TIMEOUT,
                                headers: {
                                    'x-api-key': SEMANTIC_SCHOLAR_API_KEY || undefined
                                }
                            })
                        ).then(response => (response.data?.data || []).map((paper: any) => this.transformSemanticScholarResult(paper)))
                        .catch((error: unknown) => {
                            if (error instanceof Error && error.message.includes('rate limit')) {
                                rateLimitedSources.add('semantic_scholar');
                            }
                            console.error('Semantic Scholar search error:', error);
                            return [];
                        }),

                        // Papers with Code search
                        makeApiRequest(() =>
                            axios.get(`${PAPERS_WITH_CODE_API}/papers/`, {
                                params: {
                                    q: normalizedQuery,
                                    page: pwcPage,
                                    items_per_page: BATCH_SIZE,
                                    sort_by: 'relevance'
                                }
                            }).then(response => {
                                console.log('PwC API request successful');
                                console.log('PwC API URL:', `${PAPERS_WITH_CODE_API}/papers/`);
                                console.log('PwC API params:', {
                                    q: normalizedQuery,
                                    page: pwcPage,
                                    items_per_page: BATCH_SIZE,
                                    sort_by: 'relevance'
                                });
                                console.log('PwC API response status:', response.status);
                                console.log('PwC API response data:', JSON.stringify(response.data, null, 2));
                                return response;
                            })
                        ).then(response => {
                            const results = response.data?.results || [];
                            console.log(`PwC returned ${results.length} results for query "${normalizedQuery}"`);
                            return results.map((paper: any) => this.transformPapersWithCodeResult(paper));
                        }).catch((error: unknown) => {
                            if (axios.isAxiosError(error)) {
                                if (error.response?.status === 429) {
                                    rateLimitedSources.add('papers_with_code');
                                    console.error('Papers with Code rate limit exceeded');
                                } else {
                                    console.error('Papers with Code API error:', {
                                        status: error.response?.status,
                                        statusText: error.response?.statusText,
                                        data: error.response?.data,
                                        url: error.config?.url,
                                        params: error.config?.params
                                    });
                                }
                            } else {
                                console.error('Papers with Code unexpected error:', error);
                            }
                            return [];
                        })
                    ];

                    // Process sources sequentially within each concurrent batch
                    const results = [];
                    for (const source of sources) {
                        try {
                            const sourceResults = await source;
                            results.push(...sourceResults);
                        } catch (error) {
                            console.error('Error processing source:', error);
                        }
                    }
                    return results;
                })
            );

            // Flatten and merge all results
            const allResults = results
                .filter((result): result is PromiseFulfilledResult<ResearchResult[]> => 
                    result.status === 'fulfilled'
                )
                .flatMap(result => result.value);

            // If all sources are rate limited and no results, throw error
            if (rateLimitedSources.size === 2 && allResults.length === 0) {
                throw new Error('All external APIs are rate limited. Please try again later.');
            }

            // Merge and deduplicate results
            const mergedResults = this.mergeAndDeduplicateResults(allResults);

            // Cache results
            await this.cacheResults(query, mergedResults);

            console.log(`Returning ${mergedResults.length} merged results for query:`, normalizedQuery);
            return mergedResults;

        } catch (error) {
            console.error('Error in searchResearch:', error);
            throw error instanceof Error ? error : new Error('Search failed');
        }
    }

    // Helper method to merge and deduplicate results
    mergeAndDeduplicateResults(...resultSets: ResearchResult[][]): ResearchResult[] {
        const seen = new Map<string, { result: ResearchResult; score: number }>();
        const merged: ResearchResult[] = [];

        for (const results of resultSets) {
            for (const result of results) {
                // Generate a stable ID based on multiple factors
                if (!result.id) {
                    if (result.metadata?.semanticScholarId) {
                        result.id = `ss-${result.metadata.semanticScholarId}`;
                    } else {
                        // Create a more unique ID using multiple fields
                        const idComponents = [
                            result.title,
                            result.metadata?.year,
                            result.metadata?.venue,
                            result.metadata?.authors?.map(a => a.name).join('-'),
                            result.metadata?.source
                        ].filter(Boolean);
                        
                        const idBase = idComponents.join('-');
                        result.id = idBase.toLowerCase()
                            .replace(/[^a-z0-9]/g, '-')
                            .replace(/-+/g, '-')
                            .slice(0, 100);
                    }
                }

                // Calculate relevance score
                const score = this.calculateRelevanceScore(result);
                const uniqueKey = `${result.id}-${result.metadata?.source || 'unknown'}`;

                // Only keep the result with the highest score
                if (!seen.has(uniqueKey) || score > (seen.get(uniqueKey)?.score || 0)) {
                    seen.set(uniqueKey, { result, score });
                }
            }
        }

        // Convert map to array and sort by score
        merged.push(...Array.from(seen.values())
            .sort((a, b) => b.score - a.score)
            .map(item => item.result));

        return merged;
    }

    // Helper method to calculate relevance score
    private calculateRelevanceScore(result: ResearchResult): number {
        let score = 0;

        // Prioritize papers with more complete information
        if (result.title) score += 10;
        if (result.abstract) score += 15;
        if (result.pdf_url) score += 5;
        if (result.code_url) score += 5;

        // Metadata factors
        if (result.metadata) {
            if (result.metadata.year) score += 3;
            if (result.metadata.venue) score += 3;
            if (result.metadata.authors?.length > 0) score += 3;
            if (result.metadata.citations) score += Math.min(result.metadata.citations / 100, 10);
            
            // Slightly boost Semantic Scholar results as they tend to be more academic
            if (result.metadata.source === 'semantic_scholar') score += 2;
        }

        // Penalize results without key information
        if (!result.abstract) score -= 10;
        if (!result.metadata?.year) score -= 5;

        return score;
    }

    // Helper method to parse and normalize paper ID
    private parsePaperId(rawId: string): { type: 'semantic_scholar' | 'pwc' | 'uuid' | 'unknown'; id: string } {
        const trimmedId = rawId.trim();

        // Check for our normalized prefixes first
        if (trimmedId.startsWith('ss-')) {
            const unprefixedId = trimmedId.substring(3);
            // Always use the unprefixed ID for Semantic Scholar
            return { type: 'semantic_scholar', id: unprefixedId };
        }

        if (trimmedId.startsWith('pwc-')) {
            return { type: 'pwc', id: trimmedId.substring(4) };
        }

        // Check for UUID format
        if (trimmedId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return { type: 'uuid', id: trimmedId };
        }

        // Check for raw Semantic Scholar hex ID format (40 characters)
        if (trimmedId.match(/^[0-9a-f]{40}$/i)) {
            return { type: 'semantic_scholar', id: trimmedId };
        }

        // Check for CorpusID format
        if (trimmedId.startsWith('CorpusID:')) {
            return { type: 'semantic_scholar', id: trimmedId };
        }

        // If we can't determine the type, default to semantic scholar
        // This maintains backward compatibility with existing IDs in the system
        return { type: 'semantic_scholar', id: trimmedId };
    }

    async analyzePaper(paperId: string): Promise<{ paper: ResearchResult; analysis: string }> {
        try {
            if (!paperId?.trim()) {
                throw new Error('Paper ID is required');
            }

            const { type, id } = this.parsePaperId(paperId);
            console.log('Analyzing paper:', { type, id, originalId: paperId });
            const supabaseClient = checkSupabase();

            // Try cache first
            try {
                const cached = paperDetailsCache.get(id);
                if (cached) {
                    console.log('Found paper in cache');
                    return cached;
                }
            } catch (cacheError) {
                console.warn('Cache error:', cacheError);
            }

            // Try to fetch the paper
            let paper: ResearchResult | null = null;
            let fetchError: Error | null = null;

            try {
                switch (type) {
                    case 'pwc':
                        console.log('Fetching from PwC API:', id);
                        try {
                            const pwcResponse = await axios.get(`${PAPERS_WITH_CODE_API}/papers/${id}/`);
                            console.log('PwC API response:', pwcResponse.status);
                            if (pwcResponse?.data) {
                                paper = this.transformPapersWithCodeResult(pwcResponse.data);
                            }
                        } catch (pwcError) {
                            console.error('PwC API error:', pwcError);
                            if (axios.isAxiosError(pwcError)) {
                                console.error('PwC API response:', {
                                    status: pwcError.response?.status,
                                    data: pwcError.response?.data
                                });
                            }
                            throw pwcError;
                        }
                        break;

                    case 'semantic_scholar':
                        console.log('Fetching from Semantic Scholar API:', id);
                        try {
                        const semanticResponse = await makeApiRequest(() =>
                                axios.get(`${SEMANTIC_SCHOLAR_API}/paper/${id}`, {
                                params: {
                                    fields: 'title,abstract,url,year,venue,citationCount,authors'
                                },
                                timeout: SEMANTIC_SCHOLAR_TIMEOUT
                            })
                        );
                            console.log('Semantic Scholar API response:', semanticResponse.status);
                        if (semanticResponse?.data) {
                            paper = this.transformSemanticScholarResult(semanticResponse.data);
                            }
                        } catch (ssError) {
                            console.error('Semantic Scholar API error:', ssError);
                            if (axios.isAxiosError(ssError)) {
                                console.error('Semantic Scholar API response:', {
                                    status: ssError.response?.status,
                                    data: ssError.response?.data
                                });
                            }
                            throw ssError;
                        }
                        break;

                    case 'uuid':
                        console.log('Looking up UUID in database:', id);
                        const { data: dbPaper, error: dbError } = await supabaseClient
                                    .from('research_results')
                            .select('*')
                            .eq('id', id)
                            .maybeSingle();
                        
                        if (dbError) {
                            console.error('Database lookup error:', dbError);
                            throw dbError;
                        }
                        
                        if (dbPaper) {
                            console.log('Found paper in database');
                            paper = dbPaper;
                        }
                        break;
                }

                // If still not found, try semantic scholar ID in database
                    if (!paper) {
                    console.log('Trying semantic scholar ID in database:', id);
                    const { data: semanticPaper, error: semanticError } = await supabaseClient
                                    .from('research_results')
                        .select('*')
                        .eq('metadata->semanticScholarId', id)
                        .maybeSingle();
                    
                    if (semanticError) {
                        console.error('Semantic Scholar database lookup error:', semanticError);
                    } else if (semanticPaper) {
                        console.log('Found paper in database via semantic scholar ID');
                        paper = semanticPaper;
                    }
                }
            } catch (error) {
                console.error('Fetch error details:', {
                    error,
                    type,
                    id,
                    isAxiosError: axios.isAxiosError(error),
                    response: axios.isAxiosError(error) ? error.response?.data : undefined
                });
                fetchError = error instanceof Error ? error : new Error('Failed to fetch paper');
            }

            if (!paper) {
                const errorMessage = `Paper not found. Type: ${type}, ID: ${id}, Original ID: ${paperId}`;
                console.error(errorMessage);
                if (fetchError) {
                    console.error('Fetch error:', fetchError);
                }
                throw new Error(errorMessage);
            }

            console.log('Successfully found paper:', {
                title: paper.title,
                source: paper.metadata?.source,
                hasAbstract: !!paper.abstract
            });

            // Initialize metadata if needed
            paper.metadata = paper.metadata || {};
            
            // Generate analysis
            const analysis = `Analysis of ${paper.title}:\n\n${
                paper.abstract ? 
                `Key findings from the abstract:\n${paper.abstract}\n\n` : 
                'No abstract available.\n\n'
            }${
                paper.metadata.citations ? 
                `This paper has been cited ${paper.metadata.citations} times.\n` : 
                ''
            }${
                paper.code_url ? 
                `Implementation code is available at: ${paper.code_url}` : 
                'No implementation code found.'
            }`;

            const result = { paper, analysis };
            
            // Cache the result
            try {
                paperDetailsCache.set(id, result);
                console.log('Cached paper details');
            } catch (cacheError) {
                console.warn('Cache set error:', cacheError);
            }

            // Start background analysis if needed
            if (!paper.metadata.analyzed) {
                this.loadAdditionalAnalysis(paper, id).catch(error => {
                    console.error('Background analysis error:', error);
                });
            }

            return result;
        } catch (error) {
            console.error('Error in analyzePaper:', error);
            throw error instanceof Error ? error : new Error('Failed to analyze paper');
        }
    }

    // Background data loading
    private async loadAdditionalAnalysis(paper: ResearchResult, paperId: string): Promise<void> {
        try {
            const supabaseClient = checkSupabase();
            
            // Queue all analysis tasks with proper delays and retries
            const analysisQueue = [
                {
                    task: () => this.generateKeyInsights(paper),
                    key: 'insights',
                    type: 'array' as const
                },
                {
                    task: () => this.explainKeyConcepts(paper),
                    key: 'concepts',
                    type: 'object' as const
                },
                {
                    task: () => this.assessTechnicalDifficulty(paper),
                    key: 'difficulty',
                    type: 'object' as const
                },
                {
                    task: () => this.generateCodeSnippets(paper),
                    key: 'codeSnippets',
                    type: 'object' as const
                },
                {
                    task: () => this.generateImplementationSteps(paper),
                    key: 'implementationSteps',
                    type: 'array' as const
                }
            ];

            const results: Record<string, any> = {};
            
            // Process tasks sequentially with delays
            for (const { task, key } of analysisQueue) {
                try {
                    await delay(2000); // Add delay between tasks
                    results[key] = await requestQueue.add(async () => task(), 'analysis');
                } catch (error) {
                    console.warn(`Error in ${key} analysis:`, error);
                    results[key] = this.getFallbackAnalysis(key, paper);
                }
            }

            // Update paper metadata with analysis results
            const updatedMetadata = {
                ...paper.metadata,
                ...results,
                analyzed: true,
                analyzedAt: new Date().toISOString()
            };

            // Update the paper in the database
            try {
                const { type, id } = this.parsePaperId(paper.id);
                await supabaseClient
                    .from('research_results')
                    .update({ metadata: updatedMetadata })
                    .eq('id', id)
                    .throwOnError();

                // Update cache with new metadata
                const cached = paperDetailsCache.get(paperId);
                if (cached) {
                    cached.paper.metadata = updatedMetadata;
                    paperDetailsCache.set(paperId, cached);
                }
            } catch (error) {
                console.warn('Error updating paper metadata:', error);
            }
        } catch (error) {
            console.error('Error loading additional analysis:', error);
        }
    }

    private getFallbackAnalysis(type: string, paper: ResearchResult): any {
        switch (type) {
            case 'insights':
                return this.generateFallbackInsights(paper);
            case 'concepts':
                return [{
                    concept: paper.title,
                    explanation: paper.abstract || 'No explanation available',
                    importance: 'High' as const
                }];
            case 'difficulty':
                return {
                    level: 'Intermediate' as const,
                    explanation: 'Technical difficulty assessment unavailable.',
                    prerequisites: [],
                    estimatedTimeToImplement: '2-4 weeks',
                    technicalSkills: [
                        { skill: 'Programming', level: 'Intermediate' as const }
                    ]
                };
            case 'codeSnippets':
                return paper.code_url ? [{
                    title: 'Reference Implementation',
                    description: 'Official implementation is available.',
                    code: `// Please visit: ${paper.code_url}`,
                    language: 'plaintext'
                }] : [];
            case 'implementationSteps':
                return [
                    'Review the paper thoroughly',
                    'Understand key concepts',
                    'Set up development environment',
                    'Implement core functionality',
                    'Test and validate'
                ];
            default:
                return null;
        }
    }

    async askImplementationQuestion(paperId: string, question: string): Promise<string> {
        try {
            const supabaseClient = checkSupabase();

            const { data: paper, error } = await supabaseClient
                .from('research_results')
                .select('*')
                .eq('metadata->semanticScholarId', paperId)
                .single();

            if (error) throw error;

            // Here you would implement the question answering logic
            // This could involve:
            // 1. Retrieving the paper analysis
            // 2. Using OpenRouter to generate an answer
            // 3. Storing the interaction

            const answer = `Answer to your question about ${paper.title}:\n\nImplementation guidance will be provided here.`;

            // Store the interaction
            await supabaseClient
                .from('user_interactions')
                .insert({
                    paper_id: paper.id, // Use the UUID from the paper record
                    question,
                    answer
                });

            return answer;
        } catch (error) {
            console.error('Error answering question:', error);
            throw error;
        }
    }

    async getResearchHistory(): Promise<ResearchQuery[]> {
        try {
            const supabaseClient = checkSupabase();

            const { data, error } = await supabaseClient
                .from('research_queries')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching research history:', error);
            throw error;
        }
    }

    async clearResearchHistory(): Promise<void> {
        try {
            const supabaseClient = checkSupabase();
            const user = (await supabaseClient.auth.getUser()).data.user;

            if (!user) {
                throw new Error('User not authenticated');
            }

            const { error } = await supabaseClient
                .from('research_queries')
                .delete()
                .eq('user_id', user.id);

            if (error) throw error;
        } catch (error) {
            console.error('Error clearing research history:', error);
            throw error;
        }
    }

    async generateKeyInsights(paper: ResearchResult): Promise<string[]> {
        try {
            // First try to get from cache
            const cacheKey = `insights-${paper.id}`;
            const cached = insightsCache.get(cacheKey);
            if (cached) {
                return cached;
            }

            // Generate insights using AI with explicit JSON format
            const prompt = `Analyze this research paper and provide 5-7 key insights in the following JSON format:

[
    {
        "category": "Choose one: [Main Contribution, Methodology, Technical Innovation, Results, Implementation, Future Work]",
        "insight": "Clear, specific insight about the paper",
        "impact": "Brief explanation of why this insight is important"
    }
]

Focus on:
- Novel contributions and breakthroughs
- Key methodological approaches
- Technical innovations
- Significant results and findings
- Practical implications
- Future research directions

Title: ${paper.title}
Abstract: ${paper.abstract}
${paper.metadata?.venue ? `Venue: ${paper.metadata.venue}` : ''}
${paper.metadata?.year ? `Year: ${paper.metadata.year}` : ''}
${paper.code_url ? `Has Implementation: Yes` : ''}`;

            const response = await makeLocalApiRequest('/api/generate', prompt);
            
            // Parse and validate the response
            let insights = [];
            if (typeof response === 'string') {
                try {
                    // Look for JSON array in the response
                    const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
                    if (jsonMatch) {
                        insights = JSON.parse(jsonMatch[0]);
                    }
                } catch (parseError) {
                    console.warn('Failed to parse JSON insights:', parseError);
                    // If JSON parsing fails, try to extract insights from text
                    insights = response.split('\n')
                        .filter(line => line.trim().length > 0)
                        .map(line => line.replace(/^\d+\.\s*/, '').trim());
                }
            } else if (Array.isArray(response)) {
                insights = response;
            }

            // Format insights into strings
            let formattedInsights: string[] = [];
            if (Array.isArray(insights) && insights.length > 0 && typeof insights[0] === 'object') {
                formattedInsights = insights.map(insight => {
                    if (insight.category && insight.insight && insight.impact) {
                        return `[${insight.category}] ${insight.insight}\n→ ${insight.impact}`;
                    }
                    return insight.insight || insight;
                });
            } else if (Array.isArray(insights)) {
                formattedInsights = insights;
            }

            // Ensure we have meaningful insights
            if (formattedInsights.length === 0) {
                formattedInsights = this.generateFallbackInsights(paper);
            }

            // Cache the results
            insightsCache.set(cacheKey, formattedInsights);
            return formattedInsights;
        } catch (error) {
            console.error('Error generating insights:', error);
            return this.generateFallbackInsights(paper);
        }
    }

    private generateFallbackInsights(paper: ResearchResult): string[] {
        const insights: string[] = [];
        
        // Main contribution
        if (paper.title) {
            insights.push(`[Main Contribution] ${paper.title}\n→ Primary research focus of the paper`);
        }

        // Publication details
        if (paper.metadata?.year || paper.metadata?.venue) {
            const details = [
                paper.metadata.year && `Published in ${paper.metadata.year}`,
                paper.metadata.venue && `Venue: ${paper.metadata.venue}`,
                paper.metadata.citations && `Cited ${paper.metadata.citations} times`
            ].filter(Boolean).join(', ');
            insights.push(`[Publication] ${details}\n→ Indicates the paper's academic impact and relevance`);
        }

        // Authors and affiliations
        if (paper.metadata?.authors && paper.metadata.authors.length > 0) {
            insights.push(`[Authors] Research by ${paper.metadata.authors.map(a => a.name).join(', ')}\n→ Represents collaboration across research institutions`);
        }

        // Implementation availability
        if (paper.code_url) {
            const implementation = [
                'Implementation code is available',
                paper.metadata?.codeRepository?.language && `Primary language: ${paper.metadata.codeRepository.language}`,
                paper.metadata?.codeRepository?.stars && `GitHub stars: ${paper.metadata.codeRepository.stars}`
            ].filter(Boolean).join(', ');
            insights.push(`[Implementation] ${implementation}\n→ Enables practical application and reproduction of results`);
        }

        // Abstract key points
        if (paper.abstract) {
            const sentences = paper.abstract.split(/[.!?]+/).filter(s => s.trim().length > 0);
            const keyPoints = sentences.slice(0, 2).map(s => s.trim());
            keyPoints.forEach((point, index) => {
                insights.push(`[Key Finding ${index + 1}] ${point}\n→ Critical research outcome from the abstract`);
            });
        }

        return insights;
    }

    async explainKeyConcepts(paper: ResearchResult): Promise<Array<{
        concept: string;
        explanation: string;
        importance: 'High' | 'Medium' | 'Low';
    }>> {
        try {
            // First try to get from cache
            const cacheKey = `concepts-${paper.id}`;
            const cached = conceptsCache.get(cacheKey);
            if (cached) {
                console.log('Returning cached concepts:', cached);
                return cached;
            }

            // Generate concepts using AI with explicit JSON format request
            const prompt = `Analyze this research paper and provide exactly 5 key concepts in the following JSON format:

[
    {
        "concept": "concept name",
        "explanation": "clear explanation",
        "importance": "High/Medium/Low"
    }
]

Focus on:
- Main research contribution
- Core methodology
- Technical innovations
- Practical applications
- Implementation considerations

Title: ${paper.title}
Abstract: ${paper.abstract}
${paper.metadata?.venue ? `Venue: ${paper.metadata.venue}` : ''}
${paper.code_url ? `Has Implementation: Yes` : ''}`;

            console.log('Sending prompt to AI:', prompt);
            const response = await makeLocalApiRequest('/api/generate', prompt);
            console.log('Raw AI response:', JSON.stringify(response, null, 2));
            
            // Try to parse as JSON first
            let concepts = [];
            if (typeof response === 'string') {
                try {
                    // Look for JSON array in the response
                    const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
                    if (jsonMatch) {
                        concepts = JSON.parse(jsonMatch[0]);
                    } else {
                        // Try to parse markdown format
                        concepts = this.parseMarkdownConcepts(response);
                    }
                } catch (parseError) {
                    console.log('JSON parsing failed, trying markdown format');
                    concepts = this.parseMarkdownConcepts(response);
                }
            } else if (Array.isArray(response)) {
                concepts = response;
            }
            
            if (Array.isArray(concepts) && concepts.length > 0) {
                console.log('Parsed concepts:', JSON.stringify(concepts, null, 2));
                
                const validConcepts = concepts
                    .filter(c => {
                        const isValid = c && typeof c === 'object' && 
                            c.concept && typeof c.concept === 'string' && 
                            c.explanation && typeof c.explanation === 'string' && 
                            c.importance && typeof c.importance === 'string';
                        
                        if (!isValid) {
                            console.log('Invalid concept structure:', JSON.stringify(c, null, 2));
                        }
                        return isValid;
                    })
                    .map(c => ({
                        concept: String(c.concept).trim(),
                        explanation: String(c.explanation).trim(),
                        importance: this.validateImportance(String(c.importance))
                    }));

                console.log('Validated concepts:', JSON.stringify(validConcepts, null, 2));

                if (validConcepts.length > 0) {
                    conceptsCache.set(cacheKey, validConcepts);
                    return validConcepts;
                }
            }

            console.log('Falling back to static concepts generation');
            return this.generateStaticConcepts(paper);
        } catch (error) {
            console.error('Error generating concepts:', error);
            return this.generateStaticConcepts(paper);
        }
    }

    private parseMarkdownConcepts(markdown: string): Array<{
        concept: string;
        explanation: string;
        importance: string;
    }> {
        const concepts: Array<{
            concept: string;
            explanation: string;
            importance: string;
        }> = [];
        
        // Split into sections by numbered items
        const sections = markdown.split(/\d+\.\s+\*\*(?:Concept(?:\s+Name)?:|[^*]+)\*\*/i);
        
        for (const section of sections) {
            if (!section.trim()) continue;
            
            // Extract concept name
            const conceptMatch = section.match(/([^*\n]+?)(?:\*\*|\n|$)/);
            if (!conceptMatch) continue;
            
            // Extract explanation
            const explanationMatch = section.match(/\*\*Explanation\*\*:\s*([^*\n]+?)(?:\n|$)/i);
            
            // Extract importance
            const importanceMatch = section.match(/\*\*Importance\*\*:\s*([^*\n]+?)(?:\n|$)/i);
            
            if (conceptMatch && explanationMatch && importanceMatch) {
                concepts.push({
                    concept: conceptMatch[1].trim(),
                    explanation: explanationMatch[1].trim(),
                    importance: importanceMatch[1].trim()
                });
            }
        }
        
        console.log('Parsed from markdown:', JSON.stringify(concepts, null, 2));
        return concepts;
    }

    private validateImportance(importance: string): 'High' | 'Medium' | 'Low' {
        const normalized = importance.toLowerCase().trim();
        if (normalized.includes('high')) return 'High';
        if (normalized.includes('medium') || normalized.includes('med')) return 'Medium';
        return 'Low';
    }

    private generateStaticConcepts(paper: ResearchResult): Array<{
        concept: string;
        explanation: string;
        importance: 'High' | 'Medium' | 'Low';
    }> {
        const concepts: Array<{
            concept: string;
            explanation: string;
            importance: 'High' | 'Medium' | 'Low';
        }> = [];

        // Add main contribution
        if (paper.title) {
            concepts.push({
                concept: 'Main Contribution',
                explanation: paper.abstract?.split('.')[0] || 'No explanation available',
                importance: 'High' as const
            });
        }

        // Domain detection
        const domainKeywords = {
            'Machine Learning': ['machine learning', 'deep learning', 'neural network', 'ai', 'artificial intelligence'],
            'Computer Vision': ['computer vision', 'image processing', 'object detection', 'segmentation', 'recognition'],
            'Natural Language Processing': ['nlp', 'language model', 'text processing', 'sentiment analysis', 'translation'],
            'Robotics': ['robot', 'automation', 'control system', 'manipulation', 'navigation'],
            'Security': ['security', 'privacy', 'encryption', 'authentication', 'vulnerability'],
            'Data Science': ['data mining', 'analytics', 'big data', 'statistics', 'visualization'],
            'Software Engineering': ['software', 'development', 'testing', 'architecture', 'design pattern']
        };

        const content = `${paper.title} ${paper.abstract}`.toLowerCase();
        for (const [domain, keywords] of Object.entries(domainKeywords)) {
            if (keywords.some(keyword => content.includes(keyword))) {
                concepts.push({
                    concept: `Domain: ${domain}`,
                    explanation: `This research falls under the ${domain} domain, focusing on ${keywords.filter(k => content.includes(k)).join(', ')}`,
                    importance: 'High' as const
                });
                break;
            }
        }

        // Technical components
        if (paper.abstract) {
            const technicalTerms = paper.abstract.match(/[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*|\b(?:CNN|RNN|LSTM|API|GPU|CPU|ML|AI|IoT|AR|VR)\b/g) || [];
            const uniqueTerms = [...new Set(technicalTerms)];
            
            uniqueTerms.slice(0, 2).forEach(term => {
                const sentence = paper.abstract?.split(/[.!?]+/)
                    .find(s => s.includes(term))?.trim() || '';
                
                if (term && sentence) {
                    concepts.push({
                        concept: `Technical Component: ${term}`,
                        explanation: sentence,
                        importance: 'Medium' as const
                    });
                }
            });
        }

        // Implementation details
        if (paper.metadata?.codeRepository) {
            const { language, framework, stars } = paper.metadata.codeRepository;
            const details = [
                language && `Language: ${language}`,
                framework && `Framework: ${framework}`,
                stars && `GitHub Stars: ${stars}`
            ].filter(Boolean).join(', ');

            concepts.push({
                concept: 'Implementation Details',
                explanation: `Available implementation details: ${details}. Code repository is available for reference.`,
                importance: 'Medium' as const
            });
        }

        return concepts;
    }

    async analyzeUploadedPDF(pdfContent: string, fileName: string): Promise<string> {
        try {
            const API_KEY = process.env.OPENROUTER_API_KEY;
            if (!API_KEY) {
                throw new Error('OpenRouter API key is not configured');
            }

            // Extract text from PDF
            const extractedText = await extractTextFromPDF(pdfContent);
            if (!extractedText.trim()) {
                throw new Error('No readable text found in the PDF');
            }

            // Prepare text for analysis
            const preparedText = prepareTextForAnalysis(extractedText);

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'HTTP-Referer': 'https://stingerai.app',
                    'X-Title': 'StingerAI',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek/deepseek-r1-distill-llama-70b:free',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a research paper analyzer. Analyze the provided text and create a concise summary focusing on the main findings, methodology, and conclusions.'
                        },
                        {
                            role: 'user',
                            content: `Please analyze this research document titled "${fileName}":\n\n${preparedText}`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000,
                    stream: false
                })
            });

            const content = await handleOpenRouterResponse(response);
            return content;
        } catch (error) {
            console.error('Error analyzing PDF:', error);
            throw error;
        }
    }

    async askQuestionAboutPDF(pdfContent: string, question: string): Promise<string> {
        try {
            const API_KEY = process.env.OPENROUTER_API_KEY;
            if (!API_KEY) {
                throw new Error('OpenRouter API key is not configured');
            }

            // Extract text from PDF
            const extractedText = await extractTextFromPDF(pdfContent);
            if (!extractedText.trim()) {
                throw new Error('No readable text found in the PDF');
            }

            // Prepare text for analysis
            const preparedText = prepareTextForAnalysis(extractedText);

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'HTTP-Referer': 'https://stingerai.app',
                    'X-Title': 'StingerAI',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek/deepseek-r1-distill-llama-70b:free',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a research paper expert. Answer questions about the provided text with specific references to the content.'
                        },
                        {
                            role: 'user',
                            content: `Context from the research document:\n\n${preparedText}\n\nQuestion: ${question}`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000,
                    stream: false
                })
            });

            const content = await handleOpenRouterResponse(response);
            return content;
        } catch (error) {
            console.error('Error answering PDF question:', error);
            throw error;
        }
    }

    async generateImplementationSteps(paper: ResearchResult): Promise<string[]> {
        // Return basic implementation steps without code generation
            return [
                'Review the paper thoroughly',
                'Understand the key concepts and methodology',
                'Set up the development environment',
                'Implement core components',
                'Test and validate the implementation',
                paper.code_url ? `Reference implementation available at: ${paper.code_url}` : 'No reference implementation available'
            ];
    }

    async assessTechnicalDifficulty(paper: ResearchResult): Promise<{
        level: 'Beginner' | 'Intermediate' | 'Advanced';
        explanation: string;
        prerequisites: string[];
        estimatedTimeToImplement: string;
        technicalSkills: Array<{ skill: string; level: 'Basic' | 'Intermediate' | 'Advanced' }>;
    }> {
        try {
            // First try to get from cache
            const cacheKey = `difficulty-${paper.id}`;
            const cached = difficultyCache.get(cacheKey);
            if (cached) {
                return cached;
            }

            // Generate difficulty assessment using AI
            const prompt = `Analyze this research paper and provide a technical difficulty assessment in the following exact JSON format:
{
    "level": "one of: Beginner, Intermediate, Advanced",
    "explanation": "detailed explanation of why this level was chosen",
    "prerequisites": ["list", "of", "required", "prerequisites"],
    "estimatedTimeToImplement": "Just give a rough estimate of the time to implement in months",
    "technicalSkills": [
        {
            "skill": "name of skill",
            "level": "one of: Basic, Intermediate, Advanced"
        }
    ]
}

Paper Title: ${paper.title}
Abstract: ${paper.abstract || 'No abstract available'}
${paper.metadata?.venue ? `Venue: ${paper.metadata.venue}` : ''}
${paper.code_url ? `Implementation available at: ${paper.code_url}` : 'No implementation available'}`;

            const response = await makeLocalApiRequest('/api/generate', prompt);
            
            // Try to extract JSON from the response
            let assessment;
            if (typeof response === 'string') {
                try {
                    // Look for JSON-like content
                    const jsonMatch = response.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const jsonStr = jsonMatch[0].replace(/\\n/g, ' ').replace(/\s+/g, ' ');
                        assessment = JSON.parse(jsonStr);
                    }
                } catch (e) {
                    console.warn('Failed to parse JSON from response:', e);
                }
            } else if (typeof response === 'object') {
                assessment = response;
            }

            if (assessment && typeof assessment === 'object') {
                // Validate and format the assessment
                const validatedAssessment = {
                    level: this.validateDifficultyLevel(String(assessment.level || '')),
                    explanation: String(assessment.explanation || '').trim(),
                    prerequisites: Array.isArray(assessment.prerequisites) ? 
                        assessment.prerequisites
                            .filter((p: unknown): p is string => typeof p === 'string' && p.trim().length > 0)
                            .map((p: string) => p.trim()) : [],
                    estimatedTimeToImplement: String(assessment.estimatedTimeToImplement || '').trim(),
                    technicalSkills: Array.isArray(assessment.technicalSkills) ?
                        assessment.technicalSkills
                            .filter((skill: any) => 
                                skill && 
                                typeof skill.skill === 'string' && 
                                typeof skill.level === 'string'
                            )
                            .map((skill: { skill: string; level: string }) => ({
                                skill: String(skill.skill).trim(),
                                level: this.validateSkillLevel(String(skill.level))
                        })) : []
                };

                // Only use the AI response if it has valid content
                if (validatedAssessment.level && 
                    validatedAssessment.explanation.length > 20 && 
                    validatedAssessment.prerequisites.length > 0 &&
                    validatedAssessment.estimatedTimeToImplement.length > 0) {
                difficultyCache.set(cacheKey, validatedAssessment);
                return validatedAssessment;
                }
            }

            // If we get here, either parsing failed or validation failed
            // Fall back to static analysis
            return this.generateStaticDifficultyAssessment(paper);
        } catch (error) {
            console.error('Error assessing technical difficulty:', error);
            return this.generateStaticDifficultyAssessment(paper);
        }
    }

    private validateDifficultyLevel(level: string): 'Beginner' | 'Intermediate' | 'Advanced' {
        const normalized = level.toLowerCase().trim();
        if (normalized.includes('begin')) return 'Beginner';
        if (normalized.includes('adv')) return 'Advanced';
        return 'Intermediate';
    }

    private validateSkillLevel(level: string): 'Basic' | 'Intermediate' | 'Advanced' {
        const normalized = level.toLowerCase().trim();
        if (normalized.includes('basic') || normalized.includes('begin')) return 'Basic';
        if (normalized.includes('adv')) return 'Advanced';
        return 'Intermediate';
    }

    private generateStaticDifficultyAssessment(paper: ResearchResult): {
        level: 'Beginner' | 'Intermediate' | 'Advanced';
        explanation: string;
        prerequisites: string[];
        estimatedTimeToImplement: string;
        technicalSkills: Array<{ skill: string; level: 'Basic' | 'Intermediate' | 'Advanced' }>;
    } {
        // Determine base difficulty from content
        const content = `${paper.title} ${paper.abstract}`.toLowerCase();
        let level: 'Beginner' | 'Intermediate' | 'Advanced' = 'Intermediate';
        const prerequisites: string[] = [];
        const technicalSkills: Array<{ skill: string; level: 'Basic' | 'Intermediate' | 'Advanced' }> = [];

        // Check for advanced concepts
        const advancedKeywords = [
            'deep learning', 'neural network', 'transformer', 'reinforcement learning',
            'quantum', 'distributed', 'parallel', 'optimization', 'bayesian'
        ];
        
        const intermediateKeywords = [
            'machine learning', 'classification', 'regression', 'clustering',
            'api', 'database', 'cloud', 'web', 'mobile'
        ];

        // Determine difficulty level
        if (advancedKeywords.some(keyword => content.includes(keyword))) {
            level = 'Advanced';
        } else if (!intermediateKeywords.some(keyword => content.includes(keyword))) {
            level = 'Beginner';
        }

        // Add domain-specific prerequisites
        if (content.includes('machine learning') || content.includes('deep learning')) {
            prerequisites.push(
                'Strong mathematics background',
                'Experience with ML frameworks',
                'Understanding of ML concepts'
            );
            technicalSkills.push(
                { skill: 'Mathematics', level: 'Advanced' },
                { skill: 'Machine Learning', level: 'Intermediate' },
                { skill: 'Python Programming', level: 'Intermediate' }
            );
        }

        if (content.includes('computer vision')) {
            prerequisites.push(
                'Image processing knowledge',
                'Experience with CV libraries'
            );
            technicalSkills.push(
                { skill: 'Computer Vision', level: 'Intermediate' },
                { skill: 'OpenCV', level: 'Basic' }
            );
        }

        // Add implementation-specific requirements
        if (paper.metadata?.codeRepository) {
            const { language, framework } = paper.metadata.codeRepository;
            if (language) {
                prerequisites.push(`${language} programming experience`);
                technicalSkills.push({
                    skill: language,
                    level: 'Intermediate'
                });
            }
            if (framework) {
                prerequisites.push(`Experience with ${framework}`);
                technicalSkills.push({
                    skill: framework,
                    level: 'Basic'
                });
            }
        }

        // Set implementation time based on difficulty level
        const implementationTimes = {
            'Beginner': '1-2 weeks',
            'Intermediate': '2-4 weeks',
            'Advanced': '1-3 months'
        } as const;

        return {
            level,
            explanation: `This ${level.toLowerCase()}-level implementation requires specific technical expertise and domain knowledge. ${
                paper.code_url ? 'Reference implementation is available to guide the development.' : 'No reference implementation is available.'
            }`,
            prerequisites: [...new Set(prerequisites)],
            estimatedTimeToImplement: implementationTimes[level],
            technicalSkills: [...new Map(technicalSkills.map(item => [item.skill, item])).values()]
        };
    }

    async generateCodeSnippets(paper: ResearchResult): Promise<Array<{
        title: string;
        description: string;
        code: string;
        language: string;
    }>> {
        // Return only reference to official implementation if available
            if (paper.code_url) {
            return [{
                    title: 'Reference Implementation',
                    description: 'Official implementation is available in the code repository.',
                    code: `// Please visit the code repository at:\n// ${paper.code_url}`,
                    language: paper.metadata.codeRepository?.language || 'plaintext'
            }];
        }
        return [];
    }

    // Cache management
    async getCachedResults(query: string) {
        try {
            const cacheKey = `${CACHE_PREFIX}${query}`;
            const cached = await AsyncStorage.getItem(cacheKey);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_EXPIRY) {
                    return data;
                }
            }
            return null;
        } catch (error) {
            console.warn('Cache read error:', error);
            return null;
        }
    }

    async cacheResults(query: string, data: any) {
        try {
            const cacheKey = `${CACHE_PREFIX}${query}`;
            await AsyncStorage.setItem(cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn('Cache write error:', error);
        }
    }

    // Improved PwC API call with exponential backoff
    async searchPapersWithCode(query: string, attempt = 1): Promise<any[]> {
        try {
            // Check cache first
            const cached = await this.getCachedResults(query);
            if (cached) {
                console.log('Returning cached results for:', query);
                return cached;
            }

            const response = await fetch(`${PAPERS_WITH_CODE_API}/papers/?q=${encodeURIComponent(query)}`, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'StingerAI Research Tool/1.0'
                }
            });

            if (!response.ok) {
                if (response.status === 429 && attempt <= MAX_RETRIES) {
                    const delay = Math.min(BASE_DELAY * Math.pow(2, attempt - 1), MAX_DELAY);
                    console.log(`Rate limit hit, retrying in ${delay/1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.searchPapersWithCode(query, attempt + 1);
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            // Cache successful results
            await this.cacheResults(query, data.results || []);
            return data.results || [];
        } catch (error) {
            console.warn('PwC API error:', error);
            // On final failure, try to return cached results even if expired
            const cached = await this.getCachedResults(query);
            return cached || [];
        }
    }

    // Transform Semantic Scholar result to our format
    private transformSemanticScholarResult(paper: any): ResearchResult {
        return {
            id: `ss-${paper.paperId}`,  // Add 'ss-' prefix for Semantic Scholar papers
            title: paper.title || 'Untitled',
            abstract: paper.abstract || '',
            pdf_url: paper.url,
            metadata: {
                source: 'semantic_scholar',
                semanticScholarId: paper.paperId,
                authors: paper.authors?.map((a: any) => ({
                    name: a.name,
                    id: a.authorId
                })) || [],
                year: paper.year,
                venue: paper.venue,
                citations: paper.citationCount
            }
        };
    }

    // Transform PwC paper details
    private transformPapersWithCodeResult(paper: any): ResearchResult {
        const id = paper.id || paper.paper_id || `pwc-${paper.title?.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const publishedYear = paper.published ? new Date(paper.published).getFullYear() : undefined;
        
        const authors = Array.isArray(paper.authors) 
            ? paper.authors.map((author: string | { name: string }) => ({
                name: typeof author === 'string' ? author : author.name,
                id: undefined
            }))
            : typeof paper.authors === 'string'
                ? [{ name: paper.authors, id: undefined }]
                : [];

        return {
            id: `pwc-${id}`,
            title: paper.title || 'Untitled',
            abstract: paper.abstract || '',
            pdf_url: paper.url_pdf || paper.paper_url || paper.url,
            code_url: paper.repository?.url || paper.repo_url,
            metadata: {
                source: 'papers_with_code',
                authors,
                year: publishedYear,
                venue: paper.conference || paper.journal || '',
                codeRepository: paper.repository ? {
                    repository_url: paper.repository.url,
                    stars: paper.repository.stars,
                    framework: paper.repository.framework,
                    language: paper.repository.programming_language || paper.repository.language
                } : undefined
            }
        };
    }
}

// Create and export a singleton instance
export const researchService = new ResearchService(); 