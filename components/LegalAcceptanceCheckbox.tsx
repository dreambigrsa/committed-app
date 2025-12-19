import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Check, FileText, ExternalLink } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { LegalDocument } from '@/types';

interface LegalAcceptanceCheckboxProps {
  document: LegalDocument;
  isAccepted: boolean;
  onToggle: (documentId: string, accepted: boolean) => void;
  onViewDocument: (document: LegalDocument) => void;
  required?: boolean;
}

export default function LegalAcceptanceCheckbox({
  document,
  isAccepted,
  onToggle,
  onViewDocument,
  required = false,
}: LegalAcceptanceCheckboxProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors, isAccepted);

  return (
    <View style={styles.container}>
      <View style={styles.checkboxRow}>
        <TouchableOpacity
          style={styles.checkboxWrapper}
          onPress={() => onToggle(document.id, !isAccepted)}
          activeOpacity={0.7}
        >
          <View style={styles.checkbox}>
            {isAccepted && (
              <View style={styles.checkmarkContainer}>
                <Check size={16} color={colors.text.white} strokeWidth={3} />
              </View>
            )}
          </View>
        </TouchableOpacity>
        
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.titleRow}
              onPress={() => {
                onViewDocument(document);
              }}
              activeOpacity={0.7}
            >
              <FileText size={18} color={isAccepted ? colors.primary : colors.text.secondary} />
              <Text style={styles.title}>
                {required && <Text style={styles.requiredStar}>* </Text>}
                {document.title}
              </Text>
            </TouchableOpacity>
            {required && (
              <View style={styles.requiredBadge}>
                <Text style={styles.requiredBadgeText}>Required</Text>
              </View>
            )}
          </View>
          
          <View style={styles.metaRow}>
            <Text style={styles.versionText}>Version {document.version}</Text>
            <TouchableOpacity
              style={styles.viewLink}
              onPress={() => {
                onViewDocument(document);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.viewLinkText}>View Full Document</Text>
              <ExternalLink size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isAccepted: boolean) => StyleSheet.create({
  container: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: isAccepted ? colors.primary + '30' : colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isAccepted ? 0.08 : 0.04,
    shadowRadius: 4,
    elevation: isAccepted ? 3 : 1,
  },
  checkboxRow: {
    flexDirection: 'row',
  },
  checkboxWrapper: {
    marginRight: 16,
    marginTop: 2,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: isAccepted ? colors.primary : colors.border.medium,
    backgroundColor: isAccepted ? colors.primary : colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: isAccepted ? colors.primary : 'transparent',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: isAccepted ? 2 : 0,
  },
  checkmarkContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    flex: 1,
    lineHeight: 22,
  },
  requiredStar: {
    color: colors.danger,
    fontWeight: '700' as const,
  },
  requiredBadge: {
    backgroundColor: colors.danger + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  requiredBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  versionText: {
    fontSize: 13,
    color: colors.text.tertiary,
    fontWeight: '500' as const,
  },
  viewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewLinkText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.primary,
  },
});
