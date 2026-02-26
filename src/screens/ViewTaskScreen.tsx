import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from 'react-native-elements';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  startDate?: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  category: string;
  status: string;
  attachments?: string[];
  userId?: string;
  color?: string;
  colorName?: string;
  dueTime?: string;
};

// Dummy avatars for demonstration
const dummyAvatars = [
  require('../assets/avatar1.jpg'),
  require('../assets/avatar2.jpg'),
  require('../assets/avatar3.jpg'),
  require('../assets/avatar4.jpg'),
];

type RootStackParamList = {
  Tasks: {
    screen: string;
    params?: {
      task?: Task;
    };
  };
  EditTask: { task: Task };
  ViewTask: { task: Task };
};

type ViewTaskScreenRouteProp = RouteProp<RootStackParamList, 'ViewTask'>;
type ViewTaskScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const statusOptions = [
  { key: 'not_started', label: 'Not Started', color: '#A1A4B2', icon: 'circle' },
  { key: 'in_progress', label: 'In Progress', color: '#0A84FF', icon: 'clock' },
  { key: 'completed', label: 'Completed', color: '#00C851', icon: 'check-circle' },
];

export default function ViewTaskScreen() {
  const route = useRoute<ViewTaskScreenRouteProp>();
  const navigation = useNavigation<ViewTaskScreenNavigationProp>();
  const { user } = useAuth();
  const { task: initialTask } = route.params;
  const [task, setTask] = React.useState(initialTask);
  const [updating, setUpdating] = React.useState(false);

  const handleStatusChange = async (newStatus: string) => {
    if (task.status === newStatus || updating) return;
    
    // Update UI immediately
    const updatedTask = { 
      ...task, 
      status: newStatus,
      completed: newStatus === 'completed'
    };
    setTask(updatedTask);
    
    // Debounce AsyncStorage update
    const timeoutId = setTimeout(async () => {
      setUpdating(true);
      try {
        const userId = user?.email || 'default';
        const tasksKey = `tasks_${userId}`;
        
        // Get current tasks
        const storedTasks = await AsyncStorage.getItem(tasksKey);
        if (storedTasks) {
          const tasks = JSON.parse(storedTasks);
          const updatedTasks = tasks.map((t: any) =>
            t.id === task.id ? updatedTask : t
          );
          // Save to AsyncStorage without waiting for completion
          AsyncStorage.setItem(tasksKey, JSON.stringify(updatedTasks)).catch(console.error);
        }
      } catch (error) {
        console.error('Error updating task:', error);
      } finally {
        setUpdating(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  };

  const handleEdit = () => {
    navigation.navigate('EditTask', { task });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      {/* Top Section */}
      <LinearGradient
        colors={[task.color || "#e7e6f7", task.color || "#e7e6f7"]}
        style={styles.topSection}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" type="feather" color="#23262B" size={26} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 18 }}>
            <TouchableOpacity>
              <Icon name="share-2" type="feather" color="#23262B" size={22} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEdit}>
              <Icon name="edit-2" type="feather" color="#23262B" size={22} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.title, { color: '#23262B' }]}>{task.title}</Text>
        <ScrollView 
          style={styles.metaScrollView}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.metaColumn}>
            <View style={styles.metaRowSingle}>
              <Text style={[styles.metaLabel, { color: '#23262B' }]}>Start Date</Text>
              <Text style={[styles.metaValue, { color: '#23262B' }]}>{new Date(task.startDate || task.dueDate).toLocaleDateString()}</Text>
            </View>
            <View style={styles.metaRowSingle}>
              <Text style={[styles.metaLabel, { color: '#23262B' }]}>End Date</Text>
              <Text style={[styles.metaValue, { color: '#23262B' }]}>{new Date(task.dueDate).toLocaleDateString()}</Text>
            </View>
            <View style={styles.metaRowSingle}>
              <Text style={[styles.metaLabel, { color: '#23262B' }]}>Time</Text>
              <Text style={[styles.metaValue, { color: '#23262B' }]}>{task.dueTime}</Text>
            </View>
            <View style={styles.metaRowSingle}>
              <Text style={[styles.metaLabel, { color: '#23262B' }]}>Status</Text>
              <View style={[
                styles.priorityBadge,
                { backgroundColor: task.status === 'not_started' ? '#A1A4B2' : 
                                 task.status === 'in_progress' ? '#0A84FF' : 
                                 '#00C851' }
              ]}>
                <Text style={styles.priorityText}>
                  {task.status === 'not_started' ? 'Not Started' : 
                   task.status === 'in_progress' ? 'In Progress' : 
                   'Completed'}
                </Text>
              </View>
            </View>
            <View style={styles.metaRowSingle}>
              <Text style={[styles.metaLabel, { color: '#23262B' }]}>Priority</Text>
              <View style={[styles.priorityBadge, { backgroundColor: task.priority === 'high' ? '#ff4444' : task.priority === 'medium' ? '#ffbb33' : '#00C851' }]}> 
                <Text style={styles.priorityText}>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>

      {/* Bottom Card Section */}
      <View style={styles.bottomCard}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.bottomScrollContent}
        >
          {/* Status Section */}
          <View style={styles.statusSection}>
            <Text style={styles.sectionLabel}>Update Status</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusPillRow}
            >
              {statusOptions.map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.statusPill,
                    task.status === option.key && { 
                      backgroundColor: option.color,
                      borderColor: option.color,
                    },
                    task.status !== option.key && {
                      borderColor: '#23262B',
                      borderWidth: 1.5,
                    }
                  ]}
                  onPress={() => handleStatusChange(option.key)}
                  disabled={updating}
                >
                  <Icon 
                    name={option.icon} 
                    type="feather" 
                    color={task.status === option.key ? '#fff' : '#A1A4B2'} 
                    size={14} 
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[
                    styles.statusPillText,
                    task.status === option.key && { 
                      color: '#fff',
                      fontWeight: '600',
                    },
                  ]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <Text style={styles.sectionLabel}>Description</Text>
          <Text style={styles.description}>{task.description}</Text>

          <Text style={styles.sectionLabel}>Attachments</Text>
          <View style={styles.attachmentsRow}>
            <TouchableOpacity style={styles.attachmentAddBtn}>
              <Icon name="plus" type="feather" color="#A1A4B2" size={28} />
            </TouchableOpacity>
            {(task.attachments || []).map((uri: string, idx: number) => (
              <Image key={uri + idx} source={{ uri }} style={styles.attachmentThumb} />
            ))}
          </View>

          <View style={styles.taskColorRow}>
            <Text style={styles.sectionLabel}>Task Color</Text>
            <View style={styles.colorInfoContainer}>
              <View style={[styles.colorDot, { backgroundColor: task.color || '#a99cf7' }]} />
              <Text style={styles.colorLabel}>{task.colorName || 'Light Purple'}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#181A20' },
  topSection: {
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    minHeight: 260,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingTop: Platform.OS === 'ios' ? 8 : 0,
  },
  title: {
    color: '#23262B',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 18,
  },
  metaScrollView: {
    maxHeight: 200,
  },
  metaColumn: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 18,
  },
  metaRowSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metaLabel: {
    color: '#A1A4B2',
    fontSize: 12,
    fontWeight: '500',
  },
  metaValue: {
    color: '#23262B',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  priorityBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  priorityText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  bottomCard: {
    flex: 1,
    backgroundColor: '#23262B',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  bottomScrollContent: {
    paddingBottom: 32, // Add padding at the bottom for better scrolling
  },
  sectionLabel: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 8,
    marginTop: 18,
  },
  description: {
    color: '#A1A4B2',
    fontSize: 15,
    marginBottom: 8,
  },
  attachmentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  attachmentAddBtn: {
    width: 54,
    height: 54,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#A1A4B2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  attachmentThumb: {
    width: 54,
    height: 54,
    borderRadius: 12,
    marginRight: 4,
  },
  taskColorRow: {
    marginTop: 18,
  },
  colorInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#fff',
  },
  colorLabel: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 15,
  },
  statusSection: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D35',
  },
  statusPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingRight: 24,
  },
  statusPill: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  statusPillText: {
    color: '#A1A4B2',
    fontWeight: '500',
    fontSize: 13,
  },
}); 