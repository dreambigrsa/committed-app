import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'expo-router';
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
    // Hide modal first to allow navigation
    setModalVisible(false);
    setIsViewingDocument(true);
    // Small delay to ensure modal closes before navigation
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      router.push(`/legal/${document.slug}` as any);
      timeoutRef.current = null;
    }, 100);
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

