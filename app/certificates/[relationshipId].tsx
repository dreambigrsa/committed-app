import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Download, Award, Share2, CheckCircle2 } from 'lucide-react-native';
import { Image } from 'expo-image';

import { useApp } from '@/contexts/AppContext';
import colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export default function CertificateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const relationshipId = params.relationshipId as string;
  const { currentUser, getCurrentUserRelationship } = useApp();
  const relationship = getCurrentUserRelationship();

  const [certificate, setCertificate] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    loadCertificate();
  }, [relationshipId]);

  const loadCertificate = async () => {
    try {
      const { data, error } = await supabase
        .from('couple_certificates')
        .select('*')
        .eq('relationship_id', relationshipId)
        .single();

      if (data) {
        setCertificate(data);
      }
    } catch (error) {
      console.error('Failed to load certificate:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCertificate = () => {
    router.push({
      pathname: '/verification/couple-selfie' as any,
      params: { relationshipId },
    });
  };

  const handleDownloadCertificate = async () => {
    if (!certificate) return;

    if (Platform.OS === 'web') {
      window.open(certificate.certificate_url, '_blank');
    } else {
      Alert.alert('Success', 'Certificate download coming soon!');
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Certificate' }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!relationship || relationship.status !== 'verified') {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Certificate' }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              Only verified relationships can generate certificates
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Couple Certificate' }} />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {certificate ? (
            <>
              <View style={styles.certificateCard}>
                <View style={styles.certificateHeader}>
                  <Award size={48} color={colors.primary} />
                  <Text style={styles.certificateTitle}>
                    Official Couple Certificate
                  </Text>
                </View>

                <View style={styles.certificateBody}>
                  <View style={styles.verifiedBadge}>
                    <CheckCircle2 size={24} color={colors.secondary} />
                    <Text style={styles.verifiedText}>Verified Couple</Text>
                  </View>

                  <Text style={styles.coupleNames}>
                    {currentUser?.fullName} & {relationship.partnerName}
                  </Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Relationship Type:</Text>
                    <Text style={styles.infoValue}>
                      {relationship.type === 'married' && 'Married'}
                      {relationship.type === 'engaged' && 'Engaged'}
                      {relationship.type === 'serious' && 'Serious Relationship'}
                      {relationship.type === 'dating' && 'Dating'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Since:</Text>
                    <Text style={styles.infoValue}>
                      {new Date(relationship.startDate).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Issued:</Text>
                    <Text style={styles.infoValue}>
                      {new Date(certificate.issued_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>

                {certificate.verification_selfie_url && (
                  <Image
                    source={{ uri: certificate.verification_selfie_url }}
                    style={styles.selfieImage}
                  />
                )}
              </View>

              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleDownloadCertificate}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <ActivityIndicator color={colors.text.white} size="small" />
                  ) : (
                    <>
                      <Download size={20} color={colors.text.white} />
                      <Text style={styles.actionButtonText}>Download</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                  onPress={() => {
                    Alert.alert('Share', 'Share functionality coming soon!');
                  }}
                >
                  <Share2 size={20} color={colors.primary} />
                  <Text style={styles.actionButtonTextSecondary}>Share</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.noCertificateContainer}>
              <Award size={80} color={colors.text.tertiary} strokeWidth={1.5} />
              <Text style={styles.noCertificateTitle}>No Certificate Yet</Text>
              <Text style={styles.noCertificateText}>
                Complete couple selfie verification to generate your official certificate
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateCertificate}
              >
                <Text style={styles.createButtonText}>Start Verification</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  certificateCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  certificateHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  certificateTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 12,
    textAlign: 'center',
  },
  certificateBody: {
    gap: 20,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.badge.verified,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.badge.verifiedText,
  },
  coupleNames: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.text.primary,
    textAlign: 'center',
    marginVertical: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 15,
    color: colors.text.secondary,
    fontWeight: '500' as const,
  },
  infoValue: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '600' as const,
  },
  selfieImage: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    marginTop: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionButtonSecondary: {
    backgroundColor: colors.background.primary,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  actionButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  noCertificateContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noCertificateTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 24,
    marginBottom: 12,
  },
  noCertificateText: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
});
