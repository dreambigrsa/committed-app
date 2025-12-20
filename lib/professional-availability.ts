/**
 * Professional Availability Service
 * Handles automatic quiet hours enforcement and availability checks
 * Implements hybrid status system: combines user_status (automatic) with professional_status (preference)
 */

import { supabase } from './supabase';
import { UserStatusType } from '@/types';

export interface EffectiveProfessionalStatus {
  status: 'online' | 'busy' | 'away' | 'offline';
  isAutomatic: boolean; // true if using automatic calculation, false if manual override
  source: 'automatic' | 'manual_override' | 'admin_override';
}

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
  } catch (error: any) {
    console.error('Error checking quiet hours:', error?.message || error);
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
        professional_status(id, status, status_override)
      `)
      .not('quiet_hours_start', 'is', null)
      .not('quiet_hours_end', 'is', null)
      .eq('is_active', true);

    if (error) throw error;

    if (!profiles || profiles.length === 0) {
      return;
    }

    for (const profile of profiles) {
      // Handle array response from Supabase join
      const statusArray = Array.isArray(profile.professional_status) 
        ? profile.professional_status 
        : profile.professional_status
          ? [profile.professional_status]
          : [];
      
      const status = statusArray[0];
      if (!status || status.status_override) {
        // Skip if status is overridden by admin or doesn't exist
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
    console.error('Error enforcing quiet hours:', error?.message || error);
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
    // Get professional profile and status (include user_id for effective status calculation)
    const { data: profile, error: profileError } = await supabase
      .from('professional_profiles')
      .select(`
        *,
        user_id,
        professional_status(*)
      `)
      .eq('id', professionalId)
      .eq('is_active', true)
      .single();

    if (profileError || !profile) {
      return { canAccept: false, reason: 'Professional not found or inactive' };
    }

    // Handle array response from Supabase join
    const statusArray = Array.isArray(profile.professional_status) 
      ? profile.professional_status 
      : profile.professional_status
        ? [profile.professional_status]
        : [];
    
    const status = statusArray[0];
    if (!status) {
      return { canAccept: false, reason: 'Professional status not found' };
    }

    // Get effective status (hybrid approach: combines automatic user_status with manual preference)
    let effectiveStatus: 'online' | 'busy' | 'away' | 'offline' = status.status;
    try {
      if (profile.user_id) {
        const effective = await getEffectiveProfessionalStatus(
          profile.user_id,
          status.status as 'online' | 'busy' | 'away' | 'offline',
          status.status_override || false
        );
        effectiveStatus = effective.status;
      }
    } catch (error) {
      // Fallback to preference if calculation fails
      console.warn(`Error calculating effective status:`, error);
    }

    // Check if status is overridden (admin control)
    if (status.status_override) {
      // Admin has overridden status, check if it's online/busy (use effective status)
      if (effectiveStatus === 'online' || effectiveStatus === 'busy') {
        // Check session limits
        if (status.current_session_count >= profile.max_concurrent_sessions) {
          return { canAccept: false, reason: 'Maximum concurrent sessions reached' };
        }
        return { canAccept: true };
      }
      return { canAccept: false, reason: 'Professional is not available (admin override)' };
    }

    // Check if professional is offline (using effective status)
    if (effectiveStatus === 'offline') {
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
    console.error('Error checking professional availability:', error?.message || error);
    return { canAccept: false, reason: 'Error checking availability' };
  }
}

/**
 * Calculate effective professional status using hybrid approach
 * Combines automatic user_status tracking with manual professional_status preference
 * 
 * Rules:
 * - "busy" or "offline" preference → Always use that status (override)
 * - "away" preference → Use automatic, but default to away when inactive
 * - "online" preference → Use automatic calculation from user_status
 */
export async function getEffectiveProfessionalStatus(
  professionalUserId: string,
  professionalStatusPreference: 'online' | 'busy' | 'away' | 'offline',
  isAdminOverride: boolean = false
): Promise<EffectiveProfessionalStatus> {
  // If admin override, respect the preference
  if (isAdminOverride) {
    return {
      status: professionalStatusPreference,
      isAutomatic: false,
      source: 'admin_override',
    };
  }

  // If preference is "busy" or "offline", always use that (manual override)
  if (professionalStatusPreference === 'busy' || professionalStatusPreference === 'offline') {
    return {
      status: professionalStatusPreference,
      isAutomatic: false,
      source: 'manual_override',
    };
  }

  // For "online" or "away" preference, get automatic status from user_status
  try {
    const { data: userStatusData, error } = await supabase
      .from('user_status')
      .select('status_type, last_active_at')
      .eq('user_id', professionalUserId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading user status for professional:', error);
      // Fallback to preference if can't load user status
      return {
        status: professionalStatusPreference,
        isAutomatic: false,
        source: 'manual_override',
      };
    }

    if (!userStatusData) {
      // No user_status entry yet, use preference
      return {
        status: professionalStatusPreference,
        isAutomatic: false,
        source: 'manual_override',
      };
    }

    // Calculate status based on last_active_at (same logic as regular users)
    const now = new Date();
    const lastActive = new Date(userStatusData.last_active_at);
    const diffMs = now.getTime() - lastActive.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    let calculatedStatus: 'online' | 'away' | 'offline';
    
    // If status_type is manually set to 'busy', preserve it
    if (userStatusData.status_type === 'busy') {
      calculatedStatus = 'online'; // Default to online if busy (they're active)
    } else if (diffMins <= 5) {
      calculatedStatus = 'online';
    } else if (diffMins <= 15) {
      calculatedStatus = 'away';
    } else {
      calculatedStatus = 'offline';
    }

    // If preference is "away", use calculated but default to away when offline
    if (professionalStatusPreference === 'away') {
      return {
        status: calculatedStatus === 'offline' ? 'away' : calculatedStatus,
        isAutomatic: true,
        source: 'automatic',
      };
    }

    // If preference is "online", use calculated status
    return {
      status: calculatedStatus,
      isAutomatic: true,
      source: 'automatic',
    };
  } catch (error: any) {
    console.error('Error calculating effective professional status:', error?.message || error);
    // Fallback to preference on error
    return {
      status: professionalStatusPreference,
      isAutomatic: false,
      source: 'manual_override',
    };
  }
}

