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
 * This creates auth users, user records, and dating profiles automatically
 * Password for all: Test123456!
 */
export async function createSampleUsers() {
  try {
    // Get current session for auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to create sample users');
    }

    // Get base URL
    const getBaseUrl = () => {
      if (process.env.EXPO_PUBLIC_COMMITTED_API_BASE_URL) {
        return process.env.EXPO_PUBLIC_COMMITTED_API_BASE_URL;
      }
      return __DEV__ 
        ? "http://localhost:3000"
        : "https://committed-5mxf.onrender.com";
    };

    // Call tRPC endpoint directly
    // tRPC uses POST with JSON body: { "0": { "json": input } }
    const url = `${getBaseUrl()}/trpc/admin.createSampleUsers`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        "0": {
          "json": {}
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = JSON.parse(errorText);
        // tRPC error format: { error: { message: "...", code: "..." } }
        if (errorData.error) {
          errorMessage = errorData.error.message || errorMessage;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    // tRPC returns data in result[0].result.data format
    if (result[0]?.result?.data) {
      return result[0].result.data;
    }
    
    // Fallback: return result as-is
    return result;
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

