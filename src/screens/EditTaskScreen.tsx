import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from 'react-native-elements';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
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

type RootStackParamList = {
  TasksList: {
    newTask?: Task;
    updatedTask?: Task;
  };
  EditTask: { task: Task };
};

type EditTaskScreenRouteProp = RouteProp<RootStackParamList, 'EditTask'>;
type EditTaskScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const priorityOptions = [
  { key: 'high', label: 'High', color: '#ff4444' },
  { key: 'medium', label: 'Medium', color: '#ffbb33' },
  { key: 'low', label: 'Low', color: '#00C851' },
];

const statusOptions = [
  { key: 'not_started', label: 'Not Started', color: '#A1A4B2' },
  { key: 'in_progress', label: 'In Progress', color: '#0A84FF' },
  { key: 'completed', label: 'Completed', color: '#00C851' },
];

const colorOptions = [
  { name: 'Lavender Mist', value: '#dad3fe' },
  { name: 'Light Purple', value: '#a99cf7' },
  { name: 'Light Blue', value: '#a9c7f7' },
  { name: 'Light Green', value: '#a9f7c7' },
  { name: 'Light Yellow', value: '#f7e6a9' },
  { name: 'Light Orange', value: '#f7c7a9' },
  { name: 'Light Pink', value: '#f7a9c7' },
];

export default function EditTaskScreen() {
  const navigation = useNavigation<EditTaskScreenNavigationProp>();
  const route = useRoute<EditTaskScreenRouteProp>();
  const { user } = useAuth();
  const { task: initialTask } = route.params;

  const [title, setTitle] = useState(initialTask.title);
  const [description, setDescription] = useState(initialTask.description);
  const [dueDate, setDueDate] = useState(new Date(initialTask.dueDate));
  const [startDate, setStartDate] = useState(initialTask.startDate ? new Date(initialTask.startDate) : new Date());
  const [priority, setPriority] = useState(initialTask.priority);
  const [category, setCategory] = useState(initialTask.category);
  const [status, setStatus] = useState(initialTask.status);
  const [color, setColor] = useState(initialTask.color || '#a99cf7');
  const [colorName, setColorName] = useState(initialTask.colorName || 'Light Purple');
  const [dueTime, setDueTime] = useState(initialTask.dueTime || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'due'>('due');
  const [saving, setSaving] = useState(false);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      if (datePickerMode === 'start') {
        setStartDate(selectedDate);
      } else {
        setDueDate(selectedDate);
      }
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const hours = selectedTime.getHours();
      const minutes = selectedTime.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes.toString().padStart(2, '0');
      setDueTime(`${formattedHours}:${formattedMinutes} ${ampm}`);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    setSaving(true);
    try {
      const userId = user?.id || 'default';
      const tasksKey = `tasks_${userId}`;
      
      // Get current tasks
      const storedTasks = await AsyncStorage.getItem(tasksKey);
      if (storedTasks) {
        const tasks = JSON.parse(storedTasks);
        const updatedTasks = tasks.map((t: Task) =>
          t.id === initialTask.id ? {
            ...t,
            title,
            description,
            dueDate: dueDate.toISOString(),
            startDate: startDate.toISOString(),
            priority,
            category,
            status,
            color,
            colorName,
            dueTime,
          } : t
        );
        
        await AsyncStorage.setItem(tasksKey, JSON.stringify(updatedTasks));
        navigation.navigate('TasksList', { 
          updatedTask: {
            ...initialTask,
            title,
            description,
            dueDate: dueDate.toISOString(),
            startDate: startDate.toISOString(),
            priority,
            category,
            status,
            color,
            colorName,
            dueTime,
          }
        });
      }
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#e7e6f7", "#e7e6f7"]}
        style={styles.topSection}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Icon name="arrow-left" type="feather" color="#23262B" size={26} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Task</Text>
          <TouchableOpacity 
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          >
            <Text style={[styles.saveButtonText, saving && styles.saveButtonTextDisabled]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.bottomCard}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.sectionLabel}>Title</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter task title"
              placeholderTextColor="#A1A4B2"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.sectionLabel}>Description</Text>
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter task description"
              placeholderTextColor="#A1A4B2"
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.dateTimeGroup}>
            <View style={styles.inputGroup}>
              <Text style={styles.sectionLabel}>Start Date</Text>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => {
                  setDatePickerMode('start');
                  setShowDatePicker(true);
                }}
              >
                <Icon name="calendar" type="feather" color="#A1A4B2" size={20} style={{ marginRight: 8 }} />
                <Text style={styles.dateButtonText}>
                  {startDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.sectionLabel}>Due Date</Text>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => {
                  setDatePickerMode('due');
                  setShowDatePicker(true);
                }}
              >
                <Icon name="calendar" type="feather" color="#A1A4B2" size={20} style={{ marginRight: 8 }} />
                <Text style={styles.dateButtonText}>
                  {dueDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.sectionLabel}>Due Time</Text>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Icon name="clock" type="feather" color="#A1A4B2" size={20} style={{ marginRight: 8 }} />
                <Text style={styles.dateButtonText}>
                  {dueTime || 'Select time'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.sectionLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {priorityOptions.map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.priorityButton,
                    priority === option.key && { backgroundColor: option.color }
                  ]}
                  onPress={() => setPriority(option.key as 'high' | 'medium' | 'low')}
                >
                  <Text style={[
                    styles.priorityButtonText,
                    priority === option.key && { color: '#fff' }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.sectionLabel}>Status</Text>
            <View style={styles.statusRow}>
              {statusOptions.map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.statusButton,
                    status === option.key && { backgroundColor: option.color }
                  ]}
                  onPress={() => setStatus(option.key)}
                >
                  <Text style={[
                    styles.statusButtonText,
                    status === option.key && { color: '#fff' }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.sectionLabel}>Category</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScrollContent}
            >
              {['Work', 'Personal', 'Study', 'Health', 'Shopping', 'Other'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.categoryButtonSelected
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    category === cat && styles.categoryButtonTextSelected
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.sectionLabel}>Task Color</Text>
            <View style={styles.colorRow}>
              {colorOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.colorButton,
                    { backgroundColor: option.value },
                    color === option.value && styles.colorButtonSelected
                  ]}
                  onPress={() => {
                    setColor(option.value);
                    setColorName(option.name);
                  }}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={datePickerMode === 'start' ? startDate : dueDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181A20',
  },
  topSection: {
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#23262B',
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#23262B',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  saveButtonTextDisabled: {
    color: '#A1A4B2',
  },
  bottomCard: {
    flex: 1,
    backgroundColor: '#23262B',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    paddingTop: 32,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  inputGroup: {
    marginBottom: 24,
  },
  dateTimeGroup: {
    gap: 16,
    marginBottom: 24,
  },
  sectionLabel: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 12,
  },
  titleInput: {
    backgroundColor: '#2A2D35',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  descriptionInput: {
    backgroundColor: '#2A2D35',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 15,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  dateButton: {
    backgroundColor: '#2A2D35',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButtonText: {
    color: '#fff',
    fontSize: 15,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    backgroundColor: '#2A2D35',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  priorityButtonText: {
    color: '#A1A4B2',
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusButton: {
    backgroundColor: '#2A2D35',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  statusButtonText: {
    color: '#A1A4B2',
    fontWeight: '500',
  },
  categoryScrollContent: {
    paddingRight: 24,
    gap: 8,
  },
  categoryButton: {
    backgroundColor: '#2A2D35',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryButtonSelected: {
    backgroundColor: '#FFE6C7',
  },
  categoryButtonText: {
    color: '#A1A4B2',
    fontWeight: '500',
    fontSize: 14,
  },
  categoryButtonTextSelected: {
    color: '#23262B',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#2A2D35',
  },
  colorButtonSelected: {
    borderColor: '#fff',
    transform: [{ scale: 1.1 }],
  },
}); 