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
 */
export async function saveUserAcceptance(
  userId: string,
  documentId: string,
  documentVersion: string,
  context: 'signup' | 'relationship_registration' | 'update' | 'manual'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_legal_acceptances')
      .insert({
        user_id: userId,
        document_id: documentId,
        document_version: documentVersion,
        context,
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error saving acceptance:', error);
    return false;
  }
}

