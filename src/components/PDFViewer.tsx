import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
    ActivityIndicator,
    Platform,
    Share,
    Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface PDFViewerProps {
    url: string;
    title: string;
    onClose: () => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ url, title, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isPdfAvailable, setIsPdfAvailable] = useState<boolean>(false);

    useEffect(() => {
        const checkPdfAvailability = async () => {
            try {
                setLoading(true);
                // If it's a Semantic Scholar URL, use their API to get the PDF URL
                if (url.includes('semanticscholar.org')) {
                    // Extract the paper ID from the URL
                    const paperId = url.split('/').pop();
                    if (!paperId) {
                        throw new Error('Invalid Semantic Scholar URL');
                    }

                    // Use Semantic Scholar's API to get paper details
                    const apiUrl = `https://api.semanticscholar.org/v1/paper/${paperId}`;
                    const response = await fetch(apiUrl);
                    const data = await response.json();

                    if (data.openAccessPdf?.url) {
                        setPdfUrl(data.openAccessPdf.url);
                        setIsPdfAvailable(true);
                    } else if (data.isOpenAccess) {
                        // If paper is open access but no PDF URL is provided, try to construct it
                        const pdfUrl = `https://pdf.semanticscholar.org/${paperId}.pdf`;
                        // Check if the PDF exists
                        const pdfResponse = await fetch(pdfUrl, { method: 'HEAD' });
                        if (pdfResponse.ok) {
                            setPdfUrl(pdfUrl);
                            setIsPdfAvailable(true);
                        } else {
                            setIsPdfAvailable(false);
                            // Auto redirect to paper webpage
                            Linking.openURL(url);
                            onClose();
                        }
                    } else {
                        setIsPdfAvailable(false);
                        // Auto redirect to paper webpage
                        Linking.openURL(url);
                        onClose();
                    }
                } else {
                    // For non-Semantic Scholar URLs, check if it's a PDF
                    if (url.toLowerCase().endsWith('.pdf')) {
                        setPdfUrl(url);
                        setIsPdfAvailable(true);
                    } else {
                        setIsPdfAvailable(false);
                        // Auto redirect to paper webpage
                        Linking.openURL(url);
                        onClose();
                    }
                }
            } catch (err) {
                console.error('Error checking PDF availability:', err);
                setIsPdfAvailable(false);
                // Auto redirect to paper webpage on error
                Linking.openURL(url);
                onClose();
            } finally {
                setLoading(false);
            }
        };

        checkPdfAvailability();
    }, [url, onClose]);

    const handleDownload = async () => {
        if (!pdfUrl) return;
        
        try {
            setLoading(true);
            const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
            const fileUri = `${FileSystem.documentDirectory}${filename}`;

            // Download the file
            const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri);
            
            if (downloadResult.status === 200) {
                // Share the file
                if (Platform.OS === 'ios') {
                    await Sharing.shareAsync(downloadResult.uri);
                } else {
                    await Share.share({
                        url: downloadResult.uri,
                        title: title,
                    });
                }
            } else {
                throw new Error('Failed to download PDF');
            }
        } catch (err) {
            setError('Failed to download PDF. Please try again.');
            console.error('Download error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenInBrowser = () => {
        Linking.openURL(url);
        onClose();
    };

    // Create the PDF.js viewer URL with additional parameters
    const pdfViewerUrl = pdfUrl ? 
        `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(pdfUrl)}&pagemode=none&toolbar=0&navpanes=0&scrollbar=1&view=FitH` :
        null;

    console.log('PDF Viewer URL:', pdfViewerUrl);

    // Show loading state while checking PDF availability
    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title} numberOfLines={1}>
                        {title}
                    </Text>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={onClose}
                    >
                        <Icon name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2563EB" />
                    <Text style={styles.loadingText}>Checking PDF availability...</Text>
                </View>
            </View>
        );
    }

    // If no PDF is available, show a brief message before redirecting
    if (!isPdfAvailable) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title} numberOfLines={1}>
                        {title}
                    </Text>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={onClose}
                    >
                        <Icon name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
                <View style={styles.errorContainer}>
                    <Icon name="description" size={48} color="#FF5B5B" />
                    <Text style={styles.errorText}>Redirecting to paper webpage...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title} numberOfLines={1}>
                    {title}
                </Text>
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleOpenInBrowser}
                    >
                        <Icon name="open-in-browser" size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleDownload}
                        disabled={loading || !pdfUrl}
                    >
                        <Icon name="download" size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={onClose}
                    >
                        <Icon name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {error ? (
                <View style={styles.errorContainer}>
                    <Icon name="error-outline" size={48} color="#FF5B5B" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => {
                            setError(null);
                            setLoading(true);
                            setPdfUrl(null);
                        }}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.pdfContainer}>
                    <WebView
                        source={{ uri: pdfViewerUrl! }}
                        style={styles.webview}
                        onLoadStart={() => {
                            console.log('WebView load started');
                            setLoading(true);
                        }}
                        onLoadEnd={() => {
                            console.log('WebView load ended');
                            setLoading(false);
                        }}
                        onError={(syntheticEvent) => {
                            const { nativeEvent } = syntheticEvent;
                            console.error('WebView error:', nativeEvent);
                            setError('Failed to load PDF. Please try again or open in browser.');
                        }}
                        onHttpError={(syntheticEvent) => {
                            const { nativeEvent } = syntheticEvent;
                            console.error('WebView HTTP error:', nativeEvent);
                            setError(`HTTP Error: ${nativeEvent.statusCode}`);
                        }}
                        onNavigationStateChange={(navState) => {
                            console.log('Navigation state changed:', navState);
                        }}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        startInLoadingState={true}
                        scalesPageToFit={true}
                        originWhitelist={['*']}
                        mixedContentMode="always"
                        allowsFullscreenVideo={true}
                        allowsInlineMediaPlayback={true}
                        mediaPlaybackRequiresUserAction={false}
                        cacheEnabled={true}
                        cacheMode="LOAD_CACHE_ELSE_NETWORK"
                    />
                    {loading && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#2563EB" />
                            <Text style={styles.loadingText}>Loading PDF...</Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
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
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginRight: 16,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        padding: 8,
        marginLeft: 8,
    },
    pdfContainer: {
        flex: 1,
        position: 'relative',
    },
    webview: {
        flex: 1,
        backgroundColor: '#181A20',
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(24, 26, 32, 0.8)',
    },
    loadingText: {
        color: '#fff',
        fontSize: 16,
        marginTop: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    errorText: {
        color: '#FF5B5B',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: '#2563EB',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
}); 