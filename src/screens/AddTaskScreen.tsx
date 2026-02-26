import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Modal, TouchableOpacity, Image, KeyboardAvoidingView, Platform, TextInput, Animated, Pressable, ActivityIndicator } from 'react-native';
import { Text, Input, Button, Icon } from 'react-native-elements';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Calendar } from 'react-native-calendars';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../services/notificationService';
import { GestureHandlerRootView, gestureHandlerRootHOC } from 'react-native-gesture-handler';

interface Task {
      id: string;
      title: string;
      description: string;
      startDate: string;
      endDate: string;
  dueDate: string;
  dueTime: string;
  priority: string;
  category: string;
  status: string;
      completed: boolean;
      attachments: string[];
  userId: string;
  color: string;
  colorName: string;
}

// Mock avatars
const mockAvatars = [
  { uri: 'https://randomuser.me/api/portraits/men/1.jpg', name: 'John' },
  { uri: 'https://randomuser.me/api/portraits/men/2.jpg', name: 'Alex' },
  { uri: 'https://randomuser.me/api/portraits/women/1.jpg', name: 'Sara' },
  { uri: 'https://randomuser.me/api/portraits/men/3.jpg', name: 'Mike' },
];

const categories = ['Work', 'Personal', 'Study', 'Health'];
const priorities = [
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

const statusOptions = [
  { label: 'Not Started', value: 'not_started' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
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

type RootStackParamList = {
  TasksList: {
    newTask?: Task;
    updatedTask?: Task;
  };
  AddTask: undefined;
  ViewTask: { task: Task };
  EditTask: { task: Task };
};

type AddTaskScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default gestureHandlerRootHOC(() => {
  const navigation = useNavigation<AddTaskScreenNavigationProp>();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('Work');
  const [showCalendar, setShowCalendar] = useState<'start' | 'end' | null>(null);
  const [assignees, setAssignees] = useState(mockAvatars);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [attachments, setAttachments] = useState<{ uri: string }[]>([]);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isDescFocused, setIsDescFocused] = useState(false);
  const [descHeight, setDescHeight] = useState(60);
  const [isCreating, setIsCreating] = useState(false);
  const [buttonScale] = useState(new Animated.Value(1));
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState('not_started');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [dueTime, setDueTime] = useState(new Date());
  const [color, setColor] = useState('#a99cf7');
  const [colorName, setColorName] = useState('Light Purple');

  // Reset form when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Reset all form fields
      setTitle('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setPriority('medium');
      setCategory('Work');
      setAttachments([]);
      setStatus('not_started');
      setDueTime(new Date());
      setColor('#a99cf7');
      setColorName('Light Purple');
    });

    return unsubscribe;
  }, [navigation]);

  // Animate button on press
  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 1.08,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // Only enable if required fields are filled
  const isButtonEnabled = title.trim() && startDate && endDate;

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setDueTime(selectedTime);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleAddTask = async () => {
    if (!title.trim()) return;
    
    setIsCreating(true);
    try {
      const userId = user?.email || 'default';
      const tasksKey = `tasks_${userId}`;
      const storedTasks = await AsyncStorage.getItem(tasksKey);
      const existingTasks = storedTasks ? JSON.parse(storedTasks) : [];

      // Create new task object with unique ID
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newTask = {
        id: taskId,
        title: title.trim(),
        description: description.trim() || 'No Description',
        startDate,
        endDate,
        dueDate: endDate,
        dueTime: formatTime(dueTime),
        priority,
        category,
        status,
        completed: status === 'completed',
        attachments: attachments.map(a => a.uri),
        userId,
        color,
        colorName,
      };

      // Add new task to existing tasks
      const updatedTasks = [newTask, ...existingTasks];
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(tasksKey, JSON.stringify(updatedTasks));
      
      // First, send immediate notification to confirm task creation
      try {
        await notificationService.sendLocalNotification(
          "Task Created", 
          `"${title.trim()}" has been added to your tasks.`
        );
      } catch (notificationError) {
        console.warn('Failed to send immediate notification:', notificationError);
      }
      
      // Then, schedule reminder notification for task due date
      try {
        // Request notification permissions first
        const hasPermission = await notificationService.requestPermissions();
        
        if (hasPermission && endDate) {
          // Create a date object with both the due date and time
          const dueDateTime = new Date(endDate);
          const timeParts = dueTime.toTimeString().split(' ')[0].split(':');
          dueDateTime.setHours(parseInt(timeParts[0], 10));
          dueDateTime.setMinutes(parseInt(timeParts[1], 10));
          
          // Schedule the notification
          const notificationId = await notificationService.scheduleTaskReminder(
            taskId,
            title.trim(),
            dueDateTime
          );
          
          console.log(`Scheduled notification ${notificationId} for task ${taskId}`);
        }
      } catch (notificationError) {
        console.warn('Failed to schedule reminder notification:', notificationError);
        // Continue with task creation even if notification fails
      }
      
      setIsCreating(false);

      // Reset form fields
      setTitle('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setPriority('medium');
      setCategory('Work');
      setAttachments([]);
      setStatus('not_started');
      setDueTime(new Date());
      setColor('#a99cf7');
      setColorName('Light Purple');

      // Navigate back to TasksList with the new task
      navigation.navigate('TasksList', {
        newTask
      });
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert('Error', 'Failed to create task. Please try again.');
      setIsCreating(false);
    }
  };

  const handleDateSelect = (day: any) => {
    if (showCalendar === 'start') setStartDate(day.dateString);
    if (showCalendar === 'end') setEndDate(day.dateString);
    setShowCalendar(null);
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

  const handleRemoveAttachment = (idx: number) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
  };

  const handleAddAttachment = async () => {
    // Ask for permission
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please allow access to your photos to attach files.');
      return;
    }
    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setAttachments([
        ...attachments,
        { uri: result.assets[0].uri }
      ]);
    }
  };

  // --- UI ---
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        {/* Header */}
        <View style={styles.headerShadow}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="arrow-back" type="material" color="#fff" size={28} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create New Task</Text>
            <View style={{ width: 28 }} />
          </View>
        </View>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          bounces={false}
          overScrollMode="never"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEventThrottle={16}
        >
          {/* Task Name */}
          <View style={styles.section}>
            <Text style={styles.label}>Task Name</Text>
            <TextInput
              style={[
                styles.input,
                styles.inputUnderline,
                isTitleFocused && styles.inputUnderlineFocused,
              ]}
              placeholder="Enter task name"
              placeholderTextColor="#6B6D7B"
              value={title}
              onChangeText={setTitle}
              onFocus={() => setIsTitleFocused(true)}
              onBlur={() => setIsTitleFocused(false)}
            />
          </View>
          {/* Dates */}
          <View style={styles.section}>
            <Text style={styles.label}>Start Date</Text>
            <TouchableOpacity style={styles.dateField} onPress={() => setShowCalendar('start')}>
              <View style={styles.dateRow}>
                <Text style={styles.dateText}>{formatDate(startDate) || 'Select Start Date'}</Text>
                <View style={{ flex: 1 }} />
                <Icon name="calendar" type="font-awesome" color="#2563EB" size={18} />
              </View>
            </TouchableOpacity>
            <Text style={[styles.label, { marginTop: 18 }]}>End Date</Text>
            <TouchableOpacity style={styles.dateField} onPress={() => setShowCalendar('end')}>
              <View style={styles.dateRow}>
                <Text style={styles.dateText}>{formatDate(endDate) || 'Select End Date'}</Text>
                <View style={{ flex: 1 }} />
                <Icon name="calendar" type="font-awesome" color="#2563EB" size={18} />
              </View>
            </TouchableOpacity>
            <Text style={[styles.label, { marginTop: 18 }]}>Due Time</Text>
            <TouchableOpacity style={styles.dateField} onPress={() => setShowTimePicker(true)}>
              <View style={styles.dateRow}>
                <Text style={styles.dateText}>{formatTime(dueTime)}</Text>
                <View style={{ flex: 1 }} />
                <Icon name="clock-o" type="font-awesome" color="#2563EB" size={18} />
              </View>
            </TouchableOpacity>
          </View>
          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[
                styles.input,
                styles.inputUnderline,
                styles.descInput,
                isDescFocused && styles.inputUnderlineFocused,
                { height: Math.max(60, descHeight) },
              ]}
              placeholder="Add a description (emoji supported)"
              placeholderTextColor="#6B6D7B"
              value={description}
              onChangeText={setDescription}
              onFocus={() => setIsDescFocused(true)}
              onBlur={() => setIsDescFocused(false)}
              multiline
              onContentSizeChange={e => setDescHeight(e.nativeEvent.contentSize.height)}
            />
          </View>
          {/* Attachments */}
          <View style={styles.section}>
            <Text style={styles.label}>Attachments</Text>
            <View style={styles.attachmentsRow}>
              <TouchableOpacity style={styles.attachmentAdd} onPress={handleAddAttachment}>
                <Icon name="plus" type="font-awesome" color="#A1A4B2" size={24} />
              </TouchableOpacity>
              {attachments.map((att, idx) => (
                <Animated.View key={idx} style={styles.attachmentPreview}>
                  <View style={styles.attachmentImageWrap}>
                    <Image source={{ uri: att.uri }} style={styles.attachmentImg} />
                  </View>
                  <TouchableOpacity style={styles.attachmentRemove} onPress={() => handleRemoveAttachment(idx)}>
                    <Icon name="close" type="material" color="#fff" size={18} />
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </View>
          {/* Category & Priority */}
          <View style={styles.section}>
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll} contentContainerStyle={{ paddingRight: 16 }}>
              <View style={styles.pillRow}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.pill, category === cat && { backgroundColor: '#2563EB' }]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={{ color: category === cat ? '#fff' : '#A1A4B2', fontWeight: '600' }}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.label}>Priority</Text>
            <View style={styles.pillRow}>
              {priorities.map(p => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.pill, priority === p.value && { backgroundColor: '#2563EB' }]}
                  onPress={() => setPriority(p.value)}
                >
                  <Text style={{ color: priority === p.value ? '#fff' : '#A1A4B2', fontWeight: '600' }}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {/* Status */}
          <View style={styles.section}>
            <Text style={styles.label}>Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll} contentContainerStyle={{ paddingRight: 16 }}>
              <View style={styles.pillRow}>
                {statusOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.pill, status === opt.value && { backgroundColor: '#2563EB' }]}
                    onPress={() => setStatus(opt.value)}
                  >
                    <Text style={{ color: status === opt.value ? '#fff' : '#A1A4B2', fontWeight: '600' }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
                </View>
            </ScrollView>
          </View>
          {/* Task Color */}
          <View style={styles.section}>
            <Text style={styles.label}>Task Color</Text>
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
        {/* Floating Create Button */}
        <View style={styles.floatingButtonWrap}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleAddTask}
            disabled={!isButtonEnabled || isCreating}
            android_ripple={{ color: '#1D4ED8' }}
            accessibilityLabel="Create Task"
            accessible
            style={({ pressed }) => [
              styles.floatingCreateButton,
              (!isButtonEnabled || isCreating) && { opacity: 0.5 },
              pressed && Platform.OS === 'ios' && { opacity: 0.7 },
            ]}
          >
            <LinearGradient
              colors={["#2563EB", "#1D4ED8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientButtonBg}
            >
              {isCreating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.buttonContentRow}>
                  <Icon name="plus" type="font-awesome" color="#fff" size={20} containerStyle={{ marginRight: 10 }} />
                  <Text style={styles.createButtonText}>Create Task</Text>
                </View>
              )}
            </LinearGradient>
          </Pressable>
        </View>
        {/* Calendar Modal */}
        <Modal
          visible={!!showCalendar}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCalendar(null)}
        >
          <View style={styles.modalContainer}>
            <View style={[styles.calendarContainer, { backgroundColor: '#23262B' }]}>  
              <Calendar
                onDayPress={handleDateSelect}
                minDate={new Date().toISOString().split('T')[0]}
                theme={{
                  backgroundColor: '#23262B',
                  calendarBackground: '#23262B',
                  textSectionTitleColor: '#A1A4B2',
                  selectedDayBackgroundColor: '#2563EB',
                  selectedDayTextColor: '#23262B',
                  todayTextColor: '#2563EB',
                  dayTextColor: '#A1A4B2',
                  textDisabledColor: '#6B6D7B',
                  dotColor: '#2563EB',
                  selectedDotColor: '#23262B',
                  arrowColor: '#2563EB',
                  monthTextColor: '#A1A4B2',
                  indicatorColor: '#2563EB',
                }}
              />
              <Button
                title="Close"
                onPress={() => setShowCalendar(null)}
                buttonStyle={[styles.closeButton, { backgroundColor: '#2563EB' }]}
                titleStyle={styles.buttonText}
              />
            </View>
          </View>
        </Modal>
        {/* Assignee Modal (placeholder) */}
        <Modal
          visible={showAssigneeModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAssigneeModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={[styles.calendarContainer, { backgroundColor: '#23262B', alignItems: 'center' }]}>  
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 20 }}>Select Assignee (Mock)</Text>
              <Button title="Close" onPress={() => setShowAssigneeModal(false)} buttonStyle={[styles.closeButton, { backgroundColor: '#2563EB' }]} titleStyle={styles.buttonText} />
            </View>
          </View>
        </Modal>
        {/* Time Picker Modal */}
        {showTimePicker && (
          <DateTimePicker
            value={dueTime}
            mode="time"
            is24Hour={false}
            display="default"
            onChange={handleTimeChange}
          />
        )}
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181A20',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 200,
  },
  headerShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    backgroundColor: '#181A20',
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  label: { color: '#A1A4B2', fontSize: 14, marginTop: 20, marginBottom: 6 },
  input: { color: '#fff', fontWeight: 'bold', fontSize: 16, backgroundColor: 'transparent', paddingVertical: 10 },
  inputUnderline: { borderBottomWidth: 1.5, borderColor: '#23262B', borderRadius: 8 },
  inputUnderlineFocused: { borderColor: '#2563EB' },
  descInput: { minHeight: 60, textAlignVertical: 'top' },
  section: { borderRadius: 18, marginHorizontal: 16, marginTop: 18, padding: 16, backgroundColor: '#23262B' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatarRow: { flexDirection: 'row', marginTop: 10 },
  avatarAdd: { borderWidth: 1, borderColor: '#A1A4B2', borderStyle: 'dashed', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 8, borderWidth: 2, borderColor: '#FFE6C7', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 2, backgroundColor: '#23262B' },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  attachmentsRow: { flexDirection: 'row', marginTop: 10 },
  attachmentAdd: { borderWidth: 1, borderColor: '#A1A4B2', borderStyle: 'dashed', borderRadius: 12, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  attachmentPreview: { position: 'relative', marginRight: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  attachmentImageWrap: { 
    width: 56, 
    height: 56, 
    borderRadius: 12, 
    backgroundColor: '#23262B', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 2, 
    borderColor: '#181A20' 
  },
  attachmentImg: { 
    width: 44, 
    height: 44, 
    borderRadius: 8 
  },
  attachmentRemove: { 
    position: 'absolute', 
    top: -8, 
    right: -8, 
    backgroundColor: '#181A20', 
    borderRadius: 10, 
    padding: 2, 
    zIndex: 2 
  },
  createButton: { backgroundColor: '#2563EB', borderRadius: 16, paddingVertical: 16, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  createButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  fieldLabel: { color: '#A1A4B2', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  dateField: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#23262B',
    minWidth: 140,
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    color: '#fff',
  },
  pillRow: { flexDirection: 'row', gap: 10, marginBottom: 2, marginTop: 8 },
  pill: { borderRadius: 16, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#23262B', marginRight: 10 },
  floatingButtonWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 145 : 125,
    alignItems: 'center',
    zIndex: 10,
  },
  floatingCreateButton: {
    borderRadius: 28,
    paddingVertical: 0,
    width: 240,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    overflow: 'hidden',
  },
  gradientButtonBg: {
    borderRadius: 28,
    paddingVertical: 16,
    width: 240,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    opacity: 1,
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  calendarContainer: { padding: 20, borderRadius: 10, width: '90%' },
  closeButton: { marginTop: 15, borderRadius: 8 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  categoriesScroll: {
    marginTop: 8,
    marginBottom: 2,
    marginLeft: -4,
  },
  inputGroup: {
    marginTop: 20,
    marginHorizontal: 16,
  },
  sectionLabel: {
    color: '#A1A4B2',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#2A2D35',
  },
  colorButtonSelected: {
    borderColor: '#FFDAB9',
    transform: [{ scale: 1.1 }],
  },
}); 