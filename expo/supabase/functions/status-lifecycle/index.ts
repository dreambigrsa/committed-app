// @ts-nocheck
// Supabase Edge Function for Status Lifecycle Management
// Runs hourly via pg_cron to archive and delete expired statuses
// Deploy: supabase functions deploy status-lifecycle
// Note: This file runs in Deno runtime, not Node.js. TypeScript errors are expected when checked with Node.js types.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STATUS_LIFECYCLE_SECRET = Deno.env.get('STATUS_LIFECYCLE_SECRET') ?? null;

serve(async (req: Request) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    // Optional hardening: require secret header if configured.
    if (STATUS_LIFECYCLE_SECRET) {
      const provided = req.headers.get('x-status-lifecycle-secret');
      if (!provided || provided !== STATUS_LIFECYCLE_SECRET) {
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
      archived: number;
      deleted: number;
      errors: string[];
    } = {
      archived: 0,
      deleted: 0,
      errors: [],
    };

    // ============================================
    // STEP 1: ARCHIVE EXPIRED STATUSES (24 hours)
    // ============================================
    try {
      const { data: expiredStatuses, error: archiveError } = await supabaseAdmin
        .from('statuses')
        .select('id, media_path')
        .eq('archived', false)
        .lt('expires_at', new Date().toISOString());

      if (archiveError) {
        console.error('Error fetching expired statuses:', archiveError);
        results.errors.push(`Archive fetch error: ${archiveError.message}`);
      } else if (expiredStatuses && expiredStatuses.length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('statuses')
          .update({
            archived: true,
            archived_at: new Date().toISOString(),
          })
          .in('id', expiredStatuses.map((s: { id: string }) => s.id));

        if (updateError) {
          console.error('Error archiving statuses:', updateError);
          results.errors.push(`Archive update error: ${updateError.message}`);
        } else {
          results.archived = expiredStatuses.length;
          console.log(`Archived ${expiredStatuses.length} statuses`);
        }
      }
    } catch (error: any) {
      console.error('Exception during archiving:', error);
      results.errors.push(`Archive exception: ${error.message}`);
    }

    // ============================================
    // STEP 2: DELETE OLD STATUSES (48 hours from creation)
    // ============================================
    try {
      const fortyEightHoursAgo = new Date();
      fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

      const { data: oldStatuses, error: deleteFetchError } = await supabaseAdmin
        .from('statuses')
        .select('id, media_path, user_id')
        .lt('created_at', fortyEightHoursAgo.toISOString());

      if (deleteFetchError) {
        console.error('Error fetching old statuses:', deleteFetchError);
        results.errors.push(`Delete fetch error: ${deleteFetchError.message}`);
      } else if (oldStatuses && oldStatuses.length > 0) {
        // Delete media files from storage
        for (const status of oldStatuses) {
          if (status.media_path) {
            try {
              // Extract file path from media_path
              // media_path format: status-media/{user_id}/{status_id}/filename
              const pathParts = status.media_path.split('/');
              if (pathParts.length >= 3) {
                const filePath = pathParts.slice(1).join('/'); // Remove bucket name
                const { error: storageError } = await supabaseAdmin.storage
                  .from('status-media')
                  .remove([filePath]);

                if (storageError) {
                  console.error(`Error deleting media for status ${status.id}:`, storageError);
                  // Continue even if storage delete fails
                } else {
                  console.log(`Deleted media for status ${status.id}`);
                }
              }
            } catch (storageErr: any) {
              console.error(`Exception deleting media for status ${status.id}:`, storageErr);
              // Continue even if storage delete fails
            }
          }
        }

        // Delete status records
        const { error: deleteError } = await supabaseAdmin
          .from('statuses')
          .delete()
          .in('id', oldStatuses.map((s: { id: string }) => s.id));

        if (deleteError) {
          console.error('Error deleting statuses:', deleteError);
          results.errors.push(`Delete error: ${deleteError.message}`);
        } else {
          results.deleted = oldStatuses.length;
          console.log(`Deleted ${oldStatuses.length} old statuses`);
        }
      }
    } catch (error: any) {
      console.error('Exception during deletion:', error);
      results.errors.push(`Delete exception: ${error.message}`);
    }

    // ============================================
    // RETURN RESULTS
    // ============================================
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
    console.error('Fatal error in status-lifecycle function:', error);
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


