import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { AlertTriangle, Shield, CheckCircle2, RefreshCw } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { LegalDocument } from '@/types';
import LegalAcceptanceCheckbox from './LegalAcceptanceCheckbox';
import { saveUserAcceptance, checkUserLegalAcceptances } from '@/lib/legal-enforcement';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';

interface LegalAcceptanceModalProps {
  visible: boolean;
  missingDocuments: LegalDocument[];
  needsReAcceptance: LegalDocument[];
  onComplete: () => void;
  onViewDocument: (document: LegalDocument) => void;
}

export default function LegalAcceptanceModal({
  visible,
  missingDocuments,
  needsReAcceptance,
  onComplete,
  onViewDocument,
}: LegalAcceptanceModalProps) {
  const { colors } = useTheme();
  const { currentUser } = useApp();
  const styles = createStyles(colors);

  const [acceptances, setAcceptances] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const documentsRef = useRef<LegalDocument[]>([]);

  const allDocuments = useMemo(() => [...missingDocuments, ...needsReAcceptance], [missingDocuments, needsReAcceptance]);
  const requiredDocs = useMemo(() => allDocuments.filter((doc) => doc.isRequired), [allDocuments]);
  const allRequiredAccepted = useMemo(() => 
    requiredDocs.every((doc) => acceptances[doc.id] === true),
    [requiredDocs, acceptances]
  );

  // Update ref when documents change
  useEffect(() => {
    documentsRef.current = allDocuments;
  }, [allDocuments]);

  // Check existing acceptances when modal opens
  useEffect(() => {
    if (!visible) {
      // Reset acceptances when modal closes
      setAcceptances({});
      return;
    }

    const allDocs = documentsRef.current;
    const documentIds = allDocs.map(d => d.id);
    const requiredDocIds = allDocs.filter(d => d.isRequired).map(d => d.id);

    if (currentUser?.id && documentIds.length > 0) {
      setIsChecking(true);
      // Check which documents are already accepted
      supabase
        .from('user_legal_acceptances')
        .select('document_id, document_version')
        .eq('user_id', currentUser.id)
        .in('document_id', documentIds)
        .then(({ data, error }) => {
          if (!error && data) {
            const existingAcceptances: Record<string, boolean> = {};
            // Check if each document is already accepted with the correct version
            allDocs.forEach(doc => {
              const acceptance = data.find(a => a.document_id === doc.id);
              if (acceptance && acceptance.document_version === doc.version) {
                existingAcceptances[doc.id] = true;
              }
            });
            setAcceptances(existingAcceptances);
            
            // If all required documents are already accepted, auto-close
            const allRequiredAlreadyAccepted = requiredDocIds.length > 0 && 
              requiredDocIds.every(docId => existingAcceptances[docId] === true);
            
            if (allRequiredAlreadyAccepted) {
              // Small delay to show the checkmarks, then close
              setTimeout(() => {
                onComplete();
              }, 500);
            }
          }
          setIsChecking(false);
        })
        .catch((error) => {
          console.error('Error checking existing acceptances:', error);
          setIsChecking(false);
        });
    } else if (documentIds.length === 0) {
      // If modal is visible but no documents, call onComplete to close it
      onComplete();
    }
  }, [visible, currentUser?.id, onComplete]);

  const handleToggle = (documentId: string, accepted: boolean) => {
    setAcceptances((prev) => ({
      ...prev,
      [documentId]: accepted,
    }));
  };

  const handleSave = async () => {
    if (requiredDocs.length > 0 && !allRequiredAccepted) {
      alert('Please accept all required documents to continue');
      return;
    }

    if (!currentUser?.id) {
      alert('User not found');
      return;
    }

    setIsSaving(true);
    try {
      const acceptancesToSave = Object.entries(acceptances)
        .filter(([_, accepted]) => accepted)
        .map(([documentId, _]) => {
          const doc = allDocuments.find((d) => d.id === documentId);
          return {
            documentId,
            version: doc?.version || '1.0.0',
          };
        });

      // Save all acceptances and track failures
      const saveResults = await Promise.all(
        acceptancesToSave.map(({ documentId, version }) =>
          saveUserAcceptance(
            currentUser.id,
            documentId,
            version,
            needsReAcceptance.find((d) => d.id === documentId) ? 'update' : 'manual'
          )
        )
      );

      // Check if all saves succeeded
      const allSucceeded = saveResults.every((result) => result === true);
      
      if (!allSucceeded) {
        alert('Failed to save some acceptances. Please try again.');
        return;
      }

      // Only call onComplete if all saves succeeded
      onComplete();
    } catch (error) {
      console.error('Failed to save acceptances:', error);
      alert('Failed to save acceptances. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      transparent={false}
      onRequestClose={() => {
        // Prevent closing modal if required documents not accepted
        if (requiredDocs.length > 0 && !allRequiredAccepted) {
          return;
        }
      }}
    >
      <View style={styles.container}>
        {/* Hero Header */}
        <View style={styles.heroHeader}>
          <View style={styles.iconContainer}>
            <Shield size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Legal Documents</Text>
          <Text style={styles.subtitle}>
            {missingDocuments.length > 0 && needsReAcceptance.length > 0
              ? 'Please review and accept the following legal documents to continue using the app.'
              : missingDocuments.length > 0
              ? 'To continue, please accept the required legal documents below.'
              : 'Some legal documents have been updated. Please review and accept the new versions.'}
          </Text>
        </View>

        <ScrollView 
          style={styles.content} 
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {missingDocuments.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <AlertTriangle size={20} color={colors.danger} />
                </View>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>New Documents</Text>
                  <Text style={styles.sectionSubtitle}>
                    {missingDocuments.length} document{missingDocuments.length > 1 ? 's' : ''} require{missingDocuments.length > 1 ? '' : 's'} your acceptance
                  </Text>
                </View>
              </View>
              {missingDocuments.map((doc) => (
                <LegalAcceptanceCheckbox
                  key={doc.id}
                  document={doc}
                  isAccepted={acceptances[doc.id] || false}
                  onToggle={handleToggle}
                  onViewDocument={onViewDocument}
                  required={doc.isRequired}
                />
              ))}
            </View>
          )}

          {needsReAcceptance.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconContainer, styles.updateIconContainer]}>
                  <RefreshCw size={20} color={colors.primary} />
                </View>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>Updated Documents</Text>
                  <Text style={styles.sectionSubtitle}>
                    {needsReAcceptance.length} document{needsReAcceptance.length > 1 ? 's have' : ' has'} been updated. Please review and accept the new version{needsReAcceptance.length > 1 ? 's' : ''}.
                  </Text>
                </View>
              </View>
              {needsReAcceptance.map((doc) => (
                <LegalAcceptanceCheckbox
                  key={doc.id}
                  document={doc}
                  isAccepted={acceptances[doc.id] || false}
                  onToggle={handleToggle}
                  onViewDocument={onViewDocument}
                  required={doc.isRequired}
                />
              ))}
            </View>
          )}

          {/* Progress Indicator */}
          {requiredDocs.length > 0 && (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <CheckCircle2 
                  size={20} 
                  color={allRequiredAccepted ? colors.secondary : colors.text.tertiary} 
                />
                <Text style={styles.progressTitle}>
                  {allRequiredAccepted ? 'All Required Documents Accepted' : 'Acceptance Progress'}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(requiredDocs.filter(d => acceptances[d.id]).length / requiredDocs.length) * 100}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {requiredDocs.filter(d => acceptances[d.id]).length} of {requiredDocs.length} required documents accepted
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton, 
              (!allRequiredAccepted && requiredDocs.length > 0) && styles.saveButtonDisabled,
              isSaving && styles.saveButtonDisabled
            ]}
            onPress={handleSave}
            disabled={isSaving || (!allRequiredAccepted && requiredDocs.length > 0)}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.text.white} />
            ) : (
              <>
                <Shield size={18} color={colors.text.white} />
                <Text style={styles.saveButtonText}>Continue</Text>
              </>
            )}
          </TouchableOpacity>
          {requiredDocs.length > 0 && !allRequiredAccepted && (
            <Text style={styles.footerHint}>
              Please accept all required documents to continue
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  heroHeader: {
    backgroundColor: colors.background.primary,
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.danger + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateIconContainer: {
    backgroundColor: colors.primary + '15',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  progressCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    flex: 1,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border.light,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500' as const,
  },
  footer: {
    padding: 20,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0.1,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  footerHint: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
