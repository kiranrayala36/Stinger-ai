import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
    ActivityIndicator,
    Modal,
    TextInput,
    ScrollView,
    Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { researchService } from '../services/researchService';
import { PDFHistory } from '../types/research';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PDFUploaderProps {
    onClose: () => void;
}

export const PDFUploader: React.FC<PDFUploaderProps> = ({ onClose }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pdfUri, setPdfUri] = useState<string | null>(null);
    const [pdfName, setPdfName] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState<string | null>(null);
    const [isAskingQuestion, setIsAskingQuestion] = useState(false);

    const analyzePDF = async (fileUri: string): Promise<{ summary: string; keyPoints: string[] }> => {
        // TODO: Implement actual AI analysis here
        // This is a mock implementation
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    summary: "This is a sample summary of the uploaded research paper...",
                    keyPoints: [
                        "Key finding 1",
                        "Important methodology",
                        "Significant results"
                    ]
                });
            }, 2000);
        });
    };

    const savePDFHistory = async (history: PDFHistory) => {
        try {
            const existingHistory = await AsyncStorage.getItem('pdf_history');
            const historyArray = existingHistory ? JSON.parse(existingHistory) : [];
            historyArray.unshift(history);
            await AsyncStorage.setItem('pdf_history', JSON.stringify(historyArray));
        } catch (error) {
            console.error('Error saving PDF history:', error);
        }
    };

    const handleUpload = async () => {
        try {
            setLoading(true);
            setError(null);

            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });

            if (result.canceled) {
                return;
            }

            const file = result.assets[0];
            
            // Check file size (10MB limit)
            const fileInfo = await FileSystem.getInfoAsync(file.uri);
            if (fileInfo.exists && 'size' in fileInfo && fileInfo.size > 10 * 1024 * 1024) {
                throw new Error('File size exceeds 10MB limit. Please choose a smaller file.');
            }

            setPdfUri(file.uri);
            setPdfName(file.name);

            // Read the PDF file
            const fileContent = await FileSystem.readAsStringAsync(file.uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            if (!fileContent) {
                throw new Error('Failed to read PDF content. The file might be corrupted.');
            }

            // Analyze the PDF
            const analysisResult = await researchService.analyzeUploadedPDF(fileContent, file.name);
            setAnalysis(analysisResult);

            const pdfHistory: PDFHistory = {
                id: Date.now().toString(),
                fileName: file.name,
                summary: analysisResult,
                keyPoints: [],
                uploadDate: new Date().toISOString(),
                fileSize: fileInfo.exists ? fileInfo.size : 0
            };

            await savePDFHistory(pdfHistory);
            onClose();

        } catch (err) {
            console.error('Error uploading PDF:', err);
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Failed to upload PDF. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAskQuestion = async () => {
        if (!question.trim() || !pdfUri) return;

        try {
            setIsAskingQuestion(true);
            setError(null);

            const fileContent = await FileSystem.readAsStringAsync(pdfUri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            const answer = await researchService.askQuestionAboutPDF(fileContent, question);
            setAnswer(answer);
            setQuestion('');

        } catch (err) {
            console.error('Error asking question:', err);
            setError('Failed to get answer. Please try again.');
        } finally {
            setIsAskingQuestion(false);
        }
    };

    const handleClose = () => {
        setIsVisible(false);
        setPdfUri(null);
        setPdfName(null);
        setAnalysis(null);
        setQuestion('');
        setAnswer(null);
        onClose();
    };

    return (
        <>
            <TouchableOpacity
                style={styles.fab}
                onPress={() => setIsVisible(true)}
            >
                <Icon name="upload-file" size={24} color="#fff" />
            </TouchableOpacity>

            <Modal
                visible={isVisible}
                animationType="slide"
                onRequestClose={handleClose}
            >
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Upload PDF</Text>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={handleClose}
                        >
                            <Icon name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        {!pdfUri ? (
                            <View style={styles.uploadSection}>
                                <TouchableOpacity
                                    style={styles.uploadButton}
                                    onPress={handleUpload}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <Icon name="upload-file" size={24} color="#fff" />
                                            <Text style={styles.uploadText}>Upload PDF</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                <View style={styles.pdfInfo}>
                                    <Icon name="description" size={24} color="#2563EB" />
                                    <Text style={styles.pdfName} numberOfLines={1}>
                                        {pdfName}
                                    </Text>
                                </View>

                                {analysis && (
                                    <View style={styles.analysisSection}>
                                        <Text style={styles.sectionTitle}>Analysis</Text>
                                        <Text style={styles.analysisText}>{analysis}</Text>
                                    </View>
                                )}

                                <View style={styles.questionSection}>
                                    <Text style={styles.sectionTitle}>Ask Questions</Text>
                                    <TextInput
                                        style={styles.questionInput}
                                        value={question}
                                        onChangeText={setQuestion}
                                        placeholder="Ask a question about the PDF..."
                                        placeholderTextColor="#666"
                                        multiline
                                        editable={!isAskingQuestion}
                                    />
                                    <TouchableOpacity
                                        style={[
                                            styles.askButton,
                                            isAskingQuestion && styles.disabledButton
                                        ]}
                                        onPress={handleAskQuestion}
                                        disabled={isAskingQuestion || !question.trim()}
                                    >
                                        {isAskingQuestion ? (
                                            <ActivityIndicator color="#fff" size="small" />
                                        ) : (
                                            <Text style={styles.askButtonText}>Ask Question</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>

                                {answer && (
                                    <View style={styles.answerSection}>
                                        <Text style={styles.sectionTitle}>Answer</Text>
                                        <Text style={styles.answerText}>{answer}</Text>
                                    </View>
                                )}
                            </>
                        )}

                        {error && (
                            <View style={styles.errorContainer}>
                                <Icon name="error-outline" size={24} color="#FF5B5B" />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
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
    container: {
        flex: 1,
        backgroundColor: '#181A20',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#23262B',
        borderBottomWidth: 1,
        borderBottomColor: '#2A2D35',
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
    },
    closeButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    uploadSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2563EB',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    uploadText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    pdfInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#23262B',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    pdfName: {
        color: '#fff',
        fontSize: 16,
        marginLeft: 12,
        flex: 1,
    },
    analysisSection: {
        backgroundColor: '#23262B',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
    },
    analysisText: {
        color: '#A1A4B2',
        fontSize: 14,
        lineHeight: 20,
    },
    questionSection: {
        backgroundColor: '#23262B',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
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
    askButton: {
        backgroundColor: '#2563EB',
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    askButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    disabledButton: {
        opacity: 0.5,
    },
    answerSection: {
        backgroundColor: '#23262B',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    answerText: {
        color: '#A1A4B2',
        fontSize: 14,
        lineHeight: 20,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 91, 91, 0.1)',
        padding: 16,
        borderRadius: 12,
        marginTop: 16,
    },
    errorText: {
        color: '#FF5B5B',
        fontSize: 14,
        marginLeft: 8,
        flex: 1,
    },
}); 