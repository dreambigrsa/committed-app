import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  FlatList,
  Alert,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Heart, X, Search, CheckCircle2, Camera, Upload, Calendar } from 'lucide-react-native';
import { Image } from 'expo-image';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '@/contexts/AppContext';
import colors from '@/constants/colors';
import { RelationshipType, LegalDocument } from '@/types';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import LegalAcceptanceCheckbox from '@/components/LegalAcceptanceCheckbox';

const RELATIONSHIP_TYPES: { value: RelationshipType; label: string }[] = [
  { value: 'married', label: 'Married' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'serious', label: 'Serious Relationship' },
  { value: 'dating', label: 'Dating' },
];

export default function RegisterRelationshipScreen() {
  const router = useRouter();
  const { createRelationship, searchUsers, currentUser } = useApp();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [step, setStep] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step]);
  
  const [formData, setFormData] = useState({
    partnerName: '',
    partnerPhone: '',
    partnerUserId: '',
    type: 'serious' as RelationshipType,
    partnerFacePhoto: '',
    partnerDateOfBirthDay: '',
    partnerDateOfBirthMonth: '',
    partnerDateOfBirthYear: '',
    partnerCity: '',
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [relationshipConsentAccepted, setRelationshipConsentAccepted] = useState(false);
  const [relationshipConsentDoc, setRelationshipConsentDoc] = useState<LegalDocument | null>(null);

  useEffect(() => {
    loadRelationshipConsentDocument();
  }, []);

  const loadRelationshipConsentDocument = async () => {
    try {
      // Look for a document with 'relationship' in display_location
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('is_active', true)
        .contains('display_location', ['relationship'])
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to load relationship consent document:', error);
        return;
      }

      if (data) {
        setRelationshipConsentDoc({
          id: data.id,
          title: data.title,
          slug: data.slug,
          content: data.content,
          version: data.version,
          isActive: data.is_active,
          isRequired: data.is_required,
          displayLocation: data.display_location || [],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          createdBy: data.created_by,
          lastUpdatedBy: data.last_updated_by,
        });
      }
    } catch (error) {
      console.error('Error loading relationship consent document:', error);
    }
  };

  const handleViewConsentDocument = (document: LegalDocument) => {
    router.push(`/legal/${document.slug}` as any);
  };

  const saveRelationshipConsent = async (userId: string) => {
    if (!relationshipConsentDoc || !relationshipConsentAccepted) return;

    try {
      const { error } = await supabase
        .from('user_legal_acceptances')
        .insert({
          user_id: userId,
          document_id: relationshipConsentDoc.id,
          document_version: relationshipConsentDoc.version,
          context: 'relationship_registration',
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save relationship consent:', error);
    }
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setTimeout(async () => {
      const results = await searchUsers(text);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
  };

  const handleSelectUser = (user: any) => {
    setSelectedUser(user);
    setFormData({
      ...formData,
      partnerName: user.fullName,
      partnerPhone: user.phoneNumber || '',
      partnerUserId: user.id || undefined, // May be undefined for non-registered users
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleNext = () => {
    if (step === 1 && !formData.partnerName && !selectedUser) {
      alert('Please search and select a partner or enter partner\'s name');
      return;
    }
    if (step === 2 && !formData.partnerPhone && !selectedUser) {
      alert('Please enter partner\'s phone number');
      return;
    }
    if (step === 3 && !formData.partnerFacePhoto) {
      alert('Please upload a clear face photo of your partner');
      return;
    }
    if (step < 4) {
      setStep(step + 1);
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      router.back();
    }
  };

  const handlePickFacePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload a photo');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingPhoto(true);
        const fileExt = result.assets[0].uri.split('.').pop() || 'jpg';
        const fileName = `partner-face-${Date.now()}.${fileExt}`;
        const filePath = `partner-photos/${fileName}`;

        // Convert URI to Uint8Array using legacy API (no deprecation warnings)
        const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(filePath, bytes, {
            contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        setFormData({ ...formData, partnerFacePhoto: publicUrl });
        setUploadingPhoto(false);
      }
    } catch (error) {
      console.error('Failed to upload photo:', error);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
      setUploadingPhoto(false);
    }
  };

  const handleRegister = async () => {
    if (!formData.partnerFacePhoto) {
      alert('Please upload a clear face photo of your partner');
      return;
    }

    // Check relationship consent if document exists
    if (relationshipConsentDoc && relationshipConsentDoc.isRequired && !relationshipConsentAccepted) {
      alert('Please confirm that you have your partner\'s consent and understand this information may become publicly visible once verified.');
      return;
    }

    setIsLoading(true);
    try {
      // Use selected user's ID if available, otherwise use form data
      const partnerUserId = selectedUser?.id || formData.partnerUserId || undefined;
      
      const partnerDateOfBirthMonth = formData.partnerDateOfBirthMonth 
        ? parseInt(formData.partnerDateOfBirthMonth, 10) 
        : undefined;
      const partnerDateOfBirthYear = formData.partnerDateOfBirthYear 
        ? parseInt(formData.partnerDateOfBirthYear, 10) 
        : undefined;

      const relationship = await createRelationship(
        formData.partnerName,
        formData.partnerPhone,
        formData.type,
        partnerUserId,
        formData.partnerFacePhoto,
        partnerDateOfBirthMonth,
        partnerDateOfBirthYear,
        formData.partnerCity || undefined
      );

      // Save relationship consent acceptance
      if (currentUser?.id && relationshipConsentAccepted && relationshipConsentDoc) {
        await saveRelationshipConsent(currentUser.id);
      }
      
      router.back();
    } catch (error) {
      console.error('Failed to register relationship:', error);
      alert('Failed to register relationship. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Register Relationship',
          presentation: 'modal',
          headerLeft: () => (
            <TouchableOpacity onPress={handleBack}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
              </View>
              <Text style={styles.stepText}>Step {step} of 4</Text>
            </View>
            <View style={styles.iconContainer}>
              <Heart size={40} color={colors.danger} fill={colors.danger} />
            </View>
            <Text style={styles.title}>Register Your Relationship</Text>
            <Text style={styles.subtitle}>
              {step === 1 && "Let's start with your partner's information"}
              {step === 2 && "How can we reach your partner?"}
              {step === 3 && "Upload a clear face photo of your partner"}
              {step === 4 && "What type of relationship is this?"}
            </Text>
          </View>

          <Animated.View 
            style={[
              styles.form,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {step === 1 && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Search Partner by Username, Name, or Phone</Text>
                <View style={styles.searchContainer}>
                  <Search size={20} color={colors.text.tertiary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by username, name, or phone..."
                    placeholderTextColor={colors.text.tertiary}
                    value={searchQuery}
                    onChangeText={handleSearch}
                    autoCapitalize="none"
                    autoFocus
                  />
                </View>

                {isSearching && (
                  <View style={styles.searchLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                )}

                {searchResults.length > 0 && (
                  <View style={styles.searchResults}>
                    <FlatList
                      data={searchResults}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.searchResultItem}
                          onPress={() => handleSelectUser(item)}
                        >
                          {item.profilePicture ? (
                            <Image source={{ uri: item.profilePicture }} style={styles.resultAvatar} />
                          ) : (
                            <View style={styles.resultAvatarPlaceholder}>
                              <Text style={styles.resultAvatarText}>{item.fullName.charAt(0)}</Text>
                            </View>
                          )}
                          <View style={styles.resultInfo}>
                            <View style={styles.resultNameRow}>
                              <Text style={styles.resultName}>{item.fullName}</Text>
                              {item.username && (
                                <Text style={styles.resultUsername}>@{item.username}</Text>
                              )}
                              {!item.isRegisteredUser && (
                                <View style={styles.nonRegisteredBadge}>
                                  <Text style={styles.nonRegisteredText}>Not Registered</Text>
                                </View>
                              )}
                              {item.verifications?.phone && (
                                <CheckCircle2 size={16} color={colors.secondary} />
                              )}
                            </View>
                            {item.phoneNumber && (
                              <Text style={styles.resultPhone}>{item.phoneNumber}</Text>
                            )}
                            {!item.isRegisteredUser && item.relationshipType && (
                              <Text style={styles.resultRelationship}>
                                Partner in {item.relationshipType} relationship
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      )}
                      style={styles.searchResultsList}
                    />
                  </View>
                )}

                {selectedUser && (
                  <View style={styles.selectedUserCard}>
                    <View style={styles.selectedUserInfo}>
                      {selectedUser.profilePicture ? (
                        <Image source={{ uri: selectedUser.profilePicture }} style={styles.selectedAvatar} />
                      ) : (
                        <View style={styles.selectedAvatarPlaceholder}>
                          <Text style={styles.selectedAvatarText}>{selectedUser.fullName.charAt(0)}</Text>
                        </View>
                      )}
                      <View>
                        <View style={styles.selectedNameRow}>
                          <Text style={styles.selectedName}>{selectedUser.fullName}</Text>
                          {selectedUser.username && (
                            <Text style={styles.selectedUsername}>@{selectedUser.username}</Text>
                          )}
                        </View>
                        <Text style={styles.selectedPhone}>{selectedUser.phoneNumber}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.clearSelection}
                      onPress={() => {
                        setSelectedUser(null);
                        setFormData({ ...formData, partnerName: '', partnerPhone: '', partnerUserId: '' });
                      }}
                    >
                      <X size={20} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                )}

                {!selectedUser && (
                  <>
                    <Text style={styles.orLabel}>OR</Text>
                    <Text style={styles.label}>Enter Partner&apos;s Full Name Manually</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter partner's name"
                      placeholderTextColor={colors.text.tertiary}
                      value={formData.partnerName}
                      onChangeText={(text) =>
                        setFormData({ ...formData, partnerName: text })
                      }
                      autoCapitalize="words"
                    />
                  </>
                )}
              </View>
            )}

            {step === 2 && !selectedUser && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Partner&apos;s Phone Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.partnerPhone}
                  onChangeText={(text) =>
                    setFormData({ ...formData, partnerPhone: text })
                  }
                  keyboardType="phone-pad"
                  autoFocus
                />
              </View>
            )}

            {step === 3 && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Partner&apos;s Clear Face Photo *</Text>
                <Text style={styles.helperText}>
                  Required: Upload a clear, front-facing photo of your partner for verification
                </Text>
                
                {formData.partnerFacePhoto ? (
                  <View style={styles.photoPreview}>
                    <Image 
                      source={{ uri: formData.partnerFacePhoto }} 
                      style={styles.photoPreviewImage}
                    />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => setFormData({ ...formData, partnerFacePhoto: '' })}
                    >
                      <X size={20} color={colors.text.white} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.photoUploadButton}
                    onPress={handlePickFacePhoto}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Camera size={32} color={colors.primary} />
                        <Text style={styles.photoUploadText}>Upload Face Photo</Text>
                        <Text style={styles.photoUploadHint}>Tap to select from gallery</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Optional Fields */}
                <View style={styles.optionalSection}>
                  <Text style={styles.optionalSectionTitle}>Optional Information</Text>
                  
                  <View style={styles.dateOfBirthSection}>
                    <Text style={styles.label}>Date of Birth (Optional)</Text>
                    <View style={styles.dateOfBirthRow}>
                      <View style={styles.dateInputGroup}>
                        <Text style={styles.dateInputLabel}>Day</Text>
                        <View style={styles.dateInputContainer}>
                          <TextInput
                            style={styles.dateInput}
                            placeholder="DD"
                            placeholderTextColor={colors.text.tertiary}
                            value={formData.partnerDateOfBirthDay}
                            onChangeText={(text) => {
                              const num = text.replace(/[^0-9]/g, '');
                              if (num === '' || (parseInt(num, 10) >= 1 && parseInt(num, 10) <= 31)) {
                                setFormData({ ...formData, partnerDateOfBirthDay: num });
                              }
                            }}
                            keyboardType="number-pad"
                            maxLength={2}
                            editable={true}
                          />
                        </View>
                      </View>
                      <View style={styles.dateInputGroup}>
                        <Text style={styles.dateInputLabel}>Month</Text>
                        <View style={styles.dateInputContainer}>
                          <TextInput
                            style={styles.dateInput}
                            placeholder="MM"
                            placeholderTextColor={colors.text.tertiary}
                            value={formData.partnerDateOfBirthMonth}
                            onChangeText={(text) => {
                              const num = text.replace(/[^0-9]/g, '');
                              if (num === '' || (parseInt(num, 10) >= 1 && parseInt(num, 10) <= 12)) {
                                setFormData({ ...formData, partnerDateOfBirthMonth: num });
                              }
                            }}
                            keyboardType="number-pad"
                            maxLength={2}
                            editable={true}
                          />
                        </View>
                      </View>
                      <View style={styles.dateInputGroup}>
                        <Text style={styles.dateInputLabel}>Year</Text>
                        <View style={styles.dateInputContainer}>
                          <TextInput
                            style={styles.dateInput}
                            placeholder="YYYY"
                            placeholderTextColor={colors.text.tertiary}
                            value={formData.partnerDateOfBirthYear}
                            onChangeText={(text) => {
                              const num = text.replace(/[^0-9]/g, '');
                              const currentYear = new Date().getFullYear();
                              if (num === '' || (parseInt(num, 10) >= 1900 && parseInt(num, 10) <= currentYear)) {
                                setFormData({ ...formData, partnerDateOfBirthYear: num });
                              }
                            }}
                            keyboardType="number-pad"
                            maxLength={4}
                            editable={true}
                          />
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.calendarButtonLarge}
                      onPress={() => {
                        // Initialize date picker with existing values if available
                        const existingDate = new Date();
                        if (formData.partnerDateOfBirthDay && formData.partnerDateOfBirthMonth && formData.partnerDateOfBirthYear) {
                          existingDate.setDate(parseInt(formData.partnerDateOfBirthDay, 10));
                          existingDate.setMonth(parseInt(formData.partnerDateOfBirthMonth, 10) - 1);
                          existingDate.setFullYear(parseInt(formData.partnerDateOfBirthYear, 10));
                        } else if (formData.partnerDateOfBirthMonth && formData.partnerDateOfBirthYear) {
                          existingDate.setMonth(parseInt(formData.partnerDateOfBirthMonth, 10) - 1);
                          existingDate.setFullYear(parseInt(formData.partnerDateOfBirthYear, 10));
                          existingDate.setDate(1);
                        } else {
                          existingDate.setFullYear(2000);
                          existingDate.setMonth(0);
                          existingDate.setDate(1);
                        }
                        setSelectedDate(existingDate);
                        setShowDatePicker(true);
                      }}
                    >
                      <Calendar size={20} color={colors.primary} />
                      <Text style={styles.calendarButtonText}>Use Calendar</Text>
                    </TouchableOpacity>
                    <Text style={styles.dateHelperText}>
                      Type the day, month, and year, or use the calendar to select a date
                    </Text>
                  </View>

                  <Text style={styles.label}>City/Location (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter city name"
                    placeholderTextColor={colors.text.tertiary}
                    value={formData.partnerCity}
                    onChangeText={(text) =>
                      setFormData({ ...formData, partnerCity: text })
                    }
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            {step === 4 && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Relationship Type</Text>
                <View style={styles.typeOptions}>
                  {RELATIONSHIP_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeOption,
                        formData.type === type.value && styles.typeOptionActive,
                      ]}
                      onPress={() =>
                        setFormData({ ...formData, type: type.value })
                      }
                    >
                      <Text
                        style={[
                          styles.typeOptionText,
                          formData.type === type.value &&
                            styles.typeOptionTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {step === 4 && (
              <>
                {relationshipConsentDoc && (
                  <View style={styles.consentSection}>
                    <LegalAcceptanceCheckbox
                      document={relationshipConsentDoc}
                      isAccepted={relationshipConsentAccepted}
                      onToggle={(_, accepted) => setRelationshipConsentAccepted(accepted)}
                      onViewDocument={handleViewConsentDocument}
                      required={relationshipConsentDoc.isRequired}
                    />
                    <Text style={styles.consentHelperText}>
                      I confirm that I have my partner's consent and understand this information may become publicly visible once verified.
                    </Text>
                  </View>
                )}
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    Your partner will receive a notification to confirm this relationship.
                    Once confirmed, your relationship status will be verified and publicly
                    visible.
                  </Text>
                </View>
              </>
            )}

            {step < 4 ? (
              <TouchableOpacity
                style={styles.button}
                onPress={handleNext}
              >
                <Text style={styles.buttonText}>Continue</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.text.white} />
                ) : (
                  <Text style={styles.buttonText}>Register Relationship</Text>
                )}
              </TouchableOpacity>
            )}
          </Animated.View>

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
                      const day = date.getDate().toString().padStart(2, '0');
                      const month = (date.getMonth() + 1).toString().padStart(2, '0');
                      const year = date.getFullYear().toString();
                      setFormData({ 
                        ...formData, 
                        partnerDateOfBirthDay: day,
                        partnerDateOfBirthMonth: month,
                        partnerDateOfBirthYear: year
                      });
                      setSelectedDate(date);
                      if (Platform.OS === 'android') {
                        setShowDatePicker(false);
                      }
                    }
                    if (Platform.OS === 'ios' && event.type === 'dismissed') {
                      setShowDatePicker(false);
                    }
                  }}
                  minimumDate={new Date(1900, 0, 1)}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 24,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: colors.border.light,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  stepText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 24,
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
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },
  searchLoading: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchResults: {
    maxHeight: 300,
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: 12,
  },
  searchResultsList: {
    maxHeight: 300,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  resultAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  resultInfo: {
    flex: 1,
  },
  resultNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  resultUsername: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  resultPhone: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  selectedUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.secondary + '20',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  selectedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  selectedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  selectedAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAvatarText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  selectedNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  selectedName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  selectedUsername: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  selectedPhone: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  clearSelection: {
    padding: 8,
  },
  nonRegisteredBadge: {
    backgroundColor: colors.accent + '30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  nonRegisteredText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: colors.accent,
  },
  resultRelationship: {
    fontSize: 12,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  orLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.secondary,
    textAlign: 'center',
    marginVertical: 16,
  },
  typeOptions: {
    gap: 12,
  },
  typeOption: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  typeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  typeOptionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  typeOptionTextActive: {
    color: colors.primary,
  },
  infoBox: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  infoText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  helperText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  photoUploadButton: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  photoUploadText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
    marginTop: 12,
  },
  photoUploadHint: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  photoPreview: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.danger,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  optionalSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  optionalSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 16,
  },
  dateOfBirthSection: {
    marginBottom: 16,
  },
  dateOfBirthRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  dateInputGroup: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.text.secondary,
    marginBottom: 6,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: 12,
  },
  dateInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
  },
  calendarButton: {
    padding: 8,
    marginLeft: 8,
  },
  calendarButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  calendarButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  dateHelperText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 8,
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
  consentSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  consentHelperText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 8,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
