import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { X, Check } from 'lucide-react-native';
import colors from '@/constants/colors';

interface BanUserModalProps {
  visible: boolean;
  onClose: () => void;
  onBanFeatures: (features: string[]) => void;
  onFullBan: () => void;
  reportedContentType?: string;
  reason?: string;
  colors: any;
}

const AVAILABLE_FEATURES = [
  { key: 'posts', label: 'Posts', description: 'Cannot create or edit posts' },
  { key: 'comments', label: 'Comments', description: 'Cannot create or edit comments' },
  { key: 'reels', label: 'Reels', description: 'Cannot create or edit reels' },
  { key: 'reel_comments', label: 'Reel Comments', description: 'Cannot comment on reels' },
  { key: 'messages', label: 'Messages', description: 'Cannot send messages' },
];

export default function BanUserModal({
  visible,
  onClose,
  onBanFeatures,
  onFullBan,
  reportedContentType,
  reason,
  colors: appColors,
}: BanUserModalProps) {
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  const handleBanFeatures = () => {
    if (selectedFeatures.length === 0) {
      return;
    }
    onBanFeatures(selectedFeatures);
    setSelectedFeatures([]);
  };

  const handleFullBan = () => {
    onFullBan();
    setSelectedFeatures([]);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: appColors.background.primary }]}>
          <SafeAreaView style={styles.safeAreaContainer}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: appColors.text.primary }]}>Ban User</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={appColors.text.primary} />
              </TouchableOpacity>
            </View>

            {(reportedContentType || reason) && (
              <View style={[styles.infoBox, { backgroundColor: appColors.background.secondary }]}>
                {reportedContentType && (
                  <Text style={[styles.infoText, { color: appColors.text.secondary }]}>
                    Reported for: <Text style={{ fontWeight: '600' }}>{reportedContentType}</Text>
                  </Text>
                )}
                {reason && (
                  <Text style={[styles.infoText, { color: appColors.text.secondary }]}>
                    Reason: <Text style={{ fontWeight: '600' }}>{reason}</Text>
                  </Text>
                )}
              </View>
            )}

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <Text style={[styles.sectionTitle, { color: appColors.text.primary }]}>
                Select Features to Ban
              </Text>
              <Text style={[styles.sectionDescription, { color: appColors.text.secondary }]}>
                Choose specific features to restrict. User will still be able to access other features.
              </Text>

              <View style={styles.featuresList}>
                {AVAILABLE_FEATURES.map((feature) => {
                  const isSelected = selectedFeatures.includes(feature.key);
                  return (
                    <TouchableOpacity
                      key={feature.key}
                      style={[
                        styles.featureItem,
                        {
                          backgroundColor: appColors.background.secondary,
                          borderColor: isSelected ? appColors.primary : appColors.border.light,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                      onPress={() => toggleFeature(feature.key)}
                    >
                      <View style={styles.featureContent}>
                        <View style={styles.featureInfo}>
                          <Text style={[styles.featureLabel, { color: appColors.text.primary }]}>
                            {feature.label}
                          </Text>
                          <Text style={[styles.featureDescription, { color: appColors.text.secondary }]}>
                            {feature.description}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.checkbox,
                            {
                              backgroundColor: isSelected ? appColors.primary : 'transparent',
                              borderColor: isSelected ? appColors.primary : appColors.border.light,
                            },
                          ]}
                        >
                          {isSelected && <Check size={16} color={appColors.text.white} />}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.divider} />

              <TouchableOpacity
                style={[styles.fullBanButton, { backgroundColor: appColors.danger }]}
                onPress={handleFullBan}
              >
                <Text style={styles.fullBanText}>Full Ban (All Features)</Text>
                <Text style={[styles.fullBanDescription, { color: appColors.text.white + 'CC' }]}>
                  Ban user from all features completely
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: appColors.border.light }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, { color: appColors.text.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.banButton,
                  {
                    backgroundColor: selectedFeatures.length > 0 ? appColors.danger : appColors.text.tertiary,
                  },
                ]}
                onPress={handleBanFeatures}
                disabled={selectedFeatures.length === 0}
              >
                <Text style={styles.banButtonText}>
                  Ban from {selectedFeatures.length} Feature{selectedFeatures.length !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  safeAreaContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  infoBox: {
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  featuresList: {
    gap: 12,
    marginBottom: 20,
  },
  featureItem: {
    borderRadius: 12,
    padding: 16,
  },
  featureContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featureInfo: {
    flex: 1,
  },
  featureLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: 24,
  },
  fullBanButton: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  fullBanText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.white,
    marginBottom: 4,
  },
  fullBanDescription: {
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  banButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  banButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.white,
  },
});

