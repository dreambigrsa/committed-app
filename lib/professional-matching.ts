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
      // Default to offline status if not found (status should exist due to trigger, but handle gracefully)
      const status = statusMap.get(profile.id) || {
        professional_id: profile.id,
        status: 'offline',
        current_session_count: 0,
        last_seen_at: new Date().toISOString(),
      };

      // Skip offline professionals if online only is strictly required
      if (criteria.requiresOnlineOnly && status.status !== 'online') {
        continue;
      }

      // Skip busy professionals at capacity (only if online)
      if (
        status.status === 'online' &&
        status.current_session_count >= (profile.max_concurrent_sessions || 3)
      ) {
        continue;
      }

      // Calculate match score
      const matchScore = calculateMatchScore(profile, status, criteria);
      if (matchScore > 0) {
        matches.push({
          profile: mapProfile(profile),
          role: mapRole(profile.role),
          status: mapStatus(status),
          matchScore,
          matchReasons: getMatchReasons(profile, status, criteria),
        });
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
  score += (profile.rating_average || 0) * 6;

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

  if (profile.rating_average && profile.rating_average >= 4.5) {
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
export async function canProfessionalAcceptSession(
  professionalId: string
): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from('professional_profiles')
      .select('max_concurrent_sessions')
      .eq('id', professionalId)
      .single();

    const { data: status } = await supabase
      .from('professional_status')
      .select('status, current_session_count')
      .eq('professional_id', professionalId)
      .single();

    if (!profile || !status) return false;
    if (status.status !== 'online' && status.status !== 'busy') return false;

    const maxSessions = profile.max_concurrent_sessions || 3;
    return status.current_session_count < maxSessions;
  } catch (error) {
    console.error('Error checking professional availability:', error);
    return false;
  }
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
    ratingAverage: parseFloat(profile.rating_average) || 0,
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
  return {
    id: role.id,
    name: role.name,
    category: role.category,
    description: role.description,
    requiresCredentials: role.requires_credentials,
    requiresVerification: role.requires_verification,
    eligibleForLiveChat: role.eligible_for_live_chat,
    approvalRequired: role.approval_required,
    disclaimerText: role.disclaimer_text,
    aiMatchingRules: role.ai_matching_rules || {},
    isActive: role.is_active,
    displayOrder: role.display_order,
    createdAt: role.created_at,
    updatedAt: role.updated_at,
  };
}

/**
 * Map database status to TypeScript type
 */
function mapStatus(status: any): ProfessionalStatus {
  return {
    id: status.id,
    professionalId: status.professional_id,
    status: status.status as any,
    currentSessionCount: status.current_session_count || 0,
    lastSeenAt: status.last_seen_at,
    statusOverride: status.status_override || false,
    statusOverrideBy: status.status_override_by,
    statusOverrideUntil: status.status_override_until,
    updatedAt: status.updated_at,
  };
}

