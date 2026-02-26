import { supabase } from '../config/supabase';
import { Task } from '../navigation/AppNavigator';
import { User, Feedback } from '../types';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { handleError, AppError } from '../utils/errorHandler';

// Initialize WebBrowser for OAuth
WebBrowser.maybeCompleteAuthSession();

// Get the redirect URL for OAuth
const redirectUrl = Linking.createURL('auth/callback');

// Error for when Supabase client is not initialized
const SUPABASE_NOT_INITIALIZED = 'Supabase client is not initialized. Check your environment variables.';

// Helper function to check if Supabase client is initialized
const checkSupabaseInitialized = () => {
  if (!supabase) {
    throw new Error(SUPABASE_NOT_INITIALIZED);
  }
  return supabase;
};

export const supabaseService = {
  // Authentication
  async signUp(email: string, password: string, firstName: string, lastName: string) {
    try {
      const client = checkSupabaseInitialized();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
            name: `${firstName} ${lastName}`
          }
        }
      });

      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('code' in error && typeof error.code === 'string') {
            appErrorOptions.code = error.code;
        }
        throw handleError(new AppError(error.message, appErrorOptions), 'SupabaseService:signUp');
      }

      if (data?.user) {
        // Update the user metadata immediately after signup
        await client.auth.updateUser({
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
            name: `${firstName} ${lastName}`
          }
        });
      }

      return { data, error: null };
    } catch (e) {
      const appError = handleError(e, 'SupabaseService:signUp');
      return { data: null, error: appError };
    }
  },

  async signIn(email: string, password: string) {
    try {
      const client = checkSupabaseInitialized();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('code' in error && typeof error.code === 'string') {
            appErrorOptions.code = error.code;
        }
        throw handleError(new AppError(error.message, appErrorOptions), 'SupabaseService:signIn');
      }
      return { data, error: null };
    } catch (e) {
      const appError = handleError(e, 'SupabaseService:signIn');
      return { data: null, error: appError };
    }
  },

  async signInWithGoogle() {
    try {
      console.log('Starting Google OAuth flow...');
      const client = checkSupabaseInitialized();
      
      // Initialize the OAuth flow
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            // Request profile information from Google
            scope: 'profile email'
          }
        }
      });

      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('code' in error && typeof error.code === 'string') {
            appErrorOptions.code = error.code;
        }
        throw handleError(new AppError('OAuth initialization error', appErrorOptions), 'SupabaseService:signInWithGoogle');
      }

      if (!data?.url) {
        throw handleError(new AppError('No OAuth URL returned'), 'SupabaseService:signInWithGoogle');
      }

      console.log('Opening auth session...');
      
      // Open auth session and wait for result
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      console.log('Auth session result:', result);

      if (result.type === 'success' && result.url) {
        // Extract code from URL
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        
        if (!code) {
          throw handleError(new AppError('No code parameter found in redirect URL', { hint: 'Check Google OAuth configuration.' }), 'SupabaseService:signInWithGoogle');
        }

        // Exchange code for session
        const { data: sessionData, error: sessionError } = await client.auth.exchangeCodeForSession(code);
        
        if (sessionError) {
            const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: sessionError };
            if ('code' in sessionError && typeof sessionError.code === 'string') {
                appErrorOptions.code = sessionError.code;
            }
            throw handleError(new AppError('Code exchange error', appErrorOptions), 'SupabaseService:signInWithGoogle');
        }
        
        if (!sessionData.session) {
          throw handleError(new AppError('No session returned from code exchange', { hint: 'Session might have expired or an issue occurred during exchange.' }), 'SupabaseService:signInWithGoogle');
        }
        
        // Log the user metadata to help debug
        console.log('User metadata from Google sign-in:', sessionData.session.user.user_metadata);
        
        return { data: sessionData, error: null };
      }

      throw handleError(new AppError('Authentication was cancelled', { hint: 'User closed the authentication window.' }), 'SupabaseService:signInWithGoogle');
    } catch (error) {
      const appError = handleError(error, 'SupabaseService:signInWithGoogle');
      return { data: null, error: appError };
    }
  },

  async signOut() {
    try {
      const client = checkSupabaseInitialized();
      const { error } = await client.auth.signOut();
      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('code' in error && typeof error.code === 'string') {
            appErrorOptions.code = error.code;
        }
        throw handleError(new AppError(error.message, appErrorOptions), 'SupabaseService:signOut');
      }
      return { error: null };
    } catch (e) {
      const appError = handleError(e, 'SupabaseService:signOut');
      return { error: appError };
    }
  },

  async getCurrentUser() {
    try {
      const client = checkSupabaseInitialized();
      const { data: { user }, error } = await client.auth.getUser();
      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('code' in error && typeof error.code === 'string') {
            appErrorOptions.code = error.code;
        }
        throw handleError(new AppError(error.message, appErrorOptions), 'SupabaseService:getCurrentUser');
      }
      return { user, error: null };
    } catch (e) {
      const appError = handleError(e, 'SupabaseService:getCurrentUser');
      return { user: null, error: appError };
    }
  },

  // Tasks
  async getTasks(userId: string) {
    try {
      const client = checkSupabaseInitialized();
      const { data, error } = await client
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('code' in error && typeof error.code === 'string') {
            appErrorOptions.code = error.code;
        }
        throw handleError(new AppError(error.message, appErrorOptions), 'SupabaseService:getTasks');
      }
      return { data, error: null };
    } catch (e) {
      const appError = handleError(e, 'SupabaseService:getTasks');
      return { data: null, error: appError };
    }
  },

  async createTask(task: Omit<Task, 'id'> & { user_id: string }) {
    try {
      const client = checkSupabaseInitialized();
      const { data, error } = await client
        .from('tasks')
        .insert(task)
        .select()
        .single();
      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('code' in error && typeof error.code === 'string') {
            appErrorOptions.code = error.code;
        }
        throw handleError(new AppError(error.message, appErrorOptions), 'SupabaseService:createTask');
      }
      return { data, error: null };
    } catch (e) {
      const appError = handleError(e, 'SupabaseService:createTask');
      return { data: null, error: appError };
    }
  },

  async updateTask(taskId: string, updates: Partial<Task>) {
    try {
      const client = checkSupabaseInitialized();
      const { data, error } = await client
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select();
      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('code' in error && typeof error.code === 'string') {
            appErrorOptions.code = error.code;
        }
        throw handleError(new AppError(error.message, appErrorOptions), 'SupabaseService:updateTask');
      }
      return { data, error: null };
    } catch (e) {
      const appError = handleError(e, 'SupabaseService:updateTask');
      return { data: null, error: appError };
    }
  },

  async deleteTask(taskId: string) {
    try {
      const client = checkSupabaseInitialized();
      const { error } = await client
        .from('tasks')
        .delete()
        .eq('id', taskId);
      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('code' in error && typeof error.code === 'string') {
            appErrorOptions.code = error.code;
        }
        throw handleError(new AppError(error.message, appErrorOptions), 'SupabaseService:deleteTask');
      }
      return { error: null };
    } catch (e) {
      const appError = handleError(e, 'SupabaseService:deleteTask');
      return { error: appError };
    }
  },

  // Chat History
  async getChatHistory(userId: string) {
    try {
      const client = checkSupabaseInitialized();
      const { data, error } = await client
        .from('chat_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('code' in error && typeof error.code === 'string') {
            appErrorOptions.code = error.code;
        }
        throw handleError(new AppError(error.message, appErrorOptions), 'SupabaseService:getChatHistory');
      }
      return { data, error: null };
    } catch (e) {
      const appError = handleError(e, 'SupabaseService:getChatHistory');
      return { data: null, error: appError };
    }
  },

  async saveChatMessage(chatId: string, message: { role: string; content: string }) {
    try {
      const client = checkSupabaseInitialized();
      const { data, error } = await client
        .from('chat_messages')
        .insert([{ chat_id: chatId, ...message }])
        .select();
      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('code' in error && typeof error.code === 'string') {
            appErrorOptions.code = error.code;
        }
        throw handleError(new AppError(error.message, appErrorOptions), 'SupabaseService:saveChatMessage');
      }
      return { data, error: null };
    } catch (e) {
      const appError = handleError(e, 'SupabaseService:saveChatMessage');
      return { data: null, error: appError };
    }
  },

  async updateUserProfile(profile: Partial<User>) {
    try {
      const client = checkSupabaseInitialized();
      const { data: { user }, error: getUserError } = await client.auth.getUser();
      if (getUserError) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: getUserError };
        if ('code' in getUserError && typeof getUserError.code === 'string') {
            appErrorOptions.code = getUserError.code;
        }
        throw handleError(new AppError(getUserError.message, appErrorOptions), 'SupabaseService:updateUserProfile');
      }
      if (!user) {
        throw handleError(new AppError('User not authenticated', { code: 'AUTH_ERROR', hint: 'Cannot update profile for unauthenticated user.' }), 'SupabaseService:updateUserProfile');
      }

      const { data, error } = await client.auth.updateUser({
        data: profile
      });

      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('code' in error && typeof error.code === 'string') {
            appErrorOptions.code = error.code;
        }
        throw handleError(new AppError(error.message, appErrorOptions), 'SupabaseService:updateUserProfile');
      }
      return { data, error: null };
    } catch (e) {
      const appError = handleError(e, 'SupabaseService:updateUserProfile');
      return { data: null, error: appError };
    }
  },

  async changePassword(currentPassword: string, newPassword: string) {
    try {
      const client = checkSupabaseInitialized();
      const { data, error } = await client.auth.updateUser({
        password: newPassword
      });
      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('code' in error && typeof error.code === 'string') {
            appErrorOptions.code = error.code;
        }
        throw handleError(new AppError(error.message, appErrorOptions), 'SupabaseService:changePassword');
      }
      return { data, error: null };
    } catch (e) {
      const appError = handleError(e, 'SupabaseService:changePassword');
      return { data: null, error: appError };
    }
  },

  async deleteAccount() {
    try {
      const client = checkSupabaseInitialized();
      const { data: { user }, error: getUserError } = await client.auth.getUser();
      if (getUserError) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: getUserError };
        if ('code' in getUserError && typeof getUserError.code === 'string') {
            appErrorOptions.code = getUserError.code;
        }
        throw handleError(new AppError(getUserError.message, appErrorOptions), 'SupabaseService:deleteAccount');
      }
      if (!user) {
        throw handleError(new AppError('User not authenticated', { code: 'AUTH_ERROR', hint: 'Cannot delete account for unauthenticated user.' }), 'SupabaseService:deleteAccount');
      }

      // Attempt to delete associated files in storage
      // Note: This assumes 'avatars' bucket, adjust if needed
      const { error: storageError } = await client.storage
          .from('avatars')
        .remove([`profiles/${user.id}/profile.jpg`]);
      
      if (storageError) {
        throw handleError(new AppError(`Failed to delete user files: ${storageError.message}`, { code: storageError.name, originalError: storageError }), 'SupabaseService:deleteAccount');
      }

      // Delete the user from auth.users table
      const { error } = await client.rpc('delete_auth_user', { user_id_param: user.id });
      
      if (error) {
        throw handleError(new AppError(`Failed to delete user: ${error.message}`, { code: error.code, details: error.details, hint: error.hint }), 'SupabaseService:deleteAccount');
      }
      
      // Also sign out locally after successful deletion
      await client.auth.signOut();
      
      return { error: null };
    } catch (e) {
      const appError = handleError(e, 'SupabaseService:deleteAccount');
      return { error: appError };
    }
  },

  async submitFeedback(feedback: Omit<Feedback, 'id' | 'created_at'>) {
    try {
      const client = checkSupabaseInitialized();
      const { data: user } = await client.auth.getUser();
      if (!user.user) {
        throw handleError(new AppError('User not authenticated', { code: 'AUTH_ERROR', hint: 'User must be logged in to submit feedback.' }), 'SupabaseService:submitFeedback');
      }

      const { error } = await client.from('user_feedback').insert({
        ...feedback,
        user_id: user.user.id,
      });
      
      if (error) {
        throw handleError(new AppError(`Feedback submission failed: ${error.message}`, { code: error.code, details: error.details, hint: error.hint }), 'SupabaseService:submitFeedback');
      }
      
      return { data: true, error: null };
    } catch (e) {
      const appError = handleError(e, 'SupabaseService:submitFeedback');
      return { data: false, error: appError };
    }
  },

  async getToken(): Promise<string> {
    try {
      const client = checkSupabaseInitialized();
      const { data } = await client.auth.getSession();
      if (!data || !data.session || !data.session.access_token) {
        throw handleError(new AppError('No active session or access token found', { code: 'AUTH_ERROR', hint: 'User might not be logged in or session expired.' }), 'SupabaseService:getToken');
      }
      return data.session.access_token;
    } catch (e) {
      throw handleError(e, 'SupabaseService:getToken');
    }
  },
}; 