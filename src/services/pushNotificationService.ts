import { supabase } from '../config/supabase';
import { notificationService } from './notificationService';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { handleError, AppError } from '../utils/errorHandler';

// Define types for push notifications
export type PushNotificationData = {
  title: string;
  body: string;
  data?: Record<string, any>;
};

/**
 * Push Notification Service
 * Handles server-side notifications via Supabase and Expo
 */
export const pushNotificationService = {
  checkSupabaseClient: () => {
    if (!supabase) {
      throw new Error('Supabase client is not initialized for PushNotificationService. Check your environment variables.');
    }
    return supabase;
  },

  /**
   * Register a device for push notifications
   * Stores the push token in Supabase for the current user
   */
  async registerDevice() {
    try {
      const client = this.checkSupabaseClient();
      // Get the current user
      const { data: { user }, error: authError } = await client.auth.getUser();
      
      if (authError) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: authError };
        if ('code' in authError && typeof authError.code === 'string') {
            appErrorOptions.code = authError.code;
        }
        throw handleError(new AppError(authError.message, appErrorOptions), 'PushNotificationService:registerDevice');
      }
      if (!user) {
        throw handleError(new AppError('User not authenticated', { code: 'AUTH_ERROR', hint: 'Cannot register device without a logged-in user.' }), 'PushNotificationService:registerDevice');
      }
      
      // Get push token using the existing notification service
      await notificationService.setupNotifications();
      const token = await this.getPushToken();
      
      if (!token) {
        // console.warn removed as handleError will log
        throw handleError(new AppError('Failed to get push token', { code: 'TOKEN_ERROR', hint: 'Ensure notification permissions are granted.' }), 'PushNotificationService:registerDevice');
      }
      
      // Check if token already exists for this user
      const { data: existingTokens, error: selectError } = await client
        .from('device_push_tokens')
        .select('*')
        .eq('user_id', user.id)
        .eq('token', token);
      
      if (selectError) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: selectError };
        if ('code' in selectError && typeof selectError.code === 'string') {
            appErrorOptions.code = selectError.code;
        }
        throw handleError(new AppError(selectError.message, appErrorOptions), 'PushNotificationService:registerDevice');
      }
      
      // If token doesn't exist, save it
      if (!existingTokens || existingTokens.length === 0) {
        const { error: insertError } = await client
          .from('device_push_tokens')
          .insert([
            { 
              user_id: user.id, 
              token: token,
              device_type: Platform.OS,
              app_version: Constants.expoConfig?.version || '1.0.0',
              created_at: new Date().toISOString()
            }
          ]);
        
        if (insertError) {
            const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: insertError };
            if ('code' in insertError && typeof insertError.code === 'string') {
                appErrorOptions.code = insertError.code;
            }
            throw handleError(new AppError(insertError.message, appErrorOptions), 'PushNotificationService:registerDevice');
        }
      }
      
      return { success: true, token };
    } catch (error) {
      handleError(error, 'PushNotificationService:registerDevice');
      return { success: false, error: error instanceof Error ? error.message : String(error) }; // Keep original return for now
    }
  },
  
  /**
   * Get the device push token from AsyncStorage
   */
  async getPushToken() {
    try {
      return await AsyncStorage.getItem('@stingerai_push_token');
    } catch (error) {
      handleError(error, 'PushNotificationService:getPushToken');
      return null;
    }
  },
  
  /**
   * Send a push notification to a specific user
   * This triggers a Supabase function that will send the notification
   */
  async sendPushNotification(userId: string, notification: PushNotificationData) {
    try {
      const client = this.checkSupabaseClient();
      // Call Supabase Edge Function to send the notification
      const { data, error } = await client.functions.invoke('send-push-notification', {
        body: {
          userId,
          notification
        }
      });
      
      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('name' in error && typeof error.name === 'string') {
            appErrorOptions.code = error.name; // Use error.name as code for functions error
        }
        throw handleError(new AppError(error.message, appErrorOptions), 'PushNotificationService:sendPushNotification');
      }
      
      return { success: true, data };
    } catch (error) {
      handleError(error, 'PushNotificationService:sendPushNotification');
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
  
  /**
   * Update the device token if it has changed
   */
  async updateDeviceToken(oldToken: string, newToken: string) {
    try {
      const client = this.checkSupabaseClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      
      if (authError) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: authError };
        if ('code' in authError && typeof authError.code === 'string') {
            appErrorOptions.code = authError.code;
        }
        throw handleError(new AppError(authError.message, appErrorOptions), 'PushNotificationService:updateDeviceToken');
      }
      if (!user) {
        throw handleError(new AppError('User not authenticated', { code: 'AUTH_ERROR', hint: 'Cannot update device token for unauthenticated user.' }), 'PushNotificationService:updateDeviceToken');
      }
      
      const { error: updateError } = await client
        .from('device_push_tokens')
        .update({ token: newToken, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('token', oldToken);
      
      if (updateError) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: updateError };
        if ('code' in updateError && typeof updateError.code === 'string') {
            appErrorOptions.code = updateError.code;
        }
        throw handleError(new AppError(updateError.message, appErrorOptions), 'PushNotificationService:updateDeviceToken');
      }
      
      return { success: true };
    } catch (error) {
      handleError(error, 'PushNotificationService:updateDeviceToken');
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
  
  /**
   * Remove a device from receiving push notifications
   */
  async unregisterDevice() {
    try {
      const client = this.checkSupabaseClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      
      if (authError) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: authError };
        if ('code' in authError && typeof authError.code === 'string') {
            appErrorOptions.code = authError.code;
        }
        throw handleError(new AppError(authError.message, appErrorOptions), 'PushNotificationService:unregisterDevice');
      }
      if (!user) {
        throw handleError(new AppError('User not authenticated', { code: 'AUTH_ERROR', hint: 'Cannot unregister device for unauthenticated user.' }), 'PushNotificationService:unregisterDevice');
      }
      
      const token = await this.getPushToken();
      
      if (!token) {
        // console.warn removed as handleError will log
        return { success: true }; // No token to unregister, consider it success
      }
      
      const { error: deleteError } = await client
        .from('device_push_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('token', token);
      
      if (deleteError) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: deleteError };
        if ('code' in deleteError && typeof deleteError.code === 'string') {
            appErrorOptions.code = deleteError.code;
        }
        throw handleError(new AppError(deleteError.message, appErrorOptions), 'PushNotificationService:unregisterDevice');
      }
      
      return { success: true };
    } catch (error) {
      handleError(error, 'PushNotificationService:unregisterDevice');
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}; 