import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  lastModified: number;
};

class ChatStorageService {
  private readonly CHAT_SESSIONS_KEY = 'chat_sessions';
  private readonly FAVORITES_KEY = 'favorite_chats';

  async saveChatSession(session: ChatSession): Promise<void> {
    try {
      const sessions = await this.getChatSessions();
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.push(session);
      }
      
      await AsyncStorage.setItem(this.CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving chat session:', error);
      throw error;
    }
  }

  async getChatSessions(): Promise<ChatSession[]> {
    try {
      const sessionsJson = await AsyncStorage.getItem(this.CHAT_SESSIONS_KEY);
      return sessionsJson ? JSON.parse(sessionsJson) : [];
    } catch (error) {
      console.error('Error getting chat sessions:', error);
      return [];
    }
  }

  async getChatSession(id: string): Promise<ChatSession | null> {
    try {
      const sessions = await this.getChatSessions();
      return sessions.find(s => s.id === id) || null;
    } catch (error) {
      console.error('Error getting chat session:', error);
      return null;
    }
  }

  async deleteChatSession(id: string): Promise<void> {
    try {
      const sessions = await this.getChatSessions();
      const updatedSessions = sessions.filter(s => s.id !== id);
      await AsyncStorage.setItem(this.CHAT_SESSIONS_KEY, JSON.stringify(updatedSessions));
    } catch (error) {
      console.error('Error deleting chat session:', error);
      throw error;
    }
  }

  async getFavorites(): Promise<string[]> {
    try {
      const favoritesJson = await AsyncStorage.getItem(this.FAVORITES_KEY);
      return favoritesJson ? JSON.parse(favoritesJson) : [];
    } catch (error) {
      console.error('Error getting favorites:', error);
      return [];
    }
  }

  async saveFavorites(favorites: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.FAVORITES_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.error('Error saving favorites:', error);
      throw error;
    }
  }
}

export const chatStorageService = new ChatStorageService(); 