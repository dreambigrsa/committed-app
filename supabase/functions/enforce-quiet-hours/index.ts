/**
 * Enforce Quiet Hours for Professionals
 * Edge function to automatically set professional status to "busy" during quiet hours
 * Should be called periodically via cron job (e.g., every 15 minutes)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get all professionals with quiet hours enabled
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('professional_profiles')
      .select(`
        id,
        quiet_hours_start,
        quiet_hours_end,
        quiet_hours_timezone,
        professional_status!inner(id, status, status_override)
      `)
      .not('quiet_hours_start', 'is', null)
      .not('quiet_hours_end', 'is', null)
      .eq('is_active', true);

    if (profilesError) {
      throw profilesError;
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No professionals with quiet hours configured', updated: 0 }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    let updatedCount = 0;

    for (const profile of profiles) {
      const status = profile.professional_status;
      if (!status || status.status_override) {
        // Skip if status is overridden by admin
        continue;
      }

      const inQuietHours = isInQuietHours(
        profile.quiet_hours_start,
        profile.quiet_hours_end,
        profile.quiet_hours_timezone || 'UTC'
      );

      // If in quiet hours and status is not already busy or offline, set to busy
      if (inQuietHours && status.status !== 'busy' && status.status !== 'offline') {
        const { error: updateError } = await supabaseClient
          .from('professional_status')
          .update({
            status: 'busy',
            updated_at: new Date().toISOString(),
          })
          .eq('id', status.id);

        if (!updateError) {
          updatedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Quiet hours enforcement completed',
        updated: updatedCount,
        total: profiles.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error enforcing quiet hours:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Check if a professional is currently in quiet hours
 */
function isInQuietHours(
  quietHoursStart: string | null,
  quietHoursEnd: string | null,
  timezone: string = 'UTC'
): boolean {
  if (!quietHoursStart || !quietHoursEnd) {
    return false;
  }

  try {
    // Get current time in the professional's timezone
    const now = new Date();
    
    // Format time in the specified timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    });
    
    const currentTimeStr = formatter.format(now);

    // Parse start and end times (HH:mm format)
    const [startHour, startMinute] = quietHoursStart.split(':').map(Number);
    const [endHour, endMinute] = quietHoursEnd.split(':').map(Number);
    const [currentHour, currentMinute] = currentTimeStr.split(':').map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    const currentMinutes = currentHour * 60 + currentMinute;

    // Handle quiet hours that span midnight (e.g., 22:00 to 08:00)
    if (endMinutes < startMinutes) {
      // Quiet hours span midnight
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      // Quiet hours within the same day
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
  } catch (error) {
    console.error('Error checking quiet hours:', error);
    return false;
  }
}

