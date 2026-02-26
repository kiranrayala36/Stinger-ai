import React, { useState, useEffect, useCallback, useRef, type RefObject } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
  Animated,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Icon } from 'react-native-elements';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { chatStorageService, ChatSession } from '../services/chatStorageService';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';

type ChatHistoryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChatHistory'>;

const CATEGORIES = ['All', 'Recent', 'Favorites'];

type SwipeableRef = RefObject<Swipeable | null>;

const ChatHistoryScreen = () => {
  const navigation = useNavigation<ChatHistoryScreenNavigationProp>();
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  const swipeableRefs = useRef<{ [key: string]: SwipeableRef }>({});

  const loadFavorites = async () => {
    const favs = await chatStorageService.getFavorites();
    setFavorites(favs);
  };

  const loadChats = async () => {
    try {
      const sessions = await chatStorageService.getChatSessions();
      setChats(sessions.sort((a, b) => b.lastModified - a.lastModified));
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadChats();
    loadFavorites();
    return () => {
      // Cleanup swipeable refs on unmount
      swipeableRefs.current = {};
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadChats();
    loadFavorites();
  }, []);

  const handleDeleteChat = async (id: string) => {
    try {
      await chatStorageService.deleteChatSession(id);
      setChats(chats.filter(chat => chat.id !== id));
      setFavorites(favorites.filter(favId => favId !== id));
      await chatStorageService.saveFavorites(favorites);
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const toggleFavorite = async (id: string) => {
    try {
      const newFavorites = favorites.includes(id)
        ? favorites.filter(favId => favId !== id)
        : [...favorites, id];
      await chatStorageService.saveFavorites(newFavorites);
      setFavorites(newFavorites);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getFilteredChats = () => {
    let filtered = chats;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(chat =>
        chat.title.toLowerCase().includes(query) ||
        chat.messages.some(msg => msg.content.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(chat => chat.title.includes(selectedCategory));
    }

    return filtered;
  };

  const renderRightActions = (id: string, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <RectButton style={styles.deleteButton} onPress={() => handleDeleteChat(id)}>
        <Animated.View style={[styles.deleteButtonContent, { transform: [{ scale }] }]}>
      <Ionicons name="trash-outline" size={24} color="white" />
        </Animated.View>
      </RectButton>
  );
  };

  const renderChatItem = ({ item }: { item: ChatSession }) => {
    // Create ref for this item if it doesn't exist
    if (!swipeableRefs.current[item.id]) {
      swipeableRefs.current[item.id] = React.createRef<Swipeable>();
    }

    return (
      <Swipeable
        key={item.id}
        enableTrackpadTwoFingerGesture
        overshootLeft={false}
        overshootRight={false}
        ref={swipeableRefs.current[item.id]}
        friction={2}
        leftThreshold={80}
        rightThreshold={40}
        renderRightActions={(progress, dragX) => renderRightActions(item.id, dragX)}
        onSwipeableOpen={() => {
          Object.entries(swipeableRefs.current).forEach(([id, ref]) => {
            if (id !== item.id && ref?.current) {
              ref.current.close();
            }
          });
        }}
        useNativeAnimations
      >
      <TouchableOpacity
        style={styles.chatItem}
          onPress={() => {
            const ref = swipeableRefs.current[item.id];
            if (ref?.current) {
              ref.current.close();
            }
            navigation.navigate({ 
              name: 'AIChat', 
              params: { sessionId: item.id }
            });
          }}
      >
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={() => toggleFavorite(item.id)}
            >
              <Ionicons
                name={favorites.includes(item.id) ? 'star' : 'star-outline'}
                size={24}
                color={favorites.includes(item.id) ? '#FFD700' : '#666'}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.chatDate}>
            {formatDate(item.lastModified)}
          </Text>
          <Text style={styles.messageCount}>
            {item.messages.length} messages
          </Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chat History</Text>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={() => navigation.navigate({ name: 'AIChat', params: {} })}
        >
          <Icon name="plus" type="feather" color="#fff" size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search" type="feather" color="#A1A4B2" size={20} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="x" type="feather" color="#A1A4B2" size={20} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CATEGORIES.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.categoryChipSelected
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.categoryChipText,
                selectedCategory === category && styles.categoryChipTextSelected
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {getFilteredChats().length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>No chats found</Text>
        </View>
      ) : (
        <FlatList
          data={getFilteredChats()}
          renderItem={renderChatItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.chatList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#A1A4B2"
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181A20',
    ...Platform.select({
      ios: {
        paddingTop: 0
      },
      android: {
        paddingTop: 0
      }
    })
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    backgroundColor: '#181A20',
    borderBottomWidth: 1,
    borderBottomColor: '#23262B',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#23262B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23262B',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 12,
    fontSize: 16,
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#23262B',
    marginRight: 8,
    marginLeft: 16,
  },
  categoryChipSelected: {
    backgroundColor: '#2563EB',
  },
  categoryChipText: {
    color: '#A1A4B2',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  chatList: {
    padding: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23262B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  favoriteButton: {
    padding: 4,
  },
  chatDate: {
    fontSize: 14,
    color: '#A1A4B2',
    marginBottom: 4,
  },
  messageCount: {
    fontSize: 14,
    color: '#666',
  },
  deleteButton: {
    width: 80,
    height: '90%',
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    marginRight: 8,
  },
  deleteButtonContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#181A20',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    color: '#666666',
    fontSize: 16,
    marginTop: 8,
  },
});

export default ChatHistoryScreen; 