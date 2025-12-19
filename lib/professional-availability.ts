/**
 * Professional Availability Service
 * Handles automatic quiet hours enforcement and availability checks
 */

import { supabase } from './supabase';

/**
 * Check if a professional is currently in quiet hours
 */
export function isInQuietHours(
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
    const currentTimeStr = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    });

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

/**
 * Check and enforce quiet hours for all professionals
 * This should be called periodically (e.g., via cron job)
 */
export async function enforceQuietHoursForAllProfessionals(): Promise<void> {
  try {
    // Get all professionals with quiet hours enabled
    const { data: profiles, error } = await supabase
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

    if (error) throw error;

    if (!profiles || profiles.length === 0) {
      return;
    }

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
        await supabase
          .from('professional_status')
          .update({
            status: 'busy',
            updated_at: new Date().toISOString(),
          })
          .eq('id', status.id);
      }
      // If not in quiet hours and status is busy (from quiet hours), restore to previous status
      // Note: We don't have a "previous_status" field, so we can't restore automatically
      // Professionals will need to manually set their status back to online
    }
  } catch (error: any) {
    console.error('Error enforcing quiet hours:', error);
  }
}

/**
 * Check if a professional can accept new sessions
 * Takes into account: current status, session count, quiet hours, availability toggles
 */
export async function canProfessionalAcceptSession(
  professionalId: string
): Promise<{ canAccept: boolean; reason?: string }> {
  try {
    // Get professional profile and status
    const { data: profile, error: profileError } = await supabase
      .from('professional_profiles')
      .select(`
        *,
        professional_status!inner(*)
      `)
      .eq('id', professionalId)
      .eq('is_active', true)
      .single();

    if (profileError || !profile) {
      return { canAccept: false, reason: 'Professional not found or inactive' };
    }

    const status = profile.professional_status;
    if (!status) {
      return { canAccept: false, reason: 'Professional status not found' };
    }

    // Check if status is overridden (admin control)
    if (status.status_override) {
      // Admin has overridden status, check if it's online/busy
      if (status.status === 'online' || status.status === 'busy') {
        // Check session limits
        if (status.current_session_count >= profile.max_concurrent_sessions) {
          return { canAccept: false, reason: 'Maximum concurrent sessions reached' };
        }
        return { canAccept: true };
      }
      return { canAccept: false, reason: 'Professional is not available (admin override)' };
    }

    // Check if professional is offline
    if (status.status === 'offline') {
      return { canAccept: false, reason: 'Professional is offline' };
    }

    // Check quiet hours
    if (profile.quiet_hours_start && profile.quiet_hours_end) {
      const inQuietHours = isInQuietHours(
        profile.quiet_hours_start,
        profile.quiet_hours_end,
        profile.quiet_hours_timezone || 'UTC'
      );

      if (inQuietHours) {
        return { canAccept: false, reason: 'Professional is in quiet hours' };
      }
    }

    // Check session count
    if (status.current_session_count >= profile.max_concurrent_sessions) {
      return { canAccept: false, reason: 'Maximum concurrent sessions reached' };
    }

    // Check availability toggles
    if (!profile.online_availability) {
      return { canAccept: false, reason: 'Professional has disabled online availability' };
    }

    // All checks passed
    return { canAccept: true };
  } catch (error: any) {
    console.error('Error checking professional availability:', error);
    return { canAccept: false, reason: 'Error checking availability' };
  }
}

