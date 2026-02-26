// Type declarations for Deno runtime APIs
declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
  }
  export const env: Env;
}

// Declare modules used in Supabase Edge Functions
declare module 'https://deno.land/std@0.177.0/http/server.ts' {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.32.0' {
  export function createClient(url: string, key: string, options?: any): any;
} 