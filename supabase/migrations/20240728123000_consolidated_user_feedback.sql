-- Create extension if it doesn't exist (already in both, keep for idempotency)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure the user_feedback table exists (from both, keep for idempotency)
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Ensure FK constraint
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  extra_data JSONB -- Store additional feedback data like screenshots
);

-- Add index for performance (from both, keep for idempotency)
CREATE INDEX IF NOT EXISTS user_feedback_user_id_idx ON public.user_feedback(user_id);

-- Enable Row Level Security (from both, keep for idempotency)
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Drop old admin policy if it exists, to avoid conflicts
-- This is necessary because we are replacing it with a new, improved one.
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.user_feedback;

-- Create policies for secure access (from fixed_user_feedback.sql, as it's better)
-- Allow users to view their own feedback
CREATE POLICY "Users can view their own feedback" 
  ON public.user_feedback 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Allow users to insert their own feedback
CREATE POLICY "Users can insert their own feedback" 
  ON public.user_feedback 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own feedback
CREATE POLICY "Users can update their own feedback" 
  ON public.user_feedback 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- New Admin policy using JWT claims (from fixed_user_feedback.sql)
CREATE POLICY "Admins can view all feedback" 
  ON public.user_feedback 
  FOR SELECT 
  USING (
    -- If the user has the 'admin' role in their JWT claims
    auth.jwt()->>'role' = 'admin'
  );

-- Grant necessary permissions to authenticated users (from both, keep for idempotency)
GRANT SELECT, INSERT, UPDATE ON public.user_feedback TO authenticated; 