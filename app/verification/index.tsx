import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Shield,
  CheckCircle2,
  Mail,
  Phone,
  IdCard,
  ChevronRight,
} from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import colors from '@/constants/colors';

export default function VerificationScreen() {
  const router = useRouter();
  const { currentUser } = useApp();

  if (!currentUser) {
    return null;
  }

  const handlePhoneVerification = () => {
    router.push('/verification/phone' as any);
  };

  const handleEmailVerification = () => {
    router.push('/verification/email' as any);
  };

  const handleIdVerification = () => {
    router.push('/verification/id' as any);
  };

  const verificationMethods = [
    {
      type: 'phone' as const,
      title: 'Phone Number',
      description: 'Verify your phone number with SMS code',
      icon: Phone,
      isVerified: currentUser.verifications.phone,
      onPress: handlePhoneVerification,
    },
    {
      type: 'email' as const,
      title: 'Email Address',
      description: 'Verify your email address with verification code',
      icon: Mail,
      isVerified: currentUser.verifications.email,
      onPress: handleEmailVerification,
    },
    {
      type: 'id' as const,
      title: 'Government ID',
      description: 'Upload your ID for identity verification',
      icon: IdCard,
      isVerified: currentUser.verifications.id,
      onPress: handleIdVerification,
    },
  ];

  const getVerificationCount = () => {
    return Object.values(currentUser.verifications).filter(Boolean).length;
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Verification',
          headerStyle: {
            backgroundColor: colors.background.primary,
          },
        }}
      />
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Shield size={48} color={colors.primary} strokeWidth={2} />
            </View>
            <Text style={styles.title}>Verify Your Identity</Text>
            <Text style={styles.subtitle}>
              Complete all verifications to increase your trust score and
              relationship credibility
            </Text>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(getVerificationCount() / 3) * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {getVerificationCount()} of 3 completed
              </Text>
            </View>
          </View>

          <View style={styles.methodsList}>
            {verificationMethods.map((method) => (
              <TouchableOpacity
                key={method.type}
                style={[
                  styles.methodCard,
                  method.isVerified && styles.methodCardVerified,
                ]}
                onPress={method.onPress}
                disabled={method.isVerified}
              >
                <View style={styles.methodLeft}>
                  <View
                    style={[
                      styles.methodIconContainer,
                      method.isVerified && styles.methodIconContainerVerified,
                    ]}
                  >
                    {method.isVerified ? (
                      <CheckCircle2 size={24} color={colors.secondary} />
                    ) : (
                      <method.icon size={24} color={colors.primary} />
                    )}
                  </View>

                  <View style={styles.methodInfo}>
                    <Text style={styles.methodTitle}>{method.title}</Text>
                    <Text style={styles.methodDescription}>
                      {method.description}
                    </Text>
                  </View>
                </View>

                {method.isVerified ? (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedBadgeText}>Verified</Text>
                  </View>
                ) : (
                  <ChevronRight size={20} color={colors.text.tertiary} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.infoCard}>
            <Shield size={20} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Why verify?</Text>
              <Text style={styles.infoText}>
                Verified accounts have higher trust scores, making your
                relationship status more credible and protecting both you and
                your partner.
              </Text>
            </View>
          </View>
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
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: colors.primary + '30',
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: colors.background.primary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  methodsList: {
    gap: 12,
    marginBottom: 24,
  },
  methodCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodCardVerified: {
    borderColor: colors.secondary + '30',
    backgroundColor: colors.badge.verified,
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  methodIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconContainerVerified: {
    backgroundColor: colors.background.primary,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  methodDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  verifiedBadge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  verifiedBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  infoCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    gap: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});
