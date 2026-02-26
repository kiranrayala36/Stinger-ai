import AsyncStorage from '@react-native-async-storage/async-storage';
import { handleError } from '../utils/errorHandler';

export type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  category: string;
  status: string;
  attachments?: string[];
};

const TASKS_STORAGE_KEY = (userId: string) => `tasks_${userId}`;

export const taskService = {
  loadTasks: async (userId: string): Promise<Task[]> => {
    try {
      const storedTasks = await AsyncStorage.getItem(TASKS_STORAGE_KEY(userId));
      if (storedTasks) {
        return JSON.parse(storedTasks) as Task[];
      }
      return [];
    } catch (error) {
      handleError(error, 'taskService:loadTasks');
      throw new Error('Failed to load tasks.');
    }
  },

  saveTasks: async (userId: string, tasks: Task[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(TASKS_STORAGE_KEY(userId), JSON.stringify(tasks));
    } catch (error) {
      handleError(error, 'taskService:saveTasks');
      throw new Error('Failed to save tasks.');
    }
  },

  addTask: async (userId: string, newTask: Task): Promise<Task[]> => {
    try {
      const currentTasks = await taskService.loadTasks(userId);
      const updatedTasks = [...currentTasks, newTask];
      await taskService.saveTasks(userId, updatedTasks);
      return updatedTasks;
    } catch (error) {
      handleError(error, 'taskService:addTask');
      throw new Error('Failed to add task.');
    }
  },

  toggleTaskCompletion: async (userId: string, taskId: string): Promise<Task[]> => {
    try {
      const currentTasks = await taskService.loadTasks(userId);
      const updatedTasks = currentTasks.map(task => {
        if (task.id === taskId) {
          return {
            ...task,
            completed: !task.completed,
            status: !task.completed ? 'completed' : 'not_started'
          };
        }
        return task;
      });
      await taskService.saveTasks(userId, updatedTasks);
      return updatedTasks;
    } catch (error) {
      handleError(error, 'taskService:toggleTaskCompletion');
      throw new Error('Failed to toggle task completion.');
    }
  },

  deleteTask: async (userId: string, taskId: string): Promise<Task[]> => {
    try {
      const currentTasks = await taskService.loadTasks(userId);
      const updatedTasks = currentTasks.filter(task => task.id !== taskId);
      await taskService.saveTasks(userId, updatedTasks);
      return updatedTasks;
    } catch (error) {
      handleError(error, 'taskService:deleteTask');
      throw new Error('Failed to delete task.');
    }
  },

  getTaskById: async (userId: string, taskId: string): Promise<Task | undefined> => {
    try {
      const tasks = await taskService.loadTasks(userId);
      return tasks.find(task => task.id === taskId);
    } catch (error) {
      handleError(error, 'taskService:getTaskById');
      return undefined;
    }
  },

  updateTask: async (userId: string, updatedTask: Task): Promise<Task[]> => {
    try {
      const currentTasks = await taskService.loadTasks(userId);
      const tasksAfterUpdate = currentTasks.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      );
      await taskService.saveTasks(userId, tasksAfterUpdate);
      return tasksAfterUpdate;
    } catch (error) {
      handleError(error, 'taskService:updateTask');
      throw new Error('Failed to update task.');
    }
  }
}; 