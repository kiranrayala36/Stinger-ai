import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type SavedAnswerDetailRouteProp = RouteProp<RootStackParamList, 'Saved Answer Detail'>;
type SavedAnswerDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Saved Answer Detail'>;

export default function SavedAnswerDetailScreen() {
    const route = useRoute<SavedAnswerDetailRouteProp>();
    const navigation = useNavigation<SavedAnswerDetailNavigationProp>();
    const { answer } = route.params;

    const handleShare = async () => {
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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Icon name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Answer Details</Text>
                <TouchableOpacity
                    style={styles.shareButton}
                    onPress={handleShare}
                >
                    <Icon name="share" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.metadataContainer}>
                    <View style={styles.metadataItem}>
                        <Icon name="topic" size={16} color="#A1A4B2" />
                        <Text style={styles.metadataText}>{answer.topic}</Text>
                    </View>
                    <View style={styles.metadataItem}>
                        <Icon name="schedule" size={16} color="#A1A4B2" />
                        <Text style={styles.metadataText}>{answer.length}</Text>
                    </View>
                    <View style={styles.metadataItem}>
                        <Icon name="style" size={16} color="#A1A4B2" />
                        <Text style={styles.metadataText}>{answer.style}</Text>
                    </View>
                    <View style={styles.metadataItem}>
                        <Icon name="access-time" size={16} color="#A1A4B2" />
                        <Text style={styles.metadataText}>{formatDate(answer.created_at)}</Text>
                    </View>
                </View>

                {answer.questions.map((item, index) => (
                    <View key={index} style={styles.qaContainer}>
                        <Text style={styles.question}>{item.question}</Text>
                        <Text style={styles.answer}>{item.answer}</Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#181A20',
    },
    header: {
        backgroundColor: '#23262B',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 12 : 8,
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2D35',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    shareButton: {
        padding: 8,
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    metadataContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    metadataItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2A2D35',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
    },
    metadataText: {
        color: '#A1A4B2',
        fontSize: 14,
        fontWeight: '500',
    },
    qaContainer: {
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
    question: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    answer: {
        color: '#A1A4B2',
        fontSize: 16,
        lineHeight: 24,
    },
}); 