# Push Notification Edge Function

This Edge Function sends push notifications to user devices via the Expo Push Notification Service.

## Prerequisites

1. Supabase CLI installed
2. Supabase project set up with appropriate tables
3. Expo Push Notification service configured in your app

## Database Schema

Make sure you have a `device_push_tokens` table with the following schema:

```sql
CREATE TABLE device_push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type TEXT NOT NULL,
  app_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX device_push_tokens_user_id_idx ON device_push_tokens(user_id);
CREATE INDEX device_push_tokens_token_idx ON device_push_tokens(token);

-- Add Row Level Security
ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow users to see and manage their own tokens
CREATE POLICY "Users can view their own tokens" 
  ON device_push_tokens 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens" 
  ON device_push_tokens 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens" 
  ON device_push_tokens 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens" 
  ON device_push_tokens 
  FOR DELETE 
  USING (auth.uid() = user_id);
```

## Deployment

To deploy the Edge Function, run:

```bash
# Login to Supabase CLI
supabase login

# Link to your Supabase project (replace 'your-project-ref' with your project reference)
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy send-push-notification --no-verify-jwt
```

## Environment Variables

Make sure to set these environment variables in your Supabase project:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

You can set them using the Supabase CLI:

```bash
supabase secrets set SUPABASE_URL=https://your-project-ref.supabase.co
supabase secrets set SUPABASE_ANON_KEY=your-anon-key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Usage

From your client app, you can call this function using the Supabase client:

```typescript
// Example from your client app
const sendNotification = async (userId: string, title: string, body: string, data = {}) => {
  const { data: result, error } = await supabase.functions.invoke('send-push-notification', {
    body: {
      userId,
      notification: {
        title,
        body,
        data
      }
    }
  });

  if (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error };
  }

  return { success: true, result };
};
```

## Debugging

If you encounter issues, you can see the function logs using:

```bash
supabase functions logs send-push-notification --project-ref your-project-ref
``` 