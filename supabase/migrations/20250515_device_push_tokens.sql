-- Create extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the device push tokens table
CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type TEXT NOT NULL,
  app_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS device_push_tokens_user_id_idx ON public.device_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS device_push_tokens_token_idx ON public.device_push_tokens(token);

-- Add Row Level Security
ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow users to see and manage their own tokens
CREATE POLICY "Users can view their own tokens" 
  ON public.device_push_tokens 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens" 
  ON public.device_push_tokens 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens" 
  ON public.device_push_tokens 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens" 
  ON public.device_push_tokens 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_push_tokens TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.device_push_tokens_id_seq TO authenticated; 