import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { getSupabaseAuthedClient } from '@/backend/supabase';
import { createClient } from '@supabase/supabase-js';

// Service role key for admin operations (create auth users)
// This should be set in environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dizcuexznganwgddsrfo.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured. Cannot create auth users.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

const SAMPLE_USERS = [
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

export const createSampleUsersProcedure = protectedProcedure
  .mutation(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const supabase = getSupabaseAuthedClient(token);
    const userId = ctx.user.id;

    // Check if user is admin
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      throw new Error('Unauthorized: Admin access required');
    }

    const results = [];
    const adminClient = getSupabaseAdminClient();

    for (const userData of SAMPLE_USERS) {
      try {
        let authUserId: string;
        
        // Try to create auth user (will fail if already exists)
        const { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
          email: userData.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: userData.fullName,
            phone_number: userData.phone,
          },
        });

        if (authError) {
          // If user already exists, get the existing user
          if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
            // List users and find by email
            const { data: usersList } = await adminClient.auth.admin.listUsers();
            const existingUser = usersList?.users.find(u => u.email === userData.email);
            if (existingUser) {
              authUserId = existingUser.id;
            } else {
              throw new Error(`Auth user exists but could not be found: ${userData.email}`);
            }
          } else {
            throw new Error(authError.message || 'Failed to create auth user');
          }
        } else if (newAuthUser?.user) {
          authUserId = newAuthUser.user.id;
        } else {
          throw new Error('Failed to create auth user: No user returned');
        }

        // Check if user record exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', authUserId)
          .maybeSingle();

        if (existingUser) {
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
            .eq('id', authUserId);

          if (updateError) throw updateError;

          // Create or update dating profile
          await supabase
            .from('dating_profiles')
            .upsert({
              user_id: authUserId,
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

          results.push({ email: userData.email, status: 'updated', userId: authUserId });
        } else {
          // Create user record directly using admin client (bypasses RLS)
          const { error: insertError } = await adminClient
            .from('users')
            .insert({
              id: authUserId,
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
              // User already exists, update it
              const { error: updateError } = await adminClient
                .from('users')
                .update({
                  full_name: userData.fullName,
                  phone_number: userData.phone,
                  is_sample_user: true,
                  phone_verified: true,
                  email_verified: true,
                })
                .eq('id', authUserId);

              if (updateError) throw updateError;
            } else {
              throw new Error(insertError.message || 'Failed to create user record');
            }
          }

          // Create dating profile
          await adminClient
            .from('dating_profiles')
            .insert({
              user_id: authUserId,
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

          results.push({ email: userData.email, status: 'created', userId: authUserId });
        }
      } catch (userError: any) {
        console.error(`Error processing user ${userData.email}:`, userError);
        results.push({
          email: userData.email,
          status: 'error',
          error: userError.message || 'Unknown error',
        });
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    const updated = results.filter(r => r.status === 'updated').length;
    const errors = results.filter(r => r.status === 'error').length;

    return {
      success: errors === 0,
      message: `Processed ${results.length} users: ${created} created, ${updated} updated${errors > 0 ? `, ${errors} errors` : ''}`,
      results,
    };
  });

