import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import { 
  Eye, 
  EyeOff, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle, 
  XCircle,
  Save,
  Shield,
  Settings as SettingsIcon,
} from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { regenerateAllFaceEmbeddings } from '@/lib/faceSearch';
import colors from '@/constants/colors';

interface FaceMatchingProvider {
  id: string;
  name: string;
  provider_type: 'aws_rekognition' | 'azure_face' | 'google_vision' | 'custom' | 'local';
  is_active: boolean;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  aws_region?: string;
  azure_endpoint?: string;
  azure_subscription_key?: string;
  google_project_id?: string;
  google_credentials_json?: string;
  custom_api_endpoint?: string;
  custom_api_key?: string;
  custom_config?: any;
  similarity_threshold: number;
  max_results: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export default function FaceMatchingProvidersScreen() {
  const { currentUser } = useApp();
  const [providers, setProviders] = useState<FaceMatchingProvider[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingProvider, setEditingProvider] = useState<FaceMatchingProvider | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [regenerating, setRegenerating] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    name: '',
    provider_type: 'aws_rekognition' as FaceMatchingProvider['provider_type'],
    aws_access_key_id: '',
    aws_secret_access_key: '',
    aws_region: 'us-east-1',
    azure_endpoint: '',
    azure_subscription_key: '',
    google_project_id: '',
    google_credentials_json: '',
    custom_api_endpoint: '',
    custom_api_key: '',
    custom_config: '',
    similarity_threshold: 0.70,
    max_results: 10,
    enabled: true,
  });

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('face_matching_providers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProviders(data || []);
    } catch (error: any) {
      console.error('Failed to load providers:', error);
      const errorMessage = error?.message || error?.toString() || 'Failed to load providers';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (provider?: FaceMatchingProvider) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({
        name: provider.name,
        provider_type: provider.provider_type,
        aws_access_key_id: provider.aws_access_key_id || '',
        aws_secret_access_key: provider.aws_secret_access_key || '',
        aws_region: provider.aws_region || 'us-east-1',
        azure_endpoint: provider.azure_endpoint || '',
        azure_subscription_key: provider.azure_subscription_key || '',
        google_project_id: provider.google_project_id || '',
        google_credentials_json: provider.google_credentials_json || '',
        custom_api_endpoint: provider.custom_api_endpoint || '',
        custom_api_key: provider.custom_api_key || '',
        custom_config: provider.custom_config ? JSON.stringify(provider.custom_config, null, 2) : '',
        similarity_threshold: provider.similarity_threshold,
        max_results: provider.max_results,
        enabled: provider.enabled,
      });
    } else {
      setEditingProvider(null);
      setFormData({
        name: '',
        provider_type: 'local',
        aws_access_key_id: '',
        aws_secret_access_key: '',
        aws_region: 'us-east-1',
        azure_endpoint: '',
        azure_subscription_key: '',
        google_project_id: '',
        google_credentials_json: '',
        custom_api_endpoint: '',
        custom_api_key: '',
        custom_config: '',
        similarity_threshold: 0.70,
        max_results: 10,
        enabled: true,
      });
    }
    setShowModal(true);
  };

  const handleSaveProvider = async () => {
    try {
      if (!formData.name.trim()) {
        Alert.alert('Error', 'Please enter a provider name');
        return;
      }

      // Validate provider-specific fields
      if (formData.provider_type === 'local') {
        // Local provider doesn't need any configuration - it's free and works immediately
        // No validation needed
      } else if (formData.provider_type === 'aws_rekognition') {
        if (!formData.aws_access_key_id || !formData.aws_secret_access_key) {
          Alert.alert('Error', 'Please enter AWS Access Key ID and Secret Access Key');
          return;
        }
      } else if (formData.provider_type === 'azure_face') {
        if (!formData.azure_endpoint || !formData.azure_subscription_key) {
          Alert.alert('Error', 'Please enter Azure Endpoint and Subscription Key');
          return;
        }
      } else if (formData.provider_type === 'google_vision') {
        if (!formData.google_project_id || !formData.google_credentials_json) {
          Alert.alert('Error', 'Please enter Google Project ID and Credentials JSON');
          return;
        }
      } else if (formData.provider_type === 'custom') {
        if (!formData.custom_api_endpoint || !formData.custom_api_key) {
          Alert.alert('Error', 'Please enter Custom API Endpoint and API Key');
          return;
        }
      }

      const providerData: any = {
        name: formData.name,
        provider_type: formData.provider_type,
        similarity_threshold: formData.similarity_threshold,
        max_results: formData.max_results,
        enabled: formData.enabled,
        created_by: currentUser?.id,
      };

      // Add provider-specific fields
      if (formData.provider_type === 'local') {
        // Local provider doesn't need any additional fields
        // It's completely free and works without configuration
      } else if (formData.provider_type === 'aws_rekognition') {
        providerData.aws_access_key_id = formData.aws_access_key_id;
        providerData.aws_secret_access_key = formData.aws_secret_access_key;
        providerData.aws_region = formData.aws_region;
      } else if (formData.provider_type === 'azure_face') {
        providerData.azure_endpoint = formData.azure_endpoint;
        providerData.azure_subscription_key = formData.azure_subscription_key;
      } else if (formData.provider_type === 'google_vision') {
        providerData.google_project_id = formData.google_project_id;
        providerData.google_credentials_json = formData.google_credentials_json;
      } else if (formData.provider_type === 'custom') {
        providerData.custom_api_endpoint = formData.custom_api_endpoint;
        providerData.custom_api_key = formData.custom_api_key;
        if (formData.custom_config) {
          try {
            providerData.custom_config = JSON.parse(formData.custom_config);
          } catch {
            Alert.alert('Error', 'Invalid JSON in custom config');
            return;
          }
        }
      }

      if (editingProvider) {
        const { error } = await supabase
          .from('face_matching_providers')
          .update(providerData)
          .eq('id', editingProvider.id);
        
        if (error) throw error;
        Alert.alert('Success', 'Provider updated successfully');
      } else {
        const { error } = await supabase
          .from('face_matching_providers')
          .insert(providerData);
        
        if (error) throw error;
        Alert.alert('Success', 'Provider created successfully');
      }

      setShowModal(false);
      loadProviders();
    } catch (error: any) {
      console.error('Failed to save provider:', error);
      Alert.alert('Error', error?.message || 'Failed to save provider');
    }
  };

  const handleSetActive = async (providerId: string) => {
    try {
      const { error } = await supabase
        .from('face_matching_providers')
        .update({ is_active: true })
        .eq('id', providerId);

      if (error) throw error;
      Alert.alert('Success', 'Provider activated successfully');
      loadProviders();
    } catch (error: any) {
      console.error('Failed to activate provider:', error);
      Alert.alert('Error', error?.message || 'Failed to activate provider');
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    Alert.alert(
      'Delete Provider',
      'Are you sure you want to delete this provider?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('face_matching_providers')
                .delete()
                .eq('id', providerId);

              if (error) throw error;
              Alert.alert('Success', 'Provider deleted successfully');
              loadProviders();
            } catch (error: any) {
              console.error('Failed to delete provider:', error);
              Alert.alert('Error', error?.message || 'Failed to delete provider');
            }
          },
        },
      ]
    );
  };

  const toggleSecretVisibility = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleRegenerateEmbeddings = async () => {
    Alert.alert(
      'Regenerate Face Embeddings',
      'This will regenerate face embeddings for all relationships with face photos. This may take several minutes. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: async () => {
            try {
              setRegenerating(true);
              const results = await regenerateAllFaceEmbeddings();
              
              let message = `Regeneration complete!\n\n`;
              message += `✅ Success: ${results.success}\n`;
              message += `❌ Failed: ${results.failed}\n`;
              
              // Check if there are approval-related errors
              const hasApprovalError = results.errors.some(e => 
                e.includes('Azure Face API approval') || 
                e.includes('requires approval') ||
                e.includes('UnsupportedFeature')
              );
              
              if (hasApprovalError) {
                message += `\n\n⚠️ IMPORTANT:\n`;
                message += `Azure Face API requires approval for face detection/matching.\n\n`;
                message += `To enable face matching:\n`;
                message += `1. Apply at: https://aka.ms/facerecognition\n`;
                message += `2. Wait for approval (5-10 business days)\n`;
                message += `3. Run regeneration again after approval\n\n`;
                message += `Note: Image URLs are stored and will be processed after approval.`;
              }
              
              if (results.errors.length > 0) {
                message += `\n\nErrors:\n${results.errors.slice(0, 5).join('\n')}`;
                if (results.errors.length > 5) {
                  message += `\n... and ${results.errors.length - 5} more`;
                }
              }
              
              Alert.alert('Regeneration Complete', message);
            } catch (error: any) {
              console.error('Failed to regenerate embeddings:', error);
              Alert.alert('Error', error?.message || 'Failed to regenerate face embeddings');
            } finally {
              setRegenerating(false);
            }
          },
        },
      ]
    );
  };

  const getProviderTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      local: 'Local (Free - No API Keys)',
      aws_rekognition: 'AWS Rekognition',
      azure_face: 'Azure Face API',
      google_vision: 'Google Cloud Vision',
      custom: 'Custom Provider',
    };
    return labels[type] || type;
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Face Matching', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>Only Admins can manage face matching providers</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Face Matching Providers', headerShown: true }} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <SettingsIcon size={64} color={colors.danger} />
          <Text style={styles.errorText}>Failed to load providers</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <SettingsIcon size={24} color={colors.primary} />
              <Text style={styles.headerTitle}>Face Matching Providers</Text>
              <Text style={styles.headerSubtext}>Configure face recognition services</Text>
              
              {providers.some(p => p.is_active && p.enabled) && (
                <TouchableOpacity
                  style={[styles.regenerateButton, regenerating && styles.regenerateButtonDisabled]}
                  onPress={handleRegenerateEmbeddings}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <>
                      <ActivityIndicator size="small" color={colors.text.white} />
                      <Text style={styles.regenerateButtonText}>Regenerating...</Text>
                    </>
                  ) : (
                    <>
                      <SettingsIcon size={16} color={colors.text.white} />
                      <Text style={styles.regenerateButtonText}>Regenerate Embeddings</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.providersList}>
              {providers.map((provider) => (
                <View key={provider.id} style={styles.providerCard}>
                  <View style={styles.providerHeader}>
                    <View style={styles.providerInfo}>
                      <Text style={styles.providerName}>{provider.name}</Text>
                      <Text style={styles.providerType}>
                        {getProviderTypeLabel(provider.provider_type)}
                      </Text>
                    </View>
                    <View style={styles.providerBadges}>
                      {provider.is_active && (
                        <View style={styles.activeBadge}>
                          <CheckCircle size={16} color={colors.text.white} />
                          <Text style={styles.activeBadgeText}>Active</Text>
                        </View>
                      )}
                      {!provider.enabled && (
                        <View style={styles.disabledBadge}>
                          <XCircle size={16} color={colors.text.white} />
                          <Text style={styles.disabledBadgeText}>Disabled</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.providerDetails}>
                    <Text style={styles.detailText}>
                      Similarity Threshold: {(provider.similarity_threshold * 100).toFixed(0)}%
                    </Text>
                    <Text style={styles.detailText}>
                      Max Results: {provider.max_results}
                    </Text>
                  </View>

                  <View style={styles.providerActions}>
                    {!provider.is_active && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.activateButton]}
                        onPress={() => handleSetActive(provider.id)}
                      >
                        <CheckCircle size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Activate</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => handleOpenModal(provider)}
                    >
                      <Edit2 size={16} color={colors.text.white} />
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteProvider(provider.id)}
                    >
                      <Trash2 size={16} color={colors.text.white} />
                      <Text style={styles.actionButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {providers.length === 0 && (
                <View style={styles.emptyState}>
                  <SettingsIcon size={64} color={colors.text.tertiary} />
                  <Text style={styles.emptyText}>No providers configured</Text>
                  <Text style={styles.emptySubtext}>Add a provider to enable face matching</Text>
                </View>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleOpenModal()}
          >
            <Plus size={24} color={colors.text.white} />
            <Text style={styles.addButtonText}>Add Provider</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingProvider ? 'Edit Provider' : 'Add Provider'}
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Provider Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="e.g., AWS Production"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Provider Type *</Text>
                <View style={styles.radioGroup}>
                  {(['local', 'aws_rekognition', 'azure_face', 'google_vision', 'custom'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.radioOption,
                        formData.provider_type === type && styles.radioOptionActive,
                      ]}
                      onPress={() => setFormData({ ...formData, provider_type: type })}
                    >
                      <Text
                        style={[
                          styles.radioText,
                          formData.provider_type === type && styles.radioTextActive,
                        ]}
                      >
                        {getProviderTypeLabel(type)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* AWS Rekognition Fields */}
              {formData.provider_type === 'aws_rekognition' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>AWS Access Key ID *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.aws_access_key_id}
                      onChangeText={(text) => setFormData({ ...formData, aws_access_key_id: text })}
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>AWS Secret Access Key *</Text>
                    <View style={styles.passwordInputContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        value={formData.aws_secret_access_key}
                        onChangeText={(text) => setFormData({ ...formData, aws_secret_access_key: text })}
                        placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                        secureTextEntry={!showSecrets['aws_secret']}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => toggleSecretVisibility('aws_secret')}
                        style={styles.eyeButton}
                      >
                        {showSecrets['aws_secret'] ? (
                          <EyeOff size={20} color={colors.text.secondary} />
                        ) : (
                          <Eye size={20} color={colors.text.secondary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>AWS Region</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.aws_region}
                      onChangeText={(text) => setFormData({ ...formData, aws_region: text })}
                      placeholder="us-east-1"
                    />
                  </View>
                </>
              )}

              {/* Azure Face API Fields */}
              {formData.provider_type === 'azure_face' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Azure Endpoint *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.azure_endpoint}
                      onChangeText={(text) => setFormData({ ...formData, azure_endpoint: text })}
                      placeholder="https://your-resource.cognitiveservices.azure.com"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Azure Subscription Key *</Text>
                    <View style={styles.passwordInputContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        value={formData.azure_subscription_key}
                        onChangeText={(text) => setFormData({ ...formData, azure_subscription_key: text })}
                        placeholder="Your subscription key"
                        secureTextEntry={!showSecrets['azure_key']}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => toggleSecretVisibility('azure_key')}
                        style={styles.eyeButton}
                      >
                        {showSecrets['azure_key'] ? (
                          <EyeOff size={20} color={colors.text.secondary} />
                        ) : (
                          <Eye size={20} color={colors.text.secondary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {/* Google Cloud Vision Fields */}
              {formData.provider_type === 'google_vision' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Google Project ID *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.google_project_id}
                      onChangeText={(text) => setFormData({ ...formData, google_project_id: text })}
                      placeholder="your-project-id"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Google Credentials JSON *</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={formData.google_credentials_json}
                      onChangeText={(text) => setFormData({ ...formData, google_credentials_json: text })}
                      placeholder='{"type": "service_account", ...}'
                      multiline
                      numberOfLines={6}
                      textAlignVertical="top"
                    />
                  </View>
                </>
              )}

              {/* Custom Provider Fields */}
              {formData.provider_type === 'custom' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>API Endpoint *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.custom_api_endpoint}
                      onChangeText={(text) => setFormData({ ...formData, custom_api_endpoint: text })}
                      placeholder="https://api.example.com/face-match"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>API Key *</Text>
                    <View style={styles.passwordInputContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        value={formData.custom_api_key}
                        onChangeText={(text) => setFormData({ ...formData, custom_api_key: text })}
                        placeholder="Your API key"
                        secureTextEntry={!showSecrets['custom_key']}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => toggleSecretVisibility('custom_key')}
                        style={styles.eyeButton}
                      >
                        {showSecrets['custom_key'] ? (
                          <EyeOff size={20} color={colors.text.secondary} />
                        ) : (
                          <Eye size={20} color={colors.text.secondary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Custom Config (JSON)</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={formData.custom_config}
                      onChangeText={(text) => setFormData({ ...formData, custom_config: text })}
                      placeholder='{"key": "value"}'
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>
                </>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.label}>Similarity Threshold</Text>
                <TextInput
                  style={styles.input}
                  value={formData.similarity_threshold.toString()}
                  onChangeText={(text) => {
                    const num = parseFloat(text);
                    if (!isNaN(num) && num >= 0 && num <= 1) {
                      setFormData({ ...formData, similarity_threshold: num });
                    }
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.70"
                />
                <Text style={styles.hint}>Value between 0 and 1 (e.g., 0.70 = 70%)</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Max Results</Text>
                <TextInput
                  style={styles.input}
                  value={formData.max_results.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text);
                    if (!isNaN(num) && num > 0) {
                      setFormData({ ...formData, max_results: num });
                    }
                  }}
                  keyboardType="number-pad"
                  placeholder="10"
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Enabled</Text>
                  <Switch
                    value={formData.enabled}
                    onValueChange={(value) => setFormData({ ...formData, enabled: value })}
                    trackColor={{ false: colors.text.tertiary, true: colors.primary }}
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveProvider}
                >
                  <Save size={20} color={colors.text.white} />
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 24,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 12,
  },
  headerSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.secondary,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  regenerateButtonDisabled: {
    opacity: 0.6,
  },
  regenerateButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  providersList: {
    padding: 16,
    gap: 16,
  },
  providerCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  providerType: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  providerBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  disabledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.text.tertiary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  disabledBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  providerDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  providerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  activateButton: {
    backgroundColor: colors.secondary,
  },
  editButton: {
    backgroundColor: colors.primary,
  },
  deleteButton: {
    backgroundColor: colors.danger,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    margin: 16,
    paddingVertical: 16,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  eyeButton: {
    padding: 12,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radioOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.secondary,
  },
  radioOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  radioText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  radioTextActive: {
    color: colors.text.white,
    fontWeight: '600' as const,
  },
  hint: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: colors.background.secondary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  infoBox: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.primary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
    marginBottom: 8,
  },
  infoNote: {
    fontSize: 12,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 8,
  },
});

