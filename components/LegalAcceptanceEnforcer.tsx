import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import LegalAcceptanceModal from './LegalAcceptanceModal';
import { LegalDocument } from '@/types';

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
          legalAcceptanceStatus &&
          !legalAcceptanceStatus.hasAllRequired &&
          (legalAcceptanceStatus.missingDocuments.length > 0 ||
            legalAcceptanceStatus.needsReAcceptance.length > 0);
        setModalVisible(shouldShow || false);
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

  const handleComplete = () => {
    // Refresh acceptance status
    if (currentUser?.id) {
      import('@/lib/legal-enforcement').then(({ checkUserLegalAcceptances }) => {
        checkUserLegalAcceptances(currentUser.id).then((status) => {
          setLegalAcceptanceStatus(status);
        });
      });
    }
  };

  useEffect(() => {
    // Only show modal if not currently viewing a document
    if (!isViewingDocument) {
      const shouldShow =
        currentUser &&
        legalAcceptanceStatus &&
        !legalAcceptanceStatus.hasAllRequired &&
        (legalAcceptanceStatus.missingDocuments.length > 0 ||
          legalAcceptanceStatus.needsReAcceptance.length > 0);
      setModalVisible(shouldShow || false);
    }
  }, [currentUser, legalAcceptanceStatus, isViewingDocument]);

  const showModal =
    !isViewingDocument &&
    currentUser &&
    legalAcceptanceStatus &&
    !legalAcceptanceStatus.hasAllRequired &&
    (legalAcceptanceStatus.missingDocuments.length > 0 ||
      legalAcceptanceStatus.needsReAcceptance.length > 0);

  return (
    <LegalAcceptanceModal
      visible={modalVisible && showModal || false}
      missingDocuments={legalAcceptanceStatus?.missingDocuments || []}
      needsReAcceptance={legalAcceptanceStatus?.needsReAcceptance || []}
      onComplete={handleComplete}
      onViewDocument={handleViewDocument}
    />
  );
}

