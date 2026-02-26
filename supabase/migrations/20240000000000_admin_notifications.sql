-- Create admin_notifications table
CREATE TABLE admin_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sent_by UUID NOT NULL REFERENCES auth.users(id),
    notification JSONB NOT NULL,
    filters JSONB,
    users_targeted TEXT[] NOT NULL,
    tokens_count INTEGER NOT NULL,
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX admin_notifications_sent_by_idx ON admin_notifications(sent_by);
CREATE INDEX admin_notifications_created_at_idx ON admin_notifications(created_at);

-- Add RLS policies
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can view notifications
CREATE POLICY "Admins can view notifications" 
    ON admin_notifications 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Only admins can insert notifications
CREATE POLICY "Admins can insert notifications" 
    ON admin_notifications 
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Create user_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for user_sessions
CREATE INDEX user_sessions_user_id_idx ON user_sessions(user_id);
CREATE INDEX user_sessions_last_active_idx ON user_sessions(last_active);

-- Add RLS policies for user_sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions" 
    ON user_sessions 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update their own sessions" 
    ON user_sessions 
    FOR UPDATE 
    USING (auth.uid() = user_id);

-- Create function to update last_active
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_sessions (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) 
    DO UPDATE SET last_active = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update last_active on user login
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
    AFTER INSERT OR UPDATE
    ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION update_last_active(); 