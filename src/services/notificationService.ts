import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: 'task' | 'chat' | 'system';
  read: boolean;
  timestamp: string;
  data?: any;
};

const NOTIFICATIONS_STORAGE_KEY = '@stingerai_notifications';
const PUSH_TOKEN_STORAGE_KEY = '@stingerai_push_token';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  }),
});

export const notificationService = {
  // Request permissions and setup notifications
  async setupNotifications() {
    if (!Device.isDevice) {
      console.warn('Notifications are not supported in the simulator/emulator');
      return false;
    }

    // Request permissions
    const permissionGranted = await this.requestPermissions();
    if (!permissionGranted) {
      console.warn('Notification permissions not granted');
      return false;
    }

    // Get or register for push token
    const token = await this.registerForPushNotifications();
    
    return !!token;
  },
  
  async requestPermissions() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      return finalStatus === 'granted';
    } catch (error) {
      console.warn('Error requesting notification permissions:', error);
      return false;
    }
  },

  // Register for push notifications and get a token
  async registerForPushNotifications() {
    try {
      // Check if we already have a token
      const existingToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
      if (existingToken) {
        return existingToken;
      }

      // Get a push token
      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      
      // Store the token
      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
      
      // Setup notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563EB',
        });
      }
      
      return token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  },

  // Send a local notification immediately
  async sendLocalNotification(title: string, body: string, data = {}) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: null, // Send immediately
      });
      
      // Also add to the local store
      await this.addNotification({
        title,
        message: body,
        type: 'system',
        data,
      });
      
      return notificationId;
    } catch (error) {
      console.error('Error sending local notification:', error);
      return null;
    }
  },

  async scheduleTaskReminder(taskId: string, title: string, dueDate: Date) {
    try {
      const trigger = new Date(dueDate);
      trigger.setHours(trigger.getHours() - 1); // Notify 1 hour before
      
      // Only schedule if the time is in the future
      if (trigger.getTime() <= Date.now()) {
        console.warn('Cannot schedule notification for past time');
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Task Reminder',
          body: `"${title}" is due in 1 hour!`,
          data: { taskId },
        },
        // @ts-ignore - Expo Notifications API accepts Date objects despite TypeScript definitions
        trigger,
      });
      
      return notificationId;
    } catch (error) {
      console.warn('Error scheduling task reminder:', error);
      return null;
    }
  },
  
  // Cancel a scheduled notification by ID
  async cancelScheduledNotification(notificationId: string) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Error canceling scheduled notification:', error);
    }
  },
  
  // Get all pending scheduled notifications
  async getScheduledNotifications() {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  },

  async getNotifications(): Promise<Notification[]> {
    try {
      const notificationsJson = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      return notificationsJson ? JSON.parse(notificationsJson) : [];
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  },

  async addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const newNotification: Notification = {
        ...notification,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        read: false,
      };
      notifications.unshift(newNotification);
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  },

  async markAsRead(notificationId: string): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const updatedNotifications = notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  async markAllAsRead(): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  },

  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const updatedNotifications = notifications.filter(n => n.id !== notificationId);
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  },

  async clearAllNotifications(): Promise<void> {
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify([]));
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  },

  async getUnreadCount(): Promise<number> {
    try {
      const notifications = await this.getNotifications();
      return notifications.filter(n => !n.read).length;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }
}; 