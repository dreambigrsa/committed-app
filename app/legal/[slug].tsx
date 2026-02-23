import React, { useState, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import LegalDocumentViewer from '@/components/LegalDocumentViewer';
import { LegalDocument } from '@/types';
import { supabase } from '@/lib/supabase';

export default function LegalPage() {
  const params = useLocalSearchParams<{ slug: string; from?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug : Array.isArray(params.slug) ? params.slug[0] : '';
  const fromAcceptance = params.from === 'acceptance';
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (slug) loadDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadDocument depends on slug which is in deps
  }, [slug]);

  const loadDocument = async () => {
    if (!slug) return;
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

  return (
    <LegalDocumentViewer
      document={document}
      isLoading={isLoading}
      fromAcceptance={fromAcceptance}
    />
  );
}

