import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Get Supabase configuration
const getSupabaseConfig = () => {
  // Try environment variables first
  let url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  let key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  // If not found in environment variables, try Expo constants
  if (!url || !key) {
    const extra = Constants.expoConfig?.extra;
    if (extra) {
      url = url || extra.supabaseUrl;
      key = key || extra.supabaseAnonKey;
      if (!url || !key) {
        throw new Error('Incomplete Supabase configuration in Expo Constants. Make sure both EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file.');
      }
    } else {
      throw new Error('No Supabase configuration found. Make sure both EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file.');
    }
  }

  // Validate URL format
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
      throw new Error(`Invalid Supabase URL format: ${url}. Expected format: https://<project>.supabase.co`);
    }
  } catch (e) {
    throw new Error(`Invalid Supabase URL: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { url, key };
};

// Initialize Supabase client
let supabase: SupabaseClient | null = null;

try {
  const config = getSupabaseConfig();
  console.log('Initializing Supabase client...');
  
  supabase = createClient(config.url, config.key, {
    auth: {
      flowType: 'pkce',
      storage: AsyncStorage,
      detectSessionInUrl: false,
      autoRefreshToken: true,
      persistSession: true
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  console.log('Supabase client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  if (error instanceof Error) {
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
  supabase = null;
}

export const isSupabaseConfigured = () => {
  return Boolean(supabase);
};

export const getSupabaseStatus = async () => {
  const status = {
    isConfigured: isSupabaseConfigured(),
    hasClient: Boolean(supabase),
    isConnected: false,
    error: null as string | null
  };

  if (status.hasClient && supabase) {
    try {
      const { error } = await supabase.auth.getSession();
      status.isConnected = !error;
      if (error) {
        status.error = error.message;
      }
    } catch (e) {
      status.error = e instanceof Error ? e.message : String(e);
      console.error('Error checking Supabase connection:', e);
    }
  } else {
    status.error = 'Supabase client not initialized';
  }

  console.log('Supabase Status:', status);
  return status;
};

export { supabase }; 