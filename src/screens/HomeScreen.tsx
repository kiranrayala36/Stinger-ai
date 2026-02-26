import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Text as RNText, FlatList, ActionSheetIOS, Platform, Modal, TouchableWithoutFeedback, Animated, Alert } from 'react-native';
import { Text, Icon } from 'react-native-elements';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatStorageService, ChatSession } from '../services/chatStorageService';
import { RootStackParamList, BottomTabParamList, Task, HomeScreenProps } from '../navigation/AppNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { notificationService, Notification } from '../services/notificationService';
import { formatDistanceToNow } from 'date-fns';

const placeholder = require('../../assets/icon.png');

type ChatHistory = {
  id: string;
  title: string;
  timestamp: string;
  preview: string;
  category: string;
};

const categories = [
  { id: '1', name: 'Mobile', icon: placeholder, color: '#E3E1FA', tasks: 6 },
  { id: '2', name: 'Wireframe', icon: placeholder, color: '#D6F5F2', tasks: 12 },
  { id: '3', name: 'Website', icon: placeholder, color: '#F6F7D9', tasks: 5 },
];

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const userName = user?.firstName || 'User';
  const avatarUri = require('../assets/stingerLogo.png');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [ongoingTasks, setOngoingTasks] = useState<Task[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const spinAnim = useRef(new Animated.Value(0)).current;
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [openTaskMenuId, setOpenTaskMenuId] = useState<string | null>(null);
  const [taskMenuTask, setTaskMenuTask] = useState<Task | null>(null);
  const [showFeatureAlert, setShowFeatureAlert] = useState(false);
  const [featureAlertInfo, setFeatureAlertInfo] = useState({ title: '', message: '', icon: '' });
  const [unreadCount, setUnreadCount] = useState(0);

  // Initialize profile photo
  useEffect(() => {
    setProfilePhoto(user?.photoURL || null);
  }, []);

  // Update profile photo when user changes
  useEffect(() => {
    if (user?.photoURL !== profilePhoto) {
      setProfilePhoto(user?.photoURL || null);
    }
  }, [user?.photoURL]);

  // Add effect to update profile photo when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user?.photoURL !== profilePhoto) {
        setProfilePhoto(user?.photoURL || null);
      }
    });

    return unsubscribe;
  }, [navigation, user?.photoURL, profilePhoto]);

  const loadTasks = useCallback(async () => {
    try {
      const userId = user?.email || 'default';
      const storedTasks = await AsyncStorage.getItem(`tasks_${userId}`);
      if (storedTasks) {
        const tasks = JSON.parse(storedTasks) as Task[];
        const inProgressTasks = tasks.filter(task => task.status === 'in_progress');
        setOngoingTasks(inProgressTasks);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, [user?.email]);

  const loadChatHistory = useCallback(async () => {
    try {
      const sessions = await chatStorageService.getChatSessions();
      // Convert ChatSession to ChatHistory format
      const formattedChats: ChatHistory[] = sessions.map(session => ({
        id: session.id,
        title: session.title,
        timestamp: new Date(session.lastModified).toISOString(),
        preview: session.messages[session.messages.length - 1]?.content || '',
        category: 'AI Chat'
      }));
      // Sort chats by timestamp in descending order (most recent first)
      const sortedChats = formattedChats.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setChatHistory(sortedChats);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    loadChatHistory();
  }, [loadTasks, loadChatHistory, route.params?.params?.refreshTasks]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadTasks();
      loadChatHistory(); // Reload chat history when screen comes into focus
    });

    return unsubscribe;
  }, [navigation, loadTasks, loadChatHistory]);

  useEffect(() => {
    if (route.params?.params?.newTask) {
      const newTask = route.params.params.newTask;
      if (newTask.status === 'in_progress') {
        setOngoingTasks(prev => [newTask, ...prev]);
      }
      // Clear the params after handling
      navigation.setParams({ params: undefined } as any);
    }
  }, [route.params?.params?.newTask, navigation]);

  useEffect(() => {
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleTaskPress = (task: Task) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'View Task', 'Edit Task'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          switch (buttonIndex) {
            case 1:
              navigation.navigate('ViewTask', { task });
              break;
            case 2:
              navigation.navigate('EditTask', { task });
              break;
          }
        }
      );
    } else {
      setSelectedTask(task);
      setShowActionSheet(true);
    }
  };

  const handleActionSheetPress = (action: 'view' | 'edit') => {
    if (selectedTask) {
      if (action === 'view') {
        navigation.navigate('ViewTask', { task: selectedTask });
      } else {
        navigation.navigate('EditTask', { task: selectedTask });
      }
    }
    setShowActionSheet(false);
  };

  const handleMarkAsCompleted = async (task: Task) => {
    try {
      const userId = user?.email || 'default';
      const storedTasks = await AsyncStorage.getItem(`tasks_${userId}`);
      if (storedTasks) {
        const tasks = JSON.parse(storedTasks) as Task[];
        const updatedTasks = tasks.map(t => 
          t.id === task.id ? { ...t, status: 'completed', completed: true } : t
        );
        await AsyncStorage.setItem(`tasks_${userId}`, JSON.stringify(updatedTasks));
        setOngoingTasks(updatedTasks.filter(t => t.status === 'in_progress'));
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    try {
      const userId = user?.email || 'default';
      const storedTasks = await AsyncStorage.getItem(`tasks_${userId}`);
      if (storedTasks) {
        const tasks = JSON.parse(storedTasks) as Task[];
        const updatedTasks = tasks.filter(t => t.id !== task.id);
        await AsyncStorage.setItem(`tasks_${userId}`, JSON.stringify(updatedTasks));
        setOngoingTasks(updatedTasks.filter(t => t.status === 'in_progress'));
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleFeatureAlert = (title: string, message: string, icon: string) => {
    setFeatureAlertInfo({ title, message, icon });
    setShowFeatureAlert(true);
  };

  useEffect(() => {
    loadUnreadCount();
    loadNotifications();
    const interval = setInterval(() => {
      loadUnreadCount();
      loadNotifications();
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    const count = await notificationService.getUnreadCount();
    setUnreadCount(count);
  };

  const loadNotifications = async () => {
    const notifs = await notificationService.getNotifications();
    setNotifications(notifs);
  };

  return (
    <View style={styles.container}>
      {/* Greeting Card Section */}
      <View style={styles.greetingCard}>
        <View style={styles.greetingRow}>
          <View style={styles.profileImageWrapper}>
            {profilePhoto ? (
              <Image
                source={{ uri: profilePhoto }}
                style={styles.profileImage}
                key={profilePhoto}
              />
            ) : (
              <Image source={avatarUri} style={styles.avatar} />
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.welcomeText}>Welcome Back!</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => setShowNotifications(true)} 
            style={styles.logoContainer}
          >
            <Icon name="bell" type="feather" color="#2563EB" size={28} containerStyle={styles.logo} />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.mainGreeting}>
          What can I do
          to <Text style={styles.highlight}>Help You?</Text>
        </Text>
      </View>

      {/* Categories Grid */}
      <View style={styles.categoriesSection}>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {/* First column: one card */}
          <View style={{ flex: 1 }}>
            <TouchableOpacity
              style={[styles.categoryCard, { backgroundColor: '#2563EB', height: 220 }]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('AIChat')}
            >
              <Animated.Image source={require('../assets/stinger.png')} style={[styles.categoryIcon, { width: 84, height: 84, transform: [{ rotate: spin }] }]} />
              <Text style={[styles.categoryNameBoldLarge, { color: '#fff' }]}>{'Chat with\nStinger'}</Text>
            </TouchableOpacity>
          </View>
          {/* Second column: two stacked cards */}
          <View style={{ flex: 1, justifyContent: 'space-between', gap: 16 }}>
            <TouchableOpacity style={[styles.categoryCard, { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Assignment Helper')}>
              <Image source={require('../assets/book.png')} style={styles.categoryIcon} />
              <Text style={[styles.categoryNameBoldMedium, { color: '#fff' }]}>{'Help With\nAssignment'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.categoryCard, { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' }]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('ResearchSearch')}>
              <Image source={require('../assets/research.png')} style={styles.categoryIcon} />
              <Text style={[styles.categoryNameBoldMedium, { color: '#fff', marginLeft: 6 }]}>{'Research\nAssistant'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {/* Scrollable Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
      >
        <TouchableWithoutFeedback onPress={() => setOpenTaskMenuId(null)}>
          <View>
            {/* Ongoing Tasks */}
            <View style={styles.ongoingSection}>
              <View style={styles.ongoingHeader}>
                <View style={styles.titleContainer}>
                  <Text style={styles.ongoingTitle}>Ongoing</Text>
                  <View style={styles.taskCountBadge}>
                    <Text style={styles.taskCountText}>{ongoingTasks.length}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.seeAllButton}
                  onPress={() => {
                    navigation.navigate('Tasks');
                  }}
                >
                  <Text style={styles.seeAll}>See All</Text>
                  <Icon name="chevron-right" type="feather" color="#2563EB" size={20} />
                </TouchableOpacity>
              </View>
              {ongoingTasks.length > 0 ? (
              <FlatList
                data={ongoingTasks}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.ongoingListContent}
                renderItem={({ item: task }) => (
                  <View style={styles.ongoingCard}>
                    <View style={styles.ongoingCardHeader}>
                        <View style={[styles.priorityBadge, 
                          task.priority === 'high' ? styles.high : 
                          task.priority === 'medium' ? styles.medium : 
                          styles.low]}>
                          <Icon 
                            name={task.priority === 'high' ? 'alert-circle' : 
                                 task.priority === 'medium' ? 'clock' : 'check-circle'} 
                            type="feather" 
                            color="#fff" 
                            size={14} 
                            style={{ marginRight: 4 }} 
                          />
                          <Text style={styles.priorityText}>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</Text>
                        </View>
                        <View style={styles.statusBadge}>
                          <Icon name="activity" type="feather" color="#0A84FF" size={14} style={{ marginRight: 4 }} />
                          <Text style={styles.statusText}>In Progress</Text>
                        </View>
                      </View>
                      <Text style={styles.ongoingTaskTitle} numberOfLines={2}>{task.title}</Text>
                    <View style={styles.ongoingDetailsRow}>
                        <Icon name="calendar" type="feather" color="#A1A4B2" size={16} />
                        <Text style={styles.ongoingTime}>Due: {new Date(task.dueDate).toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.ongoingFooter}>
                        <View style={styles.categoryBadge}>
                          <Icon name="tag" type="feather" color="#FFE6C7" size={14} style={{ marginRight: 4 }} />
                          <Text style={styles.categoryText}>{task.category}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.moreButton}
                          onPress={() => setTaskMenuTask(task)}
                        >
                          <Icon name="more-horizontal" type="feather" color="#A1A4B2" size={20} />
                        </TouchableOpacity>
                      </View>
                  </View>
                )}
              />
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Icon 
                    name="inbox" 
                    type="feather" 
                    color="#A1A4B2" 
                    size={32} 
                    style={styles.emptyStateIcon}
                  />
                  <Text style={styles.emptyStateText}>No ongoing tasks</Text>
                  <Text style={styles.emptyStateSubtext}>Create a new task to get started</Text>
                  </View>
                )}
            </View>

            {/* Chat History Section */}
            <View style={styles.ongoingSection}>
              <View style={styles.ongoingHeader}>
                <View style={styles.titleContainer}>
                  <Text style={styles.ongoingTitle}>Recent Chats</Text>
                  <View style={styles.taskCountBadge}>
                    <Text style={styles.taskCountText}>{chatHistory.length}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.seeAllButton}
                  onPress={() => navigation.navigate('Chat History')}
                >
                  <Text style={styles.seeAll}>See All</Text>
                  <Icon name="chevron-right" type="feather" color="#A1A4B2" size={16} />
                </TouchableOpacity>
              </View>
              {chatHistory.length > 0 ? (
                <FlatList
                  data={chatHistory}
                  keyExtractor={item => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.ongoingListContent}
                  renderItem={({ item: chat }) => (
                    <TouchableOpacity 
                      style={styles.ongoingCard}
                      onPress={() => navigation.navigate('AIChat', { sessionId: chat.id })}
                    >
                      <View style={styles.ongoingCardHeader}>
                        <View style={styles.categoryBadge}>
                          <Icon name="message-circle" type="feather" color="#FFE6C7" size={14} style={{ marginRight: 4 }} />
                          <Text style={styles.categoryText}>{chat.category}</Text>
                        </View>
                        <Text style={styles.chatTime}>{new Date(chat.timestamp).toLocaleDateString()}</Text>
                      </View>
                      <Text style={styles.ongoingTaskTitle} numberOfLines={2}>{chat.title}</Text>
                      <Text style={styles.chatPreview} numberOfLines={2}>{chat.preview}</Text>
                      <View style={styles.ongoingFooter}>
                        <View style={styles.statusBadge}>
                          <Icon name="clock" type="feather" color="#0A84FF" size={14} style={{ marginRight: 4 }} />
                          <Text style={styles.statusText}>Recent</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Icon 
                    name="message-circle" 
                    type="feather" 
                    color="#A1A4B2" 
                    size={32} 
                    style={styles.emptyStateIcon}
                  />
                  <Text style={styles.emptyStateText}>No chat history</Text>
                  <Text style={styles.emptyStateSubtext}>Start a new chat with AI</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>

      {/* Custom Action Sheet for Android */}
      <Modal
        visible={showActionSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowActionSheet(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.actionSheet, { 
              position: 'absolute', 
              left: menuPosition.x, 
              top: menuPosition.y,
              zIndex: 1000 // Ensure menu appears above other content
            }]}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleActionSheetPress('view')}
              >
                <Icon name="eye" type="feather" color="#A1A4B2" size={16} style={styles.actionIcon} />
                <Text style={styles.actionText}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleActionSheetPress('edit')}
              >
                <Icon name="edit-2" type="feather" color="#A1A4B2" size={16} style={styles.actionIcon} />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Floating Notification Modal */}
      <Modal
        visible={showNotifications}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifications(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowNotifications(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.notificationModal}>
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationTitle}>Notifications</Text>
                  {notifications.length > 0 && (
                    <TouchableOpacity 
                      onPress={async () => {
                        await notificationService.clearAllNotifications();
                        await loadNotifications();
                        await loadUnreadCount();
                      }} 
                      style={styles.clearButton}
                    >
                      <Text style={styles.clearButtonText}>Clear All</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {notifications.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Icon name="bell-off" type="feather" size={48} color="#A1A4B2" />
                    <Text style={styles.emptyText}>No notifications yet</Text>
                  </View>
                ) : (
                  <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.notificationCard, !item.read && styles.unreadNotification]}
                        onPress={async () => {
                          await notificationService.markAsRead(item.id);
                          await loadNotifications();
                          await loadUnreadCount();
                        }}
                      >
                        <View style={styles.notificationContent}>
                          <View style={styles.notificationHeader}>
                            <Text style={styles.notificationItemTitle}>{item.title}</Text>
                            <TouchableOpacity
                              onPress={async () => {
                                await notificationService.deleteNotification(item.id);
                                await loadNotifications();
                                await loadUnreadCount();
                              }}
                              style={styles.deleteButton}
                            >
                              <Icon name="x" type="feather" size={16} color="#A1A4B2" />
                            </TouchableOpacity>
                          </View>
                          <Text style={styles.notificationItem}>{item.message}</Text>
                          <Text style={styles.notificationTime}>
                            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={!!taskMenuTask}
        transparent
        animationType="fade"
        onRequestClose={() => setTaskMenuTask(null)}
      >
        <TouchableWithoutFeedback onPress={() => setTaskMenuTask(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.taskOptionsModal}>
                <TouchableOpacity onPress={() => {
                  setTaskMenuTask(null);
                  navigation.navigate('Tasks', { screen: 'ViewTask', params: { task: taskMenuTask } });
                }}>
                  <Text style={styles.taskOption}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setTaskMenuTask(null);
                  navigation.navigate('Tasks', { screen: 'EditTask', params: { task: taskMenuTask } });
                }}>
                  <Text style={styles.taskOption}>Edit</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Feature Alert Modal */}
      <Modal
        visible={showFeatureAlert}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFeatureAlert(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowFeatureAlert(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.featureAlertModal}>
                <View style={styles.featureAlertIconContainer}>
                  <Icon 
                    name={featureAlertInfo.icon} 
                    type="feather" 
                    color="#2563EB" 
                    size={32} 
                  />
                </View>
                <Text style={styles.featureAlertTitle}>{featureAlertInfo.title}</Text>
                <Text style={styles.featureAlertMessage}>{featureAlertInfo.message}</Text>
                <TouchableOpacity 
                  style={styles.featureAlertButton}
                  onPress={() => setShowFeatureAlert(false)}
                >
                  <Text style={styles.featureAlertButtonText}>Got it!</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181A20',
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  scrollView: {
    flex: 1,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  greetingCard: {
    backgroundColor: '#F8F7F4',
    borderRadius: 28,
    padding: 24,
    margin: 22,
    marginBottom:0,
    marginTop: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eee',
  },
  profileImageWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#eee',
    borderWidth: 2,
    borderColor: '#2563EB'
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  welcomeText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '500',
  },
  userName: {
    color: '#181A20',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 2,
  },
  logoContainer: {
    backgroundColor: '#EBF2FF',
    borderRadius: 16,
    padding: 6,
    marginLeft: 8,
  },
  logo: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  mainGreeting: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#181A20',
    marginTop: 8,
    lineHeight: 32,
  },
  highlight: {
    color: '#2563EB',
  },
  categoriesSection: {
    marginTop: 8,
    marginHorizontal: 22,
  },
  categoriesGrid: {
    flexDirection: 'column',
    gap: 16,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 0,
  },
  categoryCard: {
    height: 100,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    marginBottom: 8,
    resizeMode: 'contain',
  },
  categoryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#181A20',
  },
  categoryNameBoldLarge: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#181A20',
    lineHeight: 28,
    textAlign: 'left',
  },
  categoryNameBoldMedium: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#181A20',
    lineHeight: 20,
    textAlign: 'left',
  },
  ongoingSection: {
    marginTop: 32,
    marginHorizontal: 24,
  },
  ongoingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ongoingTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  taskCountBadge: {
    backgroundColor: 'rgba(255, 230, 199, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  taskCountText: {
    color: '#FFE6C7',
    fontSize: 14,
    fontWeight: '600',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAll: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  ongoingListContent: {
    paddingLeft: 4,
    paddingRight: 24,
    gap: 12,
  },
  ongoingCard: {
    backgroundColor: '#23262B',
    borderRadius: 20,
    padding: 16,
    width: 260,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  ongoingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    color: '#0A84FF',
    fontWeight: '600',
    fontSize: 12,
  },
  high: {
    backgroundColor: '#FF5B5B',
  },
  medium: {
    backgroundColor: '#FFD056',
  },
  low: {
    backgroundColor: '#00C851',
  },
  priorityText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  ongoingTaskTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    lineHeight: 22,
  },
  ongoingDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(161, 164, 178, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ongoingTime: {
    color: '#A1A4B2',
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '500',
  },
  ongoingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 230, 199, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: {
    color: '#FFE6C7',
    fontSize: 12,
    fontWeight: '600',
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(161, 164, 178, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  actionSheet: {
    backgroundColor: '#23262B',
    borderRadius: 12,
    padding: 8,
    width: 120,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionIcon: {
    marginRight: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 24,
    marginTop: 8,
  },
  emptyStateIcon: {
    marginBottom: 12,
    opacity: 0.8,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    color: '#A1A4B2',
    fontSize: 14,
    fontWeight: '500',
  },
  chatTime: {
    color: '#A1A4B2',
    fontSize: 12,
  },
  chatPreview: {
    color: '#A1A4B2',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  notificationModal: {
    backgroundColor: '#23262B',
    borderRadius: 24,
    padding: 24,
    width: '85%',
    maxHeight: '80%',
    alignSelf: 'center',
    marginTop: '10%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  notificationTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationCard: {
    backgroundColor: '#2A2D35',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
  },
  notificationContent: {
    flex: 1,
  },
  notificationItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginBottom: 4,
  },
  notificationItem: {
    fontSize: 14,
    color: '#A1A4B2',
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: 'rgba(161, 164, 178, 0.1)',
    borderRadius: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#A1A4B2',
    marginTop: 16,
    fontWeight: '500',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  taskOptionsModal: {
    backgroundColor: '#23262B',
    borderRadius: 12,
    padding: 16,
    minWidth: 120,
    alignSelf: 'center',
    marginTop: '60%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  taskOption: {
    color: '#fff',
    fontSize: 15,
    paddingVertical: 6,
  },
  featureAlertModal: {
    backgroundColor: '#23262B',
    borderRadius: 24,
    padding: 24,
    width: '85%',
    alignSelf: 'center',
    marginTop: '40%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureAlertIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  featureAlertTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  featureAlertMessage: {
    color: '#A1A4B2',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  featureAlertButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureAlertButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen; 