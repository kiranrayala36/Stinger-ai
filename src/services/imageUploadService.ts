import { supabase } from '../config/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { handleError, AppError } from '../utils/errorHandler';

export const imageUploadService = {
  checkSupabaseClient: () => {
    if (!supabase) {
      throw handleError(new AppError('Supabase client is not initialized for ImageUploadService. Check your environment variables.', { code: 'SUPABASE_INIT_ERROR' }), 'ImageUploadService:checkSupabaseClient');
    }
    return supabase;
  },

  requestPermissions: async () => {
    try {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
          throw handleError(new AppError('Permission to access media library was denied', { code: 'PERMISSION_DENIED', hint: 'Grant media library permissions in app settings.' }), 'ImageUploadService:requestPermissions');
        }
      }
    } catch (error) {
      throw handleError(error, 'ImageUploadService:requestPermissions');
    }
  },

  pickImage: async (): Promise<ImagePicker.ImagePickerResult> => {
    try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
        throw handleError(new AppError('Image selection was cancelled', { code: 'USER_CANCELLED' }), 'ImageUploadService:pickImage');
    }

    return result;
    } catch (error) {
      throw handleError(error, 'ImageUploadService:pickImage');
    }
  },

  uploadProfilePhoto: async (userId: string, uri: string): Promise<string> => {
    try {
      const client = imageUploadService.checkSupabaseClient();

      // Validate URI
      if (!uri || typeof uri !== 'string') {
        throw handleError(new AppError('Invalid image URI provided', { code: 'INVALID_URI' }), 'ImageUploadService:uploadProfilePhoto');
      }

      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${userId}.${fileExt}`;
      const filePath = fileName;

      // Convert image to blob with error handling
      try {
        // Handle file:// URIs for React Native
        const fileData = {
          uri: uri,
          name: fileName,
          type: `image/${fileExt}`
        };

        // Upload to Supabase Storage with detailed error handling
        const { error: uploadError, data: uploadData } = await client.storage
          .from('avatars')
          .upload(filePath, fileData as any, {
            contentType: `image/${fileExt}`,
            upsert: true
          });

        if (uploadError) {
            const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: uploadError };
            if ('error' in uploadError && typeof uploadError.error === 'string') { // Supabase Storage errors might have a 'error' field
                appErrorOptions.code = uploadError.error;
            } else if ('name' in uploadError && typeof uploadError.name === 'string') {
                appErrorOptions.code = uploadError.name;
            }
            throw handleError(new AppError(`Upload failed: ${uploadError.message}`, appErrorOptions), 'ImageUploadService:uploadProfilePhoto');
        }

        // Get public URL
        const { data } = client.storage
          .from('avatars')
          .getPublicUrl(filePath);

        if (!data.publicUrl) {
          throw handleError(new AppError('Failed to get public URL for uploaded image', { code: 'URL_ERROR', hint: 'Check Supabase storage bucket configuration.' }), 'ImageUploadService:uploadProfilePhoto');
        }

        return data.publicUrl;
      } catch (error) {
        throw handleError(new AppError('Failed to process image data', { originalError: error }), 'ImageUploadService:uploadProfilePhoto');
      }
    } catch (error) {
      throw handleError(error, 'ImageUploadService:uploadProfilePhoto');
    }
  },

  deleteProfilePhoto: async (userId: string): Promise<void> => {
    try {
      const client = imageUploadService.checkSupabaseClient();

      const { error } = await client.storage
        .from('avatars')
        .remove([`profiles/${userId}/profile.jpg`]);

      if (error) {
        const appErrorOptions: { code?: string; originalError?: Error | unknown } = { originalError: error };
        if ('error' in error && typeof error.error === 'string') {
            appErrorOptions.code = error.error;
        } else if ('name' in error && typeof error.name === 'string') {
            appErrorOptions.code = error.name;
        }
        throw handleError(new AppError(`Failed to delete profile photo: ${error.message}`, appErrorOptions), 'ImageUploadService:deleteProfilePhoto');
      }
    } catch (error) {
      throw handleError(error, 'ImageUploadService:deleteProfilePhoto');
    }
  }
}; 