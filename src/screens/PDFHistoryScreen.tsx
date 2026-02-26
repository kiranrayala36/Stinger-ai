import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PDFHistory } from '../types/research';

export default function PDFHistoryScreen() {
    const [history, setHistory] = useState<PDFHistory[]>([]);
    const [selectedPDF, setSelectedPDF] = useState<PDFHistory | null>(null);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const historyData = await AsyncStorage.getItem('pdf_history');
            if (historyData) {
                setHistory(JSON.parse(historyData));
            }
        } catch (error) {
            console.error('Error loading PDF history:', error);
        }
    };

    const deletePDFHistory = async (id: string) => {
        Alert.alert(
            'Delete PDF',
            'Are you sure you want to delete this PDF history?',
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
                            const updatedHistory = history.filter(item => item.id !== id);
                            await AsyncStorage.setItem('pdf_history', JSON.stringify(updatedHistory));
                            setHistory(updatedHistory);
                            if (selectedPDF?.id === id) {
                                setSelectedPDF(null);
                            }
                        } catch (error) {
                            console.error('Error deleting PDF history:', error);
                        }
                    }
                }
            ]
        );
    };

    const renderHistoryItem = ({ item }: { item: PDFHistory }) => (
        <TouchableOpacity
            style={styles.historyItem}
            onPress={() => setSelectedPDF(item)}
        >
            <View style={styles.itemHeader}>
                <Icon name="description" size={24} color="#2563EB" />
                <View style={styles.itemInfo}>
                    <Text style={styles.fileName}>{item.fileName}</Text>
                    <Text style={styles.uploadDate}>
                        {new Date(item.uploadDate).toLocaleDateString()}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => deletePDFHistory(item.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Icon name="delete" size={24} color="#FF5B5B" />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={history}
                renderItem={renderHistoryItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="description" size={48} color="#A1A4B2" />
                        <Text style={styles.emptyText}>No PDF history found</Text>
                    </View>
                }
            />

            <Modal
                visible={!!selectedPDF}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSelectedPDF(null)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>PDF Summary</Text>
                            <TouchableOpacity onPress={() => setSelectedPDF(null)}>
                                <Icon name="close" size={24} color="#A1A4B2" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {selectedPDF && (
                                <>
                                    <Text style={styles.summaryTitle}>Summary</Text>
                                    <Text style={styles.summaryText}>{selectedPDF.summary}</Text>
                                    <Text style={styles.keyPointsTitle}>Key Points</Text>
                                    {selectedPDF.keyPoints.map((point, index) => (
                                        <View key={index} style={styles.keyPoint}>
                                            <Icon name="check-circle" size={16} color="#4ADE80" />
                                            <Text style={styles.keyPointText}>{point}</Text>
                                        </View>
                                    ))}
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#181A20',
    },
    list: {
        padding: 16,
    },
    historyItem: {
        backgroundColor: '#23262B',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemInfo: {
        flex: 1,
        marginLeft: 12,
    },
    fileName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    uploadDate: {
        fontSize: 12,
        color: '#A1A4B2',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyText: {
        color: '#A1A4B2',
        fontSize: 16,
        marginTop: 16,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#23262B',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    modalBody: {
        padding: 16,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    summaryText: {
        fontSize: 14,
        color: '#A1A4B2',
        lineHeight: 20,
        marginBottom: 16,
    },
    keyPointsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    keyPoint: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    keyPointText: {
        fontSize: 14,
        color: '#A1A4B2',
        marginLeft: 8,
        flex: 1,
    },
}); 