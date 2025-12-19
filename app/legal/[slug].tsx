import React, { useState, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import LegalDocumentViewer from '@/components/LegalDocumentViewer';
import { LegalDocument } from '@/types';
import { supabase } from '@/lib/supabase';

export default function LegalPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDocument();
  }, [slug]);

  const loadDocument = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error) throw error;

      if (data) {
        setDocument({
          id: data.id,
          title: data.title,
          slug: data.slug,
          content: data.content,
          version: data.version,
          isActive: data.is_active,
          isRequired: data.is_required,
          displayLocation: data.display_location || [],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          createdBy: data.created_by,
          lastUpdatedBy: data.last_updated_by,
        });
      }
    } catch (error) {
      console.error('Failed to load legal document:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return <LegalDocumentViewer document={document} isLoading={isLoading} />;
}

