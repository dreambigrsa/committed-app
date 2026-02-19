import { supabase } from './supabase';
import { LegalDocument } from '@/types';
import { isAbortLikeError } from './abort-error';

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
    // For other contexts, verify session is active (fixes 401 errors).
    // Supabase auth getSession/refreshSession can throw "signal is aborted" — catch and skip check.
    try {
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
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data: { session } } = await supabase.auth.getSession();

        if (session && session.user) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError && refreshError.message !== 'Auth session missing!') {
            console.warn('Session refresh error during signup:', refreshError);
          } else {
            if (__DEV__) console.log('Session available for legal acceptance');
          }

          if (session.user.id !== userId) {
            console.warn(`Session user ID (${session.user.id}) doesn't match provided userId (${userId}) during signup`);
          }
        } else {
          if (__DEV__) console.log('No session yet during signup - RLS policy will use helper function');
        }
      }
    } catch (sessionErr: unknown) {
      if (isAbortLikeError(sessionErr)) {
        if (__DEV__) console.log('Legal save: session check skipped (abort)');
        // Continue to DB insert/update; RLS may still allow it
      } else {
        console.error('Session check error when saving acceptance:', sessionErr);
        return false;
      }
    }

    // Upsert: insert or update on (user_id, document_id) to avoid duplicate key errors
    const row = {
      user_id: userId,
      document_id: documentId,
      document_version: documentVersion,
      context,
      accepted_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_legal_acceptances')
      .upsert(row, { onConflict: 'user_id,document_id' });

    if (error) {
      if (error.code === '23505') {
        // Duplicate key - row exists but RLS may have hidden it on select; retry as update by id if needed
        console.warn('Legal acceptance duplicate key (race/RLS), row already saved:', documentId);
        return true;
      }
      console.error('Error upserting acceptance:', error);
      if (error.code === '42501') {
        console.error('RLS Policy Error: Please run migrations for user_legal_acceptances.');
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (isAbortLikeError(error)) {
      if (__DEV__) console.log('Legal save: request aborted');
      return false;
    }
    console.error('Error saving acceptance:', error);
    throw error;
  }
}

