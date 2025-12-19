/**
 * Professional Matching Service
 * Handles matching users with appropriate professionals based on AI analysis and admin-defined rules
 */

import { supabase } from './supabase';
import { ProfessionalProfile, ProfessionalRole, ProfessionalStatus } from '@/types';

export interface MatchingCriteria {
  roleId?: string;
  location?: string;
  minRating?: number;
  requiresOnlineOnly?: boolean;
  maxDistance?: number; // in kilometers
  excludeProfessionalId?: string; // Exclude a specific professional (for escalations)
}

export interface ProfessionalMatch {
  profile: ProfessionalProfile;
  role: ProfessionalRole;
  status: ProfessionalStatus;
  matchScore: number;
  matchReasons: string[];
}

/**
 * Find matching professionals based on criteria
 */
export async function findMatchingProfessionals(
  criteria: MatchingCriteria,
  limit: number = 5
): Promise<ProfessionalMatch[]> {
  // Import quiet hours check function once at the start
  const { isInQuietHours } = await import('./professional-availability');
  
  try {
    let query = supabase
      .from('professional_profiles')
      .select(`
        *,
        role:professional_roles(*),
        status:professional_status(*)
      `)
      .eq('approval_status', 'approved')
      .eq('is_active', true);

    // Filter by role if specified
    if (criteria.roleId) {
      query = query.eq('role_id', criteria.roleId);
    }

    // Exclude a specific professional if specified
    if (criteria.excludeProfessionalId) {
      query = query.neq('id', criteria.excludeProfessionalId);
    }

    // Filter by minimum rating
    if (criteria.minRating) {
      query = query.gte('rating_average', criteria.minRating);
    }

    // Filter by online availability if required
    if (criteria.requiresOnlineOnly) {
      query = query.eq('online_availability', true);
    }

    const { data: profiles, error } = await query;

    if (error) throw error;
    if (!profiles || profiles.length === 0) return [];

    // Get professional statuses for filtering
    const professionalIds = profiles.map((p: any) => p.id);
    const { data: statuses } = await supabase
      .from('professional_status')
      .select('*')
      .in('professional_id', professionalIds);

    const statusMap = new Map(
      (statuses || []).map((s: any) => [s.professional_id, s])
    );

    // Filter and score professionals
    const matches: ProfessionalMatch[] = [];

    for (const profile of profiles) {
      // Check if status is in the profile join result
      let statusData = statusMap.get(profile.id);
      
      // If status is in profile join result, use that instead
      if (!statusData && profile.status) {
        const statusFromJoin = Array.isArray(profile.status) ? profile.status[0] : profile.status;
        if (statusFromJoin) {
          statusData = statusFromJoin;
        }
      }
      
      // Default to offline status if not found (status should exist due to trigger, but handle gracefully)
      const status = statusData || {
        professional_id: profile.id,
        status: 'offline',
        current_session_count: 0,
        last_seen_at: new Date().toISOString(),
      };

      // Skip offline professionals if online only is strictly required
      if (criteria.requiresOnlineOnly && status.status !== 'online' && status.status !== 'busy') {
        continue;
      }

      // Check quiet hours
      if (profile.quiet_hours_start && profile.quiet_hours_end) {
        const inQuietHours = isInQuietHours(
          profile.quiet_hours_start,
          profile.quiet_hours_end,
          profile.quiet_hours_timezone || 'UTC'
        );
        
        // Skip professionals in quiet hours if online only is required
        if (inQuietHours && criteria.requiresOnlineOnly) {
          continue;
        }
      }

      // Skip professionals at capacity
      if (
        status.current_session_count >= (profile.max_concurrent_sessions || 3)
      ) {
        continue;
      }

      // Skip if online availability is disabled
      if (!profile.online_availability && criteria.requiresOnlineOnly) {
        continue;
      }

      // Ensure role exists
      if (!profile.role) {
        console.warn(`Professional ${profile.id} has no role data, skipping`);
        continue;
      }

      // Calculate match score
      const matchScore = calculateMatchScore(profile, status, criteria);
      // Include professionals even with low scores, as long as they're approved and active
      if (matchScore >= 0) {
        try {
          const mappedRole = mapRole(profile.role);
          const mappedStatus = mapStatus(status);
          const mappedProfile = mapProfile(profile);
          
          matches.push({
            profile: mappedProfile,
            role: mappedRole,
            status: mappedStatus,
            matchScore,
            matchReasons: getMatchReasons(profile, status, criteria),
          });
        } catch (mapError) {
          console.error(`Error mapping professional ${profile.id}:`, mapError);
          // Skip this professional if mapping fails
        }
      }
    }

    // Sort by match score (highest first) and return top matches
    return matches
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  } catch (error: any) {
    console.error('Error finding matching professionals:', error);
    return [];
  }
}

/**
 * Calculate match score for a professional
 */
function calculateMatchScore(
  profile: any,
  status: any,
  criteria: MatchingCriteria
): number {
  let score = 0;

  // Base score for being online and available
  if (status.status === 'online') {
    score += 50;
  } else if (status.status === 'busy') {
    score += 20;
  }

  // Rating bonus (0-5 scale, normalized to 0-30 points)
  const rating = profile.rating_average ? (typeof profile.rating_average === 'number' ? profile.rating_average : parseFloat(profile.rating_average) || 0) : 0;
  score += rating * 6;

  // Availability bonus (online availability)
  if (profile.online_availability) {
    score += 10;
  }

  // Session capacity bonus (more available sessions = higher score)
  const maxSessions = profile.max_concurrent_sessions || 3;
  const currentSessions = status.current_session_count || 0;
  const availableCapacity = maxSessions - currentSessions;
  score += availableCapacity * 5;

  // Location match (if location criteria provided)
  if (criteria.location && profile.location) {
    if (profile.location.toLowerCase().includes(criteria.location.toLowerCase())) {
      score += 15;
    }
  }

  // Review count bonus (more reviews = more trusted, up to 10 points)
  const reviewBonus = Math.min(profile.review_count || 0, 50) / 5;
  score += reviewBonus;

  return score;
}

/**
 * Get human-readable match reasons
 */
function getMatchReasons(
  profile: any,
  status: any,
  criteria: MatchingCriteria
): string[] {
  const reasons: string[] = [];

  if (status.status === 'online') {
    reasons.push('Currently online');
  }

  const rating = profile.rating_average ? (typeof profile.rating_average === 'number' ? profile.rating_average : parseFloat(profile.rating_average) || 0) : 0;
  if (rating >= 4.5) {
    reasons.push('Highly rated');
  }

  const maxSessions = profile.max_concurrent_sessions || 3;
  const currentSessions = status.current_session_count || 0;
  if (currentSessions < maxSessions) {
    reasons.push('Available now');
  }

  if (profile.review_count && profile.review_count > 20) {
    reasons.push('Experienced professional');
  }

  if (criteria.location && profile.location) {
    if (profile.location.toLowerCase().includes(criteria.location.toLowerCase())) {
      reasons.push('Local availability');
    }
  }

  return reasons;
}

/**
 * Get best matching professional for a role
 */
export async function getBestMatchForRole(
  roleId: string,
  userLocation?: string
): Promise<ProfessionalMatch | null> {
  const matches = await findMatchingProfessionals(
    {
      roleId,
      location: userLocation,
      requiresOnlineOnly: true,
      minRating: 0,
    },
    1
  );

  return matches.length > 0 ? matches[0] : null;
}

/**
 * Check if a professional can accept a new session
 */
/**
 * Check if a professional can accept a new session
 * Uses the enhanced availability check from professional-availability.ts
 */
export async function canProfessionalAcceptSession(
  professionalId: string
): Promise<boolean> {
  // Use the enhanced availability check from professional-availability.ts
  const { canProfessionalAcceptSession: checkAvailability } = await import('./professional-availability');
  const result = await checkAvailability(professionalId);
  return result.canAccept;
}

/**
 * Map database profile to TypeScript type
 */
function mapProfile(profile: any): ProfessionalProfile {
  return {
    id: profile.id,
    userId: profile.user_id,
    roleId: profile.role_id,
    fullName: profile.full_name,
    bio: profile.bio,
    credentials: profile.credentials || [],
    credentialDocuments: profile.credential_documents || [],
    location: profile.location,
    locationCoordinates: profile.location_coordinates,
    onlineAvailability: profile.online_availability,
    inPersonAvailability: profile.in_person_availability,
    serviceAreas: profile.service_areas || [],
    pricingInfo: profile.pricing_info,
    languages: profile.languages || ['en'],
    ratingAverage: profile.rating_average ? (typeof profile.rating_average === 'number' ? profile.rating_average : parseFloat(profile.rating_average) || 0) : 0,
    ratingCount: profile.rating_count || 0,
    reviewCount: profile.review_count || 0,
    approvalStatus: profile.approval_status,
    rejectionReason: profile.rejection_reason,
    approvedBy: profile.approved_by,
    approvedAt: profile.approved_at,
    publicProfileUrl: profile.public_profile_url,
    maxConcurrentSessions: profile.max_concurrent_sessions || 3,
    quietHoursStart: profile.quiet_hours_start,
    quietHoursEnd: profile.quiet_hours_end,
    quietHoursTimezone: profile.quiet_hours_timezone || 'UTC',
    isActive: profile.is_active,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

/**
 * Map database role to TypeScript type
 */
function mapRole(role: any): ProfessionalRole {
  if (!role) {
    throw new Error('Role data is required');
  }
  
  // Handle array case (from join)
  const roleData = Array.isArray(role) ? role[0] : role;
  
  if (!roleData) {
    throw new Error('Invalid role data');
  }
  
  return {
    id: roleData.id,
    name: roleData.name || 'Unknown',
    category: roleData.category || 'general',
    description: roleData.description || '',
    requiresCredentials: roleData.requires_credentials || false,
    requiresVerification: roleData.requires_verification || false,
    eligibleForLiveChat: roleData.eligible_for_live_chat ?? true,
    approvalRequired: roleData.approval_required || false,
    disclaimerText: roleData.disclaimer_text || null,
    aiMatchingRules: roleData.ai_matching_rules || {},
    isActive: roleData.is_active ?? true,
    displayOrder: roleData.display_order || 0,
    createdAt: roleData.created_at || new Date().toISOString(),
    updatedAt: roleData.updated_at || new Date().toISOString(),
  };
}

/**
 * Map database status to TypeScript type
 */
function mapStatus(status: any): ProfessionalStatus {
  if (!status) {
    // Return default status if not provided
    return {
      id: '',
      professionalId: '',
      status: 'offline',
      currentSessionCount: 0,
      lastSeenAt: new Date().toISOString(),
      statusOverride: false,
      statusOverrideBy: undefined,
      statusOverrideUntil: undefined,
      updatedAt: new Date().toISOString(),
    };
  }
  
  // Handle array case (from join)
  const statusData = Array.isArray(status) ? status[0] : status;
  
  return {
    id: statusData.id || '',
    professionalId: statusData.professional_id || '',
    status: (statusData.status || 'offline') as any,
    currentSessionCount: statusData.current_session_count || 0,
    lastSeenAt: statusData.last_seen_at || new Date().toISOString(),
    statusOverride: statusData.status_override || false,
    statusOverrideBy: statusData.status_override_by || undefined,
    statusOverrideUntil: statusData.status_override_until || undefined,
    updatedAt: statusData.updated_at || new Date().toISOString(),
  };
}


