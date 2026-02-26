import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    Animated,
    Dimensions,
    Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { assignmentService } from '../services/assignmentService';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type SavedAnswersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Saved Answers'>;

interface SavedAnswer {
    id: string;
    topic: string;
    questions: Array<{
        question: string;
        answer: string;
    }>;
    length: string;
    style: string;
    created_at: string;
}

export default function SavedAnswersScreen() {
    const { user } = useAuth();
    const navigation = useNavigation<SavedAnswersScreenNavigationProp>();
    const [loading, setLoading] = useState(true);
    const [answers, setAnswers] = useState<SavedAnswer[]>([]);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const scrollY = new Animated.Value(0);

    const loadSavedAnswers = async () => {
        try {
            if (!user) {
                Alert.alert(
                    'Authentication Required',
                    'Please sign in to view your saved answers.',
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
            const savedAnswers = await assignmentService.getSavedAnswers();
            setAnswers(savedAnswers);
        } catch (error) {
            console.error('Error loading saved answers:', error);
            Alert.alert('Error', 'Failed to load saved answers. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSavedAnswers();
    }, [user]);

    const handleDelete = async (id: string) => {
        Alert.alert(
            'Delete Answer',
            'Are you sure you want to delete this saved answer?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setDeletingId(id);
                            await assignmentService.deleteSavedAnswer(id);
                            setAnswers(prev => prev.filter(answer => answer.id !== id));
                        } catch (error) {
                            console.error('Error deleting answer:', error);
                            Alert.alert('Error', 'Failed to delete saved answer');
                        } finally {
                            setDeletingId(null);
                        }
                    }
                }
            ]
        );
    };

    const handleShare = async (answer: SavedAnswer) => {
        try {
            const questionsAndAnswers = answer.questions
                .map(qa => `Q: ${qa.question}\nA: ${qa.answer}`)
                .join('\n\n');

            const content = `Topic: ${answer.topic}\n\n${questionsAndAnswers}\n\nGenerated with StingerAI`;
            
            await Share.share({
                message: content,
                title: 'Shared Answer from StingerAI'
            });
        } catch (error) {
            console.error('Error sharing:', error);
            Alert.alert('Error', 'Failed to share the answer');
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const headerHeight = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [80, 80],
        extrapolate: 'clamp',
    });

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 50],
        outputRange: [1, 0.9],
        extrapolate: 'clamp',
    });

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>Loading your answers...</Text>
            </View>
        );
    }

    if (answers.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                    <Icon name="history" size={64} color="#A1A4B2" />
                </View>
                <Text style={styles.emptyTitle}>No Saved Answers</Text>
                <Text style={styles.emptyText}>Start creating answers to see them here</Text>
                <TouchableOpacity
                    style={styles.createButton}
                    onPress={() => navigation.navigate('Assignment Helper')}
                >
                    <Icon name="add" size={20} color="#fff" style={styles.createButtonIcon} />
                    <Text style={styles.createButtonText}>Create New Answer</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.header, { height: headerHeight, opacity: headerOpacity }]}>
                <View style={styles.headerContent}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.title}>Saved Answers</Text>
                        <Text style={styles.subtitle}>View and manage your saved answers</Text>
                    </View>
                </View>
            </Animated.View>

            <Animated.ScrollView 
                style={[styles.scrollView, { marginTop: headerHeight }]}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
            >
                {answers.map((answer, index) => (
                    <Animated.View 
                        key={answer.id} 
                        style={[
                            styles.card,
                            {
                                transform: [{
                                    translateY: scrollY.interpolate({
                                        inputRange: [-1, 0, 100 * index, 100 * (index + 1)],
                                        outputRange: [0, 0, 0, 0],
                                    })
                                }]
                            }
                        ]}
                    >
                        <TouchableOpacity
                            style={styles.cardContent}
                            onPress={() => navigation.navigate('Saved Answer Detail', { answer })}
                            activeOpacity={0.7}
                        >
                            <View style={styles.cardHeader}>
                                <View style={styles.topicContainer}>
                                    <Icon name="topic" size={16} color="#A1A4B2" />
                                    <Text style={styles.topic}>{answer.topic}</Text>
                                </View>
                                <View style={styles.metaContainer}>
                                    <View style={styles.metaItem}>
                                        <Icon name="schedule" size={14} color="#A1A4B2" />
                                        <Text style={styles.metaText}>{answer.length}</Text>
                                    </View>
                                    <View style={styles.metaItem}>
                                        <Icon name="style" size={14} color="#A1A4B2" />
                                        <Text style={styles.metaText}>{answer.style}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => handleDelete(answer.id)}
                                    disabled={deletingId === answer.id}
                                >
                                    {deletingId === answer.id ? (
                                        <ActivityIndicator size="small" color="#FF3B30" />
                                    ) : (
                                        <Icon name="delete" size={20} color="#FF3B30" />
                                    )}
                                </TouchableOpacity>
                            </View>

                            {answer.questions.map((item, index) => (
                                <View key={index} style={styles.qaContainer}>
                                    <Text style={styles.question}>{item.question}</Text>
                                    <Text style={styles.answer} numberOfLines={2}>{item.answer}</Text>
                                </View>
                            ))}

                            <View style={styles.cardFooter}>
                                <Text style={styles.date}>{formatDate(answer.created_at)}</Text>
                                <TouchableOpacity 
                                    style={styles.shareButton}
                                    onPress={() => handleShare(answer)}
                                >
                                    <Icon name="share" size={16} color="#A1A4B2" />
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                ))}
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#181A20',
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 16,
        paddingTop: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#181A20',
    },
    loadingText: {
        color: '#A1A4B2',
        fontSize: 16,
        marginTop: 12,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#181A20',
        padding: 20,
    },
    emptyIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#23262B',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#2A2D35',
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    emptyText: {
        color: '#A1A4B2',
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    createButton: {
        backgroundColor: '#2563EB',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.3)',
    },
    createButtonIcon: {
        marginRight: 8,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    header: {
        backgroundColor: '#23262B',
        borderBottomWidth: 1,
        borderBottomColor: '#2A2D35',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1,
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 8,
        paddingBottom: 12,
    },
    headerLeft: {
        flex: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: '#A1A4B2',
        lineHeight: 16,
    },
    card: {
        margin: 12,
        marginTop: 0,
        padding: 16,
        backgroundColor: '#23262B',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2A2D35',
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
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    topicContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#2A2D35',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#3B3F4A',
    },
    topic: {
        color: '#A1A4B2',
        fontSize: 13,
        fontWeight: '600',
    },
    metaContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#2A2D35',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#3B3F4A',
    },
    metaText: {
        color: '#A1A4B2',
        fontSize: 12,
        fontWeight: '500',
    },
    qaContainer: {
        marginBottom: 12,
        backgroundColor: '#2A2D35',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#3B3F4A',
    },
    question: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 8,
    },
    answer: {
        color: '#A1A4B2',
        fontSize: 14,
        lineHeight: 20,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    date: {
        color: '#A1A4B2',
        fontSize: 12,
        fontWeight: '500',
    },
    shareButton: {
        padding: 6,
        backgroundColor: '#2A2D35',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#3B3F4A',
    },
    deleteButton: {
        padding: 6,
        backgroundColor: 'rgba(255, 59, 48, 0.1)',
        borderRadius: 8,
        marginLeft: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 59, 48, 0.2)',
    },
    cardContent: {
        flex: 1,
    },
}); 