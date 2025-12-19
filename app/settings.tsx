import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Animated,
  Image,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Shield,
  Bell,
  Eye,
  Lock,
  Heart,
  AlertTriangle,
  ChevronRight,
  Mail,
  Phone,
  IdCard,
  CheckCircle2,
  XCircle,
  User,
  Calendar,
  Download,
  Key,
  Smartphone,
  Users,
  Moon,
  Globe,
  Trash2,
  Camera,
  Settings,
  X,
  FileText,
  Briefcase,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { LegalDocument, UserStatusType, StatusVisibility } from '@/types';
import StatusIndicator from '@/components/StatusIndicator';
import StatusBadge from '@/components/StatusBadge';
import { configureAndroidNotificationChannel } from '@/lib/push-notifications';
import { setNotificationPreferences } from '@/lib/notification-preferences';

export default function SettingsScreen() {
  const router = useRouter();
  const { currentUser, deleteAccount, getCurrentUserRelationship, endRelationship, updateUserProfile, getUserStatus, updateUserStatus, updateStatusPrivacy, userStatuses } = useApp();
  const [legalDocuments, setLegalDocuments] = useState<LegalDocument[]>([]);
  const { colors, isDark, themeMode, setThemeMode, loadThemePreference, saveThemePreference, visualTheme, loadVisualTheme, saveVisualTheme } = useTheme();
  const { language, setLanguage: setLanguageContext, loadLanguagePreference, saveLanguagePreference, t } = useLanguage();
  const relationship = getCurrentUserRelationship();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Early return if no current user (prevents crashes)
  if (!currentUser) {
    return null;
  }

  const [editMode, setEditMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Basic Information
  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(currentUser?.phoneNumber || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [gender, setGender] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Notifications
  const [notifications, setNotifications] = useState({
    relationshipUpdates: true,
    cheatingAlerts: true,
    verificationAttempts: true,
    anniversaryReminders: true,
    marketingPromotions: false,
    soundEnabled: true,
  });

  // Privacy & Security
  const [privacy, setPrivacy] = useState({
    profileVisibility: 'public' as 'public' | 'private' | 'verified-only',
    searchVisibility: true,
    allowSearchByPhone: true,
  });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  
  // Status settings
  const [currentStatus, setCurrentStatus] = useState<UserStatusType>('offline');
  const [customStatusText, setCustomStatusText] = useState<string>('');
  const [statusVisibility, setStatusVisibility] = useState<StatusVisibility>('contacts');
  const [lastSeenVisibility, setLastSeenVisibility] = useState<StatusVisibility>('contacts');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showStatusPrivacyModal, setShowStatusPrivacyModal] = useState(false);
  
  // Password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // App Preferences - Now managed by contexts (LanguageContext and ThemeContext)

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName || '');
      setPhoneNumber(currentUser.phoneNumber || '');
      setEmail(currentUser.email || '');
      loadSettings();
      loadSessions();
      loadBlockedUsers();
      load2FAStatus();
      loadThemePreference(currentUser.id);
      loadVisualTheme(currentUser.id);
      loadLanguagePreference(currentUser.id);
      loadLegalDocuments();
    }
  }, [currentUser, loadThemePreference, loadVisualTheme, loadLanguagePreference]);

  const loadLegalDocuments = async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('is_active', true)
        .contains('display_location', ['settings']);

      if (error) throw error;

      if (data) {
        const docs = data.map((doc) => ({
          id: doc.id,
          title: doc.title,
          slug: doc.slug,
          content: doc.content,
          version: doc.version,
          isActive: doc.is_active,
          isRequired: doc.is_required,
          displayLocation: doc.display_location || [],
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
          createdBy: doc.created_by,
          lastUpdatedBy: doc.last_updated_by,
        }));
        setLegalDocuments(docs);
      }
    } catch (error) {
      console.error('Failed to load legal documents:', error);
    }
  };

  const loadSettings = async () => {
    if (!currentUser) return;
    
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', currentUser.id)
        .limit(1);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        const settings = data[0];
        if (settings.notification_settings) {
          // Helper function to ensure boolean values (handle string "true"/"false" from JSONB)
          const toBoolean = (value: any, fallback: boolean): boolean => {
            if (value === null || value === undefined) return fallback;
            if (typeof value === 'boolean') return value;
            if (typeof value === 'string') return value.toLowerCase() === 'true';
            return Boolean(value);
          };

          // Normalize notification settings to ensure all keys exist and are proper booleans
          const normalizedSettings = {
            relationshipUpdates: toBoolean(
              settings.notification_settings.relationshipUpdates ?? settings.notification_settings.relationshipRequests,
              true
            ),
            cheatingAlerts: toBoolean(settings.notification_settings.cheatingAlerts, true),
            verificationAttempts: toBoolean(
              settings.notification_settings.verificationAttempts ?? settings.notification_settings.verificationUpdates,
              true
            ),
            anniversaryReminders: toBoolean(settings.notification_settings.anniversaryReminders, true),
            marketingPromotions: toBoolean(
              settings.notification_settings.marketingPromotions ?? settings.notification_settings.partnerActivity,
              false
            ),
            soundEnabled: toBoolean(settings.notification_settings.soundEnabled, true),
          };
          setNotifications(normalizedSettings);

          // Keep in-memory preferences in sync for foreground sound + local notifications.
          setNotificationPreferences({ soundEnabled: normalizedSettings.soundEnabled });
          await configureAndroidNotificationChannel({ soundEnabled: normalizedSettings.soundEnabled });
        }
        if (settings.privacy_settings) {
          setPrivacy(settings.privacy_settings);
        }
        // Language and visual theme are loaded by their respective contexts
        // No need to set local state here
      }

      // Load gender and date of birth from users table
      const { data: userData } = await supabase
        .from('users')
        .select('gender, date_of_birth')
        .eq('id', currentUser.id)
        .single();

      if (userData) {
        if (userData.gender) setGender(userData.gender);
        if (userData.date_of_birth) setDateOfBirth(userData.date_of_birth);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadSessions = async () => {
    if (!currentUser) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: dbSessions } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('is_active', true);
      
      const sessionList = [];
      if (session) {
        sessionList.push({ id: session.access_token, device: 'Current Device', lastActive: new Date().toISOString() });
      }
      if (dbSessions) {
        dbSessions.forEach(s => {
          if (s.session_token !== session?.access_token) {
            sessionList.push({ id: s.id, device: s.device_info || 'Unknown Device', lastActive: s.last_active });
          }
        });
      }
      setSessions(sessionList);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
    }
  };

  const load2FAStatus = async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('user_2fa')
        .select('enabled')
        .eq('user_id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading 2FA:', error);
        return;
      }

      setTwoFactorEnabled(data?.enabled || false);
    } catch (error) {
      console.error('Failed to load 2FA status:', error);
    }
  };

  const loadBlockedUsers = async () => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('blocked_id, users!blocked_users_blocked_id_fkey(full_name, profile_picture)')
        .eq('blocker_id', currentUser.id);

      if (error) {
        // Table might not exist yet, that's okay
        console.log('Blocked users table not available:', error);
        setBlockedUsers([]);
        return;
      }

      if (data) {
        setBlockedUsers(data);
      }
    } catch (error) {
      console.error('Failed to load blocked users:', error);
      setBlockedUsers([]);
    }
  };

  if (!currentUser) {
    return null;
  }

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    
    try {
      const updateData: any = {
        full_name: fullName,
        phone_number: phoneNumber,
      };

      // Add optional fields if they have values
      if (gender) {
        updateData.gender = gender;
      }
      if (dateOfBirth) {
        updateData.date_of_birth = dateOfBirth;
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', currentUser.id);

      if (error) throw error;

      await updateUserProfile({
        fullName,
        phoneNumber,
      });

      Alert.alert('Success', 'Profile updated successfully!');
      setEditMode(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleProfilePhotoChange = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        // Upload to Supabase Storage
        const fileExt = result.assets[0].uri.split('.').pop();
        const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
        const filePath = `profile-pictures/${fileName}`;

        const formData = new FormData();
        formData.append('file', {
          uri: result.assets[0].uri,
          type: `image/${fileExt}`,
          name: fileName,
        } as any);

        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(filePath, formData, {
            contentType: `image/${fileExt}`,
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        await updateUserProfile({
          profilePicture: publicUrl,
        });

        Alert.alert('Success', 'Profile photo updated!');
      }
    } catch (error) {
      console.error('Failed to update profile photo:', error);
      Alert.alert('Error', 'Failed to update profile photo');
    }
  };

  const handleChangePassword = () => {
    setShowPasswordModal(true);
  };

  const handleSavePassword = async () => {
    // Validate inputs
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in new password fields');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      // Update password - Supabase allows this for authenticated users
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      Alert.alert('Success', 'Password updated successfully!');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Failed to change password:', error);
      Alert.alert('Error', error.message || 'Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleReVerify = (type: 'phone' | 'email' | 'id') => {
    if (type === 'phone') {
      router.push('/verification/phone' as any);
    } else if (type === 'email') {
      router.push('/verification/email' as any);
    } else if (type === 'id') {
      router.push('/verification/id' as any);
    }
  };

  const handleToggleNotification = async (key: keyof typeof notifications) => {
    const newValue = !notifications[key];
    setNotifications((prev: typeof notifications) => ({
      ...prev,
      [key]: newValue,
    }));

    if (key === 'soundEnabled') {
      setNotificationPreferences({ soundEnabled: newValue });
      await configureAndroidNotificationChannel({ soundEnabled: newValue });
    }

    await saveNotificationSettings({ ...notifications, [key]: newValue });
  };

  const handleTogglePrivacy = async (key: keyof typeof privacy) => {
    if (key === 'profileVisibility') return;

    const newValue = !privacy[key];
    setPrivacy((prev: typeof privacy) => ({
      ...prev,
      [key]: newValue,
    }));

    await savePrivacySettings({ ...privacy, [key]: newValue });
  };

  const saveNotificationSettings = async (settings: typeof notifications) => {
    if (!currentUser) return;
    
    try {
      const { data: existingData } = await supabase
        .from('user_settings')
        .select('privacy_settings, theme_preference, language')
        .eq('user_id', currentUser.id)
        .limit(1);

      const existingPrivacy = existingData && existingData.length > 0 
        ? existingData[0].privacy_settings 
        : privacy;
      const existingTheme = existingData && existingData.length > 0 
        ? existingData[0].theme_preference || 'light'
        : 'light';
      const existingLanguage = existingData && existingData.length > 0 
        ? existingData[0].language || 'en'
        : 'en';

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: currentUser.id,
          notification_settings: settings,
          privacy_settings: existingPrivacy,
          theme_preference: existingTheme,
          language: existingLanguage,
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      Alert.alert('Error', 'Failed to save notification settings');
    }
  };

  const savePrivacySettings = async (settings: typeof privacy) => {
    if (!currentUser) return;

    try {
      const { data: existingData } = await supabase
        .from('user_settings')
        .select('notification_settings, theme_preference, language, visual_theme')
        .eq('user_id', currentUser.id)
        .limit(1);

      const existingNotifications = existingData && existingData.length > 0 
        ? existingData[0].notification_settings 
        : notifications;
      const existingTheme = existingData && existingData.length > 0 
        ? existingData[0].theme_preference || 'light'
        : 'light';
      const existingLanguage = existingData && existingData.length > 0 
        ? existingData[0].language || 'en'
        : 'en';

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: currentUser.id,
          privacy_settings: settings,
          notification_settings: existingNotifications,
          theme_preference: existingTheme,
          language: existingLanguage,
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
      Alert.alert('Error', 'Failed to save privacy settings');
    }
  };

  // Language and theme are now saved via their respective context functions
  // This function is kept for backward compatibility but is no longer used
  const saveAppPreferences = async () => {
    // No-op: Language saved via saveLanguagePreference, theme via saveVisualTheme
  };

  const handleChangePrivacyLevel = async () => {
    Alert.alert(
      'Profile Visibility',
      'Choose who can see your relationship status',
      [
        {
          text: 'Public',
          onPress: async () => {
            const newPrivacy = { ...privacy, profileVisibility: 'public' as const };
            setPrivacy(newPrivacy);
            await savePrivacySettings(newPrivacy);
          },
        },
        {
          text: 'Verified Users Only',
          onPress: async () => {
            const newPrivacy = { ...privacy, profileVisibility: 'verified-only' as const };
            setPrivacy(newPrivacy);
            await savePrivacySettings(newPrivacy);
          },
        },
        {
          text: 'Private',
          onPress: async () => {
            const newPrivacy = { ...privacy, profileVisibility: 'private' as const };
            setPrivacy(newPrivacy);
            await savePrivacySettings(newPrivacy);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleDownloadCertificate = () => {
    if (relationship && relationship.status === 'verified') {
      router.push(`/certificates/${relationship.id}` as any);
    } else {
      Alert.alert('Not Available', 'You need a verified relationship to download a certificate');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account?\n\nThis will delete:\n• Your profile and all personal information\n• All your posts, reels, and comments\n• All your messages and conversations\n• Your relationships and verification status\n• All other account data\n\nThis action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            // Double confirmation
            Alert.alert(
              'Final Confirmation',
              'This is your last chance to cancel. Your account will be permanently deleted and all data will be lost forever.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setIsDeleting(true);
                      const success = await deleteAccount();
                      
                      if (success) {
                        Alert.alert(
                          'Account Deleted',
                          'Your account has been permanently deleted. You will be redirected to the login page.',
                          [
                            {
                              text: 'OK',
                              onPress: () => {
                                router.replace('/auth');
                              },
                            },
                          ]
                        );
                      }
                    } catch (error: any) {
                      console.error('Failed to delete account:', error);
                      
                      let errorMessage = 'Failed to delete account. Please try again.';
                      if (error.message?.includes('permission') || error.message?.includes('policy')) {
                        errorMessage = 'Permission denied. Please contact support if you need to delete your account.';
                      } else if (error.message) {
                        errorMessage = error.message;
                      }
                      
                      Alert.alert('Error', errorMessage);
                    } finally {
                      setIsDeleting(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const getPrivacyLevelLabel = () => {
    const labels: Record<'public' | 'private' | 'verified-only', string> = {
      public: 'Public',
      private: 'Private',
      'verified-only': 'Verified Users Only',
    };
    return labels[privacy.profileVisibility];
  };

  const getVerificationStatus = (type: 'phone' | 'email' | 'id') => {
    if (type === 'phone') return currentUser.verifications.phone;
    if (type === 'email') return currentUser.verifications.email;
    if (type === 'id') return currentUser.verifications.id;
    return false;
  };

  const getRelationshipVerificationStatus = () => {
    return relationship?.status === 'verified';
  };

  const handleStatusChange = async (newStatus: UserStatusType) => {
    const success = await updateUserStatus(newStatus, customStatusText);
    if (success) {
      setCurrentStatus(newStatus);
      setShowStatusModal(false);
      Alert.alert('Success', 'Status updated successfully');
    } else {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleSaveCustomStatus = async () => {
    const success = await updateUserStatus(currentStatus, customStatusText);
    if (success) {
      setShowStatusModal(false);
      Alert.alert('Success', 'Custom status updated successfully');
    } else {
      Alert.alert('Error', 'Failed to update custom status');
    }
  };

  const handleStatusPrivacyChange = async () => {
    const success = await updateStatusPrivacy(statusVisibility, lastSeenVisibility);
    if (success) {
      setShowStatusPrivacyModal(false);
      Alert.alert('Success', 'Privacy settings updated successfully');
    } else {
      Alert.alert('Error', 'Failed to update privacy settings');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Settings',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Basic Information Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Basic Information</Text>
            </View>

            <View style={styles.settingsList}>
              <View style={styles.profilePhotoSection}>
                <TouchableOpacity onPress={handleProfilePhotoChange}>
                  {currentUser.profilePicture ? (
                    <Image
                      source={{ uri: currentUser.profilePicture }}
                      style={styles.profilePhoto}
                    />
                  ) : (
                    <View style={styles.profilePhotoPlaceholder}>
                      <Camera size={24} color={colors.text.tertiary} />
                    </View>
                  )}
                  <View style={styles.profilePhotoEditBadge}>
                    <Camera size={16} color={colors.text.white} />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.profileEditSection}>
                <View style={styles.editRow}>
                  <Text style={styles.editLabel}>Full Name</Text>
                  <TextInput
                    style={[styles.editInput, !editMode && styles.editInputDisabled]}
                    value={fullName}
                    onChangeText={setFullName}
                    editable={editMode}
                    placeholder="Enter your full name"
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>
                <View style={styles.editRow}>
                  <Text style={styles.editLabel}>Phone Number</Text>
                  <TextInput
                    style={[styles.editInput, !editMode && styles.editInputDisabled]}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    editable={editMode}
                    placeholder="Enter your phone number"
                    placeholderTextColor={colors.text.tertiary}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.editRow}>
                  <Text style={styles.editLabel}>Email Address</Text>
                  <TextInput
                    style={[styles.editInput, styles.editInputDisabled]}
                    value={email}
                    editable={false}
                    placeholderTextColor={colors.text.tertiary}
                  />
                  <Text style={styles.editHint}>Email cannot be changed</Text>
                </View>
                <View style={styles.editRow}>
                  <Text style={styles.editLabel}>Gender (Optional)</Text>
                  <TextInput
                    style={[styles.editInput, !editMode && styles.editInputDisabled]}
                    value={gender}
                    onChangeText={setGender}
                    editable={editMode}
                    placeholder="Male, Female, Other"
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>
                <View style={styles.editRow}>
                  <Text style={styles.editLabel}>Date of Birth (Optional)</Text>
                  <View style={styles.dateInputContainer}>
                    <TextInput
                      style={[styles.editInput, styles.dateInput, !editMode && styles.editInputDisabled]}
                      value={dateOfBirth}
                      onChangeText={setDateOfBirth}
                      editable={editMode}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.text.tertiary}
                    />
                    {editMode && (
                      <TouchableOpacity
                        style={styles.calendarButton}
                        onPress={() => {
                          // Initialize date picker with existing value if available
                          let initialDate = new Date();
                          if (dateOfBirth) {
                            const parsedDate = new Date(dateOfBirth);
                            if (!isNaN(parsedDate.getTime())) {
                              initialDate = parsedDate;
                            }
                          } else {
                            initialDate = new Date(2000, 0, 1);
                          }
                          setSelectedDate(initialDate);
                          setShowDatePicker(true);
                        }}
                      >
                        <Calendar size={18} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {editMode && (
                    <Text style={styles.dateHelperText}>
                      Type the date (YYYY-MM-DD) or use the calendar icon
                    </Text>
                  )}
                </View>
                {editMode ? (
                  <View style={styles.editButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setEditMode(false);
                        setFullName(currentUser?.fullName || '');
                        setPhoneNumber(currentUser?.phoneNumber || '');
                        setGender('');
                        setDateOfBirth('');
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={handleSaveProfile}
                    >
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => setEditMode(true)}
                  >
                    <Text style={styles.editButtonText}>Edit Profile</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Verification Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Shield size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Verification Status</Text>
            </View>

            <View style={styles.settingsList}>
              <TouchableOpacity
                style={styles.verificationItem}
                onPress={() => !getVerificationStatus('phone') && handleReVerify('phone')}
              >
                <View style={styles.verificationLeft}>
                  <Phone size={20} color={colors.text.secondary} />
                  <View style={styles.verificationInfo}>
                    <Text style={styles.verificationLabel}>Phone Verification</Text>
                    <Text style={styles.verificationStatus}>
                      {getVerificationStatus('phone') ? 'Verified' : 'Not Verified'}
                    </Text>
                  </View>
                </View>
                {getVerificationStatus('phone') ? (
                  <CheckCircle2 size={24} color={colors.secondary} />
                ) : (
                  <XCircle size={24} color={colors.text.tertiary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.verificationItem}
                onPress={() => !getVerificationStatus('email') && handleReVerify('email')}
              >
                <View style={styles.verificationLeft}>
                  <Mail size={20} color={colors.text.secondary} />
                  <View style={styles.verificationInfo}>
                    <Text style={styles.verificationLabel}>Email Verification</Text>
                    <Text style={styles.verificationStatus}>
                      {getVerificationStatus('email') ? 'Verified' : 'Not Verified'}
                    </Text>
                  </View>
                </View>
                {getVerificationStatus('email') ? (
                  <CheckCircle2 size={24} color={colors.secondary} />
                ) : (
                  <XCircle size={24} color={colors.text.tertiary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.verificationItem}
                onPress={() => !getVerificationStatus('id') && handleReVerify('id')}
              >
                <View style={styles.verificationLeft}>
                  <IdCard size={20} color={colors.text.secondary} />
                  <View style={styles.verificationInfo}>
                    <Text style={styles.verificationLabel}>Government ID Verification</Text>
                    <Text style={styles.verificationStatus}>
                      {getVerificationStatus('id') ? 'Verified' : 'Not Verified'}
                    </Text>
                  </View>
                </View>
                {getVerificationStatus('id') ? (
                  <CheckCircle2 size={24} color={colors.secondary} />
                ) : (
                  <XCircle size={24} color={colors.text.tertiary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.verificationItem}
                onPress={() => {
                  if (relationship) {
                    router.push('/verification/couple-selfie' as any);
                  } else {
                    Alert.alert(
                      'No Relationship',
                      'You need to register a relationship before you can verify it. Would you like to register one now?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Register', 
                          onPress: () => router.push('/relationship/register' as any)
                        }
                      ]
                    );
                  }
                }}
              >
                <View style={styles.verificationLeft}>
                  <Heart size={20} color={colors.text.secondary} />
                  <View style={styles.verificationInfo}>
                    <Text style={styles.verificationLabel}>Relationship Verification</Text>
                    <Text style={styles.verificationStatus}>
                      {getRelationshipVerificationStatus() ? 'Verified' : relationship ? 'Pending' : 'None'}
                    </Text>
                  </View>
                </View>
                {getRelationshipVerificationStatus() ? (
                  <CheckCircle2 size={24} color={colors.secondary} />
                ) : (
                  <XCircle size={24} color={colors.text.tertiary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.reverifyButton}
                onPress={() => router.push('/verification' as any)}
              >
                <Shield size={18} color={colors.primary} />
                <Text style={styles.reverifyButtonText}>Re-verify Identity</Text>
                <ChevronRight size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Status & Privacy */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Globe size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Status & Privacy</Text>
            </View>

            <View style={styles.settingsList}>
              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => setShowStatusModal(true)}
              >
                <View style={styles.settingLeft}>
                  <View style={styles.statusIndicatorContainer}>
                    <StatusIndicator status={currentStatus} size="small" />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Current Status</Text>
                    <StatusBadge status={currentStatus} customStatusText={customStatusText} />
                  </View>
                </View>
                <ChevronRight size={20} color={colors.text.tertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => setShowStatusPrivacyModal(true)}
              >
                <View style={styles.settingLeft}>
                  <Eye size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>Status Privacy</Text>
                </View>
                <View style={styles.settingRight}>
                  <Text style={styles.settingValue}>
                    {statusVisibility === 'everyone' ? 'Everyone' : statusVisibility === 'contacts' ? 'Contacts' : 'Nobody'}
                  </Text>
                  <ChevronRight size={20} color={colors.text.tertiary} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Relationship Settings */}
          {relationship && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Heart size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Relationship Settings</Text>
              </View>

              <View style={styles.settingsList}>
                <View style={styles.settingItem}>
                  <View style={styles.settingLeft}>
                    <Heart size={20} color={colors.text.secondary} />
                    <Text style={styles.settingLabel}>Relationship Status</Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={[
                      styles.statusBadgeText,
                      relationship.status === 'verified' && styles.statusBadgeTextVerified
                    ]}>
                      {relationship.status === 'verified' ? 'Verified' : relationship.status === 'pending' ? 'Pending' : 'Ended'}
                    </Text>
                  </View>
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingLeft}>
                    <User size={20} color={colors.text.secondary} />
                    <Text style={styles.settingLabel}>Partner Name</Text>
                  </View>
                  <Text style={styles.settingValue}>{relationship.partnerName}</Text>
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingLeft}>
                    <Phone size={20} color={colors.text.secondary} />
                    <Text style={styles.settingLabel}>Partner Phone</Text>
                  </View>
                  <Text style={styles.settingValue}>{relationship.partnerPhone}</Text>
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingLeft}>
                    <Calendar size={20} color={colors.text.secondary} />
                    <Text style={styles.settingLabel}>Anniversary Date</Text>
                  </View>
                  <Text style={styles.settingValue}>
                    {new Date(relationship.startDate).toLocaleDateString()}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={handleChangePrivacyLevel}
                >
                  <View style={styles.settingLeft}>
                    <Eye size={20} color={colors.text.secondary} />
                    <Text style={styles.settingLabel}>Who Can See My Relationship?</Text>
                  </View>
                  <View style={styles.settingRight}>
                    <Text style={styles.settingValue}>
                      {getPrivacyLevelLabel()}
                    </Text>
                    <ChevronRight size={20} color={colors.text.tertiary} />
                  </View>
                </TouchableOpacity>

                {relationship.status === 'verified' && (
                  <TouchableOpacity
                    style={styles.settingItem}
                    onPress={handleDownloadCertificate}
                  >
                    <View style={styles.settingLeft}>
                      <Download size={20} color={colors.text.secondary} />
                      <Text style={styles.settingLabel}>Download Certificate</Text>
                    </View>
                    <ChevronRight size={20} color={colors.text.tertiary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Privacy & Security */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Lock size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Privacy & Security</Text>
            </View>

            <View style={styles.settingsList}>
              <TouchableOpacity
                style={styles.settingItem}
                onPress={handleChangePassword}
              >
                <View style={styles.settingLeft}>
                  <Key size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>Change Password</Text>
                </View>
                <ChevronRight size={20} color={colors.text.tertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => router.push('/settings/2fa' as any)}
              >
                <View style={styles.settingLeft}>
                  <Shield size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
                </View>
                <View style={styles.settingRight}>
                  <Text style={styles.settingValue}>
                    {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                  <ChevronRight size={20} color={colors.text.tertiary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => router.push('/settings/sessions' as any)}
              >
                <View style={styles.settingLeft}>
                  <Smartphone size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>Active Sessions</Text>
                </View>
                <View style={styles.settingRight}>
                  <Text style={styles.settingValue}>{sessions.length} device(s)</Text>
                  <ChevronRight size={20} color={colors.text.tertiary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => router.push('/settings/blocked-users' as any)}
              >
                <View style={styles.settingLeft}>
                  <Users size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>Blocked Users</Text>
                </View>
                <View style={styles.settingRight}>
                  <Text style={styles.settingValue}>{blockedUsers.length} blocked</Text>
                  <ChevronRight size={20} color={colors.text.tertiary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => router.push('/settings/become-professional' as any)}
              >
                <View style={styles.settingLeft}>
                  <Briefcase size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>Become a Professional</Text>
                </View>
                <View style={styles.settingRight}>
                  <ChevronRight size={20} color={colors.text.tertiary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingItem}
                onPress={handleChangePrivacyLevel}
              >
                <View style={styles.settingLeft}>
                  <Eye size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>Profile Visibility</Text>
                </View>
                <View style={styles.settingRight}>
                  <Text style={styles.settingValue}>
                    {getPrivacyLevelLabel()}
                  </Text>
                  <ChevronRight size={20} color={colors.text.tertiary} />
                </View>
              </TouchableOpacity>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Eye size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>Search Visibility</Text>
                </View>
                <Switch
                  value={privacy.searchVisibility}
                  onValueChange={() => handleTogglePrivacy('searchVisibility')}
                  trackColor={{
                    false: colors.border.light,
                    true: colors.primary + '50',
                  }}
                  thumbColor={privacy.searchVisibility ? colors.primary : colors.text.tertiary}
                />
              </View>
            </View>
          </View>

          {/* Notifications */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Bell size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t('notifications')}</Text>
            </View>

            <View style={styles.settingsList}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Bell size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>Notification Sound</Text>
                </View>
                <Switch
                  value={notifications.soundEnabled}
                  onValueChange={() => handleToggleNotification('soundEnabled')}
                  trackColor={{
                    false: colors.border.light,
                    true: colors.primary + '50',
                  }}
                  thumbColor={notifications.soundEnabled ? colors.primary : colors.text.tertiary}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Heart size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>{t('relationshipUpdates')}</Text>
                </View>
                <Switch
                  value={notifications.relationshipUpdates}
                  onValueChange={() => handleToggleNotification('relationshipUpdates')}
                  trackColor={{
                    false: colors.border.light,
                    true: colors.primary + '50',
                  }}
                  thumbColor={notifications.relationshipUpdates ? colors.primary : colors.text.tertiary}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <AlertTriangle size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>{t('cheatingAlerts')}</Text>
                </View>
                <Switch
                  value={notifications.cheatingAlerts}
                  onValueChange={() => handleToggleNotification('cheatingAlerts')}
                  trackColor={{
                    false: colors.border.light,
                    true: colors.primary + '50',
                  }}
                  thumbColor={notifications.cheatingAlerts ? colors.primary : colors.text.tertiary}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Shield size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>{t('verificationAttempts')}</Text>
                </View>
                <Switch
                  value={notifications.verificationAttempts}
                  onValueChange={() => handleToggleNotification('verificationAttempts')}
                  trackColor={{
                    false: colors.border.light,
                    true: colors.primary + '50',
                  }}
                  thumbColor={notifications.verificationAttempts ? colors.primary : colors.text.tertiary}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Calendar size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>{t('anniversaryReminders')}</Text>
                </View>
                <Switch
                  value={notifications.anniversaryReminders}
                  onValueChange={() => handleToggleNotification('anniversaryReminders')}
                  trackColor={{
                    false: colors.border.light,
                    true: colors.primary + '50',
                  }}
                  thumbColor={notifications.anniversaryReminders ? colors.primary : colors.text.tertiary}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Bell size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>{t('marketingPromotions')}</Text>
                </View>
                <Switch
                  value={notifications.marketingPromotions}
                  onValueChange={() => handleToggleNotification('marketingPromotions')}
                  trackColor={{
                    false: colors.border.light,
                    true: colors.primary + '50',
                  }}
                  thumbColor={notifications.marketingPromotions ? colors.primary : colors.text.tertiary}
                />
              </View>
            </View>
          </View>

          {/* App Preferences */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Settings size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t('settings')}</Text>
            </View>

            <View style={styles.settingsList}>
              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Moon size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>Dark Mode</Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={async (value) => {
                    const newMode = value ? 'dark' : 'light';
                    setThemeMode(newMode);
                    if (currentUser) {
                      await saveThemePreference(currentUser.id, newMode);
                    }
                  }}
                  trackColor={{
                    false: colors.border.light,
                    true: colors.primary + '50',
                  }}
                  thumbColor={isDark ? colors.primary : colors.text.tertiary}
                />
              </View>

              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => {
                  Alert.alert(
                    t('selectLanguage'),
                    '',
                    [
                      { text: t('english'), onPress: async () => {
                        if (currentUser) {
                          await saveLanguagePreference(currentUser.id, 'en');
                        }
                      }},
                      { text: t('spanish'), onPress: async () => {
                        if (currentUser) {
                          await saveLanguagePreference(currentUser.id, 'es');
                        }
                      }},
                      { text: t('french'), onPress: async () => {
                        if (currentUser) {
                          await saveLanguagePreference(currentUser.id, 'fr');
                        }
                      }},
                      { text: t('cancel'), style: 'cancel' },
                    ]
                  );
                }}
              >
                <View style={styles.settingLeft}>
                  <Globe size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>{t('language')}</Text>
                </View>
                <View style={styles.settingRight}>
                  <Text style={styles.settingValue}>
                    {language === 'en' ? t('english') : language === 'es' ? t('spanish') : t('french')}
                  </Text>
                  <ChevronRight size={20} color={colors.text.tertiary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingItem}
                onPress={() => {
                  Alert.alert(
                    t('selectTheme'),
                    '',
                    [
                      { text: t('default'), onPress: async () => {
                        if (currentUser) {
                          await saveVisualTheme(currentUser.id, 'default');
                        }
                      }},
                      { text: t('colorful'), onPress: async () => {
                        if (currentUser) {
                          await saveVisualTheme(currentUser.id, 'colorful');
                        }
                      }},
                      { text: t('minimal'), onPress: async () => {
                        if (currentUser) {
                          await saveVisualTheme(currentUser.id, 'minimal');
                        }
                      }},
                      { text: t('cancel'), style: 'cancel' },
                    ]
                  );
                }}
              >
                <View style={styles.settingLeft}>
                  <Settings size={20} color={colors.text.secondary} />
                  <Text style={styles.settingLabel}>{t('theme')}</Text>
                </View>
                <View style={styles.settingRight}>
                  <Text style={styles.settingValue}>
                    {visualTheme === 'default' ? t('default') : visualTheme === 'colorful' ? t('colorful') : t('minimal')}
                  </Text>
                  <ChevronRight size={20} color={colors.text.tertiary} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Legal & Policies */}
          {legalDocuments.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <FileText size={20} color={colors.primary} />
                </View>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>Legal & Policies</Text>
                  <Text style={styles.sectionSubtitle}>
                    Review our terms, policies, and guidelines
                  </Text>
                </View>
              </View>

              <View style={styles.settingsList}>
                {legalDocuments.map((doc, index) => (
                  <TouchableOpacity
                    key={doc.id}
                    style={[
                      styles.legalDocumentItem,
                      index === 0 && styles.legalDocumentItemFirst,
                      index === legalDocuments.length - 1 && styles.legalDocumentItemLast,
                    ]}
                    onPress={() => router.push(`/legal/${doc.slug}` as any)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.legalDocumentLeft}>
                      <View style={styles.legalDocumentIconContainer}>
                        <FileText size={18} color={colors.primary} />
                      </View>
                      <View style={styles.legalDocumentInfo}>
                        <Text style={styles.legalDocumentTitle}>{doc.title}</Text>
                        <View style={styles.legalDocumentMeta}>
                          <Text style={styles.legalDocumentVersion}>v{doc.version}</Text>
                          {doc.isRequired && (
                            <View style={styles.legalDocumentRequiredBadge}>
                              <Text style={styles.legalDocumentRequiredText}>Required</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    <ChevronRight size={20} color={colors.text.tertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Delete Account */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.dangerCard}
              onPress={handleDeleteAccount}
            >
              <Trash2 size={24} color={colors.danger} />
              <View style={styles.dangerContent}>
                <Text style={styles.dangerTitle}>Delete Account</Text>
                <Text style={styles.dangerText}>
                  Permanently delete your account and all associated data. This action cannot be undone.
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {relationship && relationship.status === 'verified' && (
            <View style={styles.section}>
              <View style={styles.dangerCard}>
                <AlertTriangle size={24} color={colors.danger} />
                <View style={styles.dangerContent}>
                  <Text style={styles.dangerTitle}>End Relationship</Text>
                  <Text style={styles.dangerText}>
                    This will send a request to your partner. The relationship
                    will end once they confirm or after 7 days.
                  </Text>
                  <TouchableOpacity
                    style={styles.dangerButton}
                    onPress={async () => {
                      Alert.alert(
                        'End Relationship',
                        `Are you sure you want to end your relationship with ${relationship.partnerName}?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'End Relationship',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await endRelationship(relationship.id, 'User requested to end relationship');
                                Alert.alert('Request Sent', 'Your partner will receive a request to confirm ending the relationship.');
                              } catch (error) {
                                Alert.alert('Error', 'Failed to send end relationship request');
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.dangerButtonText}>End Relationship</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <View style={styles.infoCard}>
            <Shield size={18} color={colors.primary} />
            <Text style={styles.infoText}>
              Your privacy settings control who can see your profile and
              relationship status. Keep your account secure by enabling two-factor authentication.
            </Text>
          </View>
        </ScrollView>

        {/* Date Picker Modal */}
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerCard}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Select Date of Birth</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={styles.datePickerCloseButton}
                >
                  <X size={24} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedDate || new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  if (date && event.type !== 'dismissed') {
                    const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
                    setDateOfBirth(formattedDate);
                    setSelectedDate(date);
                    if (Platform.OS === 'android') {
                      setShowDatePicker(false);
                    }
                  }
                  if (Platform.OS === 'ios' && event.type === 'dismissed') {
                    setShowDatePicker(false);
                  }
                }}
                maximumDate={new Date()}
              />
              {Platform.OS === 'ios' && (
                <View style={styles.datePickerActions}>
                  <TouchableOpacity
                    style={styles.datePickerCancelButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.datePickerCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.datePickerConfirmButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.datePickerConfirmText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Password Change Modal */}
        <Modal
          visible={showPasswordModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setShowPasswordModal(false);
            setNewPassword('');
            setConfirmPassword('');
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.passwordModalContent}>
              <View style={styles.passwordModalHeader}>
                <Text style={styles.passwordModalTitle}>Change Password</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowPasswordModal(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  <X size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.passwordModalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.passwordInputGroup}>
                  <Text style={styles.passwordLabel}>New Password</Text>
                  <TextInput
                    style={styles.passwordInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password (min 6 characters)"
                    placeholderTextColor={colors.text.tertiary}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.passwordInputGroup}>
                  <Text style={styles.passwordLabel}>Confirm New Password</Text>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.text.tertiary}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </ScrollView>

              <View style={styles.passwordModalFooter}>
                <TouchableOpacity
                  style={styles.passwordCancelButton}
                  onPress={() => {
                    setShowPasswordModal(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  <Text style={styles.passwordCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.passwordSaveButton, isChangingPassword && styles.passwordSaveButtonDisabled]}
                  onPress={handleSavePassword}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <ActivityIndicator color={colors.text.white} size="small" />
                  ) : (
                    <Text style={styles.passwordSaveText}>Change Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Status Selection Modal */}
        <Modal
          visible={showStatusModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowStatusModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.statusModalContent}>
              <View style={styles.statusModalHeader}>
                <Text style={styles.statusModalTitle}>Set Your Status</Text>
                <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                  <X size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.statusModalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.statusOptions}>
                  {(['online', 'away', 'busy', 'offline'] as UserStatusType[]).map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusOption,
                        currentStatus === status && styles.statusOptionSelected,
                      ]}
                      onPress={() => handleStatusChange(status)}
                    >
                      <View style={styles.statusOptionLeft}>
                        <StatusIndicator status={status} size="medium" />
                        <Text style={[
                          styles.statusOptionText,
                          currentStatus === status && styles.statusOptionTextSelected,
                        ]}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Text>
                      </View>
                      {currentStatus === status && (
                        <CheckCircle2 size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.customStatusSection}>
                  <Text style={styles.customStatusLabel}>Custom Status (Optional)</Text>
                  <TextInput
                    style={styles.customStatusInput}
                    placeholder="e.g., At work, With family..."
                    placeholderTextColor={colors.text.tertiary}
                    value={customStatusText}
                    onChangeText={setCustomStatusText}
                    maxLength={50}
                  />
                  <TouchableOpacity
                    style={styles.saveCustomStatusButton}
                    onPress={handleSaveCustomStatus}
                  >
                    <Text style={styles.saveCustomStatusButtonText}>Save Custom Status</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Status Privacy Modal */}
        <Modal
          visible={showStatusPrivacyModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowStatusPrivacyModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.statusModalContent}>
              <View style={styles.statusModalHeader}>
                <Text style={styles.statusModalTitle}>Status Privacy</Text>
                <TouchableOpacity onPress={() => setShowStatusPrivacyModal(false)}>
                  <X size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.statusModalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.privacySection}>
                  <Text style={styles.privacySectionTitle}>Who can see your status?</Text>
                  {(['everyone', 'contacts', 'nobody'] as StatusVisibility[]).map((visibility) => (
                    <TouchableOpacity
                      key={visibility}
                      style={[
                        styles.privacyOption,
                        statusVisibility === visibility && styles.privacyOptionSelected,
                      ]}
                      onPress={() => setStatusVisibility(visibility)}
                    >
                      <Text style={[
                        styles.privacyOptionText,
                        statusVisibility === visibility && styles.privacyOptionTextSelected,
                      ]}>
                        {visibility === 'everyone' ? 'Everyone' : visibility === 'contacts' ? 'Contacts Only' : 'Nobody'}
                      </Text>
                      {statusVisibility === visibility && (
                        <CheckCircle2 size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.privacySection}>
                  <Text style={styles.privacySectionTitle}>Who can see your last seen?</Text>
                  {(['everyone', 'contacts', 'nobody'] as StatusVisibility[]).map((visibility) => (
                    <TouchableOpacity
                      key={visibility}
                      style={[
                        styles.privacyOption,
                        lastSeenVisibility === visibility && styles.privacyOptionSelected,
                      ]}
                      onPress={() => setLastSeenVisibility(visibility)}
                    >
                      <Text style={[
                        styles.privacyOptionText,
                        lastSeenVisibility === visibility && styles.privacyOptionTextSelected,
                      ]}>
                        {visibility === 'everyone' ? 'Everyone' : visibility === 'contacts' ? 'Contacts Only' : 'Nobody'}
                      </Text>
                      {lastSeenVisibility === visibility && (
                        <CheckCircle2 size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.savePrivacyButton}
                  onPress={handleStatusPrivacyChange}
                >
                  <Text style={styles.savePrivacyButtonText}>Save Privacy Settings</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  settingsList: {
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500' as const,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    fontSize: 15,
    color: colors.text.secondary,
    fontWeight: '500' as const,
  },
  profilePhotoSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  profilePhotoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  profilePhotoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background.primary,
  },
  profileEditSection: {
    padding: 16,
    gap: 16,
  },
  editRow: {
    gap: 8,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  editInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  editInputDisabled: {
    backgroundColor: colors.background.primary,
    color: colors.text.secondary,
  },
  editHint: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  editButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  verificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  verificationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  verificationInfo: {
    flex: 1,
  },
  verificationLabel: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500' as const,
  },
  verificationStatus: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  reverifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.primary + '10',
  },
  reverifyButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  statusBadge: {
    backgroundColor: colors.badge.pending,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.badge.pendingText,
  },
  statusBadgeTextVerified: {
    backgroundColor: colors.badge.verified,
    color: colors.badge.verifiedText,
  },
  dangerCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    gap: 16,
    borderWidth: 2,
    borderColor: colors.danger + '30',
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
  },
  dangerCardDisabled: {
    opacity: 0.6,
    shadowRadius: 8,
    elevation: 3,
  },
  dangerContent: {
    flex: 1,
  },
  dangerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.danger,
    marginBottom: 8,
  },
  dangerText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  dangerButton: {
    backgroundColor: colors.danger,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: 'flex-start',
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.primary + '10',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    flex: 1,
  },
  calendarButton: {
    padding: 8,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dateHelperText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  datePickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  datePickerCloseButton: {
    padding: 4,
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  datePickerCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  datePickerCancelText: {
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '600' as const,
  },
  datePickerConfirmButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  datePickerConfirmText: {
    fontSize: 16,
    color: colors.text.white,
    fontWeight: '600' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  passwordModalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  passwordModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  passwordModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  passwordModalBody: {
    padding: 20,
    maxHeight: 400,
  },
  passwordInputGroup: {
    marginBottom: 20,
  },
  passwordLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  passwordInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  passwordModalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  passwordCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  passwordCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  passwordSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  passwordSaveButtonDisabled: {
    opacity: 0.6,
  },
  passwordSaveText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: 18,
  },
  legalDocumentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  legalDocumentItemFirst: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  legalDocumentItemLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  legalDocumentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  legalDocumentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalDocumentInfo: {
    flex: 1,
  },
  legalDocumentTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  legalDocumentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legalDocumentVersion: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontWeight: '500' as const,
  },
  legalDocumentRequiredBadge: {
    backgroundColor: colors.danger + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  legalDocumentRequiredText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Status styles
  statusIndicatorContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  statusModalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    width: '100%',
  },
  statusModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  statusModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  statusModalBody: {
    padding: 20,
  },
  statusOptions: {
    gap: 12,
    marginBottom: 24,
  },
  statusOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  statusOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  statusOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusOptionText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: colors.text.primary,
  },
  statusOptionTextSelected: {
    fontWeight: '700' as const,
    color: colors.primary,
  },
  customStatusSection: {
    marginTop: 8,
  },
  customStatusLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  customStatusInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: 12,
  },
  saveCustomStatusButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  saveCustomStatusButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  privacySection: {
    marginBottom: 24,
  },
  privacySectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 12,
  },
  privacyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  privacyOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  privacyOptionText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: colors.text.primary,
  },
  privacyOptionTextSelected: {
    fontWeight: '700' as const,
    color: colors.primary,
  },
  savePrivacyButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  savePrivacyButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
});
