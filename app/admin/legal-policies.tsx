import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Eye,
  Save,
  X,
  FileText,
  CheckCircle2,
  XCircle,
  Users,
  Tag,
  Calendar,
  MapPin,
  Shield,
  AlertCircle,
  Search,
  Filter,
} from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { LegalDocument } from '@/types';

export default function AdminLegalPoliciesScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<LegalDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingDoc, setEditingDoc] = useState<LegalDocument | null>(null);
  const [acceptanceStats, setAcceptanceStats] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    version: '1.0.0',
    isActive: true,
    isRequired: false,
    displayLocation: [] as string[],
  });

  useEffect(() => {
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
      loadDocuments();
      loadAcceptanceStats();
    }
  }, [currentUser]);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchQuery, filterActive]);

  const filterDocuments = () => {
    let filtered = [...documents];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.slug.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filterActive === 'active') {
      filtered = filtered.filter(doc => doc.isActive);
    } else if (filterActive === 'inactive') {
      filtered = filtered.filter(doc => !doc.isActive);
    }

    setFilteredDocuments(filtered);
  };

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .order('created_at', { ascending: false });

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
        setDocuments(docs);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
      Alert.alert('Error', 'Failed to load legal documents');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAcceptanceStats = async () => {
    try {
      const { data, error } = await supabase
        .from('user_legal_acceptances')
        .select('document_id');

      if (error) throw error;

      const stats: Record<string, number> = {};
      data?.forEach((acceptance) => {
        stats[acceptance.document_id] = (stats[acceptance.document_id] || 0) + 1;
      });
      setAcceptanceStats(stats);
    } catch (error) {
      console.error('Failed to load acceptance stats:', error);
    }
  };

  const handleCreateNew = () => {
    setEditingDoc(null);
    setFormData({
      title: '',
      slug: '',
      content: '',
      version: '1.0.0',
      isActive: true,
      isRequired: false,
      displayLocation: [],
    });
    setShowEditor(true);
  };

  const handleEdit = (doc: LegalDocument) => {
    setEditingDoc(doc);
    setFormData({
      title: doc.title,
      slug: doc.slug,
      content: doc.content,
      version: doc.version,
      isActive: doc.isActive,
      isRequired: doc.isRequired,
      displayLocation: doc.displayLocation,
    });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.slug || !formData.content) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const updateData: any = {
        title: formData.title,
        slug: formData.slug,
        content: formData.content,
        version: formData.version,
        is_active: formData.isActive,
        is_required: formData.isRequired,
        display_location: formData.displayLocation,
        last_updated_by: currentUser?.id,
      };

      if (editingDoc) {
        const { error } = await supabase
          .from('legal_documents')
          .update(updateData)
          .eq('id', editingDoc.id);

        if (error) throw error;
        Alert.alert('Success', 'Document updated successfully');
      } else {
        updateData.created_by = currentUser?.id;
        const { error } = await supabase
          .from('legal_documents')
          .insert(updateData);

        if (error) throw error;
        Alert.alert('Success', 'Document created successfully');
      }

      setShowEditor(false);
      loadDocuments();
      loadAcceptanceStats();
    } catch (error: any) {
      console.error('Failed to save document:', error);
      Alert.alert('Error', error.message || 'Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (doc: LegalDocument) => {
    try {
      const { error } = await supabase
        .from('legal_documents')
        .update({
          is_active: !doc.isActive,
          last_updated_by: currentUser?.id,
        })
        .eq('id', doc.id);

      if (error) throw error;
      loadDocuments();
    } catch (error) {
      console.error('Failed to toggle document:', error);
      Alert.alert('Error', 'Failed to update document');
    }
  };

  const handleDelete = (doc: LegalDocument) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${doc.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('legal_documents')
                .delete()
                .eq('id', doc.id);

              if (error) throw error;
              Alert.alert('Success', 'Document deleted successfully');
              loadDocuments();
            } catch (error) {
              console.error('Failed to delete document:', error);
              Alert.alert('Error', 'Failed to delete document');
            }
          },
        },
      ]
    );
  };

  const toggleDisplayLocation = (location: string) => {
    const current = formData.displayLocation || [];
    if (current.includes(location)) {
      setFormData({
        ...formData,
        displayLocation: current.filter((l) => l !== location),
      });
    } else {
      setFormData({
        ...formData,
        displayLocation: [...current, location],
      });
    }
  };

  const getLocationIcon = (location: string) => {
    switch (location) {
      case 'signup': return '👤';
      case 'settings': return '⚙️';
      case 'search': return '🔍';
      case 'relationship': return '❤️';
      default: return '📍';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Legal & Policies', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={themeColors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>You don't have admin permissions</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeCount = documents.filter(d => d.isActive).length;
  const inactiveCount = documents.filter(d => !d.isActive).length;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Legal & Policies',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
              <ArrowLeft size={24} color={themeColors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Stats Header */}
      <View style={styles.statsHeader}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{documents.length}</Text>
          <Text style={styles.statLabel}>Total Documents</Text>
        </View>
        <View style={[styles.statCard, styles.statCardActive]}>
          <Text style={[styles.statNumber, styles.statNumberActive]}>{activeCount}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{inactiveCount}</Text>
          <Text style={styles.statLabel}>Inactive</Text>
        </View>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color={themeColors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search documents..."
            placeholderTextColor={themeColors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color={themeColors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.filterContainer}>
          {(['all', 'active', 'inactive'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                filterActive === filter && styles.filterButtonActive,
              ]}
              onPress={() => setFilterActive(filter)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterActive === filter && styles.filterButtonTextActive,
                ]}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Create Button */}
      <View style={styles.createButtonContainer}>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateNew}>
          <View style={styles.createButtonIcon}>
            <Plus size={22} color={themeColors.text.white} />
          </View>
          <Text style={styles.createButtonText}>Create New Document</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      ) : filteredDocuments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FileText size={64} color={themeColors.text.tertiary} />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No documents found' : 'No documents yet'}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'Try adjusting your search or filters'
              : 'Create your first legal document to get started'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredDocuments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[
              styles.documentCard,
              !item.isActive && styles.documentCardInactive,
            ]}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[
                    styles.statusIndicator,
                    item.isActive ? styles.statusIndicatorActive : styles.statusIndicatorInactive,
                  ]} />
                  <View style={styles.titleContainer}>
                    <View style={styles.titleRow}>
                      <FileText 
                        size={20} 
                        color={item.isActive ? themeColors.primary : themeColors.text.tertiary} 
                      />
                      <Text style={[
                        styles.documentTitle,
                        !item.isActive && styles.documentTitleInactive,
                      ]}>
                        {item.title}
                      </Text>
                    </View>
                    <View style={styles.badgeRow}>
                      <View style={styles.versionBadge}>
                        <Tag size={12} color={themeColors.primary} />
                        <Text style={styles.versionText}>v{item.version}</Text>
                      </View>
                      {item.isRequired && (
                        <View style={styles.requiredBadge}>
                          <AlertCircle size={12} color={themeColors.danger} />
                          <Text style={styles.requiredBadgeText}>Required</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {/* Stats Row */}
              {acceptanceStats[item.id] && (
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Users size={14} color={themeColors.primary} />
                    <Text style={styles.statItemText}>
                      {acceptanceStats[item.id]} acceptances
                    </Text>
                  </View>
                </View>
              )}

              {/* Info Grid */}
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Status</Text>
                  <View style={styles.infoValueContainer}>
                    {item.isActive ? (
                      <>
                        <CheckCircle2 size={14} color={themeColors.secondary} />
                        <Text style={[styles.infoValue, styles.infoValueActive]}>Active</Text>
                      </>
                    ) : (
                      <>
                        <XCircle size={14} color={themeColors.text.tertiary} />
                        <Text style={styles.infoValue}>Inactive</Text>
                      </>
                    )}
                  </View>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Required</Text>
                  <Text style={styles.infoValue}>
                    {item.isRequired ? 'Yes' : 'No'}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Updated</Text>
                  <View style={styles.infoValueContainer}>
                    <Calendar size={14} color={themeColors.text.secondary} />
                    <Text style={styles.infoValue}>{formatDate(item.updatedAt)}</Text>
                  </View>
                </View>
              </View>

              {/* Display Locations */}
              {item.displayLocation.length > 0 && (
                <View style={styles.locationsContainer}>
                  <Text style={styles.locationsLabel}>Display Locations:</Text>
                  <View style={styles.locationsRow}>
                    {item.displayLocation.map((location) => (
                      <View key={location} style={styles.locationTag}>
                        <Text style={styles.locationTagEmoji}>
                          {getLocationIcon(location)}
                        </Text>
                        <Text style={styles.locationTagText}>
                          {location.charAt(0).toUpperCase() + location.slice(1)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Actions */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonPrimary]}
                  onPress={() => router.push(`/legal/${item.slug}` as any)}
                >
                  <Eye size={16} color={themeColors.primary} />
                  <Text style={styles.actionButtonTextPrimary}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                  onPress={() => handleEdit(item)}
                >
                  <Edit size={16} color={themeColors.primary} />
                  <Text style={styles.actionButtonTextSecondary}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonTertiary]}
                  onPress={() => handleToggleActive(item)}
                >
                  {item.isActive ? (
                    <>
                      <XCircle size={16} color={themeColors.danger} />
                      <Text style={styles.actionButtonTextDanger}>Deactivate</Text>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} color={themeColors.secondary} />
                      <Text style={styles.actionButtonTextSuccess}>Activate</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonDanger]}
                  onPress={() => handleDelete(item)}
                >
                  <Trash2 size={16} color={themeColors.danger} />
                  <Text style={styles.actionButtonTextDanger}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Editor Modal */}
      <Modal
        visible={showEditor}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditor(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.modalIconContainer}>
                <FileText size={24} color={themeColors.primary} />
              </View>
              <View>
                <Text style={styles.modalTitle}>
                  {editingDoc ? 'Edit Document' : 'Create New Document'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {editingDoc ? 'Update document details' : 'Add a new legal document'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowEditor(false)}
              style={styles.modalCloseButton}
            >
              <X size={24} color={themeColors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.modalContent} 
            contentContainerStyle={styles.modalContentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Basic Information</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Title *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.title}
                  onChangeText={(text) => setFormData({ ...formData, title: text })}
                  placeholder="e.g., Terms of Service"
                  placeholderTextColor={themeColors.text.tertiary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Slug * (URL-friendly)</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.slug}
                  onChangeText={(text) => setFormData({ ...formData, slug: text.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="e.g., terms-of-service"
                  placeholderTextColor={themeColors.text.tertiary}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Version *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.version}
                  onChangeText={(text) => setFormData({ ...formData, version: text })}
                  placeholder="e.g., 1.0.0"
                  placeholderTextColor={themeColors.text.tertiary}
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Content</Text>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Content * (HTML/Markdown supported)</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  value={formData.content}
                  onChangeText={(text) => setFormData({ ...formData, content: text })}
                  placeholder="Enter document content..."
                  placeholderTextColor={themeColors.text.tertiary}
                  multiline
                  numberOfLines={12}
                  textAlignVertical="top"
                />
                <Text style={styles.formHint}>
                  Supports HTML tags and Markdown formatting
                </Text>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Settings</Text>
              
              <View style={styles.switchGroup}>
                <View style={styles.switchRow}>
                  <View style={styles.switchLabelContainer}>
                    <Shield size={18} color={themeColors.primary} />
                    <View style={styles.switchTextContainer}>
                      <Text style={styles.switchLabel}>Active</Text>
                      <Text style={styles.switchDescription}>
                        Document will be visible to users
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={formData.isActive}
                    onValueChange={(value) => setFormData({ ...formData, isActive: value })}
                    trackColor={{
                      false: themeColors.border.light,
                      true: themeColors.primary + '50',
                    }}
                    thumbColor={formData.isActive ? themeColors.primary : themeColors.text.tertiary}
                  />
                </View>

                <View style={styles.switchRow}>
                  <View style={styles.switchLabelContainer}>
                    <AlertCircle size={18} color={themeColors.danger} />
                    <View style={styles.switchTextContainer}>
                      <Text style={styles.switchLabel}>Required</Text>
                      <Text style={styles.switchDescription}>
                        Users must accept this document
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={formData.isRequired}
                    onValueChange={(value) => setFormData({ ...formData, isRequired: value })}
                    trackColor={{
                      false: themeColors.border.light,
                      true: themeColors.danger + '50',
                    }}
                    thumbColor={formData.isRequired ? themeColors.danger : themeColors.text.tertiary}
                  />
                </View>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Display Locations</Text>
              <Text style={styles.formSectionDescription}>
                Select where this document should appear in the app
              </Text>
              <View style={styles.locationsGrid}>
                {['signup', 'settings', 'search', 'relationship'].map((location) => (
                  <TouchableOpacity
                    key={location}
                    style={[
                      styles.locationOption,
                      formData.displayLocation.includes(location) && styles.locationOptionActive,
                    ]}
                    onPress={() => toggleDisplayLocation(location)}
                  >
                    <Text style={styles.locationOptionEmoji}>
                      {getLocationIcon(location)}
                    </Text>
                    <Text style={[
                      styles.locationOptionText,
                      formData.displayLocation.includes(location) && styles.locationOptionTextActive,
                    ]}>
                      {location.charAt(0).toUpperCase() + location.slice(1)}
                    </Text>
                    {formData.displayLocation.includes(location) && (
                      <CheckCircle2 size={16} color={themeColors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowEditor(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={themeColors.text.white} />
              ) : (
                <>
                  <Save size={18} color={themeColors.text.white} />
                  <Text style={styles.saveButtonText}>Save Document</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  headerBackButton: {
    padding: 8,
    marginLeft: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  errorSubtext: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  statsHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statCardActive: {
    backgroundColor: colors.primary + '10',
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  statNumberActive: {
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  filterButtonTextActive: {
    color: colors.text.white,
  },
  createButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.text.white + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
    gap: 16,
  },
  documentCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  documentCardInactive: {
    opacity: 0.7,
    borderColor: colors.border.light,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    gap: 12,
  },
  statusIndicator: {
    width: 4,
    borderRadius: 2,
    alignSelf: 'stretch',
  },
  statusIndicatorActive: {
    backgroundColor: colors.secondary,
  },
  statusIndicatorInactive: {
    backgroundColor: colors.text.tertiary,
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  documentTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    lineHeight: 26,
  },
  documentTitleInactive: {
    color: colors.text.tertiary,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  requiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.danger + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  requiredBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.danger,
  },
  statsRow: {
    backgroundColor: colors.primary + '08',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statItemText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.tertiary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  infoValueActive: {
    color: colors.secondary,
  },
  locationsContainer: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  locationsLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.tertiary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  locationTagEmoji: {
    fontSize: 14,
  },
  locationTagText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary + '30',
  },
  actionButtonSecondary: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.border.light,
  },
  actionButtonTertiary: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.border.light,
  },
  actionButtonDanger: {
    backgroundColor: colors.danger + '10',
    borderColor: colors.danger + '30',
  },
  actionButtonTextPrimary: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  actionButtonTextSecondary: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  actionButtonTextDanger: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.danger,
  },
  actionButtonTextSuccess: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.secondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 20,
  },
  formSection: {
    marginBottom: 32,
  },
  formSectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 16,
  },
  formSectionDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  formTextArea: {
    minHeight: 200,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  formHint: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  switchGroup: {
    gap: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  switchTextContainer: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  locationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  locationOption: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.background.primary,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  locationOptionActive: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary,
  },
  locationOptionEmoji: {
    fontSize: 20,
  },
  locationOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  locationOptionTextActive: {
    color: colors.primary,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
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
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
});
