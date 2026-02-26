-- Create extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create assignment_answers table
CREATE TABLE IF NOT EXISTS public.assignment_answers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    questions JSONB NOT NULL,
    length TEXT NOT NULL,
    style TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS assignment_answers_user_id_idx ON public.assignment_answers(user_id);
CREATE INDEX IF NOT EXISTS assignment_answers_created_at_idx ON public.assignment_answers(created_at);

-- Enable Row Level Security
ALTER TABLE public.assignment_answers ENABLE ROW LEVEL SECURITY;

-- Create policies for secure access
-- Allow users to view their own answers
CREATE POLICY "Users can view their own answers"
    ON public.assignment_answers
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to insert their own answers
CREATE POLICY "Users can insert their own answers"
    ON public.assignment_answers
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own answers
CREATE POLICY "Users can update their own answers"
    ON public.assignment_answers
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own answers
CREATE POLICY "Users can delete their own answers"
    ON public.assignment_answers
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_assignment_answers_updated_at
    BEFORE UPDATE ON public.assignment_answers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_answers TO authenticated; 