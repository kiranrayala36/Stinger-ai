import { supabase } from '../config/supabase'
import { File } from '../types/supabase'

export class SupabaseStorage {
  private static checkSupabaseClient() {
    if (!supabase) {
      throw new Error('Supabase client is not initialized for SupabaseStorage. Check your environment variables.');
    }
    return supabase;
  }

  static async uploadFile(
    bucket: string,
    path: string,
    file: File | Blob
  ) {
    const client = SupabaseStorage.checkSupabaseClient();
    // Convert the file to an ArrayBuffer that Supabase can handle
    const arrayBuffer = await (file as Blob).arrayBuffer();
    const { data, error } = await client.storage
      .from(bucket)
      .upload(path, arrayBuffer);
    return { data, error };
  }

  static async downloadFile(bucket: string, path: string) {
    const client = SupabaseStorage.checkSupabaseClient();
    const { data, error } = await client.storage
      .from(bucket)
      .download(path);
    return { data, error };
  }

  static async getPublicUrl(bucket: string, path: string) {
    const client = SupabaseStorage.checkSupabaseClient();
    const { data } = await client.storage
      .from(bucket)
      .getPublicUrl(path);
    return data;
  }

  static async removeFile(bucket: string, path: string) {
    const client = SupabaseStorage.checkSupabaseClient();
    const { error } = await client.storage
      .from(bucket)
      .remove([path]);
    return error;
  }

  static async listFiles(bucket: string, path?: string) {
    const client = SupabaseStorage.checkSupabaseClient();
    const { data, error } = await client.storage
      .from(bucket)
      .list(path);
    return { data, error };
  }
}
