import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList,
  Image as RNImage,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore - legacy path works at runtime
import * as FileSystem from 'expo-file-system/legacy';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  Filter,
  Star,
  StarOff,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Smile,
  Package,
  Upload,
  Save,
  ChevronRight,
  Image as ImageIcon,
} from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { StickerPack, Sticker } from '@/types';
import colors from '@/constants/colors';

export default function AdminStickersScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [filteredPacks, setFilteredPacks] = useState<StickerPack[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedPack, setSelectedPack] = useState<StickerPack | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPackModal, setShowPackModal] = useState(false);
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [editingPack, setEditingPack] = useState<StickerPack | null>(null);
  const [editingSticker, setEditingSticker] = useState<Sticker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterFeatured, setFilterFeatured] = useState<'all' | 'featured' | 'not-featured'>('all');

  const [packFormData, setPackFormData] = useState({
    name: '',
    description: '',
    iconUrl: '',
    isActive: true,
    isFeatured: false,
    displayOrder: 0,
  });

  const [stickerFormData, setStickerFormData] = useState({
    name: '',
    imageUrl: '',
    isAnimated: false,
    displayOrder: 0,
  });

  useEffect(() => {
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
      loadPacks();
    }
  }, [currentUser]);

  useEffect(() => {
    filterPacks();
  }, [packs, searchQuery, filterActive, filterFeatured]);

  useEffect(() => {
    if (selectedPack) {
      loadStickers(selectedPack.id);
    } else {
      setStickers([]);
    }
  }, [selectedPack]);

  const filterPacks = () => {
    let filtered = [...packs];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(pack =>
        pack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pack.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filterActive === 'active') {
      filtered = filtered.filter(pack => pack.isActive);
    } else if (filterActive === 'inactive') {
      filtered = filtered.filter(pack => !pack.isActive);
    }

    // Apply featured filter
    if (filterFeatured === 'featured') {
      filtered = filtered.filter(pack => pack.isFeatured);
    } else if (filterFeatured === 'not-featured') {
      filtered = filtered.filter(pack => !pack.isFeatured);
    }

    setFilteredPacks(filtered);
  };

  const loadPacks = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('sticker_packs')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const packsData: StickerPack[] = data.map((pack: any) => ({
          id: pack.id,
          name: pack.name,
          description: pack.description,
          iconUrl: pack.icon_url,
          isActive: pack.is_active,
          isFeatured: pack.is_featured,
          displayOrder: pack.display_order,
          createdBy: pack.created_by,
          createdAt: pack.created_at,
          updatedAt: pack.updated_at,
        }));
        setPacks(packsData);
      }
    } catch (error) {
      console.error('Failed to load sticker packs:', error);
      Alert.alert('Error', 'Failed to load sticker packs');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStickers = async (packId: string) => {
    try {
      const { data, error } = await supabase
        .from('stickers')
        .select('*')
        .eq('pack_id', packId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const stickersData: Sticker[] = data.map((sticker: any) => ({
          id: sticker.id,
          packId: sticker.pack_id,
          name: sticker.name,
          imageUrl: sticker.image_url,
          isAnimated: sticker.is_animated,
          displayOrder: sticker.display_order,
          createdAt: sticker.created_at,
          updatedAt: sticker.updated_at,
        }));
        setStickers(stickersData);
      }
    } catch (error) {
      console.error('Failed to load stickers:', error);
      Alert.alert('Error', 'Failed to load stickers');
    }
  };

  const handlePickPackIcon = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uploadedUrl = await uploadImage(asset.uri, 'sticker-packs');
        if (uploadedUrl) {
          setPackFormData({ ...packFormData, iconUrl: uploadedUrl });
        }
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handlePickStickerImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Don't allow editing for GIFs
        quality: 1.0, // Full quality for GIFs
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // Check if it's a GIF based on file extension or MIME type
        const uri = asset.uri.toLowerCase();
        const isGif = Boolean(
          uri.endsWith('.gif') || 
          (asset.mimeType && asset.mimeType.toLowerCase() === 'image/gif')
        );
        
        const uploadedUrl = await uploadImage(asset.uri, 'stickers', isGif);
        if (uploadedUrl) {
          setStickerFormData({ 
            ...stickerFormData, 
            imageUrl: uploadedUrl,
            isAnimated: isGif, // Auto-detect and set animated flag
          });
        }
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (uri: string, folder: string, isGif: boolean = false): Promise<string | null> => {
    try {
      const extension = isGif ? 'gif' : 'jpg';
      const contentType = isGif ? 'image/gif' : 'image/jpeg';
      const filename = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
      
      // Check if it's a local file URI
      let fileData: Uint8Array;
      
      if (uri.startsWith('file://') || uri.startsWith('ph://') || uri.startsWith('content://')) {
        // Read local file using FileSystem
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64);
        fileData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          fileData[i] = binaryString.charCodeAt(i);
        }
      } else {
        // Remote URL - fetch and convert to Uint8Array
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        fileData = new Uint8Array(arrayBuffer);
      }

      const { data, error } = await supabase.storage
        .from('stickers')
        .upload(filename, fileData, {
          contentType: contentType,
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('stickers')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Failed to upload image:', error);
      Alert.alert('Error', `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  };

  const handleSavePack = async () => {
    if (!packFormData.name.trim()) {
      Alert.alert('Error', 'Pack name is required');
      return;
    }

    if (!packFormData.iconUrl) {
      Alert.alert('Error', 'Pack icon is required');
      return;
    }

    try {
      setIsSaving(true);
      const packData: any = {
        name: packFormData.name.trim(),
        description: packFormData.description.trim() || null,
        icon_url: packFormData.iconUrl,
        is_active: packFormData.isActive,
        is_featured: packFormData.isFeatured,
        display_order: packFormData.displayOrder,
        updated_at: new Date().toISOString(),
      };

      if (editingPack) {
        const { error } = await supabase
          .from('sticker_packs')
          .update(packData)
          .eq('id', editingPack.id);

        if (error) throw error;
        Alert.alert('Success', 'Sticker pack updated successfully');
      } else {
        packData.created_by = currentUser?.id;
        const { error } = await supabase
          .from('sticker_packs')
          .insert(packData);

        if (error) throw error;
        Alert.alert('Success', 'Sticker pack created successfully');
      }

      setShowPackModal(false);
      resetPackForm();
      loadPacks();
    } catch (error: any) {
      console.error('Failed to save sticker pack:', error);
      Alert.alert('Error', error.message || 'Failed to save sticker pack');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSticker = async () => {
    if (!selectedPack) {
      Alert.alert('Error', 'Please select a pack first');
      return;
    }

    if (!stickerFormData.name.trim()) {
      Alert.alert('Error', 'Sticker name is required');
      return;
    }

    if (!stickerFormData.imageUrl) {
      Alert.alert('Error', 'Sticker image is required');
      return;
    }

    try {
      setIsSaving(true);
      const stickerData: any = {
        pack_id: selectedPack.id,
        name: stickerFormData.name.trim(),
        image_url: stickerFormData.imageUrl,
        is_animated: stickerFormData.isAnimated,
        display_order: stickerFormData.displayOrder,
        updated_at: new Date().toISOString(),
      };

      if (editingSticker) {
        const { error } = await supabase
          .from('stickers')
          .update(stickerData)
          .eq('id', editingSticker.id);

        if (error) throw error;
        Alert.alert('Success', 'Sticker updated successfully');
      } else {
        const { error } = await supabase
          .from('stickers')
          .insert(stickerData);

        if (error) throw error;
        Alert.alert('Success', 'Sticker created successfully');
      }

      setShowStickerModal(false);
      resetStickerForm();
      if (selectedPack) {
        loadStickers(selectedPack.id);
      }
    } catch (error: any) {
      console.error('Failed to save sticker:', error);
      Alert.alert('Error', error.message || 'Failed to save sticker');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePack = (pack: StickerPack) => {
    Alert.alert(
      'Delete Sticker Pack',
      `Are you sure you want to delete "${pack.name}"? This will also delete all stickers in this pack.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('sticker_packs')
                .delete()
                .eq('id', pack.id);

              if (error) throw error;

              if (selectedPack?.id === pack.id) {
                setSelectedPack(null);
              }
              loadPacks();
              Alert.alert('Success', 'Sticker pack deleted successfully');
            } catch (error: any) {
              console.error('Failed to delete pack:', error);
              Alert.alert('Error', error.message || 'Failed to delete sticker pack');
            }
          },
        },
      ]
    );
  };

  const handleDeleteSticker = (sticker: Sticker) => {
    Alert.alert(
      'Delete Sticker',
      `Are you sure you want to delete "${sticker.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('stickers')
                .delete()
                .eq('id', sticker.id);

              if (error) throw error;

              if (selectedPack) {
                loadStickers(selectedPack.id);
              }
              Alert.alert('Success', 'Sticker deleted successfully');
            } catch (error: any) {
              console.error('Failed to delete sticker:', error);
              Alert.alert('Error', error.message || 'Failed to delete sticker');
            }
          },
        },
      ]
    );
  };

  const handleToggleActive = async (pack: StickerPack) => {
    try {
      const { error } = await supabase
        .from('sticker_packs')
        .update({ is_active: !pack.isActive, updated_at: new Date().toISOString() })
        .eq('id', pack.id);

      if (error) throw error;
      loadPacks();
    } catch (error: any) {
      console.error('Failed to toggle active status:', error);
      Alert.alert('Error', 'Failed to update pack status');
    }
  };

  const handleToggleFeatured = async (pack: StickerPack) => {
    try {
      const { error } = await supabase
        .from('sticker_packs')
        .update({ is_featured: !pack.isFeatured, updated_at: new Date().toISOString() })
        .eq('id', pack.id);

      if (error) throw error;
      loadPacks();
    } catch (error: any) {
      console.error('Failed to toggle featured status:', error);
      Alert.alert('Error', 'Failed to update pack status');
    }
  };

  const handleEditPack = (pack: StickerPack) => {
    setEditingPack(pack);
    setPackFormData({
      name: pack.name,
      description: pack.description || '',
      iconUrl: pack.iconUrl || '',
      isActive: pack.isActive,
      isFeatured: pack.isFeatured,
      displayOrder: pack.displayOrder,
    });
    setShowPackModal(true);
  };

  const handleEditSticker = (sticker: Sticker) => {
    setEditingSticker(sticker);
    setStickerFormData({
      name: sticker.name,
      imageUrl: sticker.imageUrl,
      isAnimated: sticker.isAnimated,
      displayOrder: sticker.displayOrder,
    });
    setShowStickerModal(true);
  };

  const resetPackForm = () => {
    setEditingPack(null);
    setPackFormData({
      name: '',
      description: '',
      iconUrl: '',
      isActive: true,
      isFeatured: false,
      displayOrder: 0,
    });
  };

  const resetStickerForm = () => {
    setEditingSticker(null);
    setStickerFormData({
      name: '',
      imageUrl: '',
      isAnimated: false,
      displayOrder: 0,
    });
  };

  const handleCreatePack = () => {
    resetPackForm();
    setShowPackModal(true);
  };

  const handleCreateSticker = () => {
    if (!selectedPack) {
      Alert.alert('Error', 'Please select a pack first');
      return;
    }
    resetStickerForm();
    setShowStickerModal(true);
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Sticker Management', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Sticker Management', headerShown: true }} />
      
      <View style={styles.content}>
        {/* Search and Filters */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search size={20} color={themeColors.text.secondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search packs..."
              placeholderTextColor={themeColors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={20} color={themeColors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterButton, filterActive === 'all' && styles.filterButtonActive]}
              onPress={() => setFilterActive('all')}
            >
              <Text style={[styles.filterText, filterActive === 'all' && styles.filterTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterActive === 'active' && styles.filterButtonActive]}
              onPress={() => setFilterActive('active')}
            >
              <Text style={[styles.filterText, filterActive === 'active' && styles.filterTextActive]}>
                Active
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterActive === 'inactive' && styles.filterButtonActive]}
              onPress={() => setFilterActive('inactive')}
            >
              <Text style={[styles.filterText, filterActive === 'inactive' && styles.filterTextActive]}>
                Inactive
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterFeatured === 'featured' && styles.filterButtonActive]}
              onPress={() => setFilterFeatured(filterFeatured === 'featured' ? 'all' : 'featured')}
            >
              <Star size={16} color={filterFeatured === 'featured' ? themeColors.primary : themeColors.text.secondary} />
              <Text style={[styles.filterText, filterFeatured === 'featured' && styles.filterTextActive]}>
                Featured
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content - Scrollable */}
        <ScrollView style={styles.mainContent} showsVerticalScrollIndicator={false}>
          {/* Packs Section */}
          <View style={styles.packsSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Package size={22} color={themeColors.primary} />
                <Text style={styles.sectionTitle}>Sticker Packs</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{filteredPacks.length}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleCreatePack}
                activeOpacity={0.7}
              >
                <Plus size={18} color={themeColors.text.white} />
                <Text style={styles.addButtonText}>New Pack</Text>
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={themeColors.primary} />
                <Text style={styles.loadingText}>Loading packs...</Text>
              </View>
            ) : filteredPacks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <Smile size={56} color={themeColors.text.tertiary} />
                </View>
                <Text style={styles.emptyText}>No sticker packs found</Text>
                <Text style={styles.emptySubtext}>Create your first pack to get started</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={handleCreatePack} activeOpacity={0.7}>
                  <Plus size={18} color={themeColors.text.white} />
                  <Text style={styles.emptyButtonText}>Create First Pack</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.packsList}>
                {filteredPacks.map((pack) => (
                  <TouchableOpacity
                    key={pack.id}
                    style={[
                      styles.packCard,
                      selectedPack?.id === pack.id && styles.packCardSelected,
                    ]}
                    onPress={() => setSelectedPack(pack)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.packCardContent}>
                      {pack.iconUrl ? (
                        <Image source={{ uri: pack.iconUrl }} style={styles.packIcon} contentFit="cover" />
                      ) : (
                        <View style={styles.packIconPlaceholder}>
                          <Smile size={28} color={themeColors.text.tertiary} />
                        </View>
                      )}
                      <View style={styles.packInfo}>
                        <View style={styles.packNameRow}>
                          <Text style={styles.packName} numberOfLines={1}>{pack.name}</Text>
                          {pack.isFeatured && (
                            <Star size={16} color={themeColors.primary} fill={themeColors.primary} />
                          )}
                        </View>
                        {pack.description && (
                          <Text style={styles.packDescription} numberOfLines={1}>
                            {pack.description}
                          </Text>
                        )}
                        <View style={styles.packMeta}>
                          <Text style={styles.packMetaText}>
                            {stickers.filter(s => s.packId === pack.id).length} stickers
                          </Text>
                          <View style={[styles.statusBadge, pack.isActive && styles.statusBadgeActive]}>
                            <Text style={[styles.statusText, pack.isActive && styles.statusTextActive]}>
                              {pack.isActive ? 'Active' : 'Inactive'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <ChevronRight size={20} color={themeColors.text.tertiary} />
                    </View>
                    <View style={styles.packActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleToggleActive(pack)}
                        activeOpacity={0.7}
                      >
                        {pack.isActive ? (
                          <EyeOff size={18} color={themeColors.text.secondary} />
                        ) : (
                          <Eye size={18} color={themeColors.text.secondary} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleToggleFeatured(pack)}
                        activeOpacity={0.7}
                      >
                        {pack.isFeatured ? (
                          <Star size={18} color={themeColors.primary} fill={themeColors.primary} />
                        ) : (
                          <StarOff size={18} color={themeColors.text.secondary} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleEditPack(pack)}
                        activeOpacity={0.7}
                      >
                        <Edit2 size={18} color={themeColors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeletePack(pack)}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={18} color={themeColors.danger} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Stickers Section - Only show when pack is selected */}
          {selectedPack && (
            <View style={styles.stickersSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Smile size={22} color={themeColors.primary} />
                  <Text style={styles.sectionTitle} numberOfLines={1}>
                    {selectedPack.name}
                  </Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{stickers.length}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleCreateSticker}
                  activeOpacity={0.7}
                >
                  <Plus size={18} color={themeColors.text.white} />
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>

              {stickers.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconContainer}>
                    <Smile size={48} color={themeColors.text.tertiary} />
                  </View>
                  <Text style={styles.emptyText}>No stickers in this pack</Text>
                  <Text style={styles.emptySubtext}>Add your first sticker to get started</Text>
                  <TouchableOpacity style={styles.emptyButton} onPress={handleCreateSticker} activeOpacity={0.7}>
                    <Plus size={18} color={themeColors.text.white} />
                    <Text style={styles.emptyButtonText}>Add First Sticker</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.stickersGrid}>
                  {stickers.map((sticker) => (
                    <View key={sticker.id} style={styles.stickerCard}>
                      <View style={styles.stickerImageContainer}>
                        <Image
                          source={{ uri: sticker.imageUrl }}
                          style={styles.stickerImage}
                          contentFit="contain"
                        />
                        {sticker.isAnimated && (
                          <View style={styles.gifBadge}>
                            <Text style={styles.gifBadgeText}>GIF</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.stickerName} numberOfLines={1}>{sticker.name}</Text>
                      <View style={styles.stickerActions}>
                        <TouchableOpacity
                          style={styles.stickerActionButton}
                          onPress={() => handleEditSticker(sticker)}
                          activeOpacity={0.7}
                        >
                          <Edit2 size={14} color={themeColors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.stickerActionButton}
                          onPress={() => handleDeleteSticker(sticker)}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={14} color={themeColors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Pack Modal */}
      <Modal
        visible={showPackModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPackModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingPack ? 'Edit Sticker Pack' : 'Create Sticker Pack'}
            </Text>
            <TouchableOpacity onPress={() => setShowPackModal(false)}>
              <X size={24} color={themeColors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Pack Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter pack name"
                value={packFormData.name}
                onChangeText={(text) => setPackFormData({ ...packFormData, name: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter pack description"
                value={packFormData.description}
                onChangeText={(text) => setPackFormData({ ...packFormData, description: text })}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Pack Icon *</Text>
              <TouchableOpacity
                style={styles.imagePicker}
                onPress={handlePickPackIcon}
              >
                {packFormData.iconUrl ? (
                  <Image source={{ uri: packFormData.iconUrl }} style={styles.previewImage} contentFit="cover" />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <ImageIcon size={32} color={themeColors.text.secondary} />
                    <Text style={styles.imagePickerText}>Tap to select icon</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Display Order</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={packFormData.displayOrder.toString()}
                onChangeText={(text) => setPackFormData({ ...packFormData, displayOrder: parseInt(text) || 0 })}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.switchGroup}>
              <Text style={styles.label}>Active</Text>
              <TouchableOpacity
                style={[styles.switch, packFormData.isActive && styles.switchActive]}
                onPress={() => setPackFormData({ ...packFormData, isActive: !packFormData.isActive })}
              >
                <View style={[styles.switchThumb, packFormData.isActive && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>

            <View style={styles.switchGroup}>
              <Text style={styles.label}>Featured</Text>
              <TouchableOpacity
                style={[styles.switch, packFormData.isFeatured && styles.switchActive]}
                onPress={() => setPackFormData({ ...packFormData, isFeatured: !packFormData.isFeatured })}
              >
                <View style={[styles.switchThumb, packFormData.isFeatured && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSavePack}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={themeColors.text.white} />
              ) : (
                <>
                  <Save size={20} color={themeColors.text.white} />
                  <Text style={styles.saveButtonText}>Save Pack</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Sticker Modal */}
      <Modal
        visible={showStickerModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStickerModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingSticker ? 'Edit Sticker' : 'Create Sticker'}
            </Text>
            <TouchableOpacity onPress={() => setShowStickerModal(false)}>
              <X size={24} color={themeColors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Sticker Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter sticker name"
                value={stickerFormData.name}
                onChangeText={(text) => setStickerFormData({ ...stickerFormData, name: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Sticker Image * (Supports PNG, JPG, and GIF)</Text>
              <TouchableOpacity
                style={styles.imagePicker}
                onPress={handlePickStickerImage}
              >
                {stickerFormData.imageUrl ? (
                  <View style={styles.previewContainer}>
                    <Image source={{ uri: stickerFormData.imageUrl }} style={styles.previewStickerImage} contentFit="contain" />
                    {stickerFormData.isAnimated && (
                      <View style={styles.animatedBadge}>
                        <Text style={styles.animatedBadgeText}>GIF</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <ImageIcon size={32} color={themeColors.text.secondary} />
                    <Text style={styles.imagePickerText}>Tap to select image or GIF</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Display Order</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={stickerFormData.displayOrder.toString()}
                onChangeText={(text) => setStickerFormData({ ...stickerFormData, displayOrder: parseInt(text) || 0 })}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.switchGroup}>
              <Text style={styles.label}>Animated (GIF)</Text>
              <TouchableOpacity
                style={[styles.switch, stickerFormData.isAnimated && styles.switchActive]}
                onPress={() => setStickerFormData({ ...stickerFormData, isAnimated: !stickerFormData.isAnimated })}
              >
                <View style={[styles.switchThumb, stickerFormData.isAnimated && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSaveSticker}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={themeColors.text.white} />
              ) : (
                <>
                  <Save size={20} color={themeColors.text.white} />
                  <Text style={styles.saveButtonText}>Save Sticker</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
  },
  searchSection: {
    padding: 16,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: colors.text.white,
  },
  mainContent: {
    flex: 1,
  },
  packsSection: {
    paddingBottom: 20,
  },
  stickersSection: {
    marginTop: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  countBadge: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.white,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.white,
  },
  packsList: {
    padding: 16,
    gap: 12,
  },
  packCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  packCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primary + '08',
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
  },
  packCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  packIcon: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: colors.background.secondary,
  },
  packIconPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  packInfo: {
    flex: 1,
  },
  packNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  packName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  packDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  packMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  packMetaText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.background.secondary,
  },
  statusBadgeActive: {
    backgroundColor: colors.primary + '20',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  statusTextActive: {
    color: colors.primary,
  },
  packActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
  },
  deleteButton: {
    marginLeft: 'auto',
  },
  stickersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  stickerCard: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: colors.background.primary,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  stickerImageContainer: {
    width: '100%',
    height: '70%',
    marginBottom: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerImage: {
    width: '100%',
    height: '100%',
  },
  gifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gifBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stickerName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 6,
    flex: 1,
  },
  stickerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
  },
  stickerActionButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: colors.background.secondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  imagePicker: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
  },
  imagePickerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    gap: 8,
  },
  imagePickerText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewStickerImage: {
    width: '100%',
    height: '100%',
  },
  animatedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  animatedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.background.secondary,
    padding: 2,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.text.white,
    alignSelf: 'flex-start',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.white,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
});

