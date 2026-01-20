import { supabase } from './supabase';
import { LegalDocument } from '@/types';

export interface AcceptanceStatus {
  hasAllRequired: boolean;
  missingDocuments: LegalDocument[];
  needsReAcceptance: LegalDocument[];
}

/**
 * Check if user has accepted all required legal documents
 */
export async function checkUserLegalAcceptances(userId: string): Promise<AcceptanceStatus> {
  try {
    // Get all active required documents
    const { data: requiredDocs, error: docsError } = await supabase
      .from('legal_documents')
      .select('*')
      .eq('is_active', true)
      .eq('is_required', true);

    if (docsError) throw docsError;

    if (!requiredDocs || requiredDocs.length === 0) {
      return {
        hasAllRequired: true,
        missingDocuments: [],
        needsReAcceptance: [],
      };
    }

    // Get user's acceptances
    const { data: acceptances, error: acceptancesError } = await supabase
      .from('user_legal_acceptances')
      .select('document_id, document_version')
      .eq('user_id', userId);

    if (acceptancesError) throw acceptancesError;

    const acceptedDocIds = new Set(
      acceptances?.map((a) => a.document_id) || []
    );
    const acceptanceVersions = new Map(
      acceptances?.map((a) => [a.document_id, a.document_version]) || []
    );

    const missingDocuments: LegalDocument[] = [];
    const needsReAcceptance: LegalDocument[] = [];

    requiredDocs.forEach((doc) => {
      const docObj: LegalDocument = {
        id: doc.id,
        title: doc.title,
        slug: doc.slug,
        content: doc.content,
        version: doc.version,
        isActive: doc.is_active,
        isRequired: doc.is_required,
        displayLocation: doc.display_location || [],
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
        createdBy: doc.created_by,
        lastUpdatedBy: doc.last_updated_by,
      };

      if (!acceptedDocIds.has(doc.id)) {
        missingDocuments.push(docObj);
      } else {
        // Check if version matches
        const acceptedVersion = acceptanceVersions.get(doc.id);
        if (acceptedVersion !== doc.version) {
          needsReAcceptance.push(docObj);
        }
      }
    });

    return {
      hasAllRequired: missingDocuments.length === 0 && needsReAcceptance.length === 0,
      missingDocuments,
      needsReAcceptance,
    };
  } catch (error) {
    console.error('Error checking legal acceptances:', error);
    // On error, allow access (fail open) but log it
    return {
      hasAllRequired: true,
      missingDocuments: [],
      needsReAcceptance: [],
    };
  }
}

/**
 * Save user acceptance of a legal document
 * Uses upsert to handle both new acceptances and updates to existing ones
 */
export async function saveUserAcceptance(
  userId: string,
  documentId: string,
  documentVersion: string,
  context: 'signup' | 'relationship_registration' | 'update' | 'manual'
): Promise<boolean> {
  try {
    // During signup, session might not be immediately available, so we're more lenient
    // For other contexts, verify session is active (fixes 401 errors)
    if (context !== 'signup') {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error when saving acceptance:', sessionError);
        return false;
      }
      
      if (!session || !session.user) {
        console.error('No active session when trying to save legal acceptance');
        return false;
      }
      
      if (session.user.id !== userId) {
        console.error(`Session user ID (${session.user.id}) doesn't match provided userId (${userId})`);
        return false;
      }
    } else {
      // During signup, wait for session to be established
      // Don't try to refresh if there's no session yet - just wait
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try to get session (don't refresh if it doesn't exist)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && session.user) {
        // Only refresh if we have a session
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError && refreshError.message !== 'Auth session missing!') {
          console.warn('Session refresh error during signup:', refreshError);
        } else {
          console.log('Session available for legal acceptance');
        }
        
        if (session.user.id !== userId) {
          console.warn(`Session user ID (${session.user.id}) doesn't match provided userId (${userId}) during signup`);
        }
      } else {
        // No session yet - that's OK, the RLS policy will handle it via the helper function
        console.log('No session yet during signup - RLS policy will use helper function');
      }
    }

    // First check if acceptance already exists
    const { data: existing, error: checkError } = await supabase
      .from('user_legal_acceptances')
      .select('id')
      .eq('user_id', userId)
      .eq('document_id', documentId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing acceptance:', checkError);
      // Don't fail if it's just "not found" - continue to insert
    }

    if (existing) {
      // Update existing acceptance
      const { error } = await supabase
        .from('user_legal_acceptances')
        .update({
          document_version: documentVersion,
          context,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        console.error('Error updating acceptance:', error);
        if (error.code === '42501') {
          console.error('RLS Policy Error: Please run migrations/fix-legal-acceptances-rls-quick.sql in Supabase');
        }
        throw error;
      }
    } else {
      // Insert new acceptance
      const { error } = await supabase
        .from('user_legal_acceptances')
        .insert({
          user_id: userId,
          document_id: documentId,
          document_version: documentVersion,
          context,
        });

      if (error) {
        console.error('Error inserting acceptance:', error);
        if (error.code === '42501') {
          console.error('⚠️ RLS Policy Error: The user_legal_acceptances table is missing INSERT policy.');
          console.error('URGENT: Run migrations/FIX-RLS-WITH-FUNCTION.sql in Supabase SQL Editor');
          console.error('This version creates a database function that bypasses RLS during signup.');
          console.error('This is a database configuration issue - the SQL must be run in Supabase dashboard.');
        }
        throw error;
      }
    }
    return true;
  } catch (error: any) {
    console.error('Error saving acceptance:', error);
    // Re-throw the error so the caller can handle it properly
    throw error;
  }
}

