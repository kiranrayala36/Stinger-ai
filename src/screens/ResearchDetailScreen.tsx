import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Linking,
    RefreshControl,
    Share,
    Platform,
    Animated,
    Dimensions,
    Pressable
} from 'react-native';
import { researchService } from '../services/researchService';
import { ResearchResult } from '../types/research';
import { RouteProp, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PDFViewer } from '../components/PDFViewer';
import { bookmarkService } from '../services/bookmarkService';

type RootStackParamList = {
    ResearchDetail: { paperId: string; paperData: ResearchResult };
};

type ResearchDetailRouteProp = RouteProp<RootStackParamList, 'ResearchDetail'>;

const { width } = Dimensions.get('window');

const TabIndicator = ({ activeTab }: { activeTab: string }) => {
    const translateX = new Animated.Value(0);

    useEffect(() => {
        Animated.spring(translateX, {
            toValue: activeTab === 'overview' ? 0 : activeTab === 'insights' ? width / 3 : (width / 3) * 2,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
        }).start();
    }, [activeTab]);

    return (
        <Animated.View
            style={[
                styles.tabIndicator,
                {
                    transform: [{ translateX }],
                },
            ]}
        />
    );
};

export const ResearchDetailScreen = () => {
    const route = useRoute<ResearchDetailRouteProp>();
    const { paperId, paperData } = route.params;

    const [paper, setPaper] = useState<ResearchResult | null>(paperData);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAskingQuestion, setIsAskingQuestion] = useState(false);
    const [showFullAbstract, setShowFullAbstract] = useState(false);
    const [showFullAnalysis, setShowFullAnalysis] = useState(false);
    const [showQuestionInput, setShowQuestionInput] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [keyInsights, setKeyInsights] = useState<string[]>([]);
    const [implementationSteps, setImplementationSteps] = useState<string[]>([]);
    const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
    const [isGeneratingImplementation, setIsGeneratingImplementation] = useState(false);
    const [technicalDifficulty, setTechnicalDifficulty] = useState<{
        level: 'Beginner' | 'Intermediate' | 'Advanced';
        explanation: string;
        prerequisites: string[];
        estimatedTimeToImplement: string;
        technicalSkills: Array<{ skill: string; level: 'Basic' | 'Intermediate' | 'Advanced' }>;
    } | null>(null);
    const [keyConcepts, setKeyConcepts] = useState<Array<{
        concept: string;
        explanation: string;
        importance: 'High' | 'Medium' | 'Low';
    }>>([]);
    const [codeSnippets, setCodeSnippets] = useState<Array<{
        title: string;
        description: string;
        code: string;
        language: string;
    }>>([]);
    const [isLoadingDifficulty, setIsLoadingDifficulty] = useState(false);
    const [isLoadingConcepts, setIsLoadingConcepts] = useState(false);
    const [isLoadingCode, setIsLoadingCode] = useState(false);
    const [showPDF, setShowPDF] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);

    const fadeAnim = new Animated.Value(0);
    const slideAnim = new Animated.Value(50);

    useEffect(() => {
        fadeAnim.setValue(0);
        slideAnim.setValue(50);
        loadPaper();
        checkBookmarkStatus();
    }, [paperId]);

    useEffect(() => {
        if (paper) {
            loadTechnicalDifficulty();
            loadKeyConcepts();
            loadCodeSnippets();
        }
    }, [paper]);

    const animateContent = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const loadPaper = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // If we already have the paper data, generate all analyses
            if (paperData) {
                const analysis = `Analysis of ${paperData.title}:\n\n${
                    paperData.abstract ? 
                    `Key findings from the abstract:\n${paperData.abstract}\n\n` : 
                    'No abstract available.\n\n'
                }${
                    paperData.metadata?.citations ? 
                    `This paper has been cited ${paperData.metadata.citations} times.\n` : 
                    ''
                }${
                    paperData.code_url ? 
                    `Implementation code is available at: ${paperData.code_url}` : 
                    'No implementation code found.'
                }`;
                setAnalysis(analysis);
                setPaper(paperData);
                
                // Set loading states
                setIsGeneratingInsights(true);
                setIsGeneratingImplementation(true);
                setIsLoadingDifficulty(true);
                setIsLoadingConcepts(true);
                setIsLoadingCode(true);

                try {
                    // Load insights
                    const insights = await researchService.generateKeyInsights(paperData);
                    setKeyInsights(insights);
                    setIsGeneratingInsights(false);

                    // Load implementation steps
                    const steps = await researchService.generateImplementationSteps(paperData);
                    setImplementationSteps(steps);
                    setIsGeneratingImplementation(false);

                    // Load technical difficulty
                    const difficulty = await researchService.assessTechnicalDifficulty(paperData);
                    setTechnicalDifficulty(difficulty);
                    setIsLoadingDifficulty(false);

                    // Load key concepts
                    const concepts = await researchService.explainKeyConcepts(paperData);
                    setKeyConcepts(concepts);
                    setIsLoadingConcepts(false);

                    // Load code snippets
                    const snippets = await researchService.generateCodeSnippets(paperData);
                    setCodeSnippets(snippets);
                    setIsLoadingCode(false);
                } catch (analysisError) {
                    console.error('Error loading analyses:', analysisError);
                } finally {
                    // Reset loading states in case of error
                    setIsGeneratingInsights(false);
                    setIsGeneratingImplementation(false);
                    setIsLoadingDifficulty(false);
                    setIsLoadingConcepts(false);
                    setIsLoadingCode(false);
                }
            } else {
                // Fallback to fetching if somehow paperData is not available
                const result = await researchService.analyzePaper(paperId);
                setPaper(result.paper);
                setAnalysis(result.analysis);
                
                if (result.paper) {
                    // Set loading states
                    setIsGeneratingInsights(true);
                    setIsGeneratingImplementation(true);
                    setIsLoadingDifficulty(true);
                    setIsLoadingConcepts(true);
                    setIsLoadingCode(true);

                    try {
                        // Load insights
                        const insights = await researchService.generateKeyInsights(result.paper);
                        setKeyInsights(insights);
                        setIsGeneratingInsights(false);

                        // Load implementation steps
                        const steps = await researchService.generateImplementationSteps(result.paper);
                        setImplementationSteps(steps);
                        setIsGeneratingImplementation(false);

                        // Load technical difficulty
                        const difficulty = await researchService.assessTechnicalDifficulty(result.paper);
                        setTechnicalDifficulty(difficulty);
                        setIsLoadingDifficulty(false);

                        // Load key concepts
                        const concepts = await researchService.explainKeyConcepts(result.paper);
                        setKeyConcepts(concepts);
                        setIsLoadingConcepts(false);

                        // Load code snippets
                        const snippets = await researchService.generateCodeSnippets(result.paper);
                        setCodeSnippets(snippets);
                        setIsLoadingCode(false);
                    } catch (analysisError) {
                        console.error('Error loading analyses:', analysisError);
                    } finally {
                        // Reset loading states in case of error
                        setIsGeneratingInsights(false);
                        setIsGeneratingImplementation(false);
                        setIsLoadingDifficulty(false);
                        setIsLoadingConcepts(false);
                        setIsLoadingCode(false);
                    }
                }
            }
            
            animateContent();
        } catch (err) {
            console.error('Error loading paper:', err);
            setError(err instanceof Error ? err.message : 'Failed to load paper details');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadPaper();
        setRefreshing(false);
    };

    const handleAskQuestion = async () => {
        if (!question.trim()) return;

        setIsAskingQuestion(true);
        setError(null);

        try {
            const response = await researchService.askImplementationQuestion(paperId, question);
            setAnswer(response);
            setQuestion('');
            setShowQuestionInput(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred while processing your question');
        } finally {
            setIsAskingQuestion(false);
        }
    };

    const openUrl = async () => {
        if (paper?.pdf_url) {
            await Linking.openURL(paper.pdf_url);
        }
    };

    const openCode = async () => {
        if (paper?.code_url) {
            await Linking.openURL(paper.code_url);
        }
    };

    const sharePaper = async () => {
        if (!paper) return;

        try {
            await Share.share({
                message: `Check out this research paper: ${paper.title}\n\nAuthors: ${paper.metadata.authors.join(', ')}\nYear: ${paper.metadata.year}\nVenue: ${paper.metadata.venue}\n\nAbstract: ${paper.abstract}\n\n${paper.pdf_url ? `PDF: ${paper.pdf_url}` : ''}${paper.code_url ? `\nCode: ${paper.code_url}` : ''}`,
                title: paper.title
            });
        } catch (error) {
            console.error('Error sharing paper:', error);
        }
    };

    const loadTechnicalDifficulty = async () => {
        if (!paper) return;
        try {
            setIsLoadingDifficulty(true);
            const difficulty = await researchService.assessTechnicalDifficulty(paper);
            setTechnicalDifficulty(difficulty);
        } catch (error) {
            console.error('Error loading technical difficulty:', error);
        } finally {
            setIsLoadingDifficulty(false);
        }
    };

    const loadKeyConcepts = async () => {
        if (!paper) return;
        try {
            setIsLoadingConcepts(true);
            const concepts = await researchService.explainKeyConcepts(paper);
            console.log('Received concepts in UI:', JSON.stringify(concepts, null, 2));
            setKeyConcepts(concepts);
        } catch (error) {
            console.error('Error loading key concepts:', error);
        } finally {
            setIsLoadingConcepts(false);
        }
    };

    const loadCodeSnippets = async () => {
        if (!paper) return;
        try {
            setIsLoadingCode(true);
            const snippets = await researchService.generateCodeSnippets(paper);
            setCodeSnippets(snippets);
        } catch (error) {
            console.error('Error loading code snippets:', error);
        } finally {
            setIsLoadingCode(false);
        }
    };

    const checkBookmarkStatus = async () => {
        try {
            const bookmarked = await bookmarkService.isBookmarked(paperId);
            setIsBookmarked(bookmarked);
        } catch (error) {
            console.error('Error checking bookmark status:', error);
        }
    };

    const handleBookmarkToggle = async () => {
        if (!paper) return;
        
        try {
            const isNowBookmarked = await bookmarkService.toggleBookmark(paper);
            setIsBookmarked(isNowBookmarked);
        } catch (error) {
            console.error('Error toggling bookmark:', error);
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Abstract</Text>
                            <Text 
                                style={styles.abstract}
                                numberOfLines={showFullAbstract ? undefined : 3}
                            >
                                {paper?.abstract || 'No abstract available'}
                            </Text>
                            {paper?.abstract && paper.abstract.length > 150 && (
                                <TouchableOpacity
                                    style={styles.readMoreButton}
                                    onPress={() => setShowFullAbstract(!showFullAbstract)}
                                >
                                    <Text style={styles.readMoreText}>
                                        {showFullAbstract ? 'Show Less' : 'Read More'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {technicalDifficulty && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Technical Difficulty</Text>
                                {isLoadingDifficulty ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="small" color="#2563EB" />
                                        <Text style={styles.loadingText}>Analyzing paper complexity and requirements...</Text>
                                        <Text style={styles.loadingSubText}>This may take a moment as we assess the technical aspects of the paper.</Text>
                                    </View>
                                ) : (
                                    <>
                                        <View style={styles.difficultyHeader}>
                                            <Text style={[
                                                styles.difficultyLevel,
                                                { color: getDifficultyColor(technicalDifficulty.level) }
                                            ]}>
                                                {technicalDifficulty.level}
                                            </Text>
                                        </View>
                                        <Text style={styles.difficultyExplanation}>
                                            {technicalDifficulty.explanation}
                                        </Text>
                                        <Text style={styles.prerequisitesTitle}>Prerequisites:</Text>
                                        {technicalDifficulty.prerequisites && technicalDifficulty.prerequisites.length > 0 ? (
                                            technicalDifficulty.prerequisites.map((prerequisite, index) => (
                                                <View key={index} style={styles.prerequisiteItem}>
                                                    <Icon name="check-circle" size={16} color="#2563EB" style={styles.prerequisiteIcon} />
                                                    <Text style={styles.prerequisiteText}>{prerequisite}</Text>
                                                </View>
                                            ))
                                        ) : (
                                            <Text style={styles.prerequisiteText}>No prerequisites specified</Text>
                                        )}
                                        {technicalDifficulty.estimatedTimeToImplement && (
                                            <View style={styles.timeEstimate}>
                                                <Text style={styles.timeEstimateLabel}>Estimated Time:</Text>
                                                <Text style={styles.timeEstimateValue}>{technicalDifficulty.estimatedTimeToImplement}</Text>
                                            </View>
                                        )}
                                        {technicalDifficulty.technicalSkills && technicalDifficulty.technicalSkills.length > 0 && (
                                            <View style={styles.technicalSkillsContainer}>
                                                <Text style={styles.prerequisitesTitle}>Required Technical Skills:</Text>
                                                {technicalDifficulty.technicalSkills.map((skill, index) => (
                                                    <View key={index} style={styles.skillItem}>
                                                        <View style={styles.skillHeader}>
                                                            <Text style={styles.skillName}>{skill.skill}</Text>
                                                            <View style={[
                                                                styles.skillLevelBadge,
                                                                { backgroundColor: getSkillLevelColor(skill.level) }
                                                            ]}>
                                                                <Text style={styles.skillLevelText}>{skill.level}</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </>
                                )}
                            </View>
                        )}

                        {Array.isArray(keyConcepts) && keyConcepts.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Key Concepts</Text>
                                {isLoadingConcepts ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="small" color="#2563EB" />
                                        <Text style={styles.loadingText}>Analyzing concepts...</Text>
                                    </View>
                                ) : (
                                    keyConcepts.map((concept, index) => {
                                        console.log(`Rendering concept ${index + 1} of ${keyConcepts.length}:`, JSON.stringify(concept, null, 2));
                                        return (
                                            <View key={index} style={styles.conceptItem}>
                                                <View style={styles.conceptHeader}>
                                                    <Text style={styles.conceptTitle}>{concept?.concept || ''}</Text>
                                                    <View style={[
                                                        styles.importanceBadge,
                                                        { backgroundColor: getImportanceColor(concept?.importance || 'Low') }
                                                    ]}>
                                                        <Text style={styles.importanceText}>{concept?.importance || 'Low'}</Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.conceptExplanation}>{concept?.explanation || ''}</Text>
                                            </View>
                                        );
                                    })
                                )}
                            </View>
                        )}
                    </>
                );
            case 'insights':
                return (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Key Insights</Text>
                        {isGeneratingInsights ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color="#2563EB" />
                                <Text style={styles.loadingText}>Generating insights...</Text>
                            </View>
                        ) : (
                            Array.isArray(keyInsights) && keyInsights.map((insight, index) => (
                                <View key={index} style={styles.insightItem}>
                                    <Icon name="lightbulb" size={20} color="#FFD700" style={styles.insightIcon} />
                                    <Text style={styles.insightText}>{insight || ''}</Text>
                                </View>
                            ))
                        )}
                    </View>
                );
            case 'implementation':
                return (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Implementation Guide</Text>
                        {isGeneratingImplementation ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color="#2563EB" />
                                <Text style={styles.loadingText}>Generating implementation steps...</Text>
                            </View>
                        ) : (
                            <>
                                {paper?.code_url && (
                                    <TouchableOpacity 
                                        style={styles.codeLinkButton}
                                        onPress={openCode}
                                    >
                                        <Icon name="code" size={20} color="#fff" style={styles.buttonIcon} />
                                        <Text style={styles.codeLinkText}>View Official Implementation</Text>
                                    </TouchableOpacity>
                                )}

                                {Array.isArray(implementationSteps) && implementationSteps.map((step, index) => (
                                    <View key={index} style={styles.stepItem}>
                                        <View style={styles.stepNumber}>
                                            <Text style={styles.stepNumberText}>{index + 1}</Text>
                                        </View>
                                        <Text style={styles.stepText}>{step || ''}</Text>
                                    </View>
                                ))}

                                <View style={styles.comingSoonContainer}>
                                    <Icon name="rocket-launch" size={40} color="#2563EB" />
                                    <Text style={styles.comingSoonText}>Advanced Features Coming Soon!</Text>
                                    <Text style={styles.comingSoonSubtext}>
                                        We're working on adding more advanced implementation features including:
                                        {'\n'}• Interactive code examples
                                        {'\n'}• Step-by-step tutorials
                                        {'\n'}• Performance optimization guides
                                        {'\n'}• Best practices and tips
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>
                );
            default:
                return null;
        }
    };

    const getDifficultyColor = (level: string) => {
        switch (level) {
            case 'Beginner': return '#4CAF50';
            case 'Intermediate': return '#FFA000';
            case 'Advanced': return '#F44336';
            default: return '#2563EB';
        }
    };

    const getImportanceColor = (importance: string) => {
        switch (importance) {
            case 'High': return 'rgba(244, 67, 54, 0.1)';
            case 'Medium': return 'rgba(255, 160, 0, 0.1)';
            case 'Low': return 'rgba(76, 175, 80, 0.1)';
            default: return 'rgba(37, 99, 235, 0.1)';
        }
    };

    const getSkillLevelColor = (level: string) => {
        switch (level) {
            case 'Basic': return 'rgba(76, 175, 80, 0.1)';
            case 'Intermediate': return 'rgba(255, 160, 0, 0.1)';
            case 'Advanced': return 'rgba(244, 67, 54, 0.1)';
            default: return 'rgba(37, 99, 235, 0.1)';
        }
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

        if (!content) {
            throw new Error('No content found in OpenRouter API response');
        }

        return content;
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>Analyzing Paper Details</Text>
                <Text style={styles.loadingSubText}>
                    We're gathering comprehensive information about this paper, including:
                </Text>
                <View style={styles.loadingDetailsList}>
                    <Text style={styles.loadingDetailsItem}>• Technical difficulty assessment</Text>
                    <Text style={styles.loadingDetailsItem}>• Implementation prerequisites</Text>
                    <Text style={styles.loadingDetailsItem}>• Key concepts and insights</Text>
                    <Text style={styles.loadingDetailsItem}>• Code examples and references</Text>
                </View>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Icon name="error-outline" size={48} color="#FF5B5B" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadPaper}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!paper) {
        return (
            <View style={styles.errorContainer}>
                <Icon name="search-off" size={48} color="#FF5B5B" />
                <Text style={styles.errorText}>Paper not found</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadPaper}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>{paper.title}</Text>
                    <Text style={styles.authors}>
                        {Array.isArray(paper.metadata?.authors) 
                            ? paper.metadata.authors.map(author => author?.name || '').filter(Boolean).join(', ') 
                            : 'Unknown Authors'} • {paper.metadata?.year || 'N/A'}
                    </Text>
                    <Text style={styles.venue}>{paper.metadata?.venue || 'No venue information'}</Text>
                    <View style={styles.actionButtons}>
                        {paper.pdf_url && (
                            <TouchableOpacity style={styles.actionButton} onPress={openUrl}>
                                <Icon name="open-in-browser" size={16} color="#fff" style={styles.buttonIcon} />
                                <Text style={styles.actionButtonText}>Visit Site</Text>
                            </TouchableOpacity>
                        )}
                        {paper.code_url && (
                            <TouchableOpacity style={styles.actionButton} onPress={openCode}>
                                <Icon name="code" size={16} color="#fff" style={styles.buttonIcon} />
                                <Text style={styles.actionButtonText}>View Code</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                            style={[
                                styles.actionButton,
                                isBookmarked && styles.bookmarkedButton
                            ]} 
                            onPress={handleBookmarkToggle}
                        >
                            <Icon 
                                name={isBookmarked ? "bookmark" : "bookmark-border"} 
                                size={16} 
                                color="#fff" 
                                style={styles.buttonIcon} 
                            />
                            <Text style={styles.actionButtonText}>
                                {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={sharePaper}>
                            <Icon name="share" size={16} color="#fff" style={styles.buttonIcon} />
                            <Text style={styles.actionButtonText}>Share</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.tabContainer}>
                    <TabIndicator activeTab={activeTab} />
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tabScrollContent}
                    >
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
                        onPress={() => setActiveTab('overview')}
                    >
                        <Icon name="info" size={20} color={activeTab === 'overview' ? '#2563EB' : '#A1A4B2'} />
                        <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
                            Overview
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'insights' && styles.activeTab]}
                        onPress={() => setActiveTab('insights')}
                    >
                        <Icon name="lightbulb" size={20} color={activeTab === 'insights' ? '#2563EB' : '#A1A4B2'} />
                        <Text style={[styles.tabText, activeTab === 'insights' && styles.activeTabText]}>
                            Insights
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'implementation' && styles.activeTab]}
                        onPress={() => setActiveTab('implementation')}
                    >
                        <Icon name="code" size={20} color={activeTab === 'implementation' ? '#2563EB' : '#A1A4B2'} />
                        <Text style={[styles.tabText, activeTab === 'implementation' && styles.activeTabText]}>
                            Implementation
                        </Text>
                    </TouchableOpacity>
                    </ScrollView>
                </View>

                {renderTabContent()}

                {showQuestionInput ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Ask Implementation Question</Text>
                        <TextInput
                            style={styles.questionInput}
                            value={question}
                            onChangeText={setQuestion}
                            placeholder="Ask a question about implementation..."
                            placeholderTextColor="#666"
                            multiline
                            editable={!isAskingQuestion}
                        />
                        <View style={styles.questionActions}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.cancelButton]}
                                onPress={() => setShowQuestionInput(false)}
                            >
                                <Text style={styles.actionButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.actionButton,
                                    styles.askButton,
                                    isAskingQuestion && styles.disabledButton
                                ]}
                                onPress={handleAskQuestion}
                                disabled={isAskingQuestion || !question.trim()}
                            >
                                {isAskingQuestion ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.actionButtonText}>Ask Question</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.askQuestionButton}
                        onPress={() => setShowQuestionInput(true)}
                    >
                        <Icon name="help-outline" size={20} color="#fff" style={styles.buttonIcon} />
                        <Text style={styles.askQuestionText}>Ask Implementation Question</Text>
                    </TouchableOpacity>
                )}

                {answer && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Answer</Text>
                        <Text style={styles.answer}>{answer}</Text>
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity 
                style={styles.fab} 
                onPress={() => setShowQuestionInput(true)}
            >
                <Icon name="help-outline" size={24} color="#fff" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#181A20',
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#181A20',
        padding: 20,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#181A20',
    },
    errorText: {
        color: '#FF5B5B',
        textAlign: 'center',
        fontSize: 16,
        marginTop: 16,
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: '#2563EB',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 16,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    header: {
        backgroundColor: '#23262B',
        padding: 16,
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2D35',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    authors: {
        fontSize: 14,
        color: '#A1A4B2',
        marginBottom: 4,
    },
    venue: {
        fontSize: 14,
        color: '#A1A4B2',
        marginBottom: 16,
    },
    actionButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    actionButton: {
        backgroundColor: '#2563EB',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    buttonIcon: {
        marginRight: 4,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    disabledButton: {
        opacity: 0.5,
    },
    section: {
        backgroundColor: '#23262B',
        borderRadius: 16,
        padding: 24,
        marginHorizontal: 16,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 20,
        letterSpacing: 0.5,
    },
    abstract: {
        fontSize: 15,
        color: '#A1A4B2',
        lineHeight: 24,
        letterSpacing: 0.2,
    },
    analysis: {
        fontSize: 14,
        color: '#A1A4B2',
        lineHeight: 20,
    },
    readMoreButton: {
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    readMoreText: {
        color: '#2563EB',
        fontSize: 14,
        fontWeight: '500',
    },
    questionInput: {
        backgroundColor: '#2A2D35',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 12,
        color: '#fff',
    },
    questionActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    cancelButton: {
        backgroundColor: '#2A2D35',
    },
    askButton: {
        backgroundColor: '#2563EB',
    },
    answer: {
        fontSize: 14,
        color: '#A1A4B2',
        lineHeight: 20,
    },
    codeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    codeLanguage: {
        fontSize: 12,
        color: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    codeStars: {
        fontSize: 12,
        color: '#A1A4B2',
    },
    fab: {
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#2563EB',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    loadingText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 16,
    },
    askQuestionButton: {
        backgroundColor: '#23262B',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    askQuestionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    tabContainer: {
        backgroundColor: '#23262B',
        padding: 4,
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        position: 'relative',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    tabScrollContent: {
        flexDirection: 'row',
        paddingHorizontal: 4,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        zIndex: 1,
        minWidth: 120,
    },
    activeTab: {
        backgroundColor: 'transparent',
    },
    tabText: {
        color: '#A1A4B2',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    activeTabText: {
        color: '#2563EB',
    },
    tabIndicator: {
        position: 'absolute',
        width: width / 3 - 8,
        height: '100%',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderRadius: 8,
        top: 0,
        left: 4,
    },
    insightItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
        backgroundColor: 'rgba(255, 215, 0, 0.08)',
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.15)',
    },
    insightIcon: {
        marginRight: 12,
        marginTop: 2,
    },
    insightText: {
        flex: 1,
        color: '#FFE6C7',
        fontSize: 15,
        lineHeight: 24,
        letterSpacing: 0.2,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
        backgroundColor: 'rgba(37, 99, 235, 0.05)',
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.1)',
    },
    stepNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#2563EB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    stepNumberText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    stepText: {
        flex: 1,
        color: '#A1A4B2',
        fontSize: 15,
        lineHeight: 24,
        letterSpacing: 0.2,
    },
    difficultyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    difficultyLevel: {
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    difficultyExplanation: {
        fontSize: 15,
        color: '#A1A4B2',
        lineHeight: 24,
        marginBottom: 20,
        letterSpacing: 0.2,
    },
    prerequisitesTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
        letterSpacing: 0.2,
    },
    prerequisiteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: 'rgba(37, 99, 235, 0.05)',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.1)',
    },
    prerequisiteIcon: {
        marginRight: 12,
    },
    prerequisiteText: {
        fontSize: 15,
        color: '#A1A4B2',
        flex: 1,
        letterSpacing: 0.2,
    },
    conceptItem: {
        backgroundColor: 'rgba(37, 99, 235, 0.05)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.1)',
    },
    conceptHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    conceptTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
        flex: 1,
        letterSpacing: 0.2,
    },
    importanceBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        marginLeft: 12,
    },
    importanceText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
        letterSpacing: 0.2,
    },
    conceptExplanation: {
        fontSize: 15,
        color: '#A1A4B2',
        lineHeight: 24,
        letterSpacing: 0.2,
    },
    codeSection: {
        marginTop: 32,
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
    },
    codeSectionTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 24,
        letterSpacing: 0.5,
    },
    codeSnippet: {
        marginBottom: 32,
        backgroundColor: 'rgba(26, 28, 35, 0.5)',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    codeTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
        letterSpacing: 0.2,
    },
    codeDescription: {
        fontSize: 15,
        color: '#A1A4B2',
        marginBottom: 16,
        lineHeight: 24,
        letterSpacing: 0.2,
    },
    codeBlock: {
        backgroundColor: '#1A1C23',
        borderRadius: 8,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    code: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 14,
        color: '#A1A4B2',
        lineHeight: 22,
    },
    bookmarkedButton: {
        backgroundColor: '#2563EB',
    },
    codeLinkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2563EB',
        padding: 12,
        borderRadius: 8,
        marginBottom: 24,
    },
    codeLinkText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    comingSoonContainer: {
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderRadius: 12,
        padding: 32,
        marginTop: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.2)',
    },
    comingSoonText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center',
    },
    comingSoonSubtext: {
        color: '#A1A4B2',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 24,
    },
    timeEstimate: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
    },
    timeEstimateLabel: {
        fontSize: 14,
        color: '#A1A4B2',
        marginRight: 8,
    },
    timeEstimateValue: {
        fontSize: 14,
        color: '#fff',
        fontWeight: '600',
    },
    loadingSubText: {
        color: '#A1A4B2',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 20,
    },
    loadingDetailsList: {
        marginTop: 16,
        alignItems: 'flex-start',
        paddingHorizontal: 40,
    },
    loadingDetailsItem: {
        color: '#A1A4B2',
        fontSize: 14,
        marginVertical: 4,
    },
    technicalSkillsContainer: {
        marginTop: 20,
    },
    skillItem: {
        backgroundColor: 'rgba(37, 99, 235, 0.05)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.1)',
    },
    skillHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    skillName: {
        fontSize: 15,
        color: '#fff',
        fontWeight: '500',
    },
    skillLevelBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    skillLevelText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
}); 