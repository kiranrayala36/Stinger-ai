/**
 * Database backup and restore utilities
 * Helps with backing up user data for maintenance and migrations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform, Share } from 'react-native';
import { Performance } from './performance';

// Types for backup
interface BackupData {
  version: string;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Creates a backup of all AsyncStorage data
 */
export const createBackup = async (appVersion: string): Promise<string> => {
  return await Performance.measureAsync('createBackup', async () => {
    try {
      // Get all keys
      const keys = await AsyncStorage.getAllKeys();
      
      // Filter out system keys if needed
      const userDataKeys = keys.filter(key => !key.startsWith('@system_'));
      
      // Get all key-value pairs
      const keyValuePairs = await AsyncStorage.multiGet(userDataKeys);
      
      // Convert to object
      const data: Record<string, any> = {};
      keyValuePairs.forEach(([key, value]) => {
        if (value) {
          try {
            // Try to parse JSON values
            data[key] = JSON.parse(value);
          } catch {
            // If not JSON, store as string
            data[key] = value;
          }
        }
      });
      
      // Create backup object
      const backup: BackupData = {
        version: appVersion,
        timestamp: new Date().toISOString(),
        data
      };
      
      // Convert to JSON
      const backupJson = JSON.stringify(backup, null, 2);
      
      // Determine where to save the file
      const backupFolder = `${FileSystem.documentDirectory}backups/`;
      const folderExists = await FileSystem.getInfoAsync(backupFolder);
      
      // Create backup folder if it doesn't exist
      if (!folderExists.exists) {
        await FileSystem.makeDirectoryAsync(backupFolder, { intermediates: true });
      }
      
      // Create backup file name
      const fileName = `stingerai_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const filePath = `${backupFolder}${fileName}`;
      
      // Write backup to file
      await FileSystem.writeAsStringAsync(filePath, backupJson);
      
      return filePath;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  });
};

/**
 * Shares a backup file with the user
 */
export const shareBackup = async (backupPath: string): Promise<void> => {
  try {
    // For Android, we need to copy the file to external directory first
    let sharePath = backupPath;
    
    if (Platform.OS === 'android') {
      const fileName = backupPath.split('/').pop();
      const destinationPath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.copyAsync({
        from: backupPath,
        to: destinationPath
      });
      sharePath = destinationPath;
    }
    
    // Share the file
    await Share.share({
      url: sharePath,
      title: 'StingerAI Backup',
      message: 'Here is your StingerAI data backup.'
    });
  } catch (error) {
    console.error('Error sharing backup:', error);
    throw error;
  }
};

/**
 * Restores data from a backup file
 * WARNING: This will overwrite existing data!
 */
export const restoreFromBackup = async (filePath: string): Promise<void> => {
  return await Performance.measureAsync('restoreFromBackup', async () => {
    try {
      // Read backup file
      const backupJson = await FileSystem.readAsStringAsync(filePath);
      
      // Parse backup
      const backup: BackupData = JSON.parse(backupJson);
      
      // Validate backup format
      if (!backup.version || !backup.timestamp || !backup.data) {
        throw new Error('Invalid backup format');
      }
      
      // Clear existing data (optional)
      // WARNING: This will delete ALL AsyncStorage data
      // await AsyncStorage.clear();
      
      // Restore each key-value pair
      const entries = Object.entries(backup.data);
      const promises = entries.map(([key, value]) => {
        return AsyncStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      });
      
      // Wait for all promises to resolve
      await Promise.all(promises);
      
      console.log(`✅ Restored ${entries.length} items from backup created on ${backup.timestamp}`);
    } catch (error) {
      console.error('Error restoring from backup:', error);
      throw error;
    }
  });
};

/**
 * Gets a list of available backups
 */
export const listBackups = async (): Promise<string[]> => {
  try {
    const backupFolder = `${FileSystem.documentDirectory}backups/`;
    const folderInfo = await FileSystem.getInfoAsync(backupFolder);
    
    if (!folderInfo.exists) {
      return [];
    }
    
    const backupFiles = await FileSystem.readDirectoryAsync(backupFolder);
    return backupFiles
      .filter(file => file.endsWith('.json'))
      .map(file => `${backupFolder}${file}`);
  } catch (error) {
    console.error('Error listing backups:', error);
    return [];
  }
};

export const Backup = {
  create: createBackup,
  share: shareBackup,
  restore: restoreFromBackup,
  list: listBackups,
}; 