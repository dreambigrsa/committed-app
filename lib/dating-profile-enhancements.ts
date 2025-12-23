// ============================================
// DATING PROFILE ENHANCEMENTS
// ============================================
// Additional functions for enhanced profile features

import { supabase } from '@/lib/supabase';
import { getDatingProfile } from './dating-service';

export async function getDailyQuestion() {
  const { data } = await supabase
    .from('daily_questions')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .limit(1)
    .single();

  return data;
}

export async function getUserBadges(userId: string) {
  const { data } = await supabase
    .from('user_dating_badges')
    .select('*')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });

  return data || [];
}

export async function calculateCompatibility(userId1: string, userId2: string): Promise<number> {
  // Check cache first
  const orderedIds = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
  const { data: cached } = await supabase
    .from('dating_compatibility_scores')
    .select('compatibility_score')
    .eq('user1_id', orderedIds[0])
    .eq('user2_id', orderedIds[1])
    .single();

  if (cached && cached.compatibility_score !== null) {
    return cached.compatibility_score;
  }

  // Get both profiles
  const [profile1Result, profile2Result] = await Promise.all([
    supabase.from('dating_profiles').select('*').eq('user_id', userId1).single(),
    supabase.from('dating_profiles').select('*').eq('user_id', userId2).single(),
  ]);

  if (!profile1Result.data || !profile2Result.data) return 0;

  const profile1 = profile1Result.data;
  const profile2 = profile2Result.data;

  let score = 0;
  let factors = 0;

  // Compare interests (40% weight)
  if (profile1.interests && profile2.interests && Array.isArray(profile1.interests) && Array.isArray(profile2.interests)) {
    const commonInterests = profile1.interests.filter((i: string) => 
      profile2.interests.includes(i)
    ).length;
    const totalInterests = new Set([...profile1.interests, ...profile2.interests]).size;
    if (totalInterests > 0) {
      score += (commonInterests / totalInterests) * 40;
    }
    factors += 40;
  }

  // Compare values (30% weight)
  if (profile1.values && profile2.values && Array.isArray(profile1.values) && Array.isArray(profile2.values)) {
    const commonValues = profile1.values.filter((v: string) => 
      profile2.values.includes(v)
    ).length;
    const totalValues = new Set([...profile1.values, ...profile2.values]).size;
    if (totalValues > 0) {
      score += (commonValues / totalValues) * 30;
    }
    factors += 30;
  }

  // Compare relationship goals (20% weight)
  if (profile1.relationship_goals && profile2.relationship_goals && Array.isArray(profile1.relationship_goals) && Array.isArray(profile2.relationship_goals)) {
    const commonGoals = profile1.relationship_goals.filter((g: string) => 
      profile2.relationship_goals.includes(g)
    ).length;
    if (commonGoals > 0) {
      score += 20;
    }
    factors += 20;
  }

  // Compare mood and weekend style (10% weight)
  if (profile1.mood === profile2.mood) score += 5;
  if (profile1.weekend_style === profile2.weekend_style) score += 5;
  factors += 10;

  const finalScore = factors > 0 ? Math.round((score / factors) * 100) : 0;

  // Cache the result
  await supabase.from('dating_compatibility_scores').upsert({
    user1_id: orderedIds[0],
    user2_id: orderedIds[1],
    compatibility_score: finalScore,
    calculated_at: new Date().toISOString(),
  }, {
    onConflict: 'user1_id,user2_id',
  });

  return finalScore;
}

export async function getConversationStarters(userId: string): Promise<string[]> {
  const profile = await getDatingProfile(userId);
  if (!profile) return [];

  const starters: string[] = [];

  // Priority 1: Use prompts if available (most engaging)
  if (profile.prompts && Array.isArray(profile.prompts) && profile.prompts.length > 0) {
    // Use the question from their prompts as conversation starters
    profile.prompts.slice(0, 2).forEach((prompt: any) => {
      if (prompt?.question) {
        starters.push(prompt.question);
      }
    });
  }

  // Priority 2: What makes them different (interesting personal touch)
  if (profile.what_makes_me_different && starters.length < 3) {
    starters.push(`What makes you different?`);
  }

  // Priority 3: Headline (if it's interesting)
  if (profile.headline && starters.length < 3) {
    // Extract a key phrase from headline, or use it directly if short
    const headlineText = profile.headline.length > 40 
      ? `Tell me more about "${profile.headline.substring(0, 40)}..."` 
      : `Tell me more about your headline`;
    starters.push(headlineText);
  }

  // Priority 4: Local spot (great conversation starter about their city)
  if (profile.local_spot && starters.length < 3) {
    starters.push(`What's your favorite spot in ${profile.location_city || 'your city'}?`);
  }

  // Priority 5: Local food (cultural connection)
  if (profile.local_food && starters.length < 3) {
    starters.push(`Tell me about ${profile.local_food}`);
  }

  // Priority 6: Weekend style (lifestyle question)
  if (profile.weekend_style && starters.length < 3) {
    starters.push(`How do you spend your weekends?`);
  }

  // Priority 7: Local slang (fun and engaging)
  if (profile.local_slang && starters.length < 3) {
    starters.push(`Teach me some local slang!`);
  }

  // Priority 8: Interests (fallback, but make it more engaging)
  if (profile.interests && Array.isArray(profile.interests) && profile.interests.length > 0 && starters.length < 3) {
    starters.push(`What do you love about ${profile.interests[0]}?`);
  }

  // Priority 9: Values (fallback)
  if (profile.values && Array.isArray(profile.values) && profile.values.length > 0 && starters.length < 3) {
    starters.push(`Tell me about ${profile.values[0]}`);
  }

  return starters.slice(0, 3); // Return max 3 starters
}

