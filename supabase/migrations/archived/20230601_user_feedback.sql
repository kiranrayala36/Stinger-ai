-- Create extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the user_feedback table for beta testing feedback
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  extra_data JSONB -- Store additional feedback data like screenshots
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS user_feedback_user_id_idx ON public.user_feedback(user_id);

-- Enable Row Level Security
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for secure access
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

-- Admin users can view all feedback (assuming you have admin users with specific IDs or roles)
CREATE POLICY "Admins can view all feedback" 
  ON public.user_feedback 
  FOR SELECT 
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_feedback TO authenticated; 