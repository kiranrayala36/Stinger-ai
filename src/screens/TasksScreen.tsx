import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ScrollView, Pressable, Image, Platform, TextInput, ActivityIndicator } from 'react-native';
import { Text, Button, ListItem, Icon, FAB } from 'react-native-elements';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useRoute, RouteProp, CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { notificationService } from '../services/notificationService';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { BottomTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import { handleError, AppError } from '../utils/errorHandler';
import { taskService, Task } from '../services/taskService';

type TasksStackParamList = {
  TasksScreen: undefined;
  AddTask: undefined;
  ViewTask: { task: Task };
  EditTask: { task: Task };
  Trash: undefined;
};

type TasksScreenRouteProp = RouteProp<TasksStackParamList, 'TasksScreen'>;
type TasksScreenNavigationProp = CompositeNavigationProp<
  StackNavigationProp<TasksStackParamList>,
  BottomTabNavigationProp<BottomTabParamList>
>;

const categories = ['All', 'Work', 'Personal', 'Study', 'Health'];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return '#00C851';
    case 'in_progress': return '#0A84FF';
    default: return '#666';
  }
};

const getStatusBorderColor = (status: string) => {
  switch (status) {
    case 'completed': return '#00C851';
    case 'in_progress': return '#0A84FF';
    default: return '#666';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return '#FF4444';
    case 'medium': return '#FFBB33';
    case 'low': return '#00C851';
    default: return '#666';
  }
};

const renderRightActions = (taskId: string, onDelete: () => void) => {
  return (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={onDelete}
    >
      <Icon name="trash" type="font-awesome" color="#fff" size={20} />
    </TouchableOpacity>
  );
};

const TaskItem = React.memo(({ task, onPress, onToggleComplete, onDelete }: { 
  task: Task; 
  onPress: () => void;
  onToggleComplete: () => void;
  onDelete: () => void;
}) => {
  const swipeableRef = React.useRef(null);
  
  // Close swipeable if open and component unmounts or updates
  React.useEffect(() => {
    return () => {
      if (swipeableRef.current) {
        // @ts-ignore - closeAll exists but TypeScript doesn't recognize it
        swipeableRef.current.close();
      }
    };
  }, []);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      key={task.id}
    >
      <Swipeable
        ref={swipeableRef}
        renderRightActions={() => renderRightActions(task.id, onDelete)}
        friction={2}
        overshootRight={false}
        enableTrackpadTwoFingerGesture
        hitSlop={{ right: 20 }}
        containerStyle={styles.swipeableContainer}
        rightThreshold={40}
      >
        <LinearGradient
          colors={["#23262B", "#23262B", "#23262B", "#23262B"]}
          style={[
            styles.taskCard,
            { borderLeftColor: getStatusBorderColor(task.status) }
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.taskCardHeader}>
            <View style={styles.statusAndTitleContainer}>
              {task.status && (
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}> 
                  <Text style={styles.statusText}>
                    {task.status === 'not_started' ? 'Not Started' : task.status === 'in_progress' ? 'In Progress' : 'Completed'}
                  </Text>
                </View>
              )}
              <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
            </View>
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}> 
              <Text style={styles.priorityText}>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</Text>
            </View>
          </View>

          <Text style={styles.taskDescription} numberOfLines={2}>{task.description}</Text>

          {task.attachments && task.attachments.length > 0 && (
            <View style={styles.attachmentsContainer}>
              <View style={styles.attachmentsRow}>
                {task.attachments.slice(0, 3).map((uri: string, idx: number) => (
                  <Image key={uri + idx} source={{ uri }} style={styles.attachmentThumb} />
                ))}
                {task.attachments.length > 3 && (
                  <View style={styles.attachmentMore}>
                    <Text style={styles.attachmentMoreText}>+{task.attachments.length - 3}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.taskCardFooter}>
            <View style={styles.dueRow}>
              <Icon name="calendar" type="font-awesome" color="#2563EB" size={14} style={{ marginRight: 6 }} />
              <Text style={styles.dueText}>Due: {new Date(task.dueDate).toLocaleDateString()}</Text>
            </View>
            <TouchableOpacity 
              onPress={onToggleComplete}
              style={styles.actionButton}
            >
              <Icon
                name={task.completed ? 'check-circle' : 'circle-o'}
                type="font-awesome"
                color={task.completed ? '#00C851' : '#666'}
                size={20}
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Swipeable>
    </TouchableOpacity>
  );
});

export default function TasksScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<TasksScreenNavigationProp>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [fabScale] = useState(new Animated.Value(1));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tasks from AsyncStorage
  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const userId = user?.email || 'default';
      const loadedTasks = await taskService.loadTasks(userId);
      setTasks(loadedTasks);
      setFilteredTasks(selectedCategory === 'All' ? loadedTasks : loadedTasks.filter((task: Task) => task.category === selectedCategory));
    } catch (error) {
      handleError(error, 'TasksScreen:loadTasks');
      setError('Failed to load tasks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, selectedCategory]);

  // Load tasks on initial mount
  useEffect(() => {
    loadTasks();
  }, []);

  // Load tasks when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadTasks();
    });

    return unsubscribe;
  }, [navigation, loadTasks]);

  // Optimize task completion toggle
  const toggleTaskCompletion = useCallback(async (taskId: string) => {
    try {
          const userId = user?.email || 'default';
      const updatedTasks = await taskService.toggleTaskCompletion(userId, taskId);
      setTasks(updatedTasks);
    } catch (e) {
      handleError(e, 'TasksScreen:toggleTaskCompletion');
      setError('Failed to update task completion. Please try again.');
    }
  }, [user?.email]);

  const deleteTask = async (taskId: string) => {
    try {
      const userId = user?.email || 'default';
      const updatedTasks = await taskService.deleteTask(userId, taskId);
      setTasks(updatedTasks);
      setFilteredTasks(updatedTasks.filter(task => 
        selectedCategory === 'All' ? true : task.category === selectedCategory
      ));
    } catch (error) {
      handleError(error, 'TasksScreen:deleteTask');
      setError('Failed to delete task. Please try again.');
    }
  };

  // Filter tasks when category changes
  useEffect(() => {
    if (selectedCategory === 'All') {
      setFilteredTasks(tasks);
    } else {
      setFilteredTasks(tasks.filter(task => task.category === selectedCategory));
    }
  }, [selectedCategory, tasks]);

  // Filter tasks based on search query and category
  useEffect(() => {
    let filtered = tasks;
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(task => task.category === selectedCategory);
    }
    if (searchQuery) {
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredTasks(filtered);
  }, [tasks, selectedCategory, searchQuery]);

  // Memoize renderTask to prevent unnecessary re-renders
  const renderTask = useCallback(({ item }: { item: Task }) => {
    // Using a stable reference for callbacks
    const handleTaskPress = () => navigation.navigate('ViewTask', { task: item });
    const handleToggleComplete = () => toggleTaskCompletion(item.id);
    const handleDeleteTask = () => deleteTask(item.id);
    
    return (
      <TaskItem
        task={item}
        onPress={handleTaskPress}
        onToggleComplete={handleToggleComplete}
        onDelete={handleDeleteTask}
      />
    );
  }, [navigation, toggleTaskCompletion, deleteTask]);

  // Memoize keyExtractor
  const keyExtractor = useCallback((item: Task) => item.id, []);

  // Memoize ListEmptyComponent
  const ListEmptyComponent = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.emptyText}>Loading tasks...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="alert-circle" type="feather" color="#FF4444" size={40} />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={loadTasks}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Icon name="tasks" type="font-awesome" color="#A1A4B2" size={40} />
        <Text style={styles.emptyText}>No tasks yet. Add one to get started!</Text>
      </View>
    );
  }, [isLoading, error, loadTasks]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Tasks</Text>
      </View>

      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterChip,
                selectedCategory === category && styles.filterChipSelected
              ]}
              onPress={() => setSelectedCategory(
                selectedCategory === category ? 'All' : category
              )}
            >
              <Text style={[
                styles.filterChipText,
                selectedCategory === category && styles.filterChipTextSelected
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search" type="feather" color="#A1A4B2" size={20} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tasks..."
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

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={loadTasks}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          renderItem={renderTask}
          keyExtractor={keyExtractor}
          ListEmptyComponent={ListEmptyComponent}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          maxToRenderPerBatch={5}
          windowSize={3}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          onEndReachedThreshold={0.5}
          refreshing={isLoading}
          onRefresh={loadTasks}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          navigation.navigate('AddTask');
        }}
      >
        <Icon name="plus" type="feather" color="#fff" size={24} />
      </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    backgroundColor: '#181A20',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  filtersContainer: {
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#23262B',
    marginRight: 8,
    marginLeft: 16,
  },
  filterChipSelected: {
    backgroundColor: '#2563EB',
  },
  filterChipText: {
    color: '#A1A4B2',
  },
  filterChipTextSelected: {
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23262B',
    marginHorizontal: 16,
    marginBottom: 16,
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
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 120 : 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  taskCardWrapper: {
    flex: 1,
    margin: 4,
  },
  taskCard: {
    backgroundColor: '#23262B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  taskCardHeader: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    justifyContent: 'space-between', 
    marginBottom: 12, 
    gap: 8 
  },
  statusAndTitleContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  taskDescription: {
    fontSize: 14,
    color: '#A1A4B2',
    marginBottom: 8,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  priorityBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  priorityText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  attachmentsContainer: {
    marginBottom: 12,
  },
  attachmentsRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    gap: 8,
  },
  attachmentThumb: { 
    width: 60, 
    height: 60, 
    borderRadius: 8,
  },
  attachmentMore: { 
    padding: 8, 
    borderRadius: 8, 
    backgroundColor: '#333',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentMoreText: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 14 
  },
  taskCardFooter: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dueRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
  },
  dueText: { 
    color: '#2563EB', 
    fontWeight: '600', 
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#A1A4B2',
  },
  deleteButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ scale: 0.95 }],
  },
  swipeableContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  swipeDelete: {
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 75,
    height: '100%',
    borderRadius: 20,
    marginRight: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#FF4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
}); 