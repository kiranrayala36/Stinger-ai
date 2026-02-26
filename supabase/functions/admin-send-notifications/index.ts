// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.32.0';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

interface AdminPushRequest {
  notification: {
    title: string;
    body: string;
    data?: Record<string, any>;
  };
  filter?: {
    userIds?: string[];
    roles?: string[];
    lastActive?: string; // ISO date string
  };
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

    // Create Supabase clients
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Parse request body
    const { notification, filter = {} } = await req.json() as AdminPushRequest;

    // Validate request
    if (!notification?.title || !notification?.body) {
      return new Response(
        JSON.stringify({ error: 'Missing required notification fields' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Verify admin role
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (!roles?.some(r => r.role === 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin role required' }),
        { 
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Build query for device tokens
    let query = supabaseAdmin
      .from('device_push_tokens')
      .select('token, user_id');

    // Apply filters
    if (filter.userIds?.length) {
      query = query.in('user_id', filter.userIds);
    }

    if (filter.roles?.length) {
      const userIdsWithRoles = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .in('role', filter.roles);
      
      if (userIdsWithRoles.data?.length) {
        const userIds = userIdsWithRoles.data.map(ur => ur.user_id);
        query = query.in('user_id', userIds);
      }
    }

    if (filter.lastActive) {
      const { data: activeUsers } = await supabaseAdmin
        .from('user_sessions')
        .select('user_id')
        .gte('last_active', filter.lastActive);
      
      if (activeUsers?.length) {
        const userIds = activeUsers.map(u => u.user_id);
        query = query.in('user_id', userIds);
      }
    }

    // Get tokens
    const { data: tokens, error: tokensError } = await query;

    if (tokensError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch device tokens', details: tokensError.message }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No matching devices found' }),
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Group tokens by user for tracking
    const userTokens = tokens.reduce((acc, { token, user_id }) => {
      if (!acc[user_id]) acc[user_id] = [];
      acc[user_id].push(token);
      return acc;
    }, {});

    // Prepare messages for Expo Push API
    const messages = tokens.map(({ token }) => ({
      to: token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: {
        ...notification.data,
        type: 'admin_notification',
      },
    }));

    // Send to Expo Push API
    const pushResponse = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const pushResult = await pushResponse.json();

    // Log notification for tracking
    await supabaseAdmin
      .from('admin_notifications')
      .insert({
        sent_by: user.id,
        notification: notification,
        filters: filter,
        users_targeted: Object.keys(userTokens),
        tokens_count: tokens.length,
        result: pushResult,
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        users: Object.keys(userTokens).length,
        tokens: tokens.length,
        result: pushResult 
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}); 