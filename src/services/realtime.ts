import { supabase } from '../config/supabase'
import { Profile } from '../types/supabase'

export class RealtimeService {
  private static checkSupabaseClient() {
    if (!supabase) {
      throw new Error('Supabase client is not initialized for RealtimeService. Check your environment variables.');
    }
    return supabase;
  }

  static subscribeToProfileChanges(
    userId: string,
    callback: (payload: any) => void
  ) {
    const client = RealtimeService.checkSupabaseClient();
    return client
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          callback(payload)
        }
      )
      .subscribe()
  }

  static subscribeToTableChanges(
    table: string,
    callback: (payload: any) => void
  ) {
    const client = RealtimeService.checkSupabaseClient();
    return client
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
        },
        (payload) => {
          callback(payload)
        }
      )
      .subscribe()
  }

  static unsubscribe(channel: any) {
    channel.unsubscribe()
  }

  static async getRealtimeStatus() {
    const client = RealtimeService.checkSupabaseClient();
    const channel = client.channel('status');
    await channel.subscribe();
    return { status: channel.state, error: null };
  }
}
