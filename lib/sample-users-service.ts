/**
 * Sample Users Service
 * Functions to create and delete sample users for testing
 */

import { supabase } from './supabase';

// Sample users data
export const SAMPLE_USERS = [
  // Kwekwe Users
  { fullName: 'Sarah Moyo', email: 'sarah.moyo@sample.com', phone: '+263771234501', city: 'Kwekwe', country: 'Zimbabwe', age: 28 },
  { fullName: 'Tendai Ndlovu', email: 'tendai.ndlovu@sample.com', phone: '+263771234502', city: 'Kwekwe', country: 'Zimbabwe', age: 32 },
  { fullName: 'Blessing Sibanda', email: 'blessing.sibanda@sample.com', phone: '+263771234503', city: 'Kwekwe', country: 'Zimbabwe', age: 26 },
  { fullName: 'Grace Chidziva', email: 'grace.chidziva@sample.com', phone: '+263771234504', city: 'Kwekwe', country: 'Zimbabwe', age: 29 },
  { fullName: 'John Maphosa', email: 'john.maphosa@sample.com', phone: '+263771234505', city: 'Kwekwe', country: 'Zimbabwe', age: 31 },
  // Harare Users
  { fullName: 'Linda Chiwenga', email: 'linda.chiwenga@sample.com', phone: '+263771234506', city: 'Harare', country: 'Zimbabwe', age: 27 },
  { fullName: 'David Mutasa', email: 'david.mutasa@sample.com', phone: '+263771234507', city: 'Harare', country: 'Zimbabwe', age: 33 },
  { fullName: 'Ruth Makoni', email: 'ruth.makoni@sample.com', phone: '+263771234508', city: 'Harare', country: 'Zimbabwe', age: 25 },
  { fullName: 'Peter Muzenda', email: 'peter.muzenda@sample.com', phone: '+263771234509', city: 'Harare', country: 'Zimbabwe', age: 30 },
  { fullName: 'Faith Nyathi', email: 'faith.nyathi@sample.com', phone: '+263771234510', city: 'Harare', country: 'Zimbabwe', age: 28 },
  // Bulawayo Users
  { fullName: 'Thabo Nkomo', email: 'thabo.nkomo@sample.com', phone: '+263771234511', city: 'Bulawayo', country: 'Zimbabwe', age: 29 },
  { fullName: 'Nomsa Dube', email: 'nomsa.dube@sample.com', phone: '+263771234512', city: 'Bulawayo', country: 'Zimbabwe', age: 26 },
  { fullName: 'Sipho Moyo', email: 'sipho.moyo@sample.com', phone: '+263771234513', city: 'Bulawayo', country: 'Zimbabwe', age: 31 },
  { fullName: 'Zanele Khumalo', email: 'zanele.khumalo@sample.com', phone: '+263771234514', city: 'Bulawayo', country: 'Zimbabwe', age: 27 },
  { fullName: 'Lungile Ncube', email: 'lungile.ncube@sample.com', phone: '+263771234515', city: 'Bulawayo', country: 'Zimbabwe', age: 30 },
];

const DEFAULT_PASSWORD = 'Test123456!';

/**
 * Create all sample users
 * This creates user records in the users table
 * Note: Auth users should be created separately via Supabase Dashboard for login
 * Password for all: Test123456!
 */
export async function createSampleUsers() {
  try {
    const results = [];
    
    for (const userData of SAMPLE_USERS) {
      try {
        // Check if user already exists
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', userData.email)
          .maybeSingle();

        if (existing) {
          // Update existing user
          const { error: updateError } = await supabase
            .from('users')
            .update({
              full_name: userData.fullName,
              phone_number: userData.phone,
              is_sample_user: true,
              phone_verified: true,
              email_verified: true,
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;

        // Create or update complete dating profile with all enhancement fields
        await supabase
          .from('dating_profiles')
          .upsert({
            user_id: existing.id,
            bio: `Looking for meaningful connections in ${userData.city}. Love good conversations and authentic people.`,
            age: userData.age,
            location_city: userData.city,
            location_country: userData.country,
            headline: 'Serious about love, fun about life',
            values: ['Family', 'Faith', 'Growth', 'Honesty'],
            mood: 'romantic',
            what_makes_me_different: 'I never give up on people I care about',
            weekend_style: 'church_faith',
            intention_tag: 'serious',
            respect_first_badge: true,
            local_food: 'Sadza & nyama',
            local_slang: 'Sharp',
            local_spot: `${userData.city} City Centre`,
            what_im_looking_for: 'Looking for someone genuine, kind, and ready for something real. Values family and growth.',
            kids: 'want_kids',
            work: 'Professional',
            smoke: 'no',
            drink: 'sometimes',
            prompts: [
              { question: 'What makes you laugh?', answer: 'Good jokes and genuine moments' },
              { question: 'Perfect weekend?', answer: 'Quality time with loved ones' },
              { question: 'What are you passionate about?', answer: 'Building meaningful connections' }
            ],
            interests: ['Music', 'Travel', 'Food', 'Family', 'Faith'],
            looking_for: 'everyone',
            age_range_min: 22,
            age_range_max: 40,
            max_distance_km: 50,
            is_active: true,
            show_me: true,
            last_active_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          });

          results.push({ email: userData.email, status: 'updated', userId: existing.id });
        } else {
          // Generate UUID for new user
          const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = Math.random() * 16 | 0;
              const v = c === 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });
          };
          const userId = generateUUID();
          
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: userId,
              full_name: userData.fullName,
              email: userData.email,
              phone_number: userData.phone,
              role: 'user',
              is_sample_user: true,
              phone_verified: true,
              email_verified: true,
            });

          if (insertError) {
            // If constraint error, user might exist
            if (insertError.code === '23505') {
              results.push({ email: userData.email, status: 'exists', userId: null });
            } else {
              throw insertError;
            }
            continue;
          }

          // Create complete dating profile with all enhancement fields
          await supabase
            .from('dating_profiles')
            .insert({
              user_id: userId,
              bio: `Looking for meaningful connections in ${userData.city}. Love good conversations and authentic people.`,
              age: userData.age,
              location_city: userData.city,
              location_country: userData.country,
              headline: 'Serious about love, fun about life',
              values: ['Family', 'Faith', 'Growth', 'Honesty'],
              mood: 'romantic',
              what_makes_me_different: 'I never give up on people I care about',
              weekend_style: 'church_faith',
              intention_tag: 'serious',
              respect_first_badge: true,
              local_food: 'Sadza & nyama',
              local_slang: 'Sharp',
              local_spot: `${userData.city} City Centre`,
              what_im_looking_for: 'Looking for someone genuine, kind, and ready for something real. Values family and growth.',
              kids: 'want_kids',
              work: 'Professional',
              smoke: 'no',
              drink: 'sometimes',
              prompts: [
                { question: 'What makes you laugh?', answer: 'Good jokes and genuine moments' },
                { question: 'Perfect weekend?', answer: 'Quality time with loved ones' },
                { question: 'What are you passionate about?', answer: 'Building meaningful connections' }
              ],
              interests: ['Music', 'Travel', 'Food', 'Family', 'Faith'],
              looking_for: 'everyone',
              age_range_min: 22,
              age_range_max: 40,
              max_distance_km: 50,
              is_active: true,
              show_me: true,
              last_active_at: new Date().toISOString(),
            });

          results.push({ email: userData.email, status: 'created', userId });
        }
      } catch (userError: any) {
        console.error(`Error processing user ${userData.email}:`, userError);
        results.push({ 
          email: userData.email, 
          status: 'error', 
          error: userError.message 
        });
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    const updated = results.filter(r => r.status === 'updated').length;
    const exists = results.filter(r => r.status === 'exists').length;
    const errors = results.filter(r => r.status === 'error').length;

    let message = `Processed ${results.length} users: ${created} created, ${updated} updated`;
    if (exists > 0) message += `, ${exists} already exist`;
    if (errors > 0) message += `, ${errors} errors`;
    message += '.\n\nNote: To enable login, create auth users in Supabase Dashboard (Authentication → Users).';

    return {
      success: errors === 0,
      message,
      results,
    };
  } catch (error: any) {
    console.error('Error creating sample users:', error);
    return {
      success: false,
      message: error.message || 'Failed to create sample users',
      error,
    };
  }
}

/**
 * Delete all sample users using SQL function
 */
export async function deleteSampleUsers() {
  try {
    // Use the SQL function to delete all sample users
    const { data, error } = await supabase.rpc('delete_all_sample_users');

    if (error) throw error;

    const deletedCount = data || 0;

    return {
      success: true,
      message: `Deleted ${deletedCount} sample users and all their data`,
      deletedCount,
    };
  } catch (error: any) {
    console.error('Error deleting sample users:', error);
    
    // Fallback: manual deletion if function doesn't exist
    try {
      const { data: sampleUsers } = await supabase
        .from('users')
        .select('id')
        .eq('is_sample_user', true);

      if (sampleUsers && sampleUsers.length > 0) {
        const userIds = sampleUsers.map(u => u.id);
        
        // Delete in batches
        for (const userId of userIds) {
          // Delete dating profiles (cascade will handle related data)
          await supabase.from('dating_profiles').delete().eq('user_id', userId);
          // Delete other data
          await supabase.from('user_subscriptions').delete().eq('user_id', userId);
          await supabase.from('user_dating_badges').delete().eq('user_id', userId);
          // Delete user
          await supabase.from('users').delete().eq('id', userId);
        }

        return {
          success: true,
          message: `Deleted ${userIds.length} sample users`,
          deletedCount: userIds.length,
        };
      }

      return {
        success: true,
        message: 'No sample users found to delete',
        deletedCount: 0,
      };
    } catch (fallbackError: any) {
      return {
        success: false,
        message: error.message || fallbackError.message || 'Failed to delete sample users',
        error: error || fallbackError,
      };
    }
  }
}

/**
 * Get count of sample users
 */
export async function getSampleUsersCount() {
  try {
    // First check if the column exists by trying to query it
    // If it doesn't exist, the column will be created by the migration
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_sample_user', true);

    if (error) {
      // If column doesn't exist, return 0 (migration hasn't been run yet)
      if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
        console.log('is_sample_user column does not exist yet. Run the migration first.');
        return 0;
      }
      throw error;
    }
    return count || 0;
  } catch (error: any) {
    // Silently handle errors - column might not exist yet
    if (error?.code === '42703' || error?.message?.includes('column') || error?.message?.includes('does not exist')) {
      return 0;
    }
    console.error('Error getting sample users count:', error?.message || error);
    return 0;
  }
}

