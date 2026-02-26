import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator, Image, Clipboard } from 'react-native';
import { Icon } from 'react-native-elements';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { speechService } from '../services/speechToText';
import { aiChatService } from '../services/aiChatService';
import { chatStorageService, ChatMessage, ChatSession } from '../services/chatStorageService';
import Animated, { 
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay
} from 'react-native-reanimated';
import { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { debounce } from 'lodash';
import { handleError, AppError } from '../utils/errorHandler';
import { useAuth } from '../context/AuthContext';
import { taskService, Task } from '../services/taskService';
import { noteService, Note } from '../services/noteService';

type FormattedContent = React.ReactNode[];

type RootStackParamList = {
  AIChat: { sessionId?: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AIChat'>;
type RouteProps = RouteProp<RootStackParamList, 'AIChat'>;

// Message type
type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type AiActionContext = 
  | null
  | { type: 'create_task'; step: 'initial' | 'awaiting_title' | 'awaiting_description' | 'awaiting_dueDate' | 'awaiting_priority' | 'awaiting_category'; taskDetails: Partial<Task> }
  | { type: 'make_notes'; step: 'initial' | 'awaiting_title' | 'awaiting_content' | 'awaiting_type' | 'awaiting_category' | 'awaiting_tags'; noteDetails: Partial<Note> };

const actions = [
  { key: 'create_task', label: 'Create task', icon: 'check-square', color: '#4ADE80' },
  { key: 'make_notes', label: 'Make notes', icon: 'file-text', color: '#38BDF8' },
  { key: 'make_plan', label: 'Make a plan', icon: 'zap', color: '#FACC15' },
  { key: 'more', label: 'More', icon: 'more-horizontal', color: '#A1A4B2' },
];

const initialMessages: Message[] = [];

function generateTitleFromMessage(msg: string): string {
  // Simple: use first 4 words or up to 20 chars
  const words = msg.trim().split(' ');
  let title = words.slice(0, 4).join(' ');
  if (title.length > 20) title = title.slice(0, 20) + '...';
  return title.charAt(0).toUpperCase() + title.slice(1);
}

const AIChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [chatTitle, setChatTitle] = useState('StingerAI');
  const [loading, setLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sessionId, setSessionId] = useState<string>(Date.now().toString());
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>(setTimeout(() => {}, 0));
  const messageListRef = useRef<FlatList>(null);
  const lastContentOffsetY = useRef(0);
  const lastMessageRef = useRef<string>('');
  const lastFormattedContent = useRef<FormattedContent>([]);
  const typingDot1Opacity = useSharedValue(0);
  const typingDot2Opacity = useSharedValue(0);
  const typingDot3Opacity = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const inputRef = useRef<TextInput>(null);
  const { user } = useAuth();
  const [aiActionContext, setAiActionContext] = useState<AiActionContext>(null);
  const [currentAiResponse, setCurrentAiResponse] = useState('');

  // Helper to add AI messages
  const addAiMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: content,
      timestamp: Date.now(),
    }]);
  }, []);

  // Basic date parsing helper
  const parseDueDate = (input: string): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('today')) {
      return today.toISOString();
    }
    if (lowerInput.includes('tomorrow')) {
      return tomorrow.toISOString();
    }
    // Attempt to parse a specific date (e.g., "2023-12-25", "Dec 25")
    const dateMatch = lowerInput.match(/(\d{4}-\d{2}-\d{2})|(\w{3,4}\s+\d{1,2}(,\s*\d{4})?)/);
    if (dateMatch) {
      try {
        const parsedDate = new Date(input);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString();
        }
      } catch (e) {
        handleError(e, 'AIChatScreen:parseDueDate:specificDate');
      }
    }
    // Default to a week from now if no specific date is parsed
    return nextWeek.toISOString();
  };

  // Add debounced save function
  const debouncedSaveSession = debounce(async (session: ChatSession) => {
    await chatStorageService.saveChatSession(session);
  }, 1000);

  const handleAiActionFlow = useCallback(async (userResponse: string) => {
    if (!user || !aiActionContext) return;

    let newContext = { ...aiActionContext };
    let assistantResponse = '';
    let finished = false;

    try {
      if (newContext.type === 'create_task') {
        const taskDetails = newContext.taskDetails;

        switch (newContext.step) {
          case 'awaiting_title':
            taskDetails.title = userResponse.trim();
            assistantResponse = "Got it. Now, could you please provide a brief description for this task?";
            newContext.step = 'awaiting_description';
            break;
          case 'awaiting_description':
            taskDetails.description = userResponse.trim();
            assistantResponse = "Okay, when is the due date for this task? (e.g., Today, Tomorrow, next week, YYYY-MM-DD)";
            newContext.step = 'awaiting_dueDate';
            break;
          case 'awaiting_dueDate':
            taskDetails.dueDate = parseDueDate(userResponse.trim());
            assistantResponse = "What's the priority for this task? (High, Medium, Low)";
            newContext.step = 'awaiting_priority';
            break;
          case 'awaiting_priority':
            const priorityInput = userResponse.trim().toLowerCase();
            if (['high', 'medium', 'low'].includes(priorityInput)) {
              taskDetails.priority = priorityInput as 'high' | 'medium' | 'low';
              assistantResponse = "And what category does this task belong to? (e.g., Work, Personal, Study, Health)";
              newContext.step = 'awaiting_category';
            } else {
              assistantResponse = "Please specify a valid priority: High, Medium, or Low.";
              // Stay in the same step
            }
            break;
          case 'awaiting_category':
            const categoryInput = userResponse.trim();
            const validCategories = ['Work', 'Personal', 'Study', 'Health', 'All']; // 'All' is a display category, actual tasks should have a specific one
            if (validCategories.includes(categoryInput)) {
              taskDetails.category = categoryInput === 'All' ? 'Personal' : categoryInput; // Default to Personal if 'All'
              const newTask: Task = {
                id: Date.now().toString(),
                title: taskDetails.title || 'New Task',
                description: taskDetails.description || '',
                dueDate: taskDetails.dueDate || new Date().toISOString(),
                priority: taskDetails.priority || 'medium',
                completed: false,
                status: 'not_started',
                category: taskDetails.category || 'Personal',
                attachments: []
              };
              await taskService.addTask(user.email || 'default', newTask);
              assistantResponse = `Great! I've added "${newTask.title}" to your tasks.`;
              finished = true;
            } else {
              assistantResponse = "Please choose a valid category: Work, Personal, Study, or Health.";
              // Stay in the same step
            }
            break;
        }
      } else if (newContext.type === 'make_notes') {
        const noteDetails = newContext.noteDetails;

        switch (newContext.step) {
          case 'awaiting_title':
            noteDetails.title = userResponse.trim();
            assistantResponse = "Got it. What content should I add to this note?";
            newContext.step = 'awaiting_content';
            break;
          case 'awaiting_content':
            noteDetails.content = userResponse.trim();
            assistantResponse = "What type of note is this? (Plain or Checklist)";
            newContext.step = 'awaiting_type';
            break;
          case 'awaiting_type':
            const typeInput = userResponse.trim().toLowerCase();
            if (['plain', 'checklist'].includes(typeInput)) {
              noteDetails.type = typeInput as 'plain' | 'checklist';
              if (noteDetails.type === 'checklist') {
                assistantResponse = "Please list the checklist items, one per line.";
                // For now, we will handle checklist items in the next step as a single string and parse later
              } else {
                assistantResponse = "What category does this note belong to? (e.g., General, Ideas, Meetings)";
                newContext.step = 'awaiting_category';
              }
            } else {
              assistantResponse = "Please specify a valid type: Plain or Checklist.";
              // Stay in the same step
            }
            break;
          case 'awaiting_category':
            noteDetails.category = userResponse.trim();
            assistantResponse = "Any tags for this note? (e.g., #important, #todo, #idea - separate with commas)";
            newContext.step = 'awaiting_tags';
            break;
          case 'awaiting_tags':
            noteDetails.tags = userResponse.split(',').map(tag => tag.trim().replace(/^#/, '')).filter(tag => tag.length > 0);
            
            const newNote: Note = {
              id: Date.now().toString(),
              title: noteDetails.title || 'New Note',
              content: noteDetails.type === 'plain' ? (noteDetails.content || '') : undefined, // Conditional content for plain notes
              type: noteDetails.type || 'plain',
              checklist: noteDetails.type === 'checklist' ? noteDetails.content?.split('\n').map(item => ({ text: item.trim(), checked: false })) : undefined, // Conditional checklist for checklist notes
              date: new Date().toISOString(), // Add missing date
              color: '#FFDDC1', // Default color
              category: noteDetails.category || 'General',
              tags: noteDetails.tags || [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isPinned: false,
              isArchived: false,
              isDeleted: false,
              attachments: [],
              userId: user.id, // Ensure userId is set
              isTemplate: false, // Add missing isTemplate
              lastModified: new Date().toISOString(), // Add missing lastModified
              isTrashed: false, // Add missing isTrashed with default false
            };
            await noteService.addNote(newNote);
            assistantResponse = `Great! I've added "${newNote.title}" to your notes.`;
            finished = true;
            break;
        }
      }
    } catch (error) {
      handleError(error, `AIChatScreen:handleAiActionFlow:${aiActionContext.type}`);
      assistantResponse = "I encountered an error while trying to process your request. Please try again.";
      finished = true;
    } finally {
      setAiActionContext(finished ? null : newContext);
      addAiMessage(assistantResponse);
      setLoading(false);
      setIsTyping(false);
    }
  }, [user, aiActionContext, addAiMessage, parseDueDate, messages, sessionId, chatTitle, debouncedSaveSession]);

  const typingDot1Style = useAnimatedStyle(() => ({
    opacity: typingDot1Opacity.value
  }));

  const typingDot2Style = useAnimatedStyle(() => ({
    opacity: typingDot2Opacity.value
  }));

  const typingDot3Style = useAnimatedStyle(() => ({
    opacity: typingDot3Opacity.value
  }));

  useEffect(() => {
    loadChatSession();
    startTypingAnimation();
    return () => {
      aiChatService.cancelCurrentStream();
    };
  }, []);

  useEffect(() => {
    saveChatSession();
  }, [messages, chatTitle]);

  const startTypingAnimation = useCallback(() => {
    const animateDot = (dot: Animated.SharedValue<number>, delay: number) => {
      dot.value = withRepeat(
        withSequence(
          withDelay(
            delay,
            withTiming(1, { duration: 500 })
          ),
          withTiming(0, { duration: 500 })
        ),
        -1
      );
    };

    animateDot(typingDot1Opacity, 0);
    animateDot(typingDot2Opacity, 200);
    animateDot(typingDot3Opacity, 400);
  }, []);

  const loadChatSession = async () => {
    try {
      const id = route.params?.sessionId;
      if (id) {
        const session = await chatStorageService.getChatSession(id);
        if (session) {
          setSessionId(session.id);
          setChatTitle(session.title);
          setMessages(session.messages);
        }
      } else {
        // If no sessionId, create a new session
        const newSessionId = Date.now().toString();
        setSessionId(newSessionId);
      }
    } catch (error) {
      handleError(error, 'AIChatScreen:loadChatSession');
      Alert.alert('Error', 'Failed to load chat session');
    }
  };

  const saveChatSession = async () => {
    if (messages.length === 0) return;
    
    try {
      const session: ChatSession = {
        id: sessionId,
        title: chatTitle,
        messages,
        lastModified: Date.now()
      };
      await chatStorageService.saveChatSession(session);
    } catch (error) {
      handleError(error, 'AIChatScreen:saveChatSession');
      // No Alert.alert here as it's a background save
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: ChatMessage = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: input,
      timestamp: Date.now()
    };
    
    // Add user message to chat history immediately
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    
    // If it's the first message of a new session, set the title
    if (messages.length === 0) {
      setChatTitle(generateTitleFromMessage(input));
    }
    
    setLoading(true);
    setIsTyping(true);
    setStreamingMessage('');

    try {
      if (aiActionContext) {
        await handleAiActionFlow(userMsg.content);
      } else {
        // Original AI chat logic
      const tempId = (Date.now() + 1).toString();
      const assistantMsg: ChatMessage = {
          id: tempId, 
          role: 'assistant', 
          content: '',
          timestamp: Date.now()
      };
      
        const allMessages = [...messages, userMsg, assistantMsg]; // Include userMsg here too
      setMessages(allMessages);

      const session: ChatSession = {
        id: sessionId,
        title: chatTitle,
        messages: allMessages,
        lastModified: Date.now()
      };
      await chatStorageService.saveChatSession(session);

      aiChatService.on('chunk', ({ content }) => {
        setStreamingMessage(prev => prev + content);
        setMessages(prev => prev.map(msg => 
          msg.id === tempId ? {
            ...msg,
            content: msg.content + content
          } : msg
        ));
        
        const updatedSession = {
          ...session,
          messages: messages.map(msg => 
            msg.id === tempId ? {
              ...msg,
              content: msg.content + content
            } : msg
          ),
          lastModified: Date.now()
        };
        debouncedSaveSession(updatedSession);
        
        if (shouldAutoScroll) {
          flatListRef.current?.scrollToEnd({ animated: false });
        }
      });

      aiChatService.on('done', (finalContent) => {
        setMessages(prev => prev.map(msg => 
          msg.id === tempId ? {
            ...msg,
            content: finalContent
          } : msg
        ));
        
        const finalSession = {
          ...session,
          messages: messages.map(msg => 
            msg.id === tempId ? {
              ...msg,
              content: finalContent
            } : msg
          ),
          lastModified: Date.now()
        };
        chatStorageService.saveChatSession(finalSession);
        
        setIsTyping(false);
        setStreamingMessage('');
      });

      await aiChatService.sendMessageToAI(
        messages.map(m => ({
          role: m.role,
          content: m.content
        })).concat({ role: 'user' as const, content: input })
      );
      }
    } catch (error) {
      handleError(error, 'AIChatScreen:handleSend');
      Alert.alert('Error', 'Failed to send message. Please try again.');
      // Remove the temporary message on error if it's the AI path
      if (!aiActionContext) {
      setMessages(prev => prev.filter(msg => msg.id !== (Date.now() + 1).toString()));
      }
    } finally {
      setLoading(false);
      setIsTyping(false);
      aiChatService.removeAllListeners('chunk');
      aiChatService.removeAllListeners('done');
    }
  };

  // Image picker handler
  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        throw handleError(new AppError('Permission required', { code: 'PERMISSION_DENIED', hint: 'Please grant media library access to select images.' }), 'AIChatScreen:handlePickImage');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        Alert.alert('Image Selected', 'You selected an image. (Integrate image upload here)');
      }
    } catch (e) {
      handleError(e, 'AIChatScreen:handlePickImage');
      Alert.alert('Error', 'Image picker not available.');
    }
  };

  // Settings modal handler
  const handleOpenSettings = () => {
    setSettingsVisible(true);
  };
  const handleCloseSettings = () => {
    setSettingsVisible(false);
  };

  // Mic handler with recording and transcription functionality
  const handleMic = async () => {
    try {
      if (!isRecording) {
        // Start recording
        await speechService.startRecording();
        setIsRecording(true);
      } else {
        // Stop recording and get transcription
        setIsTranscribing(true);
        try {
          const transcribedText = await speechService.stopRecording();
          setInput(transcribedText);
        } catch (error) {
          handleError(error, 'AIChatScreen:handleMic:transcribe');
          Alert.alert(
            'Transcription Error',
            'Failed to transcribe speech. Please try again.'
          );
        } finally {
          setIsRecording(false);
          setIsTranscribing(false);
        }
      }
    } catch (error) {
      handleError(error, 'AIChatScreen:handleMic');
      Alert.alert(
        'Error',
        'Failed to access microphone. Please try again.'
      );
      setIsRecording(false);
      setIsTranscribing(false);
    }
  };

  // Action button handlers
  const handleAction = (key: string) => {
    switch (key) {
      case 'create_task':
        setAiActionContext({ type: 'create_task', step: 'awaiting_title', taskDetails: {} });
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: "Okay, let's create a new task. What's the title of this task?",
          timestamp: Date.now()
        }]);
        setInput('');
        setTimeout(() => inputRef.current?.focus(), 100);
        break;
      case 'make_notes':
        setAiActionContext({ type: 'make_notes', step: 'awaiting_title', noteDetails: {} });
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: "Alright, I can help you make a note. What's the title of your note?",
          timestamp: Date.now()
        }]);
        setInput('');
        setTimeout(() => inputRef.current?.focus(), 100);
        break;
      case 'make_plan':
        setInput('Help me make a plan for: ');
        break;
      case 'more':
        setInput('I need help with: ');
        break;
      default:
        setInput('');
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleStartEdit = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingContent(content);
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editingContent.trim()) return;

    // Find the edited message index and the next AI response
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    const nextMessage = messages[messageIndex + 1];
    
    // Update the edited message
    const updatedMessages = messages.map(msg => 
      msg.id === messageId ? { ...msg, content: editingContent.trim() } : msg
    );

    // If there's an AI response after this message, remove it and all subsequent messages
    const messagesBeforeEdit = updatedMessages.slice(0, messageIndex + 1);
    setMessages(messagesBeforeEdit);
    setEditingMessageId(null);
    setEditingContent('');

    // Save the updated chat session
    const session: ChatSession = {
      id: sessionId,
      title: chatTitle,
      messages: messagesBeforeEdit,
      lastModified: Date.now()
    };
    try {
    await chatStorageService.saveChatSession(session);
    } catch (e) {
      handleError(e, 'AIChatScreen:handleSaveEdit:saveSession');
    }

    // If there was an AI response, generate a new one
    if (nextMessage && nextMessage.role === 'assistant') {
      setLoading(true);
      setIsTyping(true);
      setStreamingMessage('');

      try {
        // Add temporary streaming message
        const tempId = (Date.now() + 1).toString();
        const assistantMsg: ChatMessage = {
          id: tempId,
          role: 'assistant',
          content: '',
          timestamp: Date.now()
        };
        
        const allMessages = [...messagesBeforeEdit, assistantMsg];
        setMessages(allMessages);

        // Save chat session after adding temporary message
        const updatedSession: ChatSession = {
          id: sessionId,
          title: chatTitle,
          messages: allMessages,
          lastModified: Date.now()
        };
        try {
        await chatStorageService.saveChatSession(updatedSession);
        } catch (e) {
          handleError(e, 'AIChatScreen:handleSaveEdit:saveUpdatedSession');
        }

        // Set up streaming handlers
        aiChatService.on('chunk', ({ content }) => {
          setStreamingMessage(prev => prev + content);
          setMessages(prev => prev.map(msg => 
            msg.id === tempId ? {
              ...msg,
              content: msg.content + content
            } : msg
          ));
          
          // Save updated session with new content
          const streamSession = {
            ...updatedSession,
            messages: messages.map(msg => 
              msg.id === tempId ? {
                ...msg,
                content: msg.content + content
              } : msg
            ),
            lastModified: Date.now()
          };
          try {
          chatStorageService.saveChatSession(streamSession);
          } catch (e) {
            handleError(e, 'AIChatScreen:handleSaveEdit:saveStreamSession');
          }
          
          flatListRef.current?.scrollToEnd({ animated: true });
        });

        aiChatService.on('done', (finalContent) => {
          setMessages(prev => prev.map(msg => 
            msg.id === tempId ? {
              ...msg,
              content: finalContent
            } : msg
          ));
          
          // Save the final version
          const finalSession = {
            ...updatedSession,
            messages: messages.map(msg => 
              msg.id === tempId ? {
                ...msg,
                content: finalContent
              } : msg
            ),
            lastModified: Date.now()
          };
          try {
          chatStorageService.saveChatSession(finalSession);
          } catch (e) {
            handleError(e, 'AIChatScreen:handleSaveEdit:saveFinalSession');
          }
          
          setIsTyping(false);
          setStreamingMessage('');
        });

        // Send all messages up to the edited message to the AI
        await aiChatService.sendMessageToAI(
          messagesBeforeEdit.map(m => ({
            role: m.role,
            content: m.content
          }))
        );

      } catch (error) {
        handleError(error, 'AIChatScreen:handleSaveEdit:generateResponse');
        Alert.alert('Error', 'Failed to generate new response. Please try again.');
      } finally {
        setLoading(false);
        setIsTyping(false);
        aiChatService.removeAllListeners('chunk');
        aiChatService.removeAllListeners('done');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  // Memoize the message rendering for better performance
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isEditing = item.id === editingMessageId;

    const formatContent = (content: string) => {
      if (isEditing) {
        return (
          <TextInput
            value={editingContent}
            onChangeText={setEditingContent}
            multiline
            style={styles.messageText}
            autoFocus
          />
        );
      }

      if (content === lastMessageRef.current) {
        return lastFormattedContent.current;
      }

      const lines = content.split('\n');
      const formattedContent = lines.map((line, index) => {
        // First check if it's a main heading (starts with ###)
        if (line.trim().startsWith('###')) {
          // Remove ### and any following whitespace first
          let cleanedHeading = line.replace(/^###\s*/, '');
          // Then remove any ** markers and trailing colons
          cleanedHeading = cleanedHeading
            .replace(/\*\*/g, '')
            .replace(/:\s*$/, '')
            .trim();
          
          return (
            <Text key={index} style={[styles.messageText, styles.mainHeading]}>
              {cleanedHeading}
            </Text>
          );
        } else if (line.match(/^\s*-\s*\*\*[^*]+\*\*/)) {
          // Split the line into heading and content parts
          const headingMatch = line.match(/^\s*-\s*\*\*([^*]+)\*\*(.*)$/);
          if (headingMatch) {
            const [_, heading, content] = headingMatch;
            const cleanedHeading = heading.trim();
            const cleanedContent = content.replace(/:\s*/, '').trim();
            
          return (
              <View key={index}>
                <Text style={[styles.messageText, styles.subHeading]}>
                  {'• ' + cleanedHeading}
            </Text>
                {cleanedContent && (
                  <Text style={styles.messageText}>
                    {cleanedContent}
                  </Text>
                )}
              </View>
          );
          }
        } else if (line.trim()) {
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          return (
            <Text key={index} style={styles.messageText}>
              {parts.map((part, partIndex) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return (
                    <Text key={partIndex} style={{ fontWeight: 'bold' }}>
                      {part.replace(/\*\*/g, '')}
                    </Text>
                  );
                }
                return part;
              })}
            </Text>
          );
        }
        return <View key={index} style={{ height: 8 }} />;
      });

      lastMessageRef.current = content;
      lastFormattedContent.current = formattedContent;
      return formattedContent;
    };

    return (
      <Animated.View
        style={[
          styles.messageContainer,
          item.role === 'user' ? styles.userMessageContainer : styles.aiMessageContainer,
          isEditing && styles.editingMessageContainer
        ]}
        entering={FadeIn.duration(300)}
      >
        <View style={[
          styles.messageBubble,
          item.role === 'user' ? styles.userBubble : styles.aiBubble,
          styles.messageShadow,
          isEditing && styles.editingBubble
        ]}>
          <View style={styles.messageContent}>
            {formatContent(item.content)}
          </View>
          {item.role === 'assistant' && isTyping && item.id === messages[messages.length - 1]?.id && (
            <View style={styles.typingIndicator}>
              <Animated.View style={[styles.typingDot, typingDot1Style]} />
              <Animated.View style={[styles.typingDot, typingDot2Style]} />
              <Animated.View style={[styles.typingDot, typingDot3Style]} />
            </View>
          )}
        </View>
        <View style={styles.messageFooter}>
          <Text style={styles.messageTime}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {item.role === 'user' && !isEditing && (
            <TouchableOpacity 
              style={styles.editButton} 
              onPress={() => handleStartEdit(item.id, item.content)}
            >
              <Icon name="edit-2" type="feather" size={14} color="#A1A4B2" />
            </TouchableOpacity>
          )}
          {item.role === 'user' && isEditing && (
            <View style={styles.editActions}>
              <TouchableOpacity 
                style={[styles.editActionButton, styles.saveButton]} 
                onPress={() => handleSaveEdit(item.id)}
              >
                <Icon name="check" type="feather" size={14} color="#4CAF50" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.editActionButton, styles.cancelButton]} 
                onPress={handleCancelEdit}
              >
                <Icon name="x" type="feather" size={14} color="#F44336" />
              </TouchableOpacity>
            </View>
          )}
          {item.role === 'assistant' && (
            <TouchableOpacity style={styles.copyButton} onPress={() => copyToClipboard(item.content)}>
              <Icon name="copy" type="feather" size={14} color="#A1A4B2" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  }, [isTyping, typingDot1Style, typingDot2Style, typingDot3Style, editingMessageId, editingContent]);

  const copyToClipboard = useCallback((content: string) => {
    Clipboard.setString(content);
    // Show toast or some feedback
    Alert.alert('Copied to clipboard');
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const scrollViewHeight = event.nativeEvent.layoutMeasurement.height;
    const isScrollingDown = currentOffset > lastContentOffsetY.current;
    const isNearBottom = contentHeight - currentOffset - scrollViewHeight < 100;

    // Update auto-scroll behavior based on user's scroll direction
    if (!isScrollingDown && !isNearBottom) {
      setShouldAutoScroll(false);
    } else if (isNearBottom) {
      setShouldAutoScroll(true);
    }

    lastContentOffsetY.current = currentOffset;
    setIsScrolling(true);

    if (scrollTimer.current) {
      clearTimeout(scrollTimer.current);
    }
    scrollTimer.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (shouldAutoScroll && !isScrolling) {
      messageListRef.current?.scrollToEnd({ animated: true });
    }
  }, [shouldAutoScroll, isScrolling]);

  // Update useEffect for messages to use shouldAutoScroll
  useEffect(() => {
    if (messages.length > 0 && shouldAutoScroll) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, shouldAutoScroll]);

  // Add manual scroll to bottom handler
  const handleManualScrollToBottom = () => {
    setShouldAutoScroll(true);
    messageListRef.current?.scrollToEnd({ animated: true });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-left" type="feather" color="#fff" size={28} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{chatTitle}</Text>
          <Text style={styles.headerSubtitle}>{messages.length} messages</Text>
        </View>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => {
            setMessages([]);
            setChatTitle('StingerAI');
            setSessionId(Date.now().toString());
          }}
        >
          <Icon name="plus" type="feather" color="#fff" size={24} />
        </TouchableOpacity>
      </View>

      {/* Chat Area (fills available space above action buttons and input) */}
      <View style={{ flex: 1 }}>
        {messages.length > 0 && (
          <FlatList
            ref={messageListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.chatContainer}
            onScroll={handleScroll}
            onScrollBeginDrag={() => setIsScrolling(true)}
            onScrollEndDrag={() => setIsScrolling(false)}
            onMomentumScrollEnd={() => setIsScrolling(false)}
            showsVerticalScrollIndicator={false}
            initialNumToRender={5}
            maxToRenderPerBatch={3}
            windowSize={5}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={100}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
          />
        )}
      </View>

      {/* Action Buttons only when chat is empty */}
      {messages.length === 0 && (
        <View style={styles.actionGrid}>
          {actions.map((action, index) => (
            <TouchableOpacity 
              key={action.key}
              style={[styles.actionButton, { borderColor: action.color }]} 
              onPress={() => handleAction(action.key)}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: `${action.color}20` }]}> 
                <Icon name={action.icon} type="feather" color={action.color} size={16} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {(!shouldAutoScroll || (messages.length > 10 && !isScrolling)) && (
        <TouchableOpacity
          style={styles.scrollToBottomButton}
          onPress={handleManualScrollToBottom}
        >
          <View style={styles.scrollToBottomContent}>
            {!shouldAutoScroll && messages.length - messages.indexOf(messages[messages.length - 1]) > 1 && (
              <View style={styles.newMessagesBadge}>
                <Text style={styles.newMessagesBadgeText}>New</Text>
              </View>
            )}
            <Icon name="chevron-down" type="feather" color="#fff" size={24} />
          </View>
        </TouchableOpacity>
      )}

      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={{ backgroundColor: '#181A20' }}
      >
        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={handlePickImage}>
            <Icon name="image" type="feather" color="#A1A4B2" size={24} />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#666"
              value={input}
              onChangeText={setInput}
              multiline
            maxLength={1000}
            editable={!loading}
            keyboardAppearance="dark"
            />
            <TouchableOpacity 
            style={[styles.sendButton, !input.trim() && styles.disabledSendButton]}
              onPress={handleSend} 
            disabled={!input.trim() || loading}
            >
              <Icon 
                name="send" 
                type="feather" 
              color={input.trim() ? '#fff' : '#666'}
                size={20} 
              />
            </TouchableOpacity>
        </View>
        {/* Settings Modal */}
        <Modal
          visible={settingsVisible}
          animationType="slide"
          transparent
          onRequestClose={handleCloseSettings}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Settings</Text>
              <Text style={{ color: '#fff', marginBottom: 24 }}>Settings options will go here.</Text>
              <TouchableOpacity onPress={handleCloseSettings} style={styles.closeModalButton}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        {/* Add extra space for navigation bar overlap with dark background */}
        <View style={{ height: 24, backgroundColor: '#23262B' }} />
      </KeyboardAvoidingView>
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
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 12,
    backgroundColor: '#181A20',
    borderBottomWidth: 1,
    borderBottomColor: '#23262B',
  },
  backButton: {
    padding: 8,
    marginRight: 4,
    borderRadius: 20,
    backgroundColor: '#23262B',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#A1A4B2',
    fontSize: 12,
    marginTop: 2,
  },
  headerIcon: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 20,
    backgroundColor: '#23262B',
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    color: '#A1A4B2',
    fontSize: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 0,
    marginBottom: 8,
  },
  actionButton: {
    width: 72,
    alignItems: 'center',
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
    margin: 8,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#23262B',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  actionLabel: {
    color: '#A1A4B2',
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '85%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  aiMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 2,
    maxWidth: '100%',
  },
  userBubble: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  aiBubble: {
    backgroundColor: '#23262B',
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
  },
  messageContent: {
    flexDirection: 'column',
    flexShrink: 1,
  },
  mainHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    marginTop: 4,
  },
  subHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
    marginTop: 8,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 2,
    flexShrink: 1,
  },
  messageTime: {
    color: '#A1A4B2',
    fontSize: 13,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#181A20',
    borderTopWidth: 1,
    borderTopColor: '#23262B',
  },
  inputBarModern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23262B',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputModern: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputIconModern: {
    padding: 8,
    marginHorizontal: 4,
    borderRadius: 20,
  },
  sendButtonModern: {
    backgroundColor: '#2563EB',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#23262B',
  },
  recordingIcon: {
    backgroundColor: 'rgba(255, 75, 75, 0.1)',
  },
  transcribingIcon: {
    backgroundColor: 'rgba(161, 164, 178, 0.1)',
  },
  chatContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  mainActionArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 24,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  logo: {
    width: 90,
    height: 90,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#23262B',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    width: 300,
  },
  closeModalButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    backgroundColor: '#35383F',
    borderRadius: 10,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    height: 20,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A1A4B2',
    marginRight: 4,
  },
  messageShadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  copyButton: {
    padding: 4,
    marginLeft: 8,
    backgroundColor: 'rgba(161, 164, 178, 0.1)',
    borderRadius: 4,
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 16,
    bottom: 80,
    backgroundColor: '#2563EB',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollToBottomContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  newMessagesBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    zIndex: 1,
  },
  newMessagesBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#23262B',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    marginHorizontal: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2A2D35',
    borderRadius: 20,
    color: '#fff',
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledSendButton: {
    backgroundColor: '#23262B',
  },
  editButton: {
    padding: 4,
    marginLeft: 8,
    backgroundColor: 'rgba(161, 164, 178, 0.1)',
    borderRadius: 4,
  },
  editContainer: {
    flex: 1,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderRadius: 16,
    padding: 4,
  },
  editInput: {
    flex: 1,
    padding: 4,
    backgroundColor: 'transparent',
    borderRadius: 12,
    color: '#fff',
    fontSize: 15,
    minHeight: 28,
    maxHeight: 100,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  editingMessageContainer: {
    opacity: 1,
    transform: [{ scale: 1.01 }],
  },
  editingBubble: {
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  editActionButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  cancelButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
  },
});

export default AIChatScreen; 