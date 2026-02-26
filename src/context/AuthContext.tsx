import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { supabaseService } from '../services/supabaseService';
import { User } from '../types/User';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  error: Error | null;
  isInitialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updateUserProfile: (profile: Partial<User>) => Promise<void>;
  updateUserMetadata: (metadata: Record<string, any>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (!supabase) throw new Error('Supabase client is not initialized');
        
        // Check for existing session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session) {
          // Try to get saved user data from AsyncStorage first
          const savedUserData = await AsyncStorage.getItem('user');
          if (savedUserData) {
            const savedUser = JSON.parse(savedUserData);
            setUser(savedUser);
          } else {
            // If no saved data, use session data
            const { user: sessionUser } = session;
            const userData: User = {
              id: sessionUser.id,
              email: sessionUser.email || '',
              photoURL: sessionUser.user_metadata?.avatar_url,
              firstName: sessionUser.user_metadata?.first_name,
              lastName: sessionUser.user_metadata?.last_name,
              phone: sessionUser.user_metadata?.phone,
              bio: sessionUser.user_metadata?.bio,
            };
            setUser(userData);
            // Save to AsyncStorage for future use
            await AsyncStorage.setItem('user', JSON.stringify(userData));
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    if (!supabase) throw new Error('Supabase client is not initialized');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const savedUserData = await AsyncStorage.getItem('user');
        if (savedUserData) {
          setUser(JSON.parse(savedUserData));
        } else {
          const userData: User = {
            id: session.user.id,
            email: session.user.email || '',
            photoURL: session.user.user_metadata?.avatar_url,
            firstName: session.user.user_metadata?.first_name,
            lastName: session.user.user_metadata?.last_name,
            phone: session.user.user_metadata?.phone,
            bio: session.user.user_metadata?.bio,
          };
          setUser(userData);
          await AsyncStorage.setItem('user', JSON.stringify(userData));
        }
      } else {
        setUser(null);
        await AsyncStorage.removeItem('user');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabaseService.signIn(email, password);
      if (error) throw error;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      setLoading(true);
      const { error } = await supabaseService.signUp(email, password, firstName, lastName);
      if (error) throw error;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabaseService.signOut();
      if (error) throw error;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('AuthContext: Starting Google sign-in...');
      setLoading(true);
      
      const { data, error } = await supabaseService.signInWithGoogle();
      
      if (error) {
        console.error('AuthContext: Error in Google sign-in:', error);
        throw error;
      }
      
      if (!data?.session?.user) {
        console.error('AuthContext: No session found after Google sign-in');
        throw new Error('Failed to get user session after Google sign-in');
      }
    } catch (error) {
      console.error('AuthContext: Error signing in with Google:', error);
      
      if (error instanceof Error) {
        Alert.alert(
          'Authentication Error',
          error.message || 'An error occurred during authentication. Please try again.'
        );
      } else {
        Alert.alert(
          'Authentication Error',
          'An unexpected error occurred. Please try again.'
        );
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfile = async (profile: Partial<User>) => {
    try {
      setLoading(true);
      const { error } = await supabaseService.updateUserProfile(profile);
      if (error) throw error;
      setUser(prev => prev ? { ...prev, ...profile } : null);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateUserMetadata = async (metadata: Record<string, any>) => {
    try {
      if (!supabase) {
        throw new Error('Supabase client is not initialized');
      }

      const { data, error } = await supabase.auth.updateUser({
        data: metadata
      });

      if (error) {
        throw error;
      }

      if (data.user && user) {
        const updatedUser = {
          ...user,
          photoURL: data.user.user_metadata.avatar_url || data.user.user_metadata.picture || user.photoURL,
        };
        setUser(updatedUser);
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      setLoading(true);
      const { error } = await supabaseService.changePassword(currentPassword, newPassword);
      if (error) throw error;
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async () => {
    try {
      setLoading(true);
      const { error } = await supabaseService.deleteAccount();
      if (error) throw error;
      setUser(null);
      await AsyncStorage.removeItem('user');
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
    user,
    loading,
        error: null,
        isInitialized,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    updateUserProfile,
    updateUserMetadata,
    changePassword,
    deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}; 