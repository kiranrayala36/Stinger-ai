import React, { useEffect, useRef, ReactNode, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppNavigator } from './navigation/AppNavigator';
import { StatusBar, View, StyleSheet, Text, ScrollView, SafeAreaView, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { notificationService } from './services/notificationService';
import * as Notifications from 'expo-notifications';
import { getSupabaseStatus, supabase } from './config/supabase';
import * as Font from 'expo-font';
import Constants from 'expo-constants';
import { AlertProvider } from './components/AlertProvider';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // console.error('ErrorBoundary caught error:', error);
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // console.error('App Error:', error);
    // console.error('Error Info:', errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Something went wrong!</Text>
          <Text style={styles.errorDetail}>{this.state.error?.message || 'Unknown error'}</Text>
          <Text style={styles.errorDetail}>
            {this.state.errorInfo?.componentStack || ''}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const LoadingScreen = ({ message }: { message: string }) => (
  <View style={styles.loadingContainer}>
    <Text style={styles.loadingText}>{message}</Text>
  </View>
);

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        if (!mounted.current) return;

        // Load fonts
        try {
          await Font.loadAsync({
            'System': require('../assets/fonts/Roboto-Regular.ttf'),
            'System-Medium': require('../assets/fonts/Roboto-Medium.ttf'),
            'System-Bold': require('../assets/fonts/Roboto-Bold.ttf'),
            'System-Heavy': require('../assets/fonts/Roboto-Black.ttf'),
          });
          setFontsLoaded(true);
        } catch (fontError) {
          setFontsLoaded(true);
        }

        // Check Supabase configuration
        const status = await getSupabaseStatus();
        if (!status.isConfigured) {
          throw new Error('Supabase is not properly configured');
        }

        // Test Supabase connection
        try {
          if (!supabase) {
            throw new Error('Supabase client is not initialized');
          }
          const { error } = await supabase.auth.getSession();
          if (error) {
            throw error;
          }
        } catch (supabaseError) {
          throw supabaseError;
        }
        
        // Initialize notification service (non-critical)
        try {
          await notificationService.setupNotifications();
        } catch (notificationError) {
          // Continue without notifications
        }

        if (mounted.current) {
          setIsInitialized(true);
        }
      } catch (error) {
        if (mounted.current) {
          setInitError(error instanceof Error ? error : new Error('Unknown initialization error'));
        }
      }
    };

    initializeApp();

    return () => {
      mounted.current = false;
    };
  }, []);

  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to start app</Text>
        <Text style={styles.errorDetail}>{initError.message}</Text>
      </View>
    );
  }

  if (!isInitialized || !fontsLoaded) {
    return <LoadingScreen message="Initializing app..." />;
  }

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthProvider>
            <ThemeProvider>
              <AlertProvider>
                <NavigationContainer
                  theme={{
                    dark: true,
                    colors: {
                      primary: '#181A20',
                      background: '#181A20',
                      card: '#181A20',
                      text: '#fff',
                      border: '#23262B',
                      notification: '#4ADE80',
                    },
                    fonts: {
                      regular: {
                        fontFamily: 'System',
                        fontWeight: '400',
                      },
                      medium: {
                        fontFamily: 'System-Medium',
                        fontWeight: '500',
                      },
                      bold: {
                        fontFamily: 'System-Bold',
                        fontWeight: '700',
                      },
                      heavy: {
                        fontFamily: 'System-Heavy',
                        fontWeight: '900',
                      },
                    }
                  }}
                  fallback={<LoadingScreen message="Loading..." />}
                >
                  <SafeAreaView style={styles.safeArea}>
                    <StatusBar 
                      barStyle="light-content" 
                      backgroundColor="transparent" 
                      translucent={true} 
                    />
                    <AppNavigator />
                  </SafeAreaView>
                </NavigationContainer>
              </AlertProvider>
            </ThemeProvider>
          </AuthProvider>
        </GestureHandlerRootView>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181A20',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight : 0,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#181A20',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 20,
    marginBottom: 10,
  },
  errorDetail: {
    color: '#ff4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  errorStack: {
    color: '#888',
    fontSize: 12,
    textAlign: 'left',
    marginTop: 10,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#181A20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  logContainer: {
    marginTop: 20,
    maxHeight: 300,
    width: '100%',
    padding: 10,
  },
  logText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
}); 