import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  save: async (key: string, value: any): Promise<void> => {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      // console.error('Error saving data:', error);
      throw error;
    }
  },

  load: async <T>(key: string): Promise<T | null> => {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      // console.error('Error reading data:', error);
      throw error;
    }
  },

  remove: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      // console.error('Error removing data:', error);
      throw error;
    }
  },

  clear: async (): Promise<void> => {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      // console.error('Error clearing data:', error);
      throw error;
    }
  },

  getAllKeys: async (): Promise<readonly string[]> => {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      // console.error('Error getting all keys:', error);
      throw error;
    }
  },

  hasKey: async (key: string): Promise<boolean> => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value != null;
    } catch (error) {
      // console.error('Error checking key:', error);
      throw error;
    }
  },
}; 