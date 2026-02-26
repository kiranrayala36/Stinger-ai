import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    RefreshControl,
    Keyboard,
    Platform,
    Animated,
    Dimensions,
    Modal,
    TouchableWithoutFeedback
} from 'react-native';
import { researchService } from '../services/researchService';
import { ResearchResult, ResearchQuery } from '../types/research';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PDFUploader } from '../components/PDFUploader';
import { bookmarkService } from '../services/bookmarkService';
import { debounce } from 'lodash';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ResearchDetail' | 'Bookmarks' | 'PDFHistory'>;

type FilterType = 'year' | 'venue' | 'citations' | 'code' | 'language';

interface FilterOption {
    label: string;
    value: number | string | boolean | null;
}

interface DropdownState {
    type: FilterType;
    options: FilterOption[];
}

const { width } = Dimensions.get('window');

const SkeletonLoader = () => {
    const shimmerValue = new Animated.Value(0);

    useEffect(() => {
        Animated.loop(
            Animated.timing(shimmerValue, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const translateX = shimmerValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-width, width],
    });

    const renderSkeletonItem = () => (
        <View style={styles.paperItem}>
            <View style={styles.paperHeader}>
                <View style={styles.skeletonTitle}>
                    <Animated.View
                        style={[
                            styles.shimmer,
                            {
                                transform: [{ translateX }],
                            },
                        ]}
                    />
                </View>
                <View style={styles.skeletonActions}>
                    <Animated.View
                        style={[
                            styles.shimmer,
                            {
                                transform: [{ translateX }],
                            },
                        ]}
                    />
                </View>
            </View>
            <View style={styles.skeletonAuthors}>
                <Animated.View
                    style={[
                        styles.shimmer,
                        {
                            transform: [{ translateX }],
                        },
                    ]}
                />
            </View>
            <View style={styles.skeletonVenue}>
                <Animated.View
                    style={[
                        styles.shimmer,
                        {
                            transform: [{ translateX }],
                        },
                    ]}
                />
            </View>
            <View style={styles.skeletonAbstract}>
                <Animated.View
                    style={[
                        styles.shimmer,
                        {
                            transform: [{ translateX }],
                        },
                    ]}
                />
            </View>
            <View style={styles.skeletonCodeInfo}>
                <Animated.View
                    style={[
                        styles.shimmer,
                        {
                            transform: [{ translateX }],
                        },
                    ]}
                />
            </View>
        </View>
    );

    return (
        <View style={styles.resultsList}>
            {[...Array(3)].map((_, index) => (
                <View key={index}>{renderSkeletonItem()}</View>
            ))}
        </View>
    );
};

const PaperItem = React.memo(({ 
    item, 
    onBookmarkToggle, 
    isBookmarked,
    onPress 
}: { 
    item: ResearchResult; 
    onBookmarkToggle: (paper: ResearchResult) => void;
    isBookmarked: boolean;
    onPress: () => void;
}) => (
    <TouchableOpacity 
        style={styles.paperItem}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={styles.paperHeader}>
            <Text style={styles.paperTitle} numberOfLines={2}>
                {item.title || 'Untitled'}
            </Text>
            <TouchableOpacity 
                onPress={() => onBookmarkToggle(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Icon
                    name={isBookmarked ? 'bookmark' : 'bookmark-border'}
                    size={24}
                    color="#2563EB"
                />
            </TouchableOpacity>
        </View>
        {Array.isArray(item.metadata?.authors) && item.metadata.authors.length > 0 && (
            <Text style={styles.authors} numberOfLines={1}>
                {item.metadata.authors.map(author => author?.name || '').filter(Boolean).join(', ')}
            </Text>
        )}
        {item.metadata?.venue && (
            <Text style={styles.venue} numberOfLines={1}>
                {item.metadata.venue} ({item.metadata?.year || 'N/A'})
            </Text>
        )}
        <Text style={styles.abstract} numberOfLines={3}>
            {item.abstract || 'No abstract available'}
        </Text>
        {item.metadata?.codeRepository && (
            <View style={styles.codeInfo}>
                <Icon name="code" size={16} color="#4ADE80" />
                <Text style={styles.codeText}>
                    Code available
                </Text>
            </View>
        )}
    </TouchableOpacity>
));

const ITEMS_PER_PAGE = 5;
const VIEWABILITY_CONFIG = {
    minimumViewTime: 3000,
    viewAreaCoveragePercentThreshold: 95,
    waitForInteraction: false
};

export default function ResearchSearchScreen() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ResearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [searchHistory, setSearchHistory] = useState<ResearchQuery[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
    const [selectedMinCitations, setSelectedMinCitations] = useState<number | null>(null);
    const [selectedHasCode, setSelectedHasCode] = useState<boolean | null>(null);
    const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
    const [bookmarkedPapers, setBookmarkedPapers] = useState<Set<string>>(new Set());
    const [showDropdown, setShowDropdown] = useState(false);
    const [currentDropdown, setCurrentDropdown] = useState<DropdownState | null>(null);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isRateLimited, setIsRateLimited] = useState(false);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
    const MAX_RESULTS = 50;
    const BATCH_SIZE = 10;
    const navigation = useNavigation<NavigationProp>();

    const fadeAnim = new Animated.Value(0);
    const slideAnim = new Animated.Value(50);

    useEffect(() => {
        loadSearchHistory();
        initializeBookmarks();
    }, []);

    useEffect(() => {
        if (showFilters) {
            animateContent();
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(50);
        }
    }, [showFilters]);

    const animateContent = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const loadSearchHistory = async () => {
        try {
            const history = await researchService.getResearchHistory();
            setSearchHistory(history);
        } catch (err) {
            console.error('Error loading search history:', err);
        }
    };

    const initializeBookmarks = async () => {
        await bookmarkService.initialize();
        const bookmarks = await bookmarkService.getBookmarks();
        setBookmarkedPapers(new Set(bookmarks.map(b => b.id)));
    };

    const handleBookmarkToggle = async (paper: ResearchResult) => {
        const isNowBookmarked = await bookmarkService.toggleBookmark(paper);
        setBookmarkedPapers(prev => {
            const newSet = new Set(prev);
            if (isNowBookmarked) {
                newSet.add(paper.id);
            } else {
                newSet.delete(paper.id);
            }
            return newSet;
        });
    };

    const debouncedSearch = React.useCallback(
        debounce(async (searchQuery: string, currentOffset: number = 0) => {
            if (!searchQuery.trim() || isRateLimited) return;
            
            if (currentOffset === 0) {
                setLoading(true);
                setError(null);
                setResults([]);
            } else {
                setLoadingMore(true);
            }
            
            try {
                // Cancel any pending search
                if (searchTimeoutRef.current) {
                    clearTimeout(searchTimeoutRef.current);
                }
                
                const searchResults = await researchService.searchResearch(searchQuery, currentOffset);
                if (searchResults.length === 0) {
                    if (currentOffset === 0) {
                        setError('No results found. Try a different search term.');
                    }
                    setHasMore(false);
                } else {
                    const updatedResults = currentOffset === 0 
                        ? searchResults 
                        : [...results, ...searchResults];
                    
                    const limitedResults = updatedResults.slice(0, MAX_RESULTS);
                    setResults(limitedResults);
                    setHasMore(limitedResults.length < MAX_RESULTS && searchResults.length === BATCH_SIZE);
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An error occurred while searching';
                if (errorMessage.toLowerCase().includes('rate limit')) {
                    setIsRateLimited(true);
                    setError('Rate limit reached. Please wait a moment before searching again.');
                    // Auto-retry after 30 seconds
                    searchTimeoutRef.current = setTimeout(() => {
                        setIsRateLimited(false);
                        setError(null);
                    }, 30000);
                } else {
                    setError(errorMessage);
                }
            } finally {
                setLoading(false);
                setLoadingMore(false);
            }
        }, 1000), // Increased debounce to 1 second to reduce API calls
        [results, isRateLimited]
    );

    const handleSearch = React.useCallback(() => {
        if (!query.trim()) return;
        
        setOffset(0);
        setHasMore(true);
        Keyboard.dismiss();
        setShowHistory(false);
        setShowFilters(false);
        debouncedSearch(query);
    }, [query, debouncedSearch]);

    const handleLoadMore = React.useCallback(() => {
        if (loadingMore || !hasMore || loading || results.length >= MAX_RESULTS) return;
        
        const nextOffset = offset + BATCH_SIZE;
        setOffset(nextOffset);
        debouncedSearch(query, nextOffset);
    }, [query, offset, loadingMore, hasMore, loading, results.length, debouncedSearch]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadSearchHistory();
        setRefreshing(false);
    };

    const handleHistoryItemPress = (historyItem: ResearchQuery) => {
        setQuery(historyItem.query_text);
        handleSearch();
    };

    const clearFilters = () => {
        setSelectedYear(null);
        setSelectedVenue(null);
        setSelectedMinCitations(null);
        setSelectedHasCode(null);
        setSelectedLanguage(null);
    };

    const getFilteredResults = () => {
        if (!results || !Array.isArray(results)) {
            return [];
        }

        let filtered = [...results];
        
        if (selectedYear) {
            filtered = filtered.filter(paper => paper.metadata?.year === selectedYear);
        }
        
        if (selectedVenue) {
            filtered = filtered.filter(paper => paper.metadata?.venue === selectedVenue);
        }
        
        if (selectedMinCitations) {
            filtered = filtered.filter(paper => 
                typeof paper.metadata?.citations === 'number' && paper.metadata.citations >= selectedMinCitations
            );
        }
        
        if (selectedHasCode !== null) {
            filtered = filtered.filter(paper => 
                selectedHasCode ? paper.metadata?.codeRepository !== null : paper.metadata?.codeRepository === null
            );
        }
        
        if (selectedLanguage) {
            filtered = filtered.filter(paper => 
                paper.metadata?.codeRepository?.language === selectedLanguage
            );
        }
        
        return filtered;
    };

    const handleDropdownSelect = (value: number | string | boolean | null) => {
        if (!currentDropdown) return;

        switch (currentDropdown.type) {
            case 'year':
                setSelectedYear(value as number | null);
                break;
            case 'venue':
                setSelectedVenue(value as string | null);
                break;
            case 'citations':
                setSelectedMinCitations(value as number | null);
                break;
            case 'code':
                setSelectedHasCode(value as boolean | null);
                break;
            case 'language':
                setSelectedLanguage(value as string | null);
                break;
        }
        setShowDropdown(false);
        setCurrentDropdown(null);
    };

    const renderDropdownModal = () => (
        <Modal
            visible={showDropdown}
            transparent
            animationType="fade"
            onRequestClose={() => {
                setShowDropdown(false);
                setCurrentDropdown(null);
            }}
        >
            <TouchableWithoutFeedback onPress={() => {
                setShowDropdown(false);
                setCurrentDropdown(null);
            }}>
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.dropdownModal}>
                            <View style={styles.dropdownHeader}>
                                <Text style={styles.dropdownTitle}>
                                    {currentDropdown?.type === 'year' ? 'Select Year' :
                                     currentDropdown?.type === 'venue' ? 'Select Venue' :
                                     currentDropdown?.type === 'citations' ? 'Select Citations' :
                                     currentDropdown?.type === 'code' ? 'Select Code Status' :
                                     'Select Language'}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setShowDropdown(false);
                                        setCurrentDropdown(null);
                                    }}
                                >
                                    <Icon name="close" size={24} color="#A1A4B2" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={styles.dropdownOptions}>
                                {currentDropdown?.options.map((option, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.dropdownOption}
                                        onPress={() => handleDropdownSelect(option.value)}
                                    >
                                        <Text style={styles.dropdownOptionText}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );

    const renderPaperItem = React.useCallback(({ item }: { item: ResearchResult }) => (
        <PaperItem
            item={item}
            onBookmarkToggle={handleBookmarkToggle}
            isBookmarked={bookmarkedPapers.has(item.id)}
            onPress={() => navigation.navigate('ResearchDetail', { 
                paperId: item.id,
                paperData: item 
            })}
        />
    ), [bookmarkedPapers, handleBookmarkToggle, navigation]);

    const keyExtractor = React.useCallback((item: ResearchResult) => {
        // Create a truly unique key by combining multiple fields
        return `${item.id}-${Date.now()}`;
    }, []);

    const getItemLayout = React.useCallback((data: any, index: number) => ({
        length: 200,
        offset: 200 * index,
        index,
    }), []);

    const memoizedResults = React.useMemo(() => {
        const results = getFilteredResults();
        // Add index to ensure uniqueness
        return results.map((item, index) => ({
            ...item,
            uniqueKey: `${item.id}-${index}`
        }));
    }, [getFilteredResults]);

    const onViewableItemsChanged = React.useCallback(({ viewableItems }: any) => {
        console.log('Visible items:', viewableItems.length);
    }, []);

    const EmptyComponent = () => (
        <View style={styles.emptyContainer}>
            {loading ? (
                <ActivityIndicator size="large" color="#2563EB" />
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Icon name="error-outline" size={48} color="#FF5B5B" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={handleSearch}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.emptyContent}>
                    <Icon name="search" size={48} color="#A1A4B2" />
                    <Text style={styles.emptyText}>
                        Enter a search query to find research papers
                    </Text>
                </View>
            )}
        </View>
    );

    const renderFilters = () => (
        <Animated.View
            style={[
                styles.filtersContainer,
                {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                }
            ]}
        >
            <View style={styles.filterHeader}>
                <Text style={styles.filterTitle}>Filters</Text>
                <TouchableOpacity onPress={clearAll}>
                    <Text style={styles.clearFiltersText}>Clear All</Text>
                </TouchableOpacity>
            </View>
            {renderDropdownModal()}
        </Animated.View>
    );

    const renderHistoryItem = React.useCallback(({ item }: { item: ResearchQuery }) => (
        <TouchableOpacity
            style={styles.historyItem}
            onPress={() => handleHistoryItemPress(item)}
        >
            <Icon name="history" size={20} color="#A1A4B2" style={styles.historyIcon} />
            <View style={styles.historyContent}>
                <Text style={styles.historyText}>{item.query_text}</Text>
                <Text style={styles.historyDate}>
                    {new Date(item.created_at).toLocaleDateString()}
                </Text>
            </View>
        </TouchableOpacity>
    ), []);

    const clearHistory = async () => {
        try {
            await researchService.clearResearchHistory();
            setSearchHistory([]);
            setResults([]);
            setQuery('');
            setShowHistory(false);
        } catch (error) {
            console.error('Error clearing search history:', error);
        }
    };

    const clearAll = async () => {
        clearFilters();
        await clearHistory();
    };

    const renderFooter = () => {
        if (!loadingMore) {
            if (results.length >= MAX_RESULTS) {
                return (
                    <View style={styles.loadingMore}>
                        <Text style={styles.maxResultsText}>
                            Showing maximum of {MAX_RESULTS} results
                        </Text>
                    </View>
                );
            }
            return null;
        }
        return (
            <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color="#2563EB" />
            </View>
        );
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    // Update search button to show rate limit status
    const renderSearchButton = () => (
        <TouchableOpacity
            style={[
                styles.searchButton,
                (loading || !query.trim() || isRateLimited) && styles.disabledButton
            ]}
            onPress={handleSearch}
            disabled={loading || !query.trim() || isRateLimited}
        >
            {loading ? (
                <ActivityIndicator color="#fff" />
            ) : isRateLimited ? (
                <Text style={styles.searchButtonText}>Please wait...</Text>
            ) : (
                <Text style={styles.searchButtonText}>Search</Text>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <Icon name="search" size={20} color="#A1A4B2" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Search for research papers..."
                        placeholderTextColor="#A1A4B2"
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                        onFocus={() => setShowHistory(true)}
                    />
                    {query.length > 0 && (
                        <TouchableOpacity
                            style={styles.clearButton}
                            onPress={() => setQuery('')}
                        >
                            <Icon name="close" size={20} color="#A1A4B2" />
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.searchActions}>
                    <TouchableOpacity
                        style={[styles.filterButton, showFilters && styles.filterButtonActive]}
                        onPress={() => {
                            setShowFilters(!showFilters);
                            if (!showFilters) {
                                animateContent();
                            }
                        }}
                    >
                        <Icon 
                            name="filter-list" 
                            size={20} 
                            color={showFilters ? '#2563EB' : '#A1A4B2'} 
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.bookmarkButton}
                        onPress={() => navigation.navigate('Bookmarks')}
                    >
                        <Icon name="bookmark" size={20} color="#A1A4B2" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.bookmarkButton}
                        onPress={() => navigation.navigate('PDFHistory')}
                    >
                        <Icon name="description" size={20} color="#A1A4B2" />
                    </TouchableOpacity>
                    {renderSearchButton()}
                </View>
            </View>

            {showFilters && renderFilters()}

            {loading ? (
                <SkeletonLoader />
            ) : showHistory && query.length === 0 ? (
                <View style={styles.historyContainer}>
                    <View style={styles.historyHeader}>
                        <Text style={styles.historyTitle}>Recent Searches</Text>
                        {searchHistory.length > 0 && (
                            <TouchableOpacity
                                style={styles.clearHistoryButton}
                                onPress={clearHistory}
                            >
                                <Text style={styles.clearHistoryText}>Clear all</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <FlatList
                        data={searchHistory}
                        renderItem={renderHistoryItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.historyList}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyHistoryContainer}>
                                <Text style={styles.emptyHistoryText}>No search history</Text>
                            </View>
                        }
                    />
                </View>
            ) : (
                <FlatList
                    data={memoizedResults}
                    renderItem={renderPaperItem}
                    keyExtractor={(item) => item.uniqueKey}
                    getItemLayout={getItemLayout}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={3}
                    windowSize={3}
                    initialNumToRender={ITEMS_PER_PAGE}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={VIEWABILITY_CONFIG}
                    updateCellsBatchingPeriod={50}
                    ListFooterComponent={renderFooter}
                    contentContainerStyle={styles.resultsList}
                    ListEmptyComponent={EmptyComponent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#2563EB']}
                            tintColor="#2563EB"
                        />
                    }
                />
            )}

            <PDFUploader onClose={() => {}} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#181A20',
    },
    searchContainer: {
        padding: 16,
        backgroundColor: '#23262B',
        borderBottomWidth: 1,
        borderBottomColor: '#2A2D35',
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2A2D35',
        borderRadius: 12,
        marginBottom: 8,
    },
    searchIcon: {
        padding: 12,
    },
    searchInput: {
        flex: 1,
        height: 48,
        fontSize: 14,
        color: '#fff',
    },
    clearButton: {
        padding: 12,
    },
    searchActions: {
        flexDirection: 'row',
        gap: 8,
    },
    filterButton: {
        width: 48,
        height: 48,
        backgroundColor: '#2A2D35',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterButtonActive: {
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
    },
    bookmarkButton: {
        width: 48,
        height: 48,
        backgroundColor: '#2A2D35',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchButton: {
        flex: 1,
        height: 48,
        backgroundColor: '#2563EB',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.5,
    },
    searchButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    filtersContainer: {
        backgroundColor: '#23262B',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2D35',
    },
    filterHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    filterTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    clearFiltersText: {
        color: '#2563EB',
        fontSize: 14,
        fontWeight: '500',
    },
    filterGrid: {
        gap: 16,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 16,
    },
    filterItem: {
        flex: 1,
    },
    filterLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#A1A4B2',
        marginBottom: 8,
    },
    dropdownContainer: {
        backgroundColor: '#2A2D35',
        borderRadius: 12,
        overflow: 'hidden',
    },
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    dropdownButtonText: {
        color: '#fff',
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropdownModal: {
        backgroundColor: '#23262B',
        borderRadius: 16,
        width: '80%',
        maxHeight: '80%',
        overflow: 'hidden',
    },
    dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2D35',
    },
    dropdownTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    dropdownOptions: {
        maxHeight: 300,
    },
    dropdownOption: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2D35',
    },
    dropdownOptionText: {
        fontSize: 14,
        color: '#fff',
    },
    resultsList: {
        padding: 16,
    },
    paperItem: {
        backgroundColor: '#23262B',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    paperHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    paperTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginRight: 8,
    },
    citationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 230, 199, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    citationText: {
        fontSize: 12,
        color: '#FFE6C7',
        marginLeft: 4,
    },
    authors: {
        fontSize: 14,
        color: '#A1A4B2',
        marginBottom: 4,
    },
    paperVenue: {
        fontSize: 14,
        color: '#A1A4B2',
        marginBottom: 8,
    },
    paperAbstract: {
        fontSize: 14,
        color: '#A1A4B2',
        lineHeight: 20,
        marginBottom: 12,
    },
    codeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    codeLanguage: {
        fontSize: 12,
        color: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginRight: 8,
    },
    codeStars: {
        fontSize: 12,
        color: '#A1A4B2',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#181A20',
    },
    emptyContent: {
        alignItems: 'center',
    },
    errorContainer: {
        alignItems: 'center',
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
        borderRadius: 16,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        color: '#A1A4B2',
        fontSize: 16,
        marginTop: 16,
    },
    historyContainer: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'transparent',
    },
    historyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    clearHistoryButton: {
        padding: 8,
    },
    clearHistoryText: {
        color: '#A1A4B2',
        fontSize: 14,
        fontWeight: '500',
    },
    historyList: {
        padding: 16,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    historyIcon: {
        marginRight: 12,
    },
    historyContent: {
        flex: 1,
    },
    historyText: {
        fontSize: 14,
        color: '#fff',
        marginBottom: 4,
    },
    historyDate: {
        fontSize: 12,
        color: '#A1A4B2',
    },
    emptyHistoryContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyHistoryText: {
        color: '#A1A4B2',
        fontSize: 14,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#181A20',
    },
    paperActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    skeletonTitle: {
        height: 24,
        backgroundColor: '#2A2D35',
        borderRadius: 4,
        width: '80%',
        marginBottom: 8,
        overflow: 'hidden',
    },
    skeletonActions: {
        width: 80,
        height: 24,
        backgroundColor: '#2A2D35',
        borderRadius: 4,
        overflow: 'hidden',
    },
    skeletonAuthors: {
        height: 16,
        backgroundColor: '#2A2D35',
        borderRadius: 4,
        width: '60%',
        marginBottom: 8,
        overflow: 'hidden',
    },
    skeletonVenue: {
        height: 16,
        backgroundColor: '#2A2D35',
        borderRadius: 4,
        width: '40%',
        marginBottom: 8,
        overflow: 'hidden',
    },
    skeletonAbstract: {
        height: 60,
        backgroundColor: '#2A2D35',
        borderRadius: 4,
        marginBottom: 12,
        overflow: 'hidden',
    },
    skeletonCodeInfo: {
        height: 24,
        backgroundColor: '#2A2D35',
        borderRadius: 4,
        width: '30%',
        overflow: 'hidden',
    },
    shimmer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        transform: [{ skewX: '-20deg' }],
    },
    venue: {
        fontSize: 14,
        color: '#A1A4B2',
        marginBottom: 8,
    },
    abstract: {
        fontSize: 14,
        color: '#A1A4B2',
        lineHeight: 20,
        marginBottom: 12,
    },
    codeText: {
        fontSize: 12,
        color: '#4ADE80',
        marginLeft: 8,
    },
    loadingMore: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    maxResultsText: {
        color: '#A1A4B2',
        fontSize: 14,
        fontStyle: 'italic',
    },
}); 