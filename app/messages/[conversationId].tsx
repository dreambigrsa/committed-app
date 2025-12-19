import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image as RNImage,
  Linking,
  ImageBackground,
  Keyboard,
  Animated,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send, Trash2, Image as ImageIcon, FileText, X, Settings, Download, ZoomIn, Flag, MoreVertical, Smile, ChevronUp, ChevronDown } from 'lucide-react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
// @ts-ignore - legacy path works at runtime, TypeScript definitions may not include it
import * as FileSystem from 'expo-file-system/legacy';
// @ts-ignore - expo-media-library may not be installed yet
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/contexts/AppContext';
import colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import ReportContentModal from '@/components/ReportContentModal';
import StickerPicker from '@/components/StickerPicker';
import { Sticker, Advertisement } from '@/types';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink } from 'lucide-react-native';
import StatusIndicator from '@/components/StatusIndicator';
import { UserStatus } from '@/types';
import { getSignedUrlForMedia } from '@/lib/status-queries';
import { getOrCreateAIUser, getAIResponse } from '@/lib/ai-service';

/**
 * Status Preview Attachment Component
 * Handles loading signed URL from media path (which may be stored as path or URL)
 */
function StatusPreviewAttachment({ 
  mediaPath, 
  isMe, 
  onPress 
}: { 
  mediaPath: string; 
  isMe: boolean; 
  onPress: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      try {
        setLoading(true);
        
        // Check if mediaPath is already a URL (starts with http/https)
        // If it's a URL, use it directly (for backward compatibility)
        // If it's a path (starts with 'status-media/'), generate signed URL
        if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
          // Already a signed URL, use it directly
          if (isMounted) {
            setPreviewUrl(mediaPath);
            setLoading(false);
          }
        } else if (mediaPath.startsWith('status-media/')) {
          // It's a media path, generate signed URL
          const url = await getSignedUrlForMedia(mediaPath);
          if (isMounted) {
            setPreviewUrl(url);
            setLoading(false);
          }
        } else {
          // Try to generate signed URL anyway (might be a path without prefix)
          const url = await getSignedUrlForMedia(mediaPath);
          if (isMounted) {
            setPreviewUrl(url);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error loading status preview:', error);
        if (isMounted) {
          setPreviewUrl(null);
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [mediaPath]);

  if (loading || !previewUrl) {
    return (
      <View style={[
        styles.statusAttachment,
        isMe ? styles.statusAttachmentMe : styles.statusAttachmentThem,
        { justifyContent: 'center', alignItems: 'center', minHeight: 150 }
      ]}>
        {loading ? (
          <Text style={[styles.statusAttachmentLabel, isMe ? styles.statusAttachmentLabelMe : styles.statusAttachmentLabelThem]}>
            Loading preview...
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.statusAttachment,
        isMe ? styles.statusAttachmentMe : styles.statusAttachmentThem
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.statusAttachmentHeader}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.statusAttachmentIcon}
          contentFit="contain"
        />
        <Text style={[styles.statusAttachmentLabel, isMe ? styles.statusAttachmentLabelMe : styles.statusAttachmentLabelThem]}>
          Story Reply
        </Text>
      </View>
      <Image
        source={{ uri: previewUrl }}
        style={styles.statusAttachmentPreview}
        contentFit="cover"
      />
    </TouchableOpacity>
  );
}

export default function ConversationDetailScreen() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { currentUser, getConversation, sendMessage, deleteMessage, getChatBackground, setChatBackground, getMessageWarnings, acknowledgeWarning, reportContent, getActiveAds, getSmartAds, recordAdImpression, recordAdClick, getUserStatus } = useApp();
  const insets = useSafeAreaInsets();
  const [messageText, setMessageText] = useState<string>('');
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  const [chatBackground, setChatBackgroundState] = useState<any>(null);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<{ uri: string; name: string } | null>(null);
  const [selectedSticker, setSelectedSticker] = useState<{ id: string; imageUrl: string } | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedBackgroundImage, setSelectedBackgroundImage] = useState<string | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(0);
  const [overlayColor, setOverlayColor] = useState<string>('#000000');
  const [warnings, setWarnings] = useState<any[]>([]);
  const [warningTemplates, setWarningTemplates] = useState<any[]>([]);
  const [reportingMessage, setReportingMessage] = useState<{ id: string; senderId: string } | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showAttachments, setShowAttachments] = useState(true);
  const [smartAds, setSmartAds] = useState<Advertisement[]>([]);
  const [otherParticipantStatus, setOtherParticipantStatus] = useState<UserStatus | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const [aiUserId, setAiUserId] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<Record<string, 1 | -1>>({});
  const [aiIsThinking, setAiIsThinking] = useState(false);
  const conversation = getConversation(conversationId);
  const recordedImpressions = useRef<Set<string>>(new Set());
  
  // Animation for attachment buttons
  const attachmentButtonsOpacity = useRef(new Animated.Value(1)).current;
  const attachmentButtonsScale = useRef(new Animated.Value(1)).current;

  // Reset recorded impressions when ads change
  useEffect(() => {
    recordedImpressions.current.clear();
  }, [smartAds]);

  useEffect(() => {
    // Cache AI user id so we can show feedback UI on AI messages
    (async () => {
      try {
        const aiUser = await getOrCreateAIUser();
        if (aiUser?.id) setAiUserId(aiUser.id);
      } catch {
        // ignore
      }
    })();
  }, []);

  const submitAiFeedback = async (messageId: string, rating: 1 | -1) => {
    if (!currentUser || !conversationId) return;
    try {
      setAiFeedback(prev => ({ ...prev, [String(messageId)]: rating }));
      await supabase.from('ai_message_feedback').upsert({
        user_id: currentUser.id,
        conversation_id: conversationId,
        message_id: String(messageId),
        rating,
        created_at: new Date().toISOString(),
      } as any);
    } catch (e) {
      // Non-fatal
      console.error('Failed to submit AI feedback:', e);
    }
  };

  // Keyboard listeners
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setIsKeyboardVisible(true);
        setShowAttachments(false);
        // Track keyboard height for Android
        if (Platform.OS === 'android') {
          setKeyboardHeight(event.endCoordinates.height);
        }
        // Animate out attachment buttons when keyboard shows
        Animated.parallel([
          Animated.timing(attachmentButtonsOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(attachmentButtonsScale, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    );

    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
        // Reset to show attachments when keyboard hides
        setShowAttachments(true);
        Animated.parallel([
          Animated.timing(attachmentButtonsOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(attachmentButtonsScale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Load advertisements for messages
  useEffect(() => {
    const loadSmartAds = async () => {
      try {
        const ads = await getSmartAds('messages', [], 5);
        setSmartAds(ads);
      } catch (error) {
        console.error('Error loading smart ads for messages:', error);
        // Fallback to regular ads
        const fallbackAds = getActiveAds('messages');
        setSmartAds(fallbackAds.slice(0, 5));
      }
    };
    if (currentUser) {
      loadSmartAds();
    }
  }, [getSmartAds, getActiveAds, currentUser]);

  useEffect(() => {
    if (conversationId && currentUser) {
      let isMounted = true;

      loadMessages();
      loadChatBackground();
      loadWarnings();
      
      const subscription = supabase
        .channel(`conversation:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            if (!isMounted) return;
            const newMessage = payload.new;
            const isSender = newMessage.sender_id === currentUser.id;
            const isReceiver = newMessage.receiver_id === currentUser.id;
            const deletedForMe = (isSender && newMessage.deleted_for_sender) || (isReceiver && newMessage.deleted_for_receiver);
            
            // Only add if not deleted for current user
            if (!deletedForMe) {
              setLocalMessages((prev) => {
                // Check if message already exists (from optimistic update or duplicate)
                const exists = prev.some(m => m.id === newMessage.id);
                if (exists) {
                  // Update existing message (replace optimistic with real)
                  return prev.map(m => 
                    m.id === newMessage.id 
                      ? {
                          id: newMessage.id,
                          conversationId: newMessage.conversation_id,
                          senderId: newMessage.sender_id,
                          receiverId: newMessage.receiver_id,
                          content: newMessage.content,
                          mediaUrl: newMessage.media_url,
                          documentUrl: newMessage.document_url,
                          documentName: newMessage.document_name,
                          stickerId: newMessage.sticker_id,
                          messageType: newMessage.message_type || 'text',
                          deletedForSender: newMessage.deleted_for_sender || false,
                          deletedForReceiver: newMessage.deleted_for_receiver || false,
                          read: newMessage.read,
                          createdAt: newMessage.created_at,
                        }
                      : m
                  );
                }
                // Check if there's an optimistic message to replace
                // Match by: temp ID, same sender, same content, and recent time
                const optimisticMatch = prev.find(m => {
                  const isTemp = m.id.toString().startsWith('temp_');
                  const sameSender = m.senderId === newMessage.sender_id;
                  const sameContent = m.content === newMessage.content || 
                                     (m.messageType === 'image' && newMessage.message_type === 'image') ||
                                     (m.messageType === 'document' && newMessage.message_type === 'document' && m.documentName === newMessage.document_name);
                  const recentTime = Math.abs(new Date(m.createdAt).getTime() - new Date(newMessage.created_at).getTime()) < 10000; // 10 seconds
                  
                  return isTemp && sameSender && sameContent && recentTime;
                });
                
                if (optimisticMatch) {
                  // Replace optimistic message with real one
                  return prev.map(m => 
                    m.id === optimisticMatch.id 
                      ? {
                          id: newMessage.id,
                          conversationId: newMessage.conversation_id,
                          senderId: newMessage.sender_id,
                          receiverId: newMessage.receiver_id,
                          content: newMessage.content,
                          mediaUrl: newMessage.media_url,
                          documentUrl: newMessage.document_url,
                          documentName: newMessage.document_name,
                          stickerId: newMessage.sticker_id,
                          messageType: newMessage.message_type || 'text',
                          deletedForSender: newMessage.deleted_for_sender || false,
                          deletedForReceiver: newMessage.deleted_for_receiver || false,
                          read: newMessage.read,
                          createdAt: newMessage.created_at,
                        }
                      : m
                  );
                }
                
                // Add new message
                return [...prev, {
                  id: newMessage.id,
                  conversationId: newMessage.conversation_id,
                  senderId: newMessage.sender_id,
                  receiverId: newMessage.receiver_id,
                  content: newMessage.content,
                  mediaUrl: newMessage.media_url,
                  documentUrl: newMessage.document_url,
                  documentName: newMessage.document_name,
                  stickerId: newMessage.sticker_id,
                  messageType: newMessage.message_type || 'text',
                  deletedForSender: newMessage.deleted_for_sender || false,
                  deletedForReceiver: newMessage.deleted_for_receiver || false,
                  read: newMessage.read,
                  createdAt: newMessage.created_at,
                }];
              });
            } else {
              // If message is deleted for current user, remove it from local state
              setLocalMessages((prev) => prev.filter(m => m.id !== newMessage.id));
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const updatedMessage = payload.new;
            const isSender = updatedMessage.sender_id === currentUser.id;
            const isReceiver = updatedMessage.receiver_id === currentUser.id;
            const deletedForMe = (isSender && updatedMessage.deleted_for_sender) || (isReceiver && updatedMessage.deleted_for_receiver);
            
            setLocalMessages((prev) => {
              // If deleted for current user, remove it completely
              if (deletedForMe) {
                return prev.filter(m => m.id !== updatedMessage.id);
              }
              
              // Otherwise update the message
              return prev.map(m => 
                m.id === updatedMessage.id 
                  ? {
                      ...m,
                      content: updatedMessage.content,
                      deletedForSender: updatedMessage.deleted_for_sender || false,
                      deletedForReceiver: updatedMessage.deleted_for_receiver || false,
                    }
                  : m
              );
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_backgrounds',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            if (!isMounted) return;
            console.log('Chat background changed:', payload);
            // Reload background when it changes
            loadChatBackground();
          }
        )
        .subscribe();

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUser]);

  // Load other participant's status
  useEffect(() => {
    const loadOtherParticipantStatus = async () => {
      const other = getOtherParticipant();
      if (other?.id && currentUser && getUserStatus) {
        try {
          const status = await getUserStatus(other.id);
          if (status) {
            setOtherParticipantStatus(status);
          } else {
            // If no status exists, create a default offline status
            setOtherParticipantStatus({
              userId: other.id,
              statusType: 'offline',
              lastActiveAt: new Date().toISOString(),
              statusVisibility: 'contacts',
              lastSeenVisibility: 'contacts',
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('Failed to load participant status:', error);
          // Set default offline status on error
          setOtherParticipantStatus({
            userId: other.id,
            statusType: 'offline',
            lastActiveAt: new Date().toISOString(),
            statusVisibility: 'contacts',
            lastSeenVisibility: 'contacts',
            updatedAt: new Date().toISOString(),
          });
        }
      }
    };
    if (conversationId && currentUser && conversation) {
      loadOtherParticipantStatus();
    }
  }, [conversationId, currentUser, conversation, getUserStatus]);

  // Subscribe to status updates for other participant and refresh periodically
  useEffect(() => {
    if (!getUserStatus) return;
    const other = getOtherParticipant();
    if (!other?.id) return;

    let isMounted = true;

    // Load status immediately
    const refreshStatus = async () => {
      if (!isMounted) return;
      const status = await getUserStatus(other.id);
      if (isMounted) {
        setOtherParticipantStatus(status);
      }
    };
    refreshStatus();

    // Refresh status every 30 seconds to recalculate based on last_active_at
    const refreshInterval = setInterval(() => {
      if (isMounted) {
        refreshStatus();
      }
    }, 30 * 1000);

    const channel = supabase
      .channel(`user_status:${other.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_status',
          filter: `user_id=eq.${other.id}`,
        },
        async (payload) => {
          if (!isMounted) return;
          const status = await getUserStatus(other.id);
          if (isMounted) {
            setOtherParticipantStatus(status);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, [conversationId, conversation, getUserStatus]);

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data) {
        const filteredMessages = data
          .filter((m: any) => {
            const isSender = m.sender_id === currentUser!.id;
            const isReceiver = m.receiver_id === currentUser!.id;
            return !((isSender && m.deleted_for_sender) || (isReceiver && m.deleted_for_receiver));
          })
          .map((m: any) => ({
            id: m.id,
            conversationId: m.conversation_id,
            senderId: m.sender_id,
            receiverId: m.receiver_id,
            content: m.content,
            mediaUrl: m.media_url,
            documentUrl: m.document_url,
            documentName: m.document_name,
            stickerId: m.sticker_id,
            messageType: m.message_type || 'text',
            deletedForSender: m.deleted_for_sender || false,
            deletedForReceiver: m.deleted_for_receiver || false,
            read: m.read,
            createdAt: m.created_at,
            statusId: m.status_id,
            statusPreviewUrl: m.status_preview_url,
          }));
        setLocalMessages(filteredMessages);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const loadChatBackground = async () => {
    if (!conversationId || !currentUser) {
      console.log('Cannot load chat background - missing conversationId or currentUser');
      return;
    }
    
    try {
      console.log('Loading chat background for conversation:', conversationId, 'user:', currentUser.id);
      const background = await getChatBackground(conversationId);
      console.log('Loaded chat background:', background);
      
      if (background) {
        setChatBackgroundState(background);
        if (background.background_type === 'image') {
          setSelectedBackgroundImage(background.background_value);
          setBackgroundOpacity(background.opacity || 0);
          setOverlayColor(background.overlay_color || '#000000');
        }
      } else {
        console.log('No background found for this conversation');
        setChatBackgroundState(null);
      }
    } catch (error) {
      console.error('Error loading chat background:', error);
    }
  };

  const loadWarnings = async () => {
    if (!conversationId) return;
    try {
      const warningList = await getMessageWarnings(conversationId);
      setWarnings(warningList);
    } catch (error) {
      console.error('Error loading warnings:', error);
    }
  };

  const loadWarningTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('warning_templates')
        .select('*')
        .eq('active', true);
      if (error) throw error;
      setWarningTemplates(data || []);
    } catch (error) {
      console.error('Error loading warning templates:', error);
    }
  };

  useEffect(() => {
    loadWarningTemplates();
  }, []);

  // Subscribe to new warnings
  useEffect(() => {
    if (!conversationId || !currentUser) return;

    const subscription = supabase
      .channel(`warnings:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_warnings',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          loadWarnings();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_warnings',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          loadWarnings();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId, currentUser]);

  const downloadImage = async (imageUrl: string) => {
    try {
      setIsDownloading(true);
      
      // Request media library permissions (only photos, not audio)
      // Wrap in try-catch to handle audio permission errors gracefully
      let permissionStatus;
      try {
        const result = await MediaLibrary.requestPermissionsAsync();
        permissionStatus = result.status;
      } catch (error: any) {
        // If audio permission error occurs, try to continue with just photo permission
        if (error?.message?.includes('AUDIO permission')) {
          console.warn('Audio permission not available, continuing with photo permission only');
          // Check if we have photo permission via ImagePicker instead
          const imagePickerResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!imagePickerResult.granted) {
            Alert.alert('Permission Required', 'Please grant access to save photos to your gallery.');
            setIsDownloading(false);
            return;
          }
          permissionStatus = 'granted';
        } else {
          throw error;
        }
      }
      
      if (permissionStatus !== 'granted') {
        Alert.alert('Permission Required', 'Please grant access to save photos to your gallery.');
        setIsDownloading(false);
        return;
      }

      // Download the image
      const fileUri = `${FileSystem.cacheDirectory}image_${Date.now()}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error('Failed to download image');
      }

      // Save to media library
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
      await MediaLibrary.createAlbumAsync('Committed', asset, false);

      Alert.alert('Success', 'Image saved to gallery!');
    } catch (error) {
      console.error('Download image error:', error);
      Alert.alert('Error', 'Failed to save image to gallery. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const filename = `messages/${conversationId}/${Date.now()}.jpg`;
      
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
        .from('media')
        .upload(filename, fileData, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Upload image error:', error);
      return null;
    }
  };

  const uploadDocument = async (uri: string, name: string): Promise<string | null> => {
    try {
      const filename = `documents/${conversationId}/${Date.now()}_${name}`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('media')
        .upload(filename, blob, {
          contentType: 'application/octet-stream',
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Upload document error:', error);
      return null;
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setSelectedDocument(null);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedDocument({
          uri: result.assets[0].uri,
          name: result.assets[0].name || 'Document',
        });
        setSelectedImage(null);
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleSend = async () => {
    if (!conversation || !currentUser) return;

    const otherParticipantId = conversation.participants.find(
      (id) => id !== currentUser.id
    );
    if (!otherParticipantId) return;

    let mediaUrl: string | undefined;
    let documentUrl: string | undefined;
    let documentName: string | undefined;
    let stickerId: string | undefined;
    let messageType: 'text' | 'image' | 'document' | 'sticker' = 'text';

    if (selectedSticker) {
      mediaUrl = selectedSticker.imageUrl;
      stickerId = selectedSticker.id;
      messageType = 'sticker';
    } else if (selectedImage) {
      const uploadedUrl = await uploadImage(selectedImage);
      if (uploadedUrl) {
        mediaUrl = uploadedUrl;
        messageType = 'image';
      } else {
        Alert.alert('Error', 'Failed to upload image');
        return;
      }
    } else if (selectedDocument) {
      const uploadedUrl = await uploadDocument(selectedDocument.uri, selectedDocument.name);
      if (uploadedUrl) {
        documentUrl = uploadedUrl;
        documentName = selectedDocument.name;
        messageType = 'document';
      } else {
        Alert.alert('Error', 'Failed to upload document');
        return;
      }
    } else if (!messageText.trim()) {
      return;
    }

    const tempId = `temp_${Date.now()}`;
    const messageContent = messageText.trim() || (messageType === 'image' ? '' : (selectedDocument ? selectedDocument.name : ''));
    const optimisticMessage: any = {
      id: tempId,
      conversationId,
      senderId: currentUser.id,
      receiverId: otherParticipantId,
      content: messageContent,
      mediaUrl,
      documentUrl,
      documentName,
      messageType,
      read: false,
      deletedForSender: false,
      deletedForReceiver: false,
      createdAt: new Date().toISOString(),
    };

    // Add optimistic message immediately
    setLocalMessages(prev => [...prev, optimisticMessage]);
    setMessageText('');
    setSelectedImage(null);
    setSelectedDocument(null);

    // Scroll to bottom to show new message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      await sendMessage(
        conversationId,
        otherParticipantId,
        messageContent,
        mediaUrl,
        documentUrl,
        documentName,
        messageType,
        stickerId
      );
      
      // Check if the other participant is the AI user and respond if needed
      // Only respond to text messages (not images, documents, or stickers)
      if (messageType === 'text' && messageContent.trim()) {
        const aiUser = await getOrCreateAIUser();
        if (aiUser && otherParticipantId === aiUser.id) {
          // This is a conversation with the AI, trigger AI response
          try {
            setAiIsThinking(true);
            const typingId = `ai_typing_${Date.now()}`;
            setLocalMessages(prev => [
              ...prev,
              {
                id: typingId,
                conversationId,
                senderId: aiUser.id,
                receiverId: currentUser.id,
                content: 'Committed AI is thinking…',
                messageType: 'text',
                read: true,
                deletedForSender: false,
                deletedForReceiver: false,
                createdAt: new Date().toISOString(),
              },
            ]);

            // Get conversation history for context
            const existingMessages = localMessages || [];
            const conversationHistory = existingMessages
              .slice(-20) // Last 20 messages for context
              .map((msg: any) => ({
                role: msg.senderId === currentUser.id ? 'user' as const : 'assistant' as const,
                content: msg.content || '',
              }));

            // Add the current message to history
            conversationHistory.push({
              role: 'user' as const,
              content: messageContent,
            });

            const isNewConversation = existingMessages.length === 0;

            // Get AI response
            const aiResponse = await getAIResponse(
              messageContent,
              conversationHistory,
              isNewConversation,
              currentUser.fullName,
              currentUser.username,
              currentUser.id
            );

            // Remove typing indicator
            setLocalMessages(prev => prev.filter(m => m.id !== typingId));
            setAiIsThinking(false);

            if (aiResponse.success) {
              // Send AI response using database function or direct insert
              try {
                const messageData: any = {
                  conversation_id: conversationId,
                  sender_id: aiUser.id,
                  receiver_id: currentUser.id,
                  content: aiResponse.message || '',
                  message_type: aiResponse.contentType === 'image' ? 'image' : 
                               aiResponse.contentType === 'document' ? 'document' : 'text',
                };

                if (aiResponse.contentType === 'image' && aiResponse.imageUrl) {
                  messageData.media_url = aiResponse.imageUrl;
                  messageData.content = aiResponse.message || 'I\'ve generated an image for you!';
                } else if (aiResponse.contentType === 'document' && aiResponse.documentUrl) {
                  messageData.document_url = aiResponse.documentUrl;
                  messageData.document_name = aiResponse.documentName || 'document.txt';
                  messageData.content = aiResponse.message || 'I\'ve generated a document for you!';
                }

                // Try direct insert first (RLS policy should allow AI to send messages)
                const { error: insertError } = await supabase
                  .from('messages')
                  .insert(messageData);

                if (insertError) {
                  // If direct insert fails, try using the RPC function
                  const { error: rpcError } = await supabase
                    .rpc('send_ai_message', {
                      p_conversation_id: conversationId,
                      p_receiver_id: currentUser.id,
                      p_content: messageData.content,
                      p_message_type: messageData.message_type,
                      p_media_url: messageData.media_url || null,
                      p_document_url: messageData.document_url || null,
                      p_document_name: messageData.document_name || null,
                      p_sticker_id: null,
                      p_status_id: null,
                      p_status_preview_url: null,
                    });

                  if (rpcError) {
                    console.error('Error sending AI response:', JSON.stringify(rpcError, null, 2));
                  }
                }
              } catch (error: any) {
                console.error('Error sending AI response:', error);
              }
            }
          } catch (error: any) {
            setAiIsThinking(false);
            console.error('Error generating AI response:', error);
            // Don't show error to user - AI failure shouldn't block the conversation
          }
        }
      }
      
      // Don't remove optimistic message here - let real-time subscription handle it
      // The real-time subscription will replace the optimistic message with the real one
      // We match by content, sender, and time to replace the optimistic message
      
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic message on error
      setLocalMessages(prev => prev.filter((m) => m.id !== tempId));
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  const getOtherParticipant = () => {
    if (!conversation || !currentUser) return null;
    // Find the other participant (not the current user)
    const otherParticipantId = conversation.participants.find(id => id !== currentUser.id);
    if (!otherParticipantId) return null;
    
    // Find the index of the other participant in the participants array
    const otherIndex = conversation.participants.indexOf(otherParticipantId);
    
    // Ensure we have valid data - if index is out of bounds, try to find by ID
    let name = 'Unknown';
    let avatar: string | undefined = undefined;
    
    if (otherIndex >= 0 && otherIndex < conversation.participantNames.length) {
      name = conversation.participantNames[otherIndex] || 'Unknown';
      avatar = conversation.participantAvatars[otherIndex];
    } else {
      // Fallback: find by matching participant ID with names/avatars
      // This handles cases where arrays might be misaligned
      const currentUserIndex = conversation.participants.indexOf(currentUser.id);
      if (currentUserIndex === 0 && conversation.participantNames.length > 1) {
        // Current user is first, other is second
        name = conversation.participantNames[1] || 'Unknown';
        avatar = conversation.participantAvatars[1];
      } else if (conversation.participantNames.length > 0) {
        // Current user is second, other is first
        name = conversation.participantNames[0] || 'Unknown';
        avatar = conversation.participantAvatars[0];
      }
      // If arrays are empty, name and avatar remain 'Unknown' and undefined
    }
    
    return {
      id: otherParticipantId,
      name,
      avatar,
    };
  };

  // Early return guard - must be after all hooks
  if (!currentUser || !conversationId) {
    return null;
  }

  const otherParticipant = getOtherParticipant();

  if (!conversation || !otherParticipant) {
    return null;
  }

  const handleDeleteMessage = async (messageId: string, isSender: boolean) => {
    const message = localMessages.find(m => m.id === messageId);
    if (!message) return;

    if (isSender) {
      // Sender can delete for everyone or just for themselves
      Alert.alert(
        'Delete Message',
        'How would you like to delete this message?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete for me',
            style: 'default',
            onPress: async () => {
              const success = await deleteMessage(messageId, conversationId, false);
              if (success) {
                setLocalMessages(prev => prev.filter(m => m.id !== messageId));
              } else {
                Alert.alert('Error', 'Failed to delete message');
              }
            },
          },
          {
            text: 'Delete for everyone',
            style: 'destructive',
            onPress: async () => {
              const success = await deleteMessage(messageId, conversationId, true);
              if (success) {
                // Update message to show deleted state
                setLocalMessages(prev => prev.map(m => 
                  m.id === messageId 
                    ? { ...m, content: 'This message was deleted', deletedForSender: true, deletedForReceiver: true }
                    : m
                ));
                // Real-time update will also handle this
              } else {
                Alert.alert('Error', 'Failed to delete message');
              }
            },
          },
        ]
      );
    } else {
      // Receiver can only delete for themselves
      Alert.alert(
        'Delete Message',
        'Delete this message for yourself?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const success = await deleteMessage(messageId, conversationId, false);
              if (success) {
                setLocalMessages(prev => prev.filter(m => m.id !== messageId));
              } else {
                Alert.alert('Error', 'Failed to delete message');
              }
            },
          },
        ]
      );
    }
  };

  const getBackgroundStyle = () => {
    if (!chatBackground) {
      return { backgroundColor: colors.background.secondary };
    }

    switch (chatBackground.background_type) {
      case 'color':
        return { backgroundColor: chatBackground.background_value };
      case 'image':
        return { backgroundColor: colors.background.secondary };
      case 'gradient':
        return { backgroundColor: colors.background.secondary };
      default:
        return { backgroundColor: colors.background.secondary };
    }
  };

  const renderBackgroundImage = () => {
    if (!chatBackground || chatBackground.background_type !== 'image' || !chatBackground.background_value) {
      return null;
    }

    const opacity = chatBackground.opacity || 0;
    const overlayOpacity = opacity / 10; // Convert 0-10 to 0-1
    const overlayColorValue = chatBackground.overlay_color || '#000000';
    
    // Convert hex color to rgba
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    return (
      <ImageBackground
        source={{ uri: chatBackground.background_value }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: hexToRgba(overlayColorValue, overlayOpacity) }]} />
      </ImageBackground>
    );
  };

  const handlePickBackgroundImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedBackgroundImage(result.assets[0].uri);
    }
  };

  const getLastSeenText = (lastActiveAt: string, statusType?: string, userId?: string) => {
    // Check if this is the AI user - always show as online
    const other = getOtherParticipant();
    if (other && other.name === 'Committed AI') {
      return 'Online';
    }

    // Also check by userId if available (AI user email is 'ai@committed.app')
    // For now, we rely on the name check above, and getUserStatus will handle it

    const lastActive = new Date(lastActiveAt);
    const now = new Date();
    const diffMs = now.getTime() - lastActive.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffSeconds = Math.floor(diffMs / 1000);

    // If user is online, show "Online"
    if (statusType === 'online') {
      return 'Online';
    }

    // If user is away, show "Away"
    if (statusType === 'away') {
      return 'Away';
    }

    // If user is busy, show "Busy"
    if (statusType === 'busy') {
      return 'Busy';
    }

    // For offline users, show last seen time
    // If just went offline (within last 2 minutes), show "Just now"
    if (statusType === 'offline' && diffSeconds < 120) {
      return 'Just now';
    }

    // Show relative time
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `Last seen ${diffMins}m ago`;
    if (diffHours < 24) return `Last seen ${diffHours}h ago`;
    if (diffDays < 7) return `Last seen ${diffDays}d ago`;
    return `Last seen ${lastActive.toLocaleDateString()}`;
  };

  const handleAdPress = async (ad: Advertisement) => {
    await recordAdClick(ad.id);
    if (ad.linkUrl) {
      await WebBrowser.openBrowserAsync(ad.linkUrl);
    }
  };

  const renderBannerAd = (ad: Advertisement) => {
    // Prevent duplicate impressions
    if (!recordedImpressions.current.has(ad.id)) {
      recordAdImpression(ad.id);
      recordedImpressions.current.add(ad.id);
    }
    return (
      <View key={`ad-banner-${ad.id}`} style={styles.bannerAdContainer}>
        <TouchableOpacity
          style={styles.bannerAdCard}
          onPress={() => handleAdPress(ad)}
          activeOpacity={0.9}
        >
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>Sponsored</Text>
          </View>
          <Image 
            source={{ uri: ad.imageUrl }} 
            style={styles.bannerAdImage} 
            contentFit="cover"
            onError={() => console.error('Failed to load banner ad image:', ad.id)}
          />
          <View style={styles.bannerAdContent}>
            <Text style={styles.bannerAdTitle}>{ad.title}</Text>
            {ad.linkUrl && (
              <View style={styles.bannerAdLinkButton}>
                <Text style={styles.bannerAdLinkText}>Learn More</Text>
                <ExternalLink size={14} color={colors.primary} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCardAd = (ad: Advertisement) => {
    // Prevent duplicate impressions
    if (!recordedImpressions.current.has(ad.id)) {
      recordAdImpression(ad.id);
      recordedImpressions.current.add(ad.id);
    }
    return (
      <View key={`ad-card-${ad.id}`} style={styles.adContainer}>
        <TouchableOpacity
          style={styles.adCard}
          onPress={() => handleAdPress(ad)}
          activeOpacity={0.9}
        >
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>Sponsored</Text>
          </View>
          <Image 
            source={{ uri: ad.imageUrl }} 
            style={styles.adImage} 
            contentFit="cover"
            onError={() => console.error('Failed to load card ad image:', ad.id)}
          />
          <View style={styles.adContent}>
            <Text style={styles.adTitle}>{ad.title}</Text>
            <Text style={styles.adDescription} numberOfLines={2}>
              {ad.description}
            </Text>
            {ad.linkUrl && (
              <View style={styles.adLinkButton}>
                <Text style={styles.adLinkText}>Learn More</Text>
                <ExternalLink size={16} color={colors.primary} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderVideoAd = (ad: Advertisement) => {
    // Prevent duplicate impressions
    if (!recordedImpressions.current.has(ad.id)) {
      recordAdImpression(ad.id);
      recordedImpressions.current.add(ad.id);
    }
    return (
      <View key={`ad-video-${ad.id}`} style={styles.adContainer}>
        <View style={styles.videoAdCard}>
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>Sponsored</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleAdPress(ad)}
            activeOpacity={0.9}
          >
          <Video
            source={{ uri: ad.imageUrl }}
            style={styles.videoAdImage}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            onError={(error) => {
              console.error('Failed to load video ad:', ad.id, error);
            }}
          />
          </TouchableOpacity>
          <View style={styles.adContent}>
            <Text style={styles.adTitle}>{ad.title}</Text>
            <Text style={styles.adDescription} numberOfLines={2}>
              {ad.description}
            </Text>
            {ad.linkUrl && (
              <View style={styles.adLinkButton}>
                <Text style={styles.adLinkText}>Learn More</Text>
                <ExternalLink size={16} color={colors.primary} />
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderAd = (ad: Advertisement) => {
    switch (ad.type) {
      case 'banner':
        return renderBannerAd(ad);
      case 'video':
        return renderVideoAd(ad);
      case 'card':
      default:
        return renderCardAd(ad);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    if (!item || !item.id) return null;

    // Render AI typing indicator without warnings/actions
    if (typeof item.id === 'string' && item.id.startsWith('ai_typing_')) {
      return (
        <View style={[styles.messageContainer, styles.theirMessageContainer]}>
          <View style={[styles.messageBubble, styles.theirMessage]}>
            <View style={styles.aiThinkingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.messageText, styles.theirMessageText]}>{item.content}</Text>
            </View>
          </View>
        </View>
      );
    }
    
    const isMe = item.senderId === currentUser.id;
    const isDeleted = (isMe && item.deletedForSender) || (!isMe && item.deletedForReceiver);
    const messageTime = new Date(item.createdAt).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    // Check if this message has a warning
    const messageWarning = warnings.find(w => w.messageId === item.id && !w.acknowledged);

    // Don't render deleted messages at all - they should be filtered out
    if (isDeleted) {
      return null;
    }

    return (
      <>
        {messageWarning && (
          <View style={styles.warningBanner}>
            <View style={[
              styles.warningContent,
              messageWarning.severity === 'high' ? styles.warningHigh : 
              messageWarning.severity === 'medium' ? styles.warningMedium : 
              styles.warningLow
            ]}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <View style={styles.warningTextContainer}>
                <Text style={styles.warningTitle}>
                  {messageWarning.severity === 'high' ? 'High Risk Warning' :
                   messageWarning.severity === 'medium' ? 'Medium Risk Warning' :
                   'Low Risk Warning'}
                </Text>
                <Text style={styles.warningMessage}>
                  {(() => {
                    const template = warningTemplates.find(t => t.severity === messageWarning.severity);
                    if (template) {
                      return template.in_chat_warning_template
                        .replace('{trigger_words}', messageWarning.triggerWords.join(', '))
                        .replace('{severity}', messageWarning.severity);
                    }
                    return `This message contains potentially inappropriate content. Trigger words detected: ${messageWarning.triggerWords.join(', ')}`;
                  })()}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.acknowledgeButton}
                onPress={async () => {
                  const success = await acknowledgeWarning(messageWarning.id);
                  if (success) {
                    setWarnings(prev => prev.map(w => 
                      w.id === messageWarning.id ? { ...w, acknowledged: true } : w
                    ));
                  }
                }}
              >
                <Text style={styles.acknowledgeButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.messageContainer,
            isMe ? styles.myMessageContainer : styles.theirMessageContainer,
          ]}
          onLongPress={() => handleDeleteMessage(item.id, isMe)}
          activeOpacity={0.9}
        >
          <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
          {item.messageType === 'image' && item.mediaUrl ? (
            <TouchableOpacity
              onPress={() => setViewingImage(item.mediaUrl)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: item.mediaUrl }}
                style={styles.messageImage}
                contentFit="cover"
              />
            </TouchableOpacity>
          ) : null}
          
          {item.messageType === 'document' && item.documentUrl ? (
            <TouchableOpacity
              style={styles.documentContainer}
              onPress={() => {
                if (item.documentUrl) {
                  Linking.openURL(item.documentUrl);
                }
              }}
            >
              <FileText size={24} color={isMe ? colors.text.white : colors.primary} />
              <Text style={[styles.documentName, isMe ? styles.myMessageText : styles.theirMessageText]}>
                {item.documentName || 'Document'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {item.messageType === 'sticker' && item.mediaUrl ? (
            <View style={styles.stickerContainer}>
              <Image
                source={{ uri: item.mediaUrl }}
                style={styles.stickerImage}
                contentFit="contain"
              />
            </View>
          ) : null}

          {/* Status Attachment - Highlighted */}
          {item.statusId && item.statusPreviewUrl ? (
            <StatusPreviewAttachment
              mediaPath={item.statusPreviewUrl}
              isMe={isMe}
              onPress={() => {
                // Get status owner from conversation
                const otherParticipantId = conversation?.participants.find(id => id !== currentUser.id);
                if (otherParticipantId) {
                  router.push(`/status/${otherParticipantId}` as any);
                }
              }}
            />
          ) : null}

          {item.content && typeof item.content === 'string' && item.content.trim() && item.messageType !== 'sticker' ? (
            <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
              {item.content}
            </Text>
          ) : null}

          {/* AI feedback (thumbs up/down) */}
          {!isMe && aiUserId && item.senderId === aiUserId && item.messageType === 'text' ? (
            <View style={styles.aiFeedbackRow}>
              <TouchableOpacity
                onPress={() => submitAiFeedback(item.id, 1)}
                style={[
                  styles.aiFeedbackButton,
                  aiFeedback[String(item.id)] === 1 && styles.aiFeedbackSelected,
                ]}
              >
                <Text style={styles.aiFeedbackText}>👍</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => submitAiFeedback(item.id, -1)}
                style={[
                  styles.aiFeedbackButton,
                  aiFeedback[String(item.id)] === -1 && styles.aiFeedbackSelected,
                ]}
              >
                <Text style={styles.aiFeedbackText}>👎</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMe ? styles.myMessageTime : styles.theirMessageTime]}>
              {messageTime}
            </Text>
            <View style={styles.messageActions}>
              {!isMe && (
                <TouchableOpacity
                  onPress={() => setReportingMessage({ id: item.id, senderId: item.senderId })}
                  style={styles.reportMessageButton}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
                  <Flag size={14} color={colors.danger} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => handleDeleteMessage(item.id, isMe)}
                style={styles.deleteMessageButton}
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
              >
                <Trash2 size={14} color={isMe ? 'rgba(255, 255, 255, 0.7)' : colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
      </>
    );
  };

  const renderImageViewer = () => {
    return (
      <Modal
        visible={viewingImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingImage(null)}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.imageViewerClose}
            onPress={() => setViewingImage(null)}
          >
            <X size={28} color={colors.text.white} />
          </TouchableOpacity>
          {viewingImage && (
            <>
              <Image
                source={{ uri: viewingImage }}
                style={styles.fullScreenImage}
                contentFit="contain"
              />
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => downloadImage(viewingImage)}
                disabled={isDownloading}
              >
                <Download size={24} color={colors.text.white} />
                <Text style={styles.downloadButtonText}>
                  {isDownloading ? 'Saving...' : 'Save to Gallery'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    );
  };

  const renderBackgroundModal = () => {
    const backgroundColors = [
      '#FFFFFF', '#F0F0F0', '#E8F5E9', '#E3F2FD', '#FFF3E0',
      '#FCE4EC', '#F3E5F5', '#E0F2F1', '#FFF9C4', '#FFEBEE',
    ];

    const overlayColors = [
      '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
      '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
      '#FFC0CB', '#A52A2A', '#808080', '#000080', '#008000',
    ];

    return (
      <Modal
        visible={showBackgroundModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBackgroundModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chat Background</Text>
              <TouchableOpacity onPress={() => setShowBackgroundModal(false)}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.backgroundOptions}>
              <Text style={styles.backgroundSectionTitle}>Colors</Text>
              <View style={styles.colorGrid}>
                {backgroundColors.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[styles.colorOption, { backgroundColor: color }]}
                    onPress={async () => {
                      const success = await setChatBackground(conversationId, 'color', color);
                      if (success) {
                        setChatBackgroundState({ background_type: 'color', background_value: color });
                        setShowBackgroundModal(false);
                      }
                    }}
                  />
                ))}
              </View>

              <Text style={[styles.backgroundSectionTitle, { marginTop: 24 }]}>Custom Image</Text>
              <TouchableOpacity
                style={styles.imageBackgroundButton}
                onPress={handlePickBackgroundImage}
              >
                <ImageIcon size={20} color={colors.primary} />
                <Text style={styles.imageBackgroundButtonText}>
                  {selectedBackgroundImage ? 'Change Image' : 'Select from Gallery'}
                </Text>
              </TouchableOpacity>

              {selectedBackgroundImage && (
                <>
                  <View style={styles.imagePreviewContainer}>
                    <ImageBackground
                      source={{ uri: selectedBackgroundImage }}
                      style={styles.backgroundPreview}
                      resizeMode="cover"
                    >
                      <View 
                        style={[
                          styles.backgroundPreview, 
                          { 
                            backgroundColor: (() => {
                              const r = parseInt(overlayColor.slice(1, 3), 16);
                              const g = parseInt(overlayColor.slice(3, 5), 16);
                              const b = parseInt(overlayColor.slice(5, 7), 16);
                              return `rgba(${r}, ${g}, ${b}, ${backgroundOpacity / 10})`;
                            })()
                          }
                        ]} 
                      />
                    </ImageBackground>
                  </View>

                  <Text style={[styles.backgroundSectionTitle, { marginTop: 20 }]}>Overlay Color</Text>
                  <View style={styles.colorGrid}>
                    {overlayColors.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorOption, 
                          { backgroundColor: color },
                          overlayColor === color && styles.selectedColorOption
                        ]}
                        onPress={() => setOverlayColor(color)}
                      />
                    ))}
                  </View>

                  <View style={styles.opacityContainer}>
                    <Text style={styles.opacityLabel}>Opacity: {backgroundOpacity}/10</Text>
                    <View style={styles.sliderContainer}>
                      <Text style={styles.sliderLabel}>0</Text>
                      <View style={styles.sliderWrapper}>
                        <View style={styles.sliderTrack}>
                          <View 
                            style={[
                              styles.sliderFill, 
                              { width: `${(backgroundOpacity / 10) * 100}%` }
                            ]} 
                          />
                          <View 
                            style={[
                              styles.sliderThumb,
                              { left: `${(backgroundOpacity / 10) * 100}%` }
                            ]}
                          />
                        </View>
                        <TouchableOpacity
                          style={StyleSheet.absoluteFill}
                          onPress={(e) => {
                            const { locationX, target } = e.nativeEvent;
                            const width = (target as any)?.layout?.width || 300;
                            const newValue = Math.round((locationX / width) * 10);
                            setBackgroundOpacity(Math.max(0, Math.min(10, newValue)));
                          }}
                          activeOpacity={1}
                        />
                      </View>
                      <Text style={styles.sliderLabel}>10</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.applyButton}
                    onPress={async () => {
                      try {
                        // Upload image to Supabase if it's a local URI
                        let imageUrl = selectedBackgroundImage;
                        if (selectedBackgroundImage && (selectedBackgroundImage.startsWith('file://') || selectedBackgroundImage.startsWith('ph://') || selectedBackgroundImage.startsWith('content://'))) {
                          // Upload to Supabase
                          const uploadedUrl = await uploadImage(selectedBackgroundImage);
                          if (uploadedUrl) {
                            imageUrl = uploadedUrl;
                          } else {
                            Alert.alert('Error', 'Failed to upload background image. Please try again.');
                            return;
                          }
                        }

                        console.log('Applying background with:', { imageUrl, backgroundOpacity, overlayColor });
                        const success = await setChatBackground(conversationId, 'image', imageUrl, backgroundOpacity, overlayColor);
                        
                        if (success) {
                          const newBackground = { 
                            background_type: 'image' as const, 
                            background_value: imageUrl,
                            opacity: backgroundOpacity,
                            overlay_color: overlayColor
                          };
                          setChatBackgroundState(newBackground);
                          setShowBackgroundModal(false);
                          Alert.alert('Success', 'Background saved! It will be available on all your devices.');
                        } else {
                          Alert.alert('Error', 'Failed to save background. Please try again.');
                        }
                      } catch (error) {
                        console.error('Error applying background:', error);
                        Alert.alert('Error', 'Failed to save background. Please try again.');
                      }
                    }}
                  >
                    <Text style={styles.applyButtonText}>Apply Background</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <TouchableOpacity
                onPress={() => {
                  try {
                    if (router.canGoBack()) {
                      router.back();
                    } else {
                      router.replace('/(tabs)/messages' as any);
                    }
                  } catch (error) {
                    // Fallback navigation
                    router.replace('/(tabs)/messages' as any);
                  }
                }}
                style={styles.backButton}
              >
                <ArrowLeft size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (otherParticipant?.id) {
                    router.push(`/profile/${otherParticipant.id}` as any);
                  }
                }}
                style={styles.headerProfileButton}
                activeOpacity={0.7}
              >
                <View style={styles.headerAvatarContainer}>
                  {otherParticipant.avatar ? (
                    <Image
                      source={{ uri: otherParticipant.avatar }}
                      style={styles.headerAvatar}
                    />
                  ) : (
                    <View style={styles.headerAvatarPlaceholder}>
                      <Text style={styles.headerAvatarPlaceholderText}>
                        {otherParticipant.name?.charAt(0) || '?'}
                      </Text>
                    </View>
                  )}
                  <StatusIndicator 
                    status={otherParticipantStatus?.statusType || 'offline'} 
                    size="small" 
                    showBorder={true}
                  />
                </View>
              </TouchableOpacity>
              <View style={styles.headerNameContainer}>
                <Text style={styles.headerName}>{otherParticipant.name}</Text>
                <Text style={styles.headerStatus}>
                  {otherParticipantStatus 
                    ? (otherParticipantStatus.statusType === 'online' 
                        ? 'Online' 
                        : otherParticipantStatus.statusType === 'away'
                        ? 'Away'
                        : otherParticipantStatus.statusType === 'busy'
                        ? 'Busy'
                        : getLastSeenText(otherParticipantStatus.lastActiveAt, otherParticipantStatus.statusType, otherParticipant?.id))
                    : 'Loading...'}
                </Text>
              </View>
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowBackgroundModal(true)}
              style={styles.headerRight}
            >
              <Settings size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={[styles.container, getBackgroundStyle()]}>
        {renderBackgroundImage()}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
          enabled={Platform.OS === 'ios'}
        >
          <FlatList
            ref={flatListRef}
            data={localMessages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={
              smartAds.length > 0 ? (
                <View style={styles.adHeaderContainer}>
                  {smartAds.slice(0, 1).map(ad => renderAd(ad))}
                </View>
              ) : null
            }
          />

          {(selectedImage || selectedDocument || selectedSticker) && (
            <View style={styles.attachmentPreview}>
              {selectedImage && (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removeAttachment}
                    onPress={() => setSelectedImage(null)}
                  >
                    <X size={20} color={colors.text.white} />
                  </TouchableOpacity>
                </View>
              )}
              {selectedDocument && (
                <View style={styles.documentPreview}>
                  <FileText size={24} color={colors.primary} />
                  <Text style={styles.documentPreviewText} numberOfLines={1}>
                    {selectedDocument.name}
                  </Text>
                  <TouchableOpacity
                    style={styles.removeDocumentButton}
                    onPress={() => setSelectedDocument(null)}
                  >
                    <X size={18} color={colors.text.primary} />
                  </TouchableOpacity>
                </View>
              )}
              {selectedSticker && (
                <View style={styles.stickerPreview}>
                  <Image source={{ uri: selectedSticker.imageUrl }} style={styles.previewSticker} />
                  <TouchableOpacity
                    style={styles.removeStickerButton}
                    onPress={() => setSelectedSticker(null)}
                  >
                    <X size={18} color={colors.text.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <Animated.View
            style={[
              styles.inputContainer,
              {
                paddingBottom: Math.max(insets.bottom, 12),
                marginBottom: Platform.OS === 'android' && keyboardHeight > 0 ? keyboardHeight : 0,
              },
            ]}
          >
            {/* Attachment Toggle Button - Only show when keyboard is visible */}
            {isKeyboardVisible && (
              <TouchableOpacity
                style={styles.attachmentToggleButton}
                onPress={() => {
                  const newShowState = !showAttachments;
                  setShowAttachments(newShowState);
                  if (newShowState) {
                    Animated.parallel([
                      Animated.timing(attachmentButtonsOpacity, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                      }),
                      Animated.timing(attachmentButtonsScale, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                      }),
                    ]).start();
                  } else {
                    Animated.parallel([
                      Animated.timing(attachmentButtonsOpacity, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                      }),
                      Animated.timing(attachmentButtonsScale, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                      }),
                    ]).start();
                  }
                }}
                activeOpacity={0.7}
              >
                {showAttachments ? (
                  <ChevronDown size={20} color={colors.primary} />
                ) : (
                  <ChevronUp size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}

            {/* Attachment Buttons - Animated */}
            <Animated.View
              pointerEvents={(!isKeyboardVisible || showAttachments) ? 'auto' : 'none'}
              style={[
                styles.attachmentButtonsContainer,
                {
                  opacity: attachmentButtonsOpacity,
                  transform: [{ scaleX: attachmentButtonsScale }],
                  width: (!isKeyboardVisible || showAttachments) ? 136 : 0,
                  overflow: 'hidden',
                },
              ]}
            >
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={handlePickImage}
                activeOpacity={0.7}
                disabled={isKeyboardVisible && !showAttachments}
              >
                <ImageIcon size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={handlePickDocument}
                activeOpacity={0.7}
                disabled={isKeyboardVisible && !showAttachments}
              >
                <FileText size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={() => setShowStickerPicker(true)}
                activeOpacity={0.7}
                disabled={isKeyboardVisible && !showAttachments}
              >
                <Smile size={22} color={colors.primary} />
              </TouchableOpacity>
            </Animated.View>

            {/* Text Input - Always flex: 1 to fill available space */}
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor={colors.text.tertiary}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={1000}
              onFocus={() => {
                // Keyboard listener will handle the animation
              }}
            />
            
            <TouchableOpacity
              style={[styles.sendButton, (!messageText.trim() && !selectedImage && !selectedDocument && !selectedSticker) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!messageText.trim() && !selectedImage && !selectedDocument && !selectedSticker}
            >
              <Send
                size={20}
                color={(messageText.trim() || selectedImage || selectedDocument || selectedSticker) ? colors.text.white : colors.text.tertiary}
              />
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      {renderBackgroundModal()}
      {renderImageViewer()}

      {/* Report Message Modal */}
      <ReportContentModal
        visible={!!reportingMessage}
        onClose={() => setReportingMessage(null)}
        contentType="message"
        contentId={reportingMessage?.id}
        reportedUserId={reportingMessage?.senderId}
        onReport={reportContent}
        colors={colors}
      />

      {/* Sticker Picker Modal */}
      <StickerPicker
        visible={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelectSticker={(sticker: Sticker) => {
          setSelectedSticker({ id: sticker.id, imageUrl: sticker.imageUrl });
          setShowStickerPicker(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerProfileButton: {
    padding: 2,
  },
  headerRight: {
    padding: 4,
  },
  headerAvatarContainer: {
    position: 'relative',
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarPlaceholderText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  headerNameContainer: {
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  headerStatus: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 100,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  myMessage: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: colors.background.primary,
    borderBottomLeftRadius: 4,
  },
  messageImage: {
    width: 250,
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
    marginBottom: 8,
  },
  documentName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  myMessageText: {
    color: colors.text.white,
  },
  theirMessageText: {
    color: colors.text.primary,
  },
  deletedMessageText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  messageTime: {
    fontSize: 11,
  },
  messageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportMessageButton: {
    padding: 2,
  },
  deleteMessageButton: {
    padding: 2,
  },
  aiFeedbackRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  aiFeedbackButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  aiFeedbackSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  aiFeedbackText: {
    fontSize: 14,
  },
  aiThinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirMessageTime: {
    color: colors.text.tertiary,
  },
  attachmentPreview: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  documentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
  },
  documentPreviewText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
  },
  removeAttachment: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeDocumentButton: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  attachmentToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 0,
    minWidth: 0, // Allow container to shrink below content size
  },
  attachmentButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text.primary,
    marginHorizontal: 0,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.background.secondary,
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
    maxHeight: '80%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  backgroundOptions: {
    padding: 20,
  },
  backgroundSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },
  downloadButton: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  downloadButtonText: {
    color: colors.text.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  stickerContainer: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerImage: {
    width: 120,
    height: 120,
  },
  statusAttachment: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 2,
  },
  statusAttachmentMe: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusAttachmentThem: {
    borderColor: colors.primary + '40',
    backgroundColor: colors.background.secondary,
  },
  statusAttachmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  statusAttachmentIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  statusAttachmentLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  statusAttachmentLabelMe: {
    color: '#fff',
  },
  statusAttachmentLabelThem: {
    color: colors.primary,
  },
  statusAttachmentPreview: {
    width: '100%',
    height: 150,
  },
  stickerPreview: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  previewSticker: {
    width: 80,
    height: 80,
  },
  removeStickerButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  imageBackgroundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginTop: 8,
  },
  imageBackgroundButtonText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: colors.text.primary,
  },
  backgroundPreview: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
  },
  opacityContainer: {
    marginTop: 20,
    paddingVertical: 12,
  },
  opacityLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 12,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    minWidth: 24,
    textAlign: 'center',
  },
  sliderWrapper: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    height: 4,
    backgroundColor: colors.border.light,
    borderRadius: 2,
    position: 'relative',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    position: 'absolute',
    top: -8,
    marginLeft: -10,
    borderWidth: 2,
    borderColor: colors.text.white,
  },
  applyButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  applyButtonText: {
    color: colors.text.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: colors.primary,
    transform: [{ scale: 1.1 }],
  },
  warningBanner: {
    marginBottom: 8,
    marginHorizontal: 16,
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  warningHigh: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  warningMedium: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningLow: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  warningIcon: {
    fontSize: 24,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  warningMessage: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  acknowledgeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  acknowledgeButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  adHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  adContainer: {
    marginBottom: 8,
  },
  adCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  adBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  adBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  adImage: {
    width: '100%',
    height: 150,
  },
  adContent: {
    padding: 12,
  },
  adTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 6,
  },
  adDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  adLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  adLinkText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  bannerAdContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  bannerAdCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  bannerAdImage: {
    width: '100%',
    height: 100,
  },
  bannerAdContent: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerAdTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.text.primary,
    flex: 1,
    marginRight: 12,
  },
  bannerAdLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.primary + '20',
    borderRadius: 6,
  },
  bannerAdLinkText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  videoAdCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  videoAdImage: {
    width: '100%',
    height: 200,
  },
});
