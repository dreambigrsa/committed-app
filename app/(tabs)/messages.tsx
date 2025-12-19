import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MessageCircle, Trash2, Send } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import StatusIndicator from '@/components/StatusIndicator';
import StatusStoriesBar from '@/components/StatusStoriesBar';
import { UserStatus } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import { getOrCreateAIUser, getAIResponse } from '@/lib/ai-service';
import { supabase } from '@/lib/supabase';

export default function MessagesScreen() {
  const router = useRouter();
  const { currentUser, conversations, deleteConversation, getUserStatus, userStatuses, createOrGetConversation, sendMessage, getMessages } = useApp();
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [participantStatuses, setParticipantStatuses] = useState<Record<string, UserStatus>>({});
  const [aiQuery, setAiQuery] = useState<string>('');
  const [isSendingAI, setIsSendingAI] = useState<boolean>(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Helper function to get other participant - defined before early return
  const getOtherParticipant = (conversation: any) => {
    if (!currentUser) return { id: null, name: 'Unknown', avatar: null };
    const otherParticipantId = conversation.participants.find((id: string) => id !== currentUser.id);
    if (!otherParticipantId) return { id: null, name: 'Unknown', avatar: null };
    
    // Find the index of the other participant
    const otherIndex = conversation.participants.indexOf(otherParticipantId);
    const currentUserIndex = conversation.participants.indexOf(currentUser.id);
    
    // Ensure we have valid data - if index is out of bounds, try to find by position
    let name = 'Unknown';
    let avatar: string | undefined = undefined;
    
    if (otherIndex >= 0 && otherIndex < conversation.participantNames.length) {
      name = conversation.participantNames[otherIndex] || 'Unknown';
      avatar = conversation.participantAvatars[otherIndex];
    } else {
      // Fallback: if current user is first, other is second, and vice versa
      if (currentUserIndex === 0 && conversation.participantNames.length > 1) {
        name = conversation.participantNames[1] || 'Unknown';
        avatar = conversation.participantAvatars[1];
      } else if (conversation.participantNames.length > 0) {
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

  // Load statuses for all participants and refresh periodically
  // This hook MUST be called before any early return to maintain hook consistency
  useEffect(() => {
    if (!currentUser || !getUserStatus || conversations.length === 0) return;

    let isMounted = true;

    const loadStatuses = async () => {
      if (!isMounted) return;
      const statuses: Record<string, UserStatus> = {};
      for (const conversation of conversations) {
        if (!isMounted) return;
        const other = getOtherParticipant(conversation);
        if (other.id) {
          const status = await getUserStatus(other.id);
          if (status && isMounted) {
            statuses[other.id] = status;
          }
        }
      }
      if (isMounted) {
        setParticipantStatuses(statuses);
      }
    };

    loadStatuses();

    // Refresh statuses every 30 seconds to recalculate based on last_active_at
    const refreshInterval = setInterval(() => {
      if (isMounted) {
        loadStatuses();
      }
    }, 30 * 1000);

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, [conversations, currentUser, getUserStatus]);

  // Return empty view instead of null to maintain hook count consistency
  // This early return happens AFTER all hooks are called
  if (!currentUser) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]} />;
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleAISubmit = async () => {
    if (!aiQuery.trim() || !currentUser || isSendingAI) return;

    setIsSendingAI(true);
    try {
      // Get or create AI user
      const aiUser = await getOrCreateAIUser();
      if (!aiUser) {
        Alert.alert('Error', 'Unable to connect to Committed AI. Please run create-ai-user.sql in Supabase SQL Editor first.');
        setIsSendingAI(false);
        return;
      }

      // Create or get conversation with AI
      const conversation = await createOrGetConversation(aiUser.id);
      if (!conversation) {
        Alert.alert('Error', 'Could not create conversation with Committed AI.');
        setIsSendingAI(false);
        return;
      }

      // Send user's message
      await sendMessage(
        conversation.id,
        aiUser.id,
        aiQuery.trim(),
        undefined, // mediaUrl
        undefined, // documentUrl
        undefined, // documentName
        'text', // messageType
        undefined, // stickerId
        undefined, // statusId
        undefined // statusPreviewUrl
      );

      // Clear input
      setAiQuery('');

      // Navigate to conversation
      router.push(`/messages/${conversation.id}` as any);

      // Get conversation history for context (before sending user's message)
      const existingMessages = getMessages(conversation.id) || [];
      const isNewConversation = existingMessages.length === 0;

      // Get conversation history for context (including the message we just sent)
      // Use more messages (last 20) for better context and learning
      const conversationHistory = [
        ...existingMessages,
        { senderId: currentUser.id, content: aiQuery.trim() } // Include the current message
      ]
        .slice(-20) // Last 20 messages for better context
        .map((msg: any) => ({
          role: msg.senderId === currentUser.id ? 'user' as const : 'assistant' as const,
          content: msg.content || '',
        }));

      // Get AI response immediately (no delay) with user information for personalization
      const aiResponse = await getAIResponse(
        aiQuery.trim(), 
        conversationHistory, 
        isNewConversation,
        currentUser.fullName,
        currentUser.username,
        currentUser.id // Pass userId for learning system
      );

      if (aiResponse.success) {
        // Send AI response - try direct insert first (RLS policy should allow it)
        // If that fails, it means the RLS policy hasn't been updated yet
        try {
          const messageData: any = {
            conversation_id: conversation.id,
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
          const { data: insertedMessage, error: insertError } = await supabase
            .from('messages')
            .insert(messageData)
            .select()
            .single();

          if (insertError) {
            // If direct insert fails, try using the RPC function
            console.log('Direct insert failed, trying RPC function:', insertError.message || insertError.code);
            
            const { data: messageId, error: rpcError } = await supabase
              .rpc('send_ai_message', {
                p_conversation_id: conversation.id,
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
              console.error('Error sending AI message (RPC):', JSON.stringify(rpcError, null, 2));
              console.error('Error code:', rpcError.code);
              console.error('Error message:', rpcError.message);
              console.error('Error details:', rpcError.details);
              console.error('Error hint:', rpcError.hint);
              
              Alert.alert(
                'Error', 
                `Failed to send AI response. ${rpcError.message || insertError.message || 'Please run the fix-ai-message-rls.sql script in Supabase.'}`
              );
            }
          } else {
            // Success - message was inserted
            console.log('AI message sent successfully');
          }
        } catch (error: any) {
          const errorMessage = error?.message || error?.code || JSON.stringify(error);
          console.error('Error sending AI message:', errorMessage);
          console.error('Full error:', JSON.stringify(error, null, 2));
          Alert.alert('Error', `Failed to send AI response: ${errorMessage}`);
        }
      }
    } catch (error: any) {
      console.error('Error handling AI submit:', error);
      Alert.alert('Error', 'Failed to send message to Committed AI. Please try again.');
    } finally {
      setIsSendingAI(false);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation? All messages will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(conversationId);
            const success = await deleteConversation(conversationId);
            setDeletingId(null);
            if (!success) {
              Alert.alert('Error', 'Failed to delete conversation');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Messenger-style Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            // @ts-ignore - require is available in React Native
            source={require('@/assets/images/icon.png')}
            style={styles.appLogoImage}
            contentFit="contain"
          />
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => {
              // Navigate to create message or search
            }}
          >
            <View style={styles.composeIcon}>
              <View style={styles.composeIconSquare} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => router.push('/(tabs)/feed' as any)}
          >
            <Image
              // @ts-ignore - require is available in React Native
              source={require('@/assets/images/icon.png')}
              style={styles.appLogoSmall}
              contentFit="contain"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Committed AI Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <View style={styles.committedAIIcon}>
            <View style={styles.committedAIGradient} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Ask Committed AI or Search"
            placeholderTextColor={colors.text.tertiary}
            value={aiQuery}
            onChangeText={setAiQuery}
            onSubmitEditing={handleAISubmit}
            returnKeyType="send"
            editable={!isSendingAI}
          />
          {aiQuery.trim().length > 0 && (
            <TouchableOpacity
              style={styles.sendAIButton}
              onPress={handleAISubmit}
              disabled={isSendingAI}
            >
              {isSendingAI ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Send size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          )}
        </View>
        {isSendingAI && (
          <View style={styles.aiStatusRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.aiStatusText}>Committed AI is thinking…</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Stories Bar - Inside ScrollView (static, scrolls with content) */}
        <StatusStoriesBar context="messenger" />
        {conversations.length === 0 ? (
          <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
            <MessageCircle size={80} color={colors.text.tertiary} strokeWidth={1.5} />
            <Text style={styles.emptyStateTitle}>No Messages Yet</Text>
            <Text style={styles.emptyStateText}>
              Start conversations with other verified members
            </Text>
          </Animated.View>
        ) : (
          conversations.map((conversation: any) => {
            const otherParticipant = getOtherParticipant(conversation);
            const isDeleting = deletingId === conversation.id;
            
            return (
              <View key={conversation.id} style={styles.conversationItemWrapper}>
                <TouchableOpacity
                  style={[styles.conversationItem, isDeleting && styles.conversationItemDeleting]}
                  onPress={() => router.push(`/messages/${conversation.id}` as any)}
                  disabled={isDeleting}
                >
                  <View style={styles.conversationLeft}>
                    <View style={styles.avatarContainer}>
                      {otherParticipant.avatar ? (
                        <Image
                          source={{ uri: otherParticipant.avatar }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarPlaceholderText}>
                            {otherParticipant.name?.charAt(0) || '?'}
                          </Text>
                        </View>
                      )}
                      <StatusIndicator 
                        status={otherParticipant.id && participantStatuses[otherParticipant.id] 
                          ? participantStatuses[otherParticipant.id].statusType 
                          : 'offline'} 
                        size="small" 
                        showBorder={true}
                      />
                    </View>
                    {conversation.unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>
                          {conversation.unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.conversationContent}>
                    <View style={styles.conversationHeader}>
                      <Text style={styles.participantName}>
                        {otherParticipant.name}
                      </Text>
                      <Text style={styles.timestamp}>
                        {formatTimeAgo(conversation.lastMessageAt)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.lastMessage,
                        conversation.unreadCount > 0 && styles.lastMessageUnread,
                      ]}
                      numberOfLines={1}
                    >
                      {conversation.lastMessage}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteConversationButton}
                  onPress={() => handleDeleteConversation(conversation.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Trash2 size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appLogoImage: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeIconSquare: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.text.primary,
    borderRadius: 2,
    position: 'relative',
  },
  appLogoSmall: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  committedAIIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  committedAIGradient: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    padding: 0,
    margin: 0,
  },
  sendAIButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  aiStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  aiStatusText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600' as const,
  },
  scrollContent: {
    paddingBottom: 100,
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: colors.text.primary,
    marginTop: 24,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  conversationItemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  conversationItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  conversationItemDeleting: {
    opacity: 0.5,
  },
  deleteConversationButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationLeft: {
    position: 'relative',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.danger,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: colors.text.white,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  participantName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  timestamp: {
    fontSize: 13,
    color: colors.text.tertiary,
    fontWeight: '500' as const,
  },
  lastMessage: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  lastMessageUnread: {
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
});
