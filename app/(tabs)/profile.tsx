import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  CheckCircle2,
  Heart,
  LogOut,
  Settings,
  Shield,
  Plus,
  BarChart3,
  Camera,
} from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const { currentUser, logout, getCurrentUserRelationship, updateUserProfile } = useApp();
  const { colors } = useTheme();
  const relationship = getCurrentUserRelationship();
  const [isUploading, setIsUploading] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const styles = useMemo(() => createStyles(colors), [colors]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (!currentUser) {
    return null;
  }

  const getRelationshipTypeLabel = (type: string) => {
    const labels = {
      married: 'Married',
      engaged: 'Engaged',
      serious: 'Serious Relationship',
      dating: 'Dating',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const uploadProfilePicture = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'You need to allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploading(true);
      try {
        const fileName = `profile_${currentUser?.id}_${Date.now()}.jpg`;
        
        // Convert URI to Uint8Array using legacy API (no deprecation warnings)
        const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64);
        const uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, uint8Array, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(fileName);

        await updateUserProfile({ profilePicture: publicUrl });

        Alert.alert('Success', 'Profile picture updated!');
      } catch (error) {
        console.error('Failed to upload profile picture:', error);
        Alert.alert('Error', 'Failed to upload profile picture');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    // Navigate to landing page (root index)
    // Use push instead of replace to avoid navigation errors
    router.push('/' as any);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.title}>Profile</Text>
        </Animated.View>

        <Animated.View 
          style={[
            styles.profileSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={uploadProfilePicture}
            disabled={isUploading}
          >
            {currentUser.profilePicture ? (
              <Image
                source={{ uri: currentUser.profilePicture }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {currentUser.fullName.charAt(0)}
                </Text>
              </View>
            )}
            {isUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color={colors.text.white} />
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Camera size={16} color={colors.text.white} />
            </View>
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{currentUser.fullName}</Text>
            <Text style={styles.profileEmail}>{currentUser.email}</Text>
            <Text style={styles.profilePhone}>{currentUser.phoneNumber}</Text>
          </View>

          <View style={styles.verificationBadges}>
            {currentUser.verifications.phone && (
              <View style={styles.badge}>
                <CheckCircle2 size={14} color={colors.secondary} />
                <Text style={styles.badgeText}>Phone Verified</Text>
              </View>
            )}
            {currentUser.verifications.email && (
              <View style={styles.badge}>
                <CheckCircle2 size={14} color={colors.secondary} />
                <Text style={styles.badgeText}>Email Verified</Text>
              </View>
            )}
            {currentUser.verifications.id && (
              <View style={styles.badge}>
                <CheckCircle2 size={14} color={colors.secondary} />
                <Text style={styles.badgeText}>ID Verified</Text>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View 
          style={[
            styles.card,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Heart size={20} color={colors.danger} />
              <Text style={styles.cardTitle}>Relationship Status</Text>
            </View>
          </View>

          {relationship ? (
            <View style={styles.relationshipContent}>
              <View style={styles.relationshipRow}>
                <Text style={styles.relationshipLabel}>Partner</Text>
                <Text style={styles.relationshipValue}>
                  {relationship.partnerName}
                </Text>
              </View>
              <View style={styles.relationshipRow}>
                <Text style={styles.relationshipLabel}>Type</Text>
                <Text style={styles.relationshipValue}>
                  {getRelationshipTypeLabel(relationship.type)}
                </Text>
              </View>
              <View style={styles.relationshipRow}>
                <Text style={styles.relationshipLabel}>Status</Text>
                <View
                  style={[
                    styles.statusBadge,
                    relationship.status === 'verified'
                      ? styles.statusBadgeVerified
                      : styles.statusBadgePending,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      relationship.status === 'verified'
                        ? styles.statusTextVerified
                        : styles.statusTextPending,
                    ]}
                  >
                    {relationship.status === 'verified' ? 'Verified' : 'Pending'}
                  </Text>
                </View>
              </View>
              <View style={styles.relationshipRow}>
                <Text style={styles.relationshipLabel}>Since</Text>
                <Text style={styles.relationshipValue}>
                  {new Date(relationship.startDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.noRelationshipContainer}>
              <Text style={styles.noRelationshipText}>
                No active relationship registered
              </Text>
              <TouchableOpacity
                style={styles.addRelationshipButton}
                onPress={() => router.push('/relationship/register' as any)}
              >
                <Plus size={16} color={colors.primary} />
                <Text style={styles.addRelationshipButtonText}>
                  Register Relationship
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <Text style={styles.sectionTitle}>Account</Text>

          {(currentUser.role === 'admin' || currentUser.role === 'super_admin') && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/admin/advertisements' as any)}
            >
              <View style={styles.menuItemLeft}>
                <BarChart3 size={20} color={colors.primary} />
                <Text style={[styles.menuItemText, styles.adminText]}>Manage Advertisements</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/settings' as any)}
          >
            <View style={styles.menuItemLeft}>
              <Settings size={20} color={colors.text.secondary} />
              <Text style={styles.menuItemText}>Settings</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/settings' as any)}
          >
            <View style={styles.menuItemLeft}>
              <Shield size={20} color={colors.text.secondary} />
              <Text style={styles.menuItemText}>Privacy</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={styles.menuItemLeft}>
              <LogOut size={20} color={colors.danger} />
              <Text style={[styles.menuItemText, styles.logoutText]}>Log Out</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
    backgroundColor: colors.background.primary,
    marginHorizontal: 20,
    borderRadius: 24,
    paddingVertical: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 40,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.background.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 15,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  verificationBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.badge.verified,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.badge.verifiedText,
  },
  card: {
    backgroundColor: colors.background.primary,
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  relationshipContent: {
    gap: 14,
  },
  relationshipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  relationshipLabel: {
    fontSize: 15,
    color: colors.text.secondary,
    fontWeight: '500' as const,
  },
  relationshipValue: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '600' as const,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeVerified: {
    backgroundColor: colors.badge.verified,
  },
  statusBadgePending: {
    backgroundColor: colors.badge.pending,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  statusTextVerified: {
    color: colors.badge.verifiedText,
  },
  statusTextPending: {
    color: colors.badge.pendingText,
  },
  noRelationshipContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  noRelationshipText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 12,
  },
  addRelationshipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addRelationshipButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500' as const,
  },
  logoutText: {
    color: colors.danger,
  },
  adminText: {
    color: colors.primary,
    fontWeight: '600' as const,
  },
});
