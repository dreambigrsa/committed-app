import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { InteractionManager } from 'react-native';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import LegalAcceptanceModal from './LegalAcceptanceModal';
import LegalReminderBanner from './LegalReminderBanner';
import { LegalDocument } from '@/types';
import { checkUserLegalAcceptances } from '@/lib/legal-enforcement';

/** Time until we surface the full legal sheet again after the user taps "Close" (soft reminder). */
const LEGAL_FULL_SHEET_REMINDER_MS = 5 * 60 * 1000;

type LegalSurface = 'sheet' | 'reminder';

/**
 * Soft legal UX (production-friendly):
 * - Full-screen sheet can be dismissed; a top banner reminds users to accept.
 * - After a delay, the sheet can appear again (gentle nudge) if still pending.
 * - Legal status still comes from AppContext once loaded (no duplicate bootstrap fetch).
 */
export default function LegalAcceptanceEnforcer() {
  const { currentUser, legalAcceptanceStatus, setLegalAcceptanceStatus } = useApp();
  const { user: authUser, updateUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [surface, setSurface] = useState<LegalSurface>('sheet');
  const [isViewingDocument, setIsViewingDocument] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reminderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPendingRef = useRef(false);

  const effectiveUserId = authUser?.id ?? currentUser?.id ?? null;

  /** Never show legal sheet/banner until email is verified — flow is: verify → legal → onboarding (AI consent). */
  const emailVerifiedForProductFlow = authUser?.emailVerified === true;
  const isOnVerifyEmail =
    pathname === '/verify-email' || pathname === 'verify-email' || pathname?.endsWith('/verify-email');

  const legalActionRequired = Boolean(
    emailVerifiedForProductFlow &&
      !isOnVerifyEmail &&
      effectiveUserId &&
      !authUser?.acceptedLegalDocs &&
      legalAcceptanceStatus !== null &&
      !legalAcceptanceStatus.hasAllRequired &&
      (legalAcceptanceStatus.missingDocuments.length > 0 ||
        legalAcceptanceStatus.needsReAcceptance.length > 0)
  );

  // When pending legal first becomes true (e.g. after login), show the sheet — not only a banner.
  useEffect(() => {
    if (legalActionRequired && !prevPendingRef.current) {
      setSurface('sheet');
    }
    if (!legalActionRequired) {
      if (reminderTimerRef.current) {
        clearTimeout(reminderTimerRef.current);
        reminderTimerRef.current = null;
      }
    }
    prevPendingRef.current = legalActionRequired;
  }, [legalActionRequired]);

  // Hide sheet when viewing a legal document; show again when back on app routes.
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (pathname?.startsWith('/legal/')) {
      setIsViewingDocument(true);
    } else if (isViewingDocument && !pathname?.startsWith('/legal/')) {
      setIsViewingDocument(false);
      timeoutRef.current = setTimeout(() => {
        if (pathname?.startsWith('/legal/')) return;
        timeoutRef.current = null;
      }, 400);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [pathname, isViewingDocument]);

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
    if (reminderTimerRef.current) {
      clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }

    if (effectiveUserId) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const status = await checkUserLegalAcceptances(effectiveUserId);
        setLegalAcceptanceStatus(status);
        if (status.hasAllRequired) {
          updateUser({ acceptedLegalDocs: true });
        }
      } catch (error) {
        console.error('Error refreshing legal acceptance status:', error);
      }
    }
  };

  const isOnResetPassword = pathname === '/reset-password';
  const isOnLegalRoute = pathname?.startsWith('/legal/');

  // If AuthContext says user already accepted, sync AppContext so UI clears.
  useEffect(() => {
    if (authUser?.acceptedLegalDocs && currentUser && legalAcceptanceStatus !== null && !legalAcceptanceStatus.hasAllRequired) {
      setLegalAcceptanceStatus({
        hasAllRequired: true,
        missingDocuments: [],
        needsReAcceptance: [],
      });
    }
  }, [authUser?.acceptedLegalDocs, currentUser, legalAcceptanceStatus, setLegalAcceptanceStatus]);

  // Re-verify from DB when status suggests we may need to show (single pass per dependency set).
  useEffect(() => {
    if (isOnResetPassword || isOnLegalRoute || isOnVerifyEmail) return;
    if (!emailVerifiedForProductFlow) return;
    if (authUser?.acceptedLegalDocs) return;
    if (!isViewingDocument && effectiveUserId && legalAcceptanceStatus !== null) {
      const mightShow =
        !legalAcceptanceStatus.hasAllRequired &&
        (legalAcceptanceStatus.missingDocuments.length > 0 || legalAcceptanceStatus.needsReAcceptance.length > 0);
      if (!mightShow) return;
      let cancelled = false;
      checkUserLegalAcceptances(effectiveUserId)
        .then((status) => {
          if (cancelled) return;
          setLegalAcceptanceStatus(status);
          if (status.hasAllRequired) {
            updateUser({ acceptedLegalDocs: true });
          }
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }
  }, [
    effectiveUserId,
    legalAcceptanceStatus,
    isViewingDocument,
    isOnResetPassword,
    isOnLegalRoute,
    isOnVerifyEmail,
    emailVerifiedForProductFlow,
    authUser?.acceptedLegalDocs,
    setLegalAcceptanceStatus,
    updateUser,
  ]);

  const handleDismissSheet = () => {
    setSurface('reminder');
    if (reminderTimerRef.current) {
      clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }
    reminderTimerRef.current = setTimeout(() => {
      reminderTimerRef.current = null;
      if (legalActionRequired) {
        setSurface('sheet');
      }
    }, LEGAL_FULL_SHEET_REMINDER_MS);
  };

  const handleOpenFromBanner = () => {
    if (reminderTimerRef.current) {
      clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }
    setSurface('sheet');
  };

  useEffect(() => {
    return () => {
      if (reminderTimerRef.current) clearTimeout(reminderTimerRef.current);
    };
  }, []);

  const showFullScreen =
    legalActionRequired &&
    surface === 'sheet' &&
    !isViewingDocument &&
    !isOnResetPassword &&
    !isOnLegalRoute &&
    !isOnVerifyEmail;

  const showBanner =
    legalActionRequired &&
    surface === 'reminder' &&
    !isOnResetPassword &&
    !isOnLegalRoute &&
    !isOnVerifyEmail;

  const showModal = showFullScreen;

  return (
    <>
      {showBanner ? (
        <LegalReminderBanner
          onOpen={handleOpenFromBanner}
          subtitle="Tap to review. We'll remind you again with a full prompt if needed."
        />
      ) : null}
      <LegalAcceptanceModal
        visible={showModal}
        missingDocuments={legalAcceptanceStatus?.missingDocuments || []}
        needsReAcceptance={legalAcceptanceStatus?.needsReAcceptance || []}
        onComplete={handleComplete}
        onViewDocument={handleViewDocument}
        onDismiss={handleDismissSheet}
      />
    </>
  );
}
