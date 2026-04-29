import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Edit2, Flag, Heart, MessageCircle, Smile, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import ReportContentModal from '@/components/ReportContentModal';
import StickerPicker from '@/components/StickerPicker';
import type { Sticker } from '@/types';

type CommentSheetItem = {
  id: string;
  userId: string;
  userName?: string;
  userAvatar?: string | null;
  content?: string;
  createdAt?: string;
  likes?: string[];
  replies?: CommentSheetItem[];
  messageType?: 'text' | 'sticker' | string;
  stickerImageUrl?: string | null;
};

type CommentSheetProps = {
  contentId: string;
  visible: boolean;
  onClose: () => void;
  comments: CommentSheetItem[];
  addComment: (
    contentId: string,
    content: string,
    parentCommentId?: string,
    stickerId?: string,
    messageType?: 'text' | 'sticker'
  ) => Promise<any>;
  editComment: (commentId: string, content: string) => Promise<any>;
  deleteComment: (commentId: string) => Promise<boolean>;
  toggleCommentLike: (commentId: string, contentId: string) => Promise<boolean>;
  adaptImage: (url: string | null | undefined, kind?: 'avatar' | 'feed' | 'full') => string;
};

export default function CommentSheet({
  contentId,
  visible,
  onClose,
  comments,
  addComment,
  editComment,
  deleteComment,
  toggleCommentLike,
  adaptImage,
}: CommentSheetProps) {
  const { currentUser, reportContent } = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [commentText, setCommentText] = useState('');
  const [selectedSticker, setSelectedSticker] = useState<{ id: string; imageUrl: string } | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [reportingComment, setReportingComment] = useState<{ id: string; userId: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const commentsList = Array.isArray(comments) ? comments : [];
  const composerBottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 12);
  const commentsBottomPadding = replyingTo ? composerBottomPadding + 16 : composerBottomPadding + 112;

  const submitComment = async () => {
    try {
      if (replyingTo && (replyText.trim() || selectedSticker)) {
        await addComment(
          contentId,
          replyText.trim(),
          replyingTo,
          selectedSticker?.id,
          selectedSticker ? 'sticker' : 'text'
        );
        setReplyText('');
        setReplyingTo(null);
        setSelectedSticker(null);
        return;
      }

      if (commentText.trim() || selectedSticker) {
        await addComment(
          contentId,
          commentText.trim(),
          undefined,
          selectedSticker?.id,
          selectedSticker ? 'sticker' : 'text'
        );
        setCommentText('');
        setSelectedSticker(null);
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
      Alert.alert('Error', 'Failed to add comment. Please try again.');
    }
  };

  const beginEdit = (comment: CommentSheetItem) => {
    if (comment.messageType === 'sticker') {
      Alert.alert('Cannot Edit', 'Sticker comments cannot be edited. You can delete them instead.');
      return;
    }
    setEditingComment(comment.id);
    setEditCommentText(comment.content || '');
  };

  const saveEdit = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    try {
      const success = await editComment(commentId, editCommentText);
      if (success) {
        setEditingComment(null);
        setEditCommentText('');
      }
    } catch (error) {
      console.error('Failed to edit comment:', error);
      Alert.alert('Error', 'Failed to edit comment. Please try again.');
    }
  };

  const removeComment = (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(commentId);
          } catch (error) {
            console.error('Failed to delete comment:', error);
            Alert.alert('Error', 'Failed to delete comment. Please try again.');
          }
        },
      },
    ]);
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const renderComment = (comment: CommentSheetItem, isReply = false) => {
    const isOwner = comment.userId === currentUser?.id;
    const isLiked = comment.likes?.includes(currentUser?.id || '') || false;
    const hasReplies = !isReply && !!comment.replies?.length;
    const showReplies = expandedReplies.has(comment.id);
    const displayName = comment.userName || 'User';

    return (
      <View key={comment.id} style={isReply ? styles.reply : styles.comment}>
        <View style={styles.commentHeader}>
          {comment.userAvatar ? (
            <Image source={{ uri: adaptImage(comment.userAvatar, 'avatar') }} style={isReply ? styles.replyAvatar : styles.commentAvatar} />
          ) : (
            <View style={[isReply ? styles.replyAvatar : styles.commentAvatar, styles.commentAvatarPlaceholder]}>
              <Text style={styles.commentAvatarPlaceholderText}>{displayName.charAt(0) || '?'}</Text>
            </View>
          )}

          <View style={styles.commentContent}>
            <View style={styles.commentHeaderRow}>
              <Text style={styles.commentUserName}>{displayName}</Text>
              {isOwner && (
                <View style={styles.commentActions}>
                  {editingComment === comment.id ? (
                    <>
                      <TouchableOpacity onPress={() => {
                        setEditingComment(null);
                        setEditCommentText('');
                      }}>
                        <Text style={styles.commentActionText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => saveEdit(comment.id)}>
                        <Text style={[styles.commentActionText, styles.commentActionSave]}>Save</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity onPress={() => beginEdit(comment)}>
                        <Edit2 size={isReply ? 12 : 14} color={colors.text.secondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeComment(comment.id)}>
                        <Trash2 size={isReply ? 12 : 14} color={colors.danger} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>

            {editingComment === comment.id ? (
              <TextInput
                style={styles.commentEditInput}
                value={editCommentText}
                onChangeText={setEditCommentText}
                multiline
                placeholderTextColor={colors.text.tertiary}
              />
            ) : comment.messageType === 'sticker' && comment.stickerImageUrl ? (
              <View style={styles.commentStickerContainer}>
                <Image source={{ uri: adaptImage(comment.stickerImageUrl, 'feed') }} style={styles.commentSticker} contentFit="contain" />
              </View>
            ) : (
              <Text style={styles.commentText}>{comment.content}</Text>
            )}

            <View style={styles.commentActionsRow}>
              <TouchableOpacity style={styles.commentActionButton} onPress={() => toggleCommentLike(comment.id, contentId)}>
                <Heart size={isReply ? 14 : 16} color={isLiked ? colors.danger : colors.text.secondary} fill={isLiked ? colors.danger : 'transparent'} />
                <Text style={[styles.commentActionCount, isLiked && styles.commentActionCountActive]}>
                  {comment.likes?.length || 0}
                </Text>
              </TouchableOpacity>
              {!isReply && (
                <TouchableOpacity
                  style={styles.commentActionButton}
                  onPress={() => {
                    setReplyingTo(replyingTo === comment.id ? null : comment.id);
                    setReplyText('');
                  }}
                >
                  <MessageCircle size={16} color={colors.text.secondary} />
                  <Text style={styles.commentActionText}>Reply</Text>
                </TouchableOpacity>
              )}
              {!isOwner && (
                <TouchableOpacity style={styles.commentActionButton} onPress={() => setReportingComment({ id: comment.id, userId: comment.userId })}>
                  <Flag size={14} color={colors.danger} />
                </TouchableOpacity>
              )}
              <Text style={styles.commentTime}>{formatTimeAgo(comment.createdAt)}</Text>
            </View>

            {hasReplies && (
              <TouchableOpacity
                style={styles.viewRepliesButton}
                onPress={() => {
                  const next = new Set(expandedReplies);
                  if (showReplies) next.delete(comment.id);
                  else next.add(comment.id);
                  setExpandedReplies(next);
                }}
              >
                <Text style={styles.viewRepliesText}>
                  {showReplies ? 'Hide' : 'View'} {comment.replies?.length || 0} {(comment.replies?.length || 0) === 1 ? 'reply' : 'replies'}
                </Text>
              </TouchableOpacity>
            )}

            {showReplies && comment.replies?.map((reply) => renderComment(reply, true))}

            {replyingTo === comment.id && (
              <View style={styles.replyInputContainer}>
                {selectedSticker && <StickerPreview stickerUrl={selectedSticker.imageUrl} adaptImage={adaptImage} onRemove={() => setSelectedSticker(null)} />}
                <View style={styles.replyInputRow}>
                  <TouchableOpacity style={styles.stickerButton} onPress={() => setShowStickerPicker(true)} activeOpacity={0.7}>
                    <Smile size={20} color={colors.text.secondary} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.replyInput}
                    placeholder={`Reply to ${displayName}...`}
                    placeholderTextColor={colors.text.tertiary}
                    value={replyText}
                    onChangeText={setReplyText}
                    multiline
                  />
                </View>
                <View style={styles.replyInputActions}>
                  <TouchableOpacity onPress={() => {
                    setReplyingTo(null);
                    setReplyText('');
                    setSelectedSticker(null);
                  }}>
                    <Text style={styles.commentActionText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={submitComment} disabled={!replyText.trim() && !selectedSticker}>
                    <Text style={[styles.commentActionText, (!replyText.trim() && !selectedSticker) && styles.commentActionTextDisabled]}>
                      Reply
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Comments</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.commentsList}
          contentContainerStyle={[
            commentsList.length === 0 ? styles.commentsListEmpty : styles.commentsListContent,
            { paddingBottom: commentsBottomPadding },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {commentsList.length === 0 ? (
            <View style={styles.emptyCommentsContainer}>
              <View style={styles.emptyCommentsIcon}>
                <MessageCircle size={24} color={colors.primary} />
              </View>
              <Text style={styles.emptyCommentsText}>No comments yet</Text>
              <Text style={styles.emptyCommentsSubtext}>Start the conversation with a thoughtful reply.</Text>
            </View>
          ) : (
            commentsList.map((comment) => renderComment(comment))
          )}
        </ScrollView>

        {!replyingTo && (
          <View style={[styles.commentInputContainer, { paddingBottom: composerBottomPadding }]}>
            {selectedSticker && <StickerPreview stickerUrl={selectedSticker.imageUrl} adaptImage={adaptImage} onRemove={() => setSelectedSticker(null)} />}
            <View style={styles.commentInputRow}>
              <TouchableOpacity style={styles.stickerButton} onPress={() => setShowStickerPicker(true)} activeOpacity={0.7}>
                <Smile size={24} color={colors.text.secondary} />
              </TouchableOpacity>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor={colors.text.tertiary}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendButton, (!commentText.trim() && !selectedSticker) && styles.sendButtonDisabled]}
                onPress={submitComment}
                disabled={!commentText.trim() && !selectedSticker}
              >
                <Text style={[styles.sendButtonText, (!commentText.trim() && !selectedSticker) && styles.sendButtonTextDisabled]}>
                  Send
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
      </KeyboardAvoidingView>

      <ReportContentModal
        visible={!!reportingComment}
        onClose={() => setReportingComment(null)}
        contentType="comment"
        contentId={reportingComment?.id}
        reportedUserId={reportingComment?.userId}
        onReport={reportContent}
        colors={colors}
      />

      <StickerPicker
        visible={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelectSticker={(sticker: Sticker) => {
          setSelectedSticker({ id: sticker.id, imageUrl: sticker.imageUrl });
          setCommentText('');
          setReplyText('');
          setShowStickerPicker(false);
        }}
      />
    </Modal>
  );
}

function StickerPreview({
  stickerUrl,
  adaptImage,
  onRemove,
}: {
  stickerUrl: string;
  adaptImage: (url: string | null | undefined, kind?: 'avatar' | 'feed' | 'full') => string;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.stickerPreview}>
      <Image source={{ uri: adaptImage(stickerUrl, 'feed') }} style={styles.previewSticker} />
      <TouchableOpacity style={styles.removeStickerButton} onPress={onRemove}>
        <X size={16} color={colors.text.white} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  commentsListContent: {
    paddingTop: 8,
  },
  commentsListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 44,
  },
  emptyCommentsContainer: {
    alignItems: 'center',
    marginHorizontal: 4,
    paddingHorizontal: 22,
    paddingVertical: 30,
    borderRadius: 14,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  emptyCommentsIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '14',
    marginBottom: 14,
  },
  emptyCommentsText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  comment: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  reply: {
    marginTop: 10,
    marginLeft: 0,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  commentAvatarPlaceholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarPlaceholderText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.white,
  },
  commentContent: {
    flex: 1,
    minWidth: 0,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  commentText: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 21,
    marginTop: 5,
    marginBottom: 2,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commentEditInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: colors.text.primary,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  commentStickerContainer: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  commentSticker: {
    width: 80,
    height: 80,
  },
  commentActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  commentActionSave: {
    color: colors.primary,
  },
  commentActionTextDisabled: {
    opacity: 0.5,
  },
  commentActionCount: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  commentActionCountActive: {
    color: colors.danger,
  },
  commentTime: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  viewRepliesButton: {
    marginTop: 8,
  },
  viewRepliesText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  replyInputContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    gap: 8,
  },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: colors.text.primary,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  replyInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  commentInputContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },
  stickerPreview: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewSticker: {
    width: 72,
    height: 72,
  },
  removeStickerButton: {
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
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  stickerButton: {
    padding: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text.primary,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: colors.background.secondary,
    opacity: 0.7,
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.white,
  },
  sendButtonTextDisabled: {
    color: colors.text.tertiary,
  },
});
