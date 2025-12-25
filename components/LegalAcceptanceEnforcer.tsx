import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { InteractionManager } from 'react-native';
import { useApp } from '@/contexts/AppContext';
import LegalAcceptanceModal from './LegalAcceptanceModal';
import { LegalDocument } from '@/types';
import { checkUserLegalAcceptances } from '@/lib/legal-enforcement';

export default function LegalAcceptanceEnforcer() {
  const { currentUser, legalAcceptanceStatus, setLegalAcceptanceStatus } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [modalVisible, setModalVisible] = useState(false);
  const [isViewingDocument, setIsViewingDocument] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hide modal when viewing a legal document, show it again when back
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (pathname?.startsWith('/legal/')) {
      setIsViewingDocument(true);
      setModalVisible(false);
    } else if (isViewingDocument && !pathname?.startsWith('/legal/')) {
      // User came back from viewing a document
      setIsViewingDocument(false);
      // Show modal again after a short delay
      timeoutRef.current = setTimeout(() => {
        const shouldShow =
          currentUser &&
          legalAcceptanceStatus !== null &&
          !legalAcceptanceStatus.hasAllRequired &&
          (legalAcceptanceStatus.missingDocuments.length > 0 ||
            legalAcceptanceStatus.needsReAcceptance.length > 0);
        setModalVisible(shouldShow);
        timeoutRef.current = null;
      }, 300);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [pathname, isViewingDocument, currentUser, legalAcceptanceStatus]);

  const handleViewDocument = (document: LegalDocument) => {
    if (!document || !document.slug) {
      console.error('Invalid document or missing slug:', document);
      return;
    }

    console.log('Viewing legal document:', document.slug);
    
    // Hide modal first to allow navigation
    setModalVisible(false);
    setIsViewingDocument(true);
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Use InteractionManager to ensure navigation happens after modal animation completes
    // This ensures the modal is fully dismissed before navigation
    InteractionManager.runAfterInteractions(() => {
      // Additional small delay to ensure modal is completely closed
      timeoutRef.current = setTimeout(() => {
        const route = `/legal/${document.slug}`;
        console.log('Navigating to:', route);
        
        try {
          router.push(route as any);
        } catch (error) {
          console.error('Error navigating to legal document:', error);
          // Fallback: try replace if push fails
          try {
            console.log('Trying replace instead of push...');
            router.replace(route as any);
          } catch (replaceError) {
            console.error('Error replacing to legal document:', replaceError);
            // Reset state if navigation completely fails
            setIsViewingDocument(false);
            setModalVisible(true);
          }
        }
        timeoutRef.current = null;
      }, 300); // Increased delay to ensure modal is completely closed
    });
  };

  const handleComplete = async () => {
    // Close modal immediately
    setModalVisible(false);
    
    // Refresh acceptance status
    if (currentUser?.id) {
      try {
        const status = await checkUserLegalAcceptances(currentUser.id);
        setLegalAcceptanceStatus(status);
        
        // If status shows all required are accepted, ensure modal stays closed
        if (status.hasAllRequired) {
          setModalVisible(false);
        }
      } catch (error) {
        console.error('Error refreshing legal acceptance status:', error);
      }
    }
  };

  useEffect(() => {
    // Only show modal if not currently viewing a document
    if (!isViewingDocument) {
      // Only show if:
      // 1. User is logged in
      // 2. Status has been checked (not null)
      // 3. User doesn't have all required documents
      // 4. There are actually missing or needs-reacceptance documents
      const shouldShow =
        currentUser &&
        legalAcceptanceStatus !== null &&
        !legalAcceptanceStatus.hasAllRequired &&
        (legalAcceptanceStatus.missingDocuments.length > 0 ||
          legalAcceptanceStatus.needsReAcceptance.length > 0);
      setModalVisible(shouldShow);
    }
  }, [currentUser, legalAcceptanceStatus, isViewingDocument]);

  const showModal =
    !isViewingDocument &&
    currentUser &&
    legalAcceptanceStatus !== null &&
    !legalAcceptanceStatus.hasAllRequired &&
    (legalAcceptanceStatus.missingDocuments.length > 0 ||
      legalAcceptanceStatus.needsReAcceptance.length > 0);

  return (
    <LegalAcceptanceModal
      visible={modalVisible && showModal}
      missingDocuments={legalAcceptanceStatus?.missingDocuments || []}
      needsReAcceptance={legalAcceptanceStatus?.needsReAcceptance || []}
      onComplete={handleComplete}
      onViewDocument={handleViewDocument}
    />
  );
}

