import { z } from 'zod';
import { protectedProcedure } from '../../create-context';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dizcuexznganwgddsrfo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpemN1ZXh6bmdhbndnZGRzcmZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjcxODcsImV4cCI6MjA4MDg0MzE4N30.cvnt9KN4rz2u9yQbDQjFcA_Q7WDz2M_lGln3RCJ-hJQ';

export const createCertificateProcedure = protectedProcedure
  .input(
    z.object({
      relationshipId: z.string(),
      verificationSelfieUrl: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { relationshipId, verificationSelfieUrl } = input;
    const userId = ctx.user.id;
    
    // Get the auth token from the request context
    const authHeader = ctx.req.headers.get("authorization");
    if (!authHeader) {
      throw new Error('Authorization header missing');
    }
    const token = authHeader.replace("Bearer ", "");
    
    // Create an authenticated Supabase client using the user's token
    // This ensures RLS policies can check auth.uid()
    const authenticatedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: relationship } = await authenticatedSupabase
      .from('relationships')
      .select('*')
      .eq('id', relationshipId)
      .eq('status', 'verified')
      .single();

    if (!relationship) {
      throw new Error('Verified relationship not found');
    }

    if (
      relationship.user_id !== userId &&
      relationship.partner_user_id !== userId
    ) {
      throw new Error('Not authorized');
    }

    const certificateUrl = `https://committed.app/certificates/${relationshipId}`;

    const { data: certificate, error } = await authenticatedSupabase
      .from('couple_certificates')
      .insert({
        relationship_id: relationshipId,
        certificate_url: certificateUrl,
        verification_selfie_url: verificationSelfieUrl,
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return certificate;
  });
