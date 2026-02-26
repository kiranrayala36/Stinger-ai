import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    TextInput,
    Animated,
    Platform,
    Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { bookmarkService, BookmarkedPaper } from '../services/bookmarkService';

type RootStackParamList = {
    ResearchDetail: { paperId: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ResearchDetail'>;

type SortOption = 'date' | 'title' | 'authors';

export default function BookmarksScreen() {
    const [bookmarks, setBookmarks] = useState<BookmarkedPaper[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('date');
    const [showSortOptions, setShowSortOptions] = useState(false);
    const navigation = useNavigation<NavigationProp>();

    const fadeAnim = new Animated.Value(0);
    const slideAnim = new Animated.Value(50);

    const loadBookmarks = async () => {
        try {
            const bookmarkedPapers = await bookmarkService.getBookmarks();
            setBookmarks(bookmarkedPapers);
        } catch (error) {
            console.error('Error loading bookmarks:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBookmarks();
        animateContent();
    }, []);

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

    const onRefresh = async () => {
        setRefreshing(true);
        await loadBookmarks();
        setRefreshing(false);
    };

    const handleRemoveBookmark = async (paperId: string) => {
        await bookmarkService.removeBookmark(paperId);
        setBookmarks(prev => prev.filter(b => b.id !== paperId));
    };

    const getSortedBookmarks = () => {
        let sorted = [...bookmarks];
        switch (sortBy) {
            case 'date':
                sorted.sort((a, b) => new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime());
                break;
            case 'title':
                sorted.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'authors':
                sorted.sort((a, b) => a.metadata.authors[0].localeCompare(b.metadata.authors[0]));
                break;
        }
        return sorted;
    };

    const getFilteredBookmarks = () => {
        const sorted = getSortedBookmarks();
        if (!searchQuery) return sorted;
        
        const query = searchQuery.toLowerCase();
        return sorted.filter(paper => 
            paper.title.toLowerCase().includes(query) ||
            paper.metadata.authors.some(author => author.toLowerCase().includes(query)) ||
            paper.metadata.venue.toLowerCase().includes(query)
        );
    };

    const renderBookmarkItem = ({ item, index }: { item: BookmarkedPaper; index: number }) => (
        <Animated.View
            style={[
                styles.bookmarkItem,
                {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                }
            ]}
        >
            <TouchableOpacity
                style={styles.bookmarkContent}
                onPress={() => navigation.navigate('ResearchDetail', { paperId: item.id })}
            >
                <View style={styles.bookmarkHeader}>
                    <Text style={styles.bookmarkTitle}>{item.title}</Text>
                    <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveBookmark(item.id)}
                    >
                        <Icon name="close" size={20} color="#A1A4B2" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.bookmarkAuthors}>
                    {item.metadata.authors.join(', ')} • {item.metadata.year}
                </Text>
                <Text style={styles.bookmarkVenue}>{item.metadata.venue}</Text>
                <View style={styles.bookmarkFooter}>
                    <View style={styles.bookmarkDateContainer}>
                        <Icon name="bookmark" size={16} color="#2563EB" />
                        <Text style={styles.bookmarkDate}>
                            {new Date(item.bookmarkedAt).toLocaleDateString()}
                        </Text>
                    </View>
                    {item.metadata.citations > 0 && (
                        <View style={styles.citationBadge}>
                            <Icon name="star" size={12} color="#FFD700" />
                            <Text style={styles.citationText}>{item.metadata.citations}</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        </Animated.View>
    );

    const renderSortOptions = () => (
        <View style={styles.sortOptionsContainer}>
            <TouchableOpacity
                style={[styles.sortOption, sortBy === 'date' && styles.sortOptionSelected]}
                onPress={() => setSortBy('date')}
            >
                <Icon name="access-time" size={16} color={sortBy === 'date' ? '#2563EB' : '#A1A4B2'} />
                <Text style={[styles.sortOptionText, sortBy === 'date' && styles.sortOptionTextSelected]}>
                    Date
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.sortOption, sortBy === 'title' && styles.sortOptionSelected]}
                onPress={() => setSortBy('title')}
            >
                <Icon name="sort-by-alpha" size={16} color={sortBy === 'title' ? '#2563EB' : '#A1A4B2'} />
                <Text style={[styles.sortOptionText, sortBy === 'title' && styles.sortOptionTextSelected]}>
                    Title
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.sortOption, sortBy === 'authors' && styles.sortOptionSelected]}
                onPress={() => setSortBy('authors')}
            >
                <Icon name="people" size={16} color={sortBy === 'authors' ? '#2563EB' : '#A1A4B2'} />
                <Text style={[styles.sortOptionText, sortBy === 'authors' && styles.sortOptionTextSelected]}>
                    Authors
                </Text>
            </TouchableOpacity>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Bookmarks</Text>
                <TouchableOpacity
                    style={styles.sortButton}
                    onPress={() => setShowSortOptions(!showSortOptions)}
                >
                    <Icon name="sort" size={24} color="#A1A4B2" />
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <Icon name="search" size={20} color="#A1A4B2" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search bookmarks..."
                    placeholderTextColor="#A1A4B2"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => setSearchQuery('')}
                    >
                        <Icon name="close" size={20} color="#A1A4B2" />
                    </TouchableOpacity>
                ) : null}
            </View>

            {showSortOptions && renderSortOptions()}

            <FlatList
                data={getFilteredBookmarks()}
                renderItem={renderBookmarkItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.bookmarksList}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="bookmark-border" size={64} color="#A1A4B2" />
                        <Text style={styles.emptyTitle}>No bookmarks yet</Text>
                        <Text style={styles.emptyText}>
                            {searchQuery 
                                ? 'No matching bookmarks found'
                                : 'Bookmark papers to read them later'}
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#181A20',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 16,
        backgroundColor: '#23262B',
        borderBottomWidth: 1,
        borderBottomColor: '#2A2D35',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: '#fff',
    },
    sortButton: {
        padding: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2A2D35',
        margin: 16,
        marginTop: 8,
        borderRadius: 12,
        paddingHorizontal: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 48,
        color: '#fff',
        fontSize: 16,
    },
    clearButton: {
        padding: 8,
    },
    sortOptionsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    sortOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2A2D35',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
    },
    sortOptionSelected: {
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
    },
    sortOptionText: {
        color: '#A1A4B2',
        marginLeft: 4,
        fontSize: 14,
    },
    sortOptionTextSelected: {
        color: '#2563EB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#181A20',
    },
    bookmarksList: {
        padding: 16,
    },
    bookmarkItem: {
        backgroundColor: '#23262B',
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    bookmarkContent: {
        padding: 16,
    },
    bookmarkHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    bookmarkTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginRight: 8,
    },
    removeButton: {
        padding: 4,
    },
    bookmarkAuthors: {
        fontSize: 14,
        color: '#A1A4B2',
        marginBottom: 4,
    },
    bookmarkVenue: {
        fontSize: 14,
        color: '#A1A4B2',
        marginBottom: 8,
    },
    bookmarkFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    bookmarkDateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bookmarkDate: {
        fontSize: 12,
        color: '#A1A4B2',
        marginLeft: 4,
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
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        marginTop: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        color: '#A1A4B2',
        fontSize: 16,
        textAlign: 'center',
    },
}); 