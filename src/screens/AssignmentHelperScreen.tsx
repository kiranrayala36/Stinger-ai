import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    Animated,
    Dimensions,
    StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { assignmentService } from '../services/assignmentService';
import { AnswerLength, AnswerStyle } from '../types/assignment';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import * as Clipboard from 'expo-clipboard';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';

// Trigger a re-check for TypeScript to resolve module import issues.

const { width } = Dimensions.get('window');
const CARD_MARGIN = 16;
const CARD_WIDTH = width - (CARD_MARGIN * 2);

type InputMethod = 'manual' | 'pdf';
type AssignmentHelperScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Assignment Helper'>;

// Card component for consistent styling
const Card = ({ children, style }: { children: React.ReactNode; style?: any }) => (
    <View style={[styles.card, style]}>
        {children}
    </View>
);

// Section Title component
const SectionTitle = ({ title }: { title: string }) => (
    <Text style={styles.sectionTitle}>{title}</Text>
);

// Generic Option Button component
interface OptionButtonProps<T> {
    icon: string;
    label: string;
    value: T;
    selectedValue: T;
    onPress: (value: T) => void;
    animationValue?: Animated.Value;
    animationStartValue?: number;
    animationEndValue?: number;
}

const OptionButton = <T,>({
    icon,
    label,
    value,
    selectedValue,
    onPress,
    animationValue,
    animationStartValue = 0,
    animationEndValue = 1,
}: OptionButtonProps<T>) => {
    const isSelected = value === selectedValue;
    const animatedStyle = animationValue ? {
        transform: [{
            scale: animationValue.interpolate({
                inputRange: [animationStartValue, animationEndValue],
                outputRange: [1, 1.05]
            })
        }]
    } : {};

    return (
        <TouchableOpacity
            style={[styles.optionButton, isSelected && styles.selectedOption]}
            onPress={() => {
                onPress(value);
                if (animationValue) {
                    animationValue.setValue(animationStartValue);
                    Animated.spring(animationValue, {
                        toValue: animationEndValue,
                        tension: 50,
                        friction: 7,
                        useNativeDriver: true,
                    }).start();
                }
            }}
            activeOpacity={0.7}
        >
            <Animated.View style={[styles.optionContent, animatedStyle]}>
                <View style={[styles.optionIconContainer, isSelected && styles.selectedOptionIcon]}>
                    <Icon name={icon} size={24} color={isSelected ? '#fff' : '#A1A4B2'} />
                </View>
                <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>
                    {label}
                </Text>
            </Animated.View>
        </TouchableOpacity>
    );
};

export default function AssignmentHelperScreen() {
    const { user } = useAuth();
    const navigation = useNavigation<AssignmentHelperScreenNavigationProp>();
    const [questions, setQuestions] = useState<string[]>(['']);
    const [pdfName, setPdfName] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [answers, setAnswers] = useState<{ [key: string]: string }>({});
    const [inputMethod, setInputMethod] = useState<InputMethod>('manual');
    const [length, setLength] = useState<AnswerLength>('Medium');
    const [style, setStyle] = useState<AnswerStyle>('Professional');
    
    const scrollY = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const lengthAnim = useRef(new Animated.Value(0)).current;
    const styleAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [questionInputHeights, setQuestionInputHeights] = useState<number[]>(questions.map(() => 40));
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    React.useEffect(() => {
        StatusBar.setBarStyle('light-content');
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            })
        ]).start();
    }, []);

    const headerHeight = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [120, 80],
        extrapolate: 'clamp',
    });

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 50],
        outputRange: [1, 0.9],
        extrapolate: 'clamp',
    });

    const addQuestion = () => {
        setQuestions([...questions, '']);
    };

    const removeQuestion = (index: number) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const updateQuestion = (index: number, value: string) => {
        const newQuestions = [...questions];
        newQuestions[index] = value;
        setQuestions(newQuestions);
    };

    const handlePdfUpload = async () => {
        try {
            setLoading(true);

            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true
            });

            if (result.canceled) {
                setLoading(false);
                return;
            }

            const file = result.assets[0];
            
            // Validate file type
            if (!file.mimeType?.toLowerCase().includes('pdf')) {
                Alert.alert('Error', 'Please select a valid PDF file.');
                setLoading(false);
                return;
            }

            // Validate file size (10MB limit)
            const MAX_SIZE = 10 * 1024 * 1024; // 10MB in bytes
            if (file.size && file.size > MAX_SIZE) {
                Alert.alert('Error', 'PDF file is too large. Maximum size is 10MB.');
                setLoading(false);
                return;
            }

            setPdfName(file.name);

            try {
                // Extract questions from the PDF content using the assignment service
                const questions = await assignmentService.extractQuestionsFromPDF(file.uri);

                if (!questions || questions.length === 0) {
                    throw new Error('No questions could be extracted from the PDF');
                }

                // Update questions state with extracted questions
                setQuestions(questions);

                // Show success message with question count
                Alert.alert(
                    'Success',
                    `Successfully extracted ${questions.length} question${questions.length === 1 ? '' : 's'} from the PDF.`
                );

            } catch (error) {
                console.error('Error processing PDF:', error);
                throw new Error('Failed to extract questions from the PDF. Please ensure the PDF contains readable text.');
            }

        } catch (error) {
            console.error('Error uploading PDF:', error);
            
            // Provide user-friendly error messages
            let errorMessage = 'Failed to process the PDF file.';
            if (error instanceof Error) {
                if (error.message.includes('No questions')) {
                    errorMessage = 'No questions were found in the PDF. Please ensure your document contains clear questions.';
                } else if (error.message.includes('readable text')) {
                    errorMessage = 'Could not extract text from the PDF. The file might be scanned or protected.';
                } else if (error.message.includes('too large')) {
                    errorMessage = 'The PDF file is too large. Please try a smaller file (maximum 10MB).';
                }
            }
            
            Alert.alert('Error', errorMessage);
            setPdfName('');
        } finally {
            setLoading(false);
        }
    };

    const generateAnswers = async () => {
        try {
            setLoading(true);

            const validQuestions = questions.filter(q => q.trim().length > 0);
            
            if (validQuestions.length === 0) {
                Alert.alert('Error', 'Please add at least one question');
                return;
            }

            // Process each question individually to get specific answers
            const answersMap: { [key: string]: string } = {};
            
            for (const question of validQuestions) {
                try {
                    let retryCount = 0;
                    let answer = '';
                    let isValidAnswer = false;
                    
                    while (retryCount < 3 && !isValidAnswer) {
            const result = await assignmentService.generateAnswers({
                topic: 'General',
                            questions: [question],
                length,
                style,
                            instructions: `Provide a detailed ${length.toLowerCase()} answer in ${style} style. 
                                The answer must be complete, properly formatted, and end with a proper conclusion. 
                                Do not truncate or leave sentences incomplete. 
                                For medium length, aim for 3-4 well-structured paragraphs.
                                Ensure the response is comprehensive yet concise.`
                        });

                        if (result && Object.keys(result).length > 0 && result[question]) {
                            answer = result[question];
                            
                            // Validate answer completeness
                            isValidAnswer = validateAnswer(answer);
                            
                            if (!isValidAnswer) {
                                // If answer is incomplete, try to get the remaining part
                                const completionResult = await assignmentService.generateAnswers({
                                    topic: 'General',
                                    questions: [question],
                                    length,
                                    style,
                                    instructions: `Complete the following truncated answer: ${answer.slice(-150)}. 
                                        Ensure proper conclusion and formatting.`
                                });
                                
                                if (completionResult && completionResult[question]) {
                                    // Combine the answers, avoiding duplication
                                    const completion = completionResult[question];
                                    answer = mergeAnswers(answer, completion);
                                    isValidAnswer = validateAnswer(answer);
                                }
                            }
                        }

                        if (!isValidAnswer) {
                            retryCount++;
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }

                    if (!isValidAnswer) {
                        throw new Error('Failed to generate a complete answer after multiple attempts');
                    }

                    answersMap[question] = answer;
                } catch (questionError) {
                    console.error(`Error generating answer for question: ${question}`, questionError);
                    answersMap[question] = 'Failed to generate a complete answer. Please try regenerating this question.';
                }
            }

            if (Object.keys(answersMap).length === 0) {
                throw new Error('Failed to generate any answers');
            }

            setAnswers(answersMap);
        } catch (error) {
            console.error('Error generating answers:', error);
            Alert.alert(
                'Error Generating Answers',
                'Some answers were incomplete or failed to generate properly. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    // Helper function to validate answer completeness
    const validateAnswer = (answer: string): boolean => {
        if (!answer || typeof answer !== 'string') return false;
        
        // Check minimum length based on selected length preference
        const minLength = length === 'Short' ? 100 : length === 'Medium' ? 200 : 400;
        if (answer.length < minLength) return false;

        // Check for truncation indicators
        if (answer.includes('**') || answer.includes('...')) return false;

        // Check if answer ends with proper punctuation
        const properEnding = /[.!?][\s]*$/.test(answer);
        if (!properEnding) return false;

        // Check for incomplete sentences
        const lastSentence = answer.split(/[.!?]/).pop();
        if (lastSentence && lastSentence.trim().length > 0 && !/[.!?]$/.test(answer)) return false;

        // Check for minimum number of paragraphs based on length
        const paragraphs = answer.split(/\n\s*\n/);
        const minParagraphs = length === 'Short' ? 1 : length === 'Medium' ? 2 : 3;
        if (paragraphs.length < minParagraphs) return false;

        return true;
    };

    // Helper function to merge original answer with completion
    const mergeAnswers = (original: string, completion: string): string => {
        // Remove any duplicate content
        const lastSentenceOriginal = original.split(/[.!?]/).pop()?.trim() || '';
        if (lastSentenceOriginal.length > 20) {
            const overlapPoint = completion.indexOf(lastSentenceOriginal);
            if (overlapPoint !== -1) {
                return original + completion.slice(overlapPoint + lastSentenceOriginal.length);
            }
        }
        
        // If no overlap found, try to merge at a sentence boundary
        const lastPeriod = original.lastIndexOf('.');
        if (lastPeriod !== -1 && lastPeriod > original.length - 50) {
            return original.slice(0, lastPeriod + 1) + ' ' + completion;
        }
        
        return original + '\n\n' + completion;
    };

    const saveAnswers = async () => {
        try {
            if (!user) {
                Alert.alert(
                    'Authentication Required',
                    'Please sign in to save your answers.',
                    [
                        {
                            text: 'Sign In',
                            onPress: () => navigation.navigate('Auth')
                        },
                        {
                            text: 'Cancel',
                            style: 'cancel'
                        }
                    ]
                );
                return;
            }

            setLoading(true);
            
            // Format and validate the answers
            const questionsWithAnswers = Object.entries(answers)
                .map(([question, answer]) => ({
                    question: question.trim(),
                    answer: answer.trim()
                }))
                .filter(item => item.question && item.answer);

            if (questionsWithAnswers.length === 0) {
                Alert.alert('Error', 'No valid answers to save');
                return;
            }

            console.log('Attempting to save answers:', {
                topic: 'General',
                questions: questionsWithAnswers,
                length,
                style
            });

            await assignmentService.saveAnswers({
                topic: 'General',
                questions: questionsWithAnswers,
                length,
                style
            });

            Alert.alert('Success', 'Answers saved successfully!');
        } catch (error) {
            console.error('Error saving answers:', error);
            if (error instanceof Error) {
                if (error.message === 'User not authenticated') {
                    Alert.alert(
                        'Authentication Required',
                        'Please sign in to save your answers.',
                        [
                            {
                                text: 'Sign In',
                                onPress: () => navigation.navigate('Auth')
                            },
                            {
                                text: 'Cancel',
                                style: 'cancel'
                            }
                        ]
                    );
                } else {
                    Alert.alert(
                        'Error Saving Answers',
                        `Failed to save answers: ${error.message}\n\nPlease try again or contact support if the problem persists.`
                    );
                }
            } else {
                Alert.alert(
                    'Error Saving Answers',
                    'An unexpected error occurred while saving your answers. Please try again or contact support if the problem persists.'
                );
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLengthChange = (newLength: AnswerLength) => {
        setLength(newLength);
        Animated.spring(lengthAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
        }).start(() => {
            lengthAnim.setValue(0);
        });
    };

    const handleStyleChange = (newStyle: AnswerStyle) => {
        setStyle(newStyle);
        Animated.spring(styleAnim, {
                toValue: 1,
                useNativeDriver: true,
            tension: 50,
            friction: 7,
        }).start(() => {
            styleAnim.setValue(0);
        });
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#2563EB', '#1C4ED8']}
                style={styles.header}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            >
                <Animated.View style={[styles.headerContent, { height: headerHeight, opacity: headerOpacity }]}>
                    <View style={styles.headerTop}>
                        <View>
                            <Text style={styles.title}>AI Assignment</Text>
                            <Text style={styles.subtitle}>Get instant help with your questions</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.savedButton}
                            onPress={() => navigation.navigate('Saved Answers')}
                        >
                            <Icon name="history" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </LinearGradient>

            <Animated.ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
            >
                <Animated.View 
                                style={[
                        styles.content,
                        {
                            opacity: fadeAnim,
                            transform: [{ scale: scaleAnim }]
                        }
                    ]}
                >
                    <Card>
                        <SectionTitle title="How would you like to input your questions?" />
                        <View style={styles.optionsGrid}>
                            <OptionButton
                                icon="edit"
                                label="Manual Entry"
                                value="manual"
                                selectedValue={inputMethod}
                                onPress={(value) => setInputMethod(value as InputMethod)}
                            />
                            <OptionButton
                                icon="upload-file"
                                label="Upload PDF"
                                value="pdf"
                                selectedValue={inputMethod}
                                onPress={(value) => setInputMethod(value as InputMethod)}
                                        />
                                    </View>
                    </Card>

                    {inputMethod === 'pdf' ? (
                        <Card>
                            <SectionTitle title="Upload Your PDF" />
                            <TouchableOpacity
                                style={styles.uploadButton}
                                onPress={handlePdfUpload}
                                disabled={loading}
                            >
                                <View style={styles.uploadIconContainer}>
                                    <Icon name="upload-file" size={24} color="#fff" />
                                </View>
                                <Text style={styles.uploadButtonText}>
                                    {pdfName ? `Selected: ${pdfName}` : 'Choose PDF File'}
                                </Text>
                                {pdfName ? (
                                    <TouchableOpacity
                                        style={styles.clearPdfButton}
                                        onPress={() => {
                                            setPdfName('');
                                            setQuestions(['']); // Clear questions if PDF is cleared
                                        }}
                                    >
                                        <Icon name="close" size={20} color="#fff" />
                                    </TouchableOpacity>
                                ) : null}
                            </TouchableOpacity>
                        </Card>
                    ) : (
                        <Card>
                            <SectionTitle title="Your Questions" />
                            <FlashList
                                data={questions}
                                estimatedItemSize={100}
                                keyExtractor={(_: string, index: number) => `question-${index}`}
                                renderItem={({ item: question, index }: { item: string; index: number }) => (
                                    <Animated.View
                                        key={index}
                                        style={[
                                            styles.questionContainer,
                                            {
                                                transform: [{
                                                    scale: fadeAnim.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [0.95, 1]
                                                    })
                                                }]
                                            }
                                        ]}
                                    >
                                        <View style={styles.questionNumberBadge}>
                                            <Text style={styles.questionNumber}>{index + 1}</Text>
                                        </View>
                                        <View style={styles.questionInputWrapper}>
                                        <TextInput
                                            style={styles.questionInput}
                                            value={question}
                                            onChangeText={(value) => updateQuestion(index, value)}
                                            placeholder="Type your question here..."
                                            placeholderTextColor="#666"
                                            multiline
                                            autoCapitalize="sentences"
                                            autoCorrect={true}
                                            scrollEnabled={false}
                                            onContentSizeChange={(event) => {
                                                const newHeights = [...questionInputHeights];
                                                newHeights[index] = Math.max(40, event.nativeEvent.contentSize.height);
                                                setQuestionInputHeights(newHeights);
                                            }}
                                        />
                                        {questions.length > 1 && (
                                            <TouchableOpacity
                                                style={styles.removeButton}
                                                onPress={() => removeQuestion(index)}
                                            >
                                                <Icon name="close" size={16} color="#FF3B30" />
                                            </TouchableOpacity>
                                        )}
                                        {question.length > 0 && (
                                            <TouchableOpacity
                                                style={styles.clearButton}
                                                onPress={() => updateQuestion(index, '')}
                                            >
                                                <Icon name="cancel" size={16} color="#A1A4B2" />
                                            </TouchableOpacity>
                                        )}
                                        </View>
                                    </Animated.View>
                                )}
                                ListEmptyComponent={() => (
                                    <Text style={styles.emptyQuestionsText}>Add your first question above!</Text>
                                )}
                            />
                            <TouchableOpacity
                                style={styles.addButton}
                                onPress={addQuestion}
                            >
                                <Icon name="add" size={24} color="#2563EB" />
                                <Text style={styles.addButtonText}>Add Another Question</Text>
                            </TouchableOpacity>
                        </Card>
                    )}

                    <Card>
                        <SectionTitle title="Answer Preferences" />
                        <View style={styles.preferencesContainer}>
                            <View style={styles.preferenceSection}>
                                <Text style={styles.preferenceTitle}>Length</Text>
                                <View style={styles.optionsRow}>
                            {(['Short', 'Medium', 'Long'] as AnswerLength[]).map((option) => (
                                        <OptionButton
                                    key={option}
                                            icon={option === 'Short' ? 'short-text' : option === 'Medium' ? 'subject' : 'notes'}
                                            label={option}
                                            value={option}
                                            selectedValue={length}
                                    onPress={handleLengthChange}
                                            animationValue={lengthAnim}
                                        />
                            ))}
                        </View>
                    </View>

                                <View style={styles.preferenceSection}>
                                    <Text style={styles.preferenceTitle}>Style</Text>
                                    <View style={styles.optionsRow}>
                                        {(['Simple', 'Professional', 'Exam-style'] as AnswerStyle[]).map((option) => (
                                            <OptionButton
                                                key={option}
                                                icon={option === 'Simple' ? 'format-align-left' : option === 'Professional' ? 'work' : 'school'}
                                                label={option}
                                                value={option}
                                                selectedValue={style}
                                                onPress={handleStyleChange}
                                                animationValue={styleAnim}
                                            />
                                ))}
                            </View>
                        </View>
                            </View>
                        </Card>

                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={[styles.generateButton, loading && styles.disabledButton]}
                                onPress={generateAnswers}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <>
                                            <Icon name="auto-awesome" size={24} color="#fff" />
                                        <Text style={styles.generateButtonText}>Generate Answers</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {Object.keys(answers).length > 0 && (
                            <Card style={styles.answersCard}>
                                <View style={styles.answersHeader}>
                                    <SectionTitle title="Generated Answers" />
                                    <Text style={styles.answerCount}>
                                        {Object.keys(answers).length} {Object.keys(answers).length === 1 ? 'Answer' : 'Answers'}
                                    </Text>
                                    </View>

                                <FlashList
                                    data={Object.entries(answers)}
                                    estimatedItemSize={300}
                                    keyExtractor={([question]: [string, string], index: number) => `answer-${question}-${index}`}
                                    renderItem={({ item: [question, answer], index }: { item: [string, string]; index: number }) => (
                                        <Animated.View 
                                            key={index} 
                                            style={[
                                                styles.answerContainer,
                                                {
                                                    transform: [{
                                                        scale: fadeAnim.interpolate({
                                                            inputRange: [0, 1],
                                                            outputRange: [0.95, 1]
                                                        })
                                                    }]
                                                }
                                            ]}
                                        >
                                            <View style={styles.answerHeader}>
                                                <View style={styles.answerBadgeContainer}>
                                                    <View style={styles.answerNumberBadge}>
                                                        <Text style={styles.answerNumber}>{index + 1}</Text>
                                                    </View>
                                                    <View style={styles.answerMetadata}>
                                                        <Text style={styles.answerStyle}>{style}</Text>
                                                        <Text style={styles.answerLength}>{length}</Text>
                                                    </View>
                                                </View>
                                                <TouchableOpacity 
                                                    style={styles.copyButton}
                                                    onPress={async () => {
                                                        try {
                                                            await Clipboard.setStringAsync(answer);
                                                            setCopiedIndex(index);
                                                            setTimeout(() => setCopiedIndex(null), 2000); // Reset after 2 seconds
                                                        } catch (error) {
                                                            console.error('Failed to copy to clipboard:', error);
                                                        }
                                                    }}
                                                >
                                                    {copiedIndex === index ? (
                                                        <Text style={styles.copyButtonText}>Copied!</Text>
                                                    ) : (
                                                        <Icon name="content-copy" size={20} color="#A1A4B2" />
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                            
                                            <View style={styles.questionSection}>
                                                <Text style={styles.questionLabel}>Question:</Text>
                                                <Text style={styles.questionText}>{question}</Text>
                                            </View>
                                            
                                            <View style={styles.answerSection}>
                                                <Text style={styles.answerLabel}>Answer:</Text>
                                                <Text style={styles.answerText}>{answer}</Text>
                                            </View>
                                        </Animated.View>
                                    )}
                                    ListEmptyComponent={() => (
                                        <Text style={styles.emptyAnswersText}>Answers will appear here after generation.</Text>
                                    )}
                                />
                                
                                <TouchableOpacity
                                    style={[styles.saveButton, loading && styles.disabledButton]}
                                    onPress={saveAnswers}
                                    disabled={loading}
                                >
                                    <Icon name="save" size={24} color="#fff" />
                                    <Text style={styles.saveButtonText}>Save All Answers</Text>
                                </TouchableOpacity>
                            </Card>
                        )}
                    </Animated.View>
                </Animated.ScrollView>
            </View>
        );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#181A20',
    },
    header: {
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
        backgroundColor: 'transparent',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        paddingHorizontal: 20,
        paddingBottom: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'System-Bold',
    },
    subtitle: {
        fontSize: 16,
        color: '#fff',
        opacity: 0.8,
        fontFamily: 'System-Medium',
    },
    savedButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        padding: 10,
        borderRadius: 10,
    },
    scrollView: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    contentContainer: {
        paddingVertical: 20,
        paddingHorizontal: CARD_MARGIN,
    },
    content: {
        flex: 1,
    },
    card: {
        backgroundColor: '#23262B',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 16,
        fontFamily: 'System-Bold',
    },
    optionsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    optionButton: {
        flex: 1,
        backgroundColor: '#2A2D35',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#3B3F4A',
        marginHorizontal: 0,
    },
    selectedOption: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
    },
    optionContent: {
        alignItems: 'center',
    },
    optionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    selectedOptionIcon: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    optionText: {
        color: '#A1A4B2',
        fontSize: 14,
        fontWeight: '500',
        fontFamily: 'System-Medium',
    },
    selectedOptionText: {
        color: '#fff',
        fontWeight: '600',
        fontFamily: 'System-Bold',
    },
    uploadButton: {
        backgroundColor: '#2563EB',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    uploadIconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'System-Bold',
    },
    clearPdfButton: {
        marginLeft: 10,
        padding: 5,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 15,
    },
    questionContainer: {
        marginBottom: 16,
        backgroundColor: '#2A2D35',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#3B3F4A',
        overflow: 'hidden',
    },
    questionNumberBadge: {
        backgroundColor: '#2563EB',
        borderRadius: 12,
        padding: 4,
        marginRight: 8,
        alignSelf: 'flex-start',
        marginTop: 12,
    },
    questionNumber: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'System-Bold',
    },
    questionInput: {
        flex: 1,
        fontSize: 16,
        color: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#1A1D22',
        borderRadius: 8,
        textAlignVertical: 'top',
        fontFamily: 'System',
        marginRight: 12,
    },
    questionInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#1A1D22',
        borderRadius: 8,
        overflow: 'hidden',
        marginRight: 0,
    },
    removeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: '#FF3B30',
        borderRadius: 16,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    clearButton: {
        position: 'absolute',
        top: 12,
        right: 50,
        backgroundColor: '#A1A4B2',
        borderRadius: 16,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#2563EB',
        borderStyle: 'dashed',
        marginTop: 16,
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
    },
    addButtonText: {
        marginLeft: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#2563EB',
        fontFamily: 'System-Bold',
    },
    preferencesContainer: {
        gap: 16,
    },
    preferenceSection: {
        marginBottom: 20,
    },
    preferenceTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 10,
        fontFamily: 'System-Bold',
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        gap: 12,
    },
    actions: {
        marginBottom: 20,
        paddingHorizontal: CARD_MARGIN,
    },
    generateButton: {
        flexDirection: 'row',
        backgroundColor: '#10B981',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    generateButtonText: {
        marginLeft: 10,
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'System-Bold',
    },
    disabledButton: {
        backgroundColor: '#9CA3AF',
        shadowColor: 'transparent',
        elevation: 0,
    },
    answersCard: {
        backgroundColor: '#23262B',
        borderColor: '#3B3F4A',
        borderWidth: 1,
        marginTop: 16,
    },
    answersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    answerCount: {
        fontSize: 16,
        fontWeight: '600',
        color: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        fontFamily: 'System-Medium',
    },
    answerContainer: {
        backgroundColor: '#2A2D35',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#3B3F4A',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    answerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    answerBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    answerNumberBadge: {
        backgroundColor: '#10B981',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    answerNumber: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        fontFamily: 'System-Bold',
    },
    answerMetadata: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
        gap: 8,
    },
    answerStyle: {
        fontSize: 14,
        color: '#A1A4B2',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginRight: 5,
        fontFamily: 'System-Medium',
    },
    answerLength: {
        fontSize: 14,
        color: '#A1A4B2',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        fontFamily: 'System-Medium',
    },
    copyButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 8,
        borderRadius: 8,
        minWidth: 70,
        alignItems: 'center',
        justifyContent: 'center',
    },
    copyButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        fontFamily: 'System-Bold',
    },
    questionSection: {
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#3B3F4A',
    },
    questionLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#A1A4B2',
        marginBottom: 4,
        fontFamily: 'System-Medium',
    },
    questionText: {
        fontSize: 16,
        color: '#fff',
        lineHeight: 24,
        fontFamily: 'System-Medium',
    },
    answerSection: {
        paddingTop: 12,
    },
    answerLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#A1A4B2',
        marginBottom: 4,
        fontFamily: 'System-Medium',
    },
    answerText: {
        fontSize: 14,
        color: '#A1A4B2',
        lineHeight: 22,
        fontFamily: 'System',
    },
    emptyQuestionsText: {
        textAlign: 'center',
        color: '#A1A4B2',
        marginTop: 20,
        fontSize: 16,
        fontStyle: 'italic',
        fontFamily: 'System-Medium',
    },
    emptyAnswersText: {
        textAlign: 'center',
        color: '#A1A4B2',
        marginTop: 20,
        fontSize: 16,
        fontStyle: 'italic',
        fontFamily: 'System-Medium',
    },
    saveButton: {
        backgroundColor: '#2563EB',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
        fontFamily: 'System-Bold',
    },
}); 