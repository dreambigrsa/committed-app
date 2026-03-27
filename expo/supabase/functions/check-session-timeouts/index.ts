// @ts-nocheck
// Supabase Edge Function for Professional Session Timeout Checking
// Runs periodically via pg_cron to check for pending sessions that have timed out
// Deploy: supabase functions deploy check-session-timeouts
// Note: This file runs in Deno runtime, not Node.js. TypeScript errors are expected when checked with Node.js types.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SESSION_TIMEOUT_SECRET = Deno.env.get('SESSION_TIMEOUT_SECRET') ?? null;

serve(async (req: Request) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-timeout-secret',
        },
      });
    }

    // Optional hardening: require secret header if configured.
    if (SESSION_TIMEOUT_SECRET) {
      const provided = req.headers.get('x-session-timeout-secret');
      if (!provided || provided !== SESSION_TIMEOUT_SECRET) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // Create admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const results: {
      sessions_checked: number;
      sessions_escalated: number;
      sessions_notified: number;
      errors: string[];
    } = {
      sessions_checked: 0,
      sessions_escalated: 0,
      sessions_notified: 0,
      errors: [],
    };

    // Call the database function to check for timeouts
    try {
      const { data, error } = await supabaseAdmin.rpc('check_pending_session_timeouts');

      if (error) {
        console.error('Error calling check_pending_session_timeouts:', error);
        results.errors.push(`Database function error: ${error.message}`);
      } else if (data && data.length > 0) {
        // The function returns a table with stats
        const stats = data[0];
        results.sessions_checked = stats.sessions_checked || 0;
        results.sessions_escalated = stats.sessions_escalated || 0;
        results.sessions_notified = stats.sessions_notified || 0;
        console.log(`Checked ${results.sessions_checked} sessions, escalated ${results.sessions_escalated}`);
      }
    } catch (error: any) {
      console.error('Exception calling database function:', error);
      results.errors.push(`Exception: ${error.message}`);
    }

    // Additionally, we can manually check and escalate if the database function doesn't handle it
    // This is a fallback in case the database function isn't fully implemented
    try {
      const { data: pendingSessions, error: fetchError } = await supabaseAdmin
        .from('professional_sessions')
        .select('id, created_at, role_id, escalation_level, conversation_id, user_id')
        .eq('status', 'pending_acceptance')
        .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // 5 minutes ago
        .limit(50);

      if (fetchError) {
        console.error('Error fetching pending sessions:', fetchError);
        results.errors.push(`Fetch error: ${fetchError.message}`);
      } else if (pendingSessions && pendingSessions.length > 0) {
        console.log(`Found ${pendingSessions.length} pending sessions to check`);

        // For each session, we'd normally call the escalation service
        // But since this is an Edge Function, we'll just log them
        // The actual escalation logic should be in the database function or called via another service
        for (const session of pendingSessions) {
          // Update session with timeout reason for tracking
          const { error: updateError } = await supabaseAdmin
            .from('professional_sessions')
            .update({
              escalation_reason: 'Timeout: Professional did not respond within 5 minutes',
              updated_at: new Date().toISOString(),
            })
            .eq('id', session.id);

          if (updateError) {
            console.error(`Error updating session ${session.id}:`, updateError);
            results.errors.push(`Update error for session ${session.id}: ${updateError.message}`);
          } else {
            results.sessions_notified++;
          }
        }
      }
    } catch (error: any) {
      console.error('Exception during manual timeout check:', error);
      results.errors.push(`Manual check exception: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('Unexpected error in check-session-timeouts:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

