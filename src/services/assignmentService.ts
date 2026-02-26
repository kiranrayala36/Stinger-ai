import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { handleError, AppError } from '../utils/errorHandler';

interface GenerateAnswersParams {
    topic: string;
    questions: string[];
    length: 'Short' | 'Medium' | 'Long';
    style: 'Simple' | 'Professional' | 'Exam-style';
    instructions?: string;
}

interface SaveAnswersParams {
    topic: string;
    questions: Array<{
        question: string;
        answer: string;
    }>;
    length: 'Short' | 'Medium' | 'Long';
    style: 'Simple' | 'Professional' | 'Exam-style';
}

interface AssignmentService {
    generateAnswers(params: GenerateAnswersParams): Promise<{ [key: string]: string }>;
    saveAnswers(params: SaveAnswersParams): Promise<void>;
    getSavedAnswers(): Promise<Array<{
        id: string;
        topic: string;
        questions: Array<{
            question: string;
            answer: string;
        }>;
        length: string;
        style: string;
        created_at: string;
    }>>;
    extractQuestionsFromPDF(pdfContent: string): Promise<string[]>;
    deleteSavedAnswer(id: string): Promise<void>;
    checkSupabaseClient: () => any;
}

export const assignmentService: AssignmentService = {
    checkSupabaseClient: () => {
        if (!supabase) {
            throw new Error('Supabase client is not initialized for AssignmentService. Check your environment variables.');
        }
        return supabase;
    },

    async generateAnswers(params: GenerateAnswersParams): Promise<{ [key: string]: string }> {
        try {
            const API_KEY = process.env.OPENROUTER_API_KEY;
            if (!API_KEY) {
                const error = new AppError('OpenRouter API key is not configured', { code: 'ENV_ERROR', hint: 'Check your .env file for OPENROUTER_API_KEY.' });
                throw handleError(error, 'AssignmentService:generateAnswers');
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
                            content: `You are an expert assignment helper. ${params.instructions || `Generate ${params.length.toLowerCase()} answers in a ${params.style.toLowerCase()} style.`} Each answer should be well-structured and appropriate for the selected length.`
                        },
                        {
                            role: 'user',
                            content: `Topic: ${params.topic}\n\nQuestions:\n${params.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nPlease provide answers for each question.`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                const error = new AppError(`Failed to generate answers: ${errorData.message || response.statusText}`, {
                    code: response.status.toString(),
                    details: JSON.stringify(errorData),
                    originalError: new Error(`HTTP Error: ${response.status} ${response.statusText}`)
                });
                throw handleError(error, 'AssignmentService:generateAnswers');
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            
            if (!content) {
                const error = new AppError('No content in response from OpenRouter API', { details: 'API response did not contain expected content.' });
                throw handleError(error, 'AssignmentService:generateAnswers');
            }

            const answers: { [key: string]: string } = {};
            const answerBlocks = content.split(/\d+\./).filter((block: string) => block.trim());
            
            params.questions.forEach((question, index) => {
                if (answerBlocks[index]) {
                    answers[question] = answerBlocks[index].trim();
                }
            });

            return answers;
        } catch (error) {
            throw handleError(error, 'AssignmentService:generateAnswers');
        }
    },

    async saveAnswers(params: SaveAnswersParams): Promise<void> {
        try {
            const client = assignmentService.checkSupabaseClient();
            const { data: user } = await client.auth.getUser();
            if (!user.user) {
                throw handleError(new AppError('User not authenticated', { code: 'AUTH_ERROR', hint: 'User must be logged in to save answers.' }), 'AssignmentService:saveAnswers');
            }

            // Validate the data before sending
            if (!params.questions || params.questions.length === 0) {
                throw handleError(new AppError('No questions to save', { code: 'VALIDATION_ERROR', hint: 'Provide at least one question.' }), 'AssignmentService:saveAnswers');
            }

            // Ensure all required fields are present and properly formatted
            const questions = params.questions.map(q => ({
                question: q.question?.trim() || '',
                answer: q.answer?.trim() || ''
            })).filter(q => q.question && q.answer);

            if (questions.length === 0) {
                throw handleError(new AppError('No valid questions to save', { code: 'VALIDATION_ERROR', hint: 'Ensure questions and answers are not empty.' }), 'AssignmentService:saveAnswers');
            }

            // Log the data being sent to help with debugging
            console.log('Saving answers with data:', {
                user_id: user.user.id,
                topic: params.topic,
                questions,
                length: params.length,
                style: params.style
            });

            const { data, error } = await client
                .from('assignment_answers')
                .insert({
                    user_id: user.user.id,
                    topic: params.topic,
                    questions: questions,
                    length: params.length,
                    style: params.style,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                let appError;
                if (error.code === '23505') {
                    appError = new AppError('Duplicate entry detected', { code: error.code, details: error.message, hint: error.hint });
                } else if (error.code === '23503') {
                    appError = new AppError('Invalid user reference', { code: error.code, details: error.message, hint: error.hint });
                } else if (error.code === '22P02') {
                    appError = new AppError('Invalid data format', { code: error.code, details: error.message, hint: error.hint });
                } else {
                    appError = new AppError(`Database error: ${error.message || 'Unknown error'}`, { code: error.code, details: error.details, hint: error.hint });
                }
                throw handleError(appError, 'AssignmentService:saveAnswers');
            }

            if (!data) {
                throw handleError(new AppError('No data returned after insert', { details: 'Supabase insert operation returned no data.' }), 'AssignmentService:saveAnswers');
            }

            console.log('Successfully saved answers:', data);
        } catch (error) {
            throw handleError(error, 'AssignmentService:saveAnswers');
        }
    },

    async getSavedAnswers(): Promise<Array<{
        id: string;
        topic: string;
        questions: Array<{
            question: string;
            answer: string;
        }>;
        length: string;
        style: string;
        created_at: string;
    }>> {
        try {
            const client = assignmentService.checkSupabaseClient();
            const { data: user } = await client.auth.getUser();
            if (!user.user) {
                throw handleError(new AppError('User not authenticated', { code: 'AUTH_ERROR', hint: 'User must be logged in to retrieve answers.' }), 'AssignmentService:getSavedAnswers');
            }

            const { data, error } = await client
                .from('assignment_answers')
                .select('*')
                .eq('user_id', user.user.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw handleError(new AppError(`Database error: ${error.message || 'Unknown error'}`, { code: error.code, details: error.details, hint: error.hint }), 'AssignmentService:getSavedAnswers');
            }
            return data || [];
        } catch (error) {
            throw handleError(error, 'AssignmentService:getSavedAnswers');
        }
    },

    async extractQuestionsFromPDF(pdfContent: string): Promise<string[]> {
        try {
            if (!pdfContent || typeof pdfContent !== 'string') {
                throw handleError(new AppError('Invalid PDF content provided', { code: 'VALIDATION_ERROR', hint: 'PDF content must be a non-empty string.' }), 'AssignmentService:extractQuestionsFromPDF');
            }

            // Check if content appears to be raw PDF data
            const isPDFStream = pdfContent.includes('stream') && 
                              (pdfContent.includes('endstream') || 
                               pdfContent.includes('endobj') ||
                               /obj\s*<</.test(pdfContent));

            if (isPDFStream) {
                throw handleError(new AppError('Raw PDF data detected. Please ensure the PDF is properly converted to text before processing.', { code: 'PROCESSING_ERROR', hint: 'Convert PDF to text using a library before passing it to this function.' }), 'AssignmentService:extractQuestionsFromPDF');
            }

            // Clean and prepare the content
            const cleanedContent = pdfContent
                // Remove PDF-specific markers and artifacts
                .replace(/<<\/[^>]+>>/g, '') // Remove PDF dictionary entries
                .replace(/\d+\s+\d+\s+obj[\s\S]*?endobj/g, '') // Remove PDF object definitions
                .replace(/stream[\s\S]*?endstream/g, '') // Remove PDF streams
                .replace(/xref[\s\S]*?%%EOF/g, '') // Remove PDF cross-reference tables
                .replace(/[^\x20-\x7E\n]/g, ' ') // Replace non-printable characters
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();

            if (!cleanedContent || cleanedContent.length < 10) {
                throw handleError(new AppError('No readable text content found in PDF', { code: 'PROCESSING_ERROR', hint: 'The PDF may be scanned or empty.' }), 'AssignmentService:extractQuestionsFromPDF');
            }

            // Implement question extraction logic here
            // This is a placeholder for your actual PDF text processing logic
            const questions = cleanedContent.split('\n').filter(line => line.endsWith('?') || line.endsWith('.') || line.length > 20);
            
            if (questions.length === 0) {
                throw handleError(new AppError('No questions could be extracted from the PDF content.', { code: 'EXTRACTION_ERROR', hint: 'The content might not contain discernible questions.' }), 'AssignmentService:extractQuestionsFromPDF');
            }

            return questions;
        } catch (error) {
            throw handleError(error, 'AssignmentService:extractQuestionsFromPDF');
        }
    },

    async deleteSavedAnswer(id: string): Promise<void> {
        try {
            const client = assignmentService.checkSupabaseClient();
            const { data: user } = await client.auth.getUser();
            if (!user.user) {
                throw handleError(new AppError('User not authenticated', { code: 'AUTH_ERROR', hint: 'User must be logged in to delete answers.' }), 'AssignmentService:deleteSavedAnswer');
            }

            if (!id) {
                throw handleError(new AppError('Assignment ID is required for deletion.', { code: 'VALIDATION_ERROR', hint: 'Provide a valid assignment ID.' }), 'AssignmentService:deleteSavedAnswer');
            }

            const { error } = await client
                .from('assignment_answers')
                .delete()
                .eq('id', id)
                .eq('user_id', user.user.id);

            if (error) {
                throw handleError(new AppError(`Database error during deletion: ${error.message || 'Unknown error'}`, { code: error.code, details: error.details, hint: error.hint }), 'AssignmentService:deleteSavedAnswer');
            }
        } catch (error) {
            throw handleError(error, 'AssignmentService:deleteSavedAnswer');
        }
    }
}; 