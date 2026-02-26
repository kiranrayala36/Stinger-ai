export * from './User';

export interface User {
  id: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
  aud?: string;
  role?: string;
  photoURL?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  due_date: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  is_ai: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'system' | 'task' | 'chat';
  read: boolean;
  created_at: string;
}

export interface Feedback {
  id?: string;
  user_id: string;
  content: string;
  category: 'general' | 'bug' | 'feature' | 'performance' | 'ui_ux' | 'accessibility' | 'auth' | 'tasks' | 'ai_chat';
  rating: number;
  created_at?: string;
  extra_data?: string;
} 