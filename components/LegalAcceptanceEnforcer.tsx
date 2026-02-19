import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { InteractionManager } from 'react-native';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import LegalAcceptanceModal from './LegalAcceptanceModal';
import { LegalDocument } from '@/types';
import { checkUserLegalAcceptances } from '@/lib/legal-enforcement';
import { supabase } from '@/lib/supabase';

export default function LegalAcceptanceEnforcer() {
  const { currentUser, legalAcceptanceStatus, setLegalAcceptanceStatus } = useApp();
  const { updateUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [modalVisible, setModalVisible] = useState(false);
  const [isViewingDocument, setIsViewingDocument] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // User came back from viewing a document — show modal again so they can accept
      setIsViewingDocument(false);
      timeoutRef.current = setTimeout(() => {
        if (pathname?.startsWith('/legal/')) return;
        const shouldShow =
          currentUser &&
          legalAcceptanceStatus !== null &&
          !legalAcceptanceStatus.hasAllRequired &&
          (legalAcceptanceStatus.missingDocuments.length > 0 ||
            legalAcceptanceStatus.needsReAcceptance.length > 0);
        setModalVisible(!!shouldShow);
        timeoutRef.current = null;
      }, 400);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [pathname, isViewingDocument, currentUser, legalAcceptanceStatus]);

  const handleViewDocument = (document: LegalDocument) => {
    if (!document) {
      console.error('Invalid document:', document);
      return;
    }
    if (!document.slug || typeof document.slug !== 'string') {
      console.error('Document missing slug:', document);
      if (typeof alert !== 'undefined') {
        alert('This document cannot be opened right now. Please try again or contact support.');
      }
      return;
    }

    const slug = document.slug.trim();
    if (!slug) {
      if (typeof alert !== 'undefined') {
        alert('This document cannot be opened right now. Please try again or contact support.');
      }
      return;
    }

    // Hide modal first so the stack screen can show and back works
    setModalVisible(false);
    setIsViewingDocument(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    InteractionManager.runAfterInteractions(() => {
      const route = `/legal/${slug}?from=acceptance`;
      setTimeout(() => {
        try {
          router.push(route as any);
        } catch (error) {
          console.error('Error navigating to legal document:', error);
          setIsViewingDocument(false);
        }
      }, 350);
    });
  };

  const handleComplete = async () => {
    // Close modal immediately
    setModalVisible(false);
    
    // Refresh acceptance status
    if (currentUser?.id) {
      try {
        // Wait a moment for database to update
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const status = await checkUserLegalAcceptances(currentUser.id);
        setLegalAcceptanceStatus(status);
        
        // If status shows all required are accepted, update AuthContext; AppGate will route
        if (status.hasAllRequired) {
          setModalVisible(false);
          updateUser({ acceptedLegalDocs: true });
        }
      } catch (error) {
        console.error('Error refreshing legal acceptance status:', error);
      }
    }
  };

  const isOnResetPassword = pathname === '/reset-password';
  const isOnLegalRoute = pathname?.startsWith('/legal/');

  // Don't show on reset-password or when viewing a legal document; allow app use so they can open /legal from Settings etc.
  useEffect(() => {
    if (isOnResetPassword || isOnLegalRoute) {
      setModalVisible(false);
      return;
    }
    if (!isViewingDocument && currentUser && legalAcceptanceStatus !== null) {
      // Re-verify from DB once when status says we might show, so we don't show if they already accepted
      const mightShow =
        !legalAcceptanceStatus.hasAllRequired &&
        (legalAcceptanceStatus.missingDocuments.length > 0 ||
          legalAcceptanceStatus.needsReAcceptance.length > 0);
      if (!mightShow) {
        setModalVisible(false);
        return;
      }
      let cancelled = false;
      checkUserLegalAcceptances(currentUser.id).then((status) => {
        if (cancelled) return;
        setLegalAcceptanceStatus(status);
        if (status.hasAllRequired) {
          setModalVisible(false);
          updateUser({ acceptedLegalDocs: true });
        } else {
          setModalVisible(
            status.missingDocuments.length > 0 || status.needsReAcceptance.length > 0
          );
        }
      }).catch(() => {
        if (!cancelled) setModalVisible(false);
      });
      return () => { cancelled = true; };
    }
  }, [currentUser, legalAcceptanceStatus, isViewingDocument, isOnResetPassword, isOnLegalRoute]);

  const showModal = Boolean(
    !isViewingDocument &&
    !isOnResetPassword &&
    !isOnLegalRoute &&
    currentUser &&
    legalAcceptanceStatus !== null &&
    !legalAcceptanceStatus.hasAllRequired &&
    (legalAcceptanceStatus.missingDocuments.length > 0 ||
      legalAcceptanceStatus.needsReAcceptance.length > 0)
  );

  const handleDismiss = () => {
    setModalVisible(false);
  };

  return (
    <LegalAcceptanceModal
      visible={modalVisible && showModal}
      missingDocuments={legalAcceptanceStatus?.missingDocuments || []}
      needsReAcceptance={legalAcceptanceStatus?.needsReAcceptance || []}
      onComplete={handleComplete}
      onViewDocument={handleViewDocument}
      onDismiss={handleDismiss}
    />
  );
}

