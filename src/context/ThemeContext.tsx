import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  colors: {
    background: string;
    card: string;
    text: string;
    border: string;
    primary: string;
    secondary: string;
    error: string;
    success: string;
    warning: string;
    divider: string;
    disabled: string;
    placeholder: string;
    shadow: string;
    overlay: string;
  };
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const lightColors = {
  background: '#f5f5f5',
  card: '#ffffff',
  text: '#000000',
  border: '#e0e0e0',
  primary: '#007AFF',
  secondary: '#666666',
  error: '#ff4444',
  success: '#00C851',
  warning: '#ffbb33',
  divider: '#e0e0e0',
  disabled: '#cccccc',
  placeholder: '#999999',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

const darkColors = {
  background: '#181A20',
  card: '#1e1e1e',
  text: '#ffffff',
  border: '#333333',
  primary: '#0A84FF',
  secondary: '#999999',
  error: '#ff453a',
  success: '#32d74b',
  warning: '#ffd60a',
  divider: '#333333',
  disabled: '#666666',
  placeholder: '#666666',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>('dark');
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    // Load saved theme preference
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        if (savedTheme) {
          setTheme(savedTheme as Theme);
          setIsDarkMode(JSON.parse(savedTheme));
        } else {
          // Use system theme if no saved preference
          setTheme(systemColorScheme || 'light');
          setIsDarkMode(systemColorScheme === 'dark');
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };

    loadTheme();
  }, [systemColorScheme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    setIsDarkMode(newTheme === 'dark');
    try {
      await AsyncStorage.setItem('theme', JSON.stringify(newTheme === 'dark'));
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const toggleDarkMode = async () => {
    try {
      const newValue = !isDarkMode;
      setIsDarkMode(newValue);
      await AsyncStorage.setItem('theme', JSON.stringify(newValue));
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const colors = theme === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        colors,
        isDarkMode,
        toggleDarkMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}; 