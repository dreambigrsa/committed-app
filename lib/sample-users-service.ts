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

const _DEFAULT_PASSWORD = 'Test123456!';

/**
 * Create all sample users using Supabase Edge Function
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

    // Get Supabase URL
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dizcuexznganwgddsrfo.supabase.co';
    const functionUrl = `${supabaseUrl}/functions/v1/create-sample-users`;

    // Call Supabase Edge Function
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
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
 * Delete all sample users using Supabase Edge Function
 */
export async function deleteSampleUsers() {
  try {
    // Get current session for auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('You must be logged in to delete sample users');
    }

    // Get Supabase URL
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dizcuexznganwgddsrfo.supabase.co';
    const functionUrl = `${supabaseUrl}/functions/v1/delete-sample-users`;

    // Call Supabase Edge Function
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Error deleting sample users:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete sample users',
      error,
    };
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

