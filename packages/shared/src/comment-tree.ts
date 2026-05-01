import { getDisplayName } from './display-name';

export type MirrorPostComment = {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  stickerId?: string;
  stickerImageUrl?: string;
  messageType: 'text' | 'sticker';
  likes: string[];
  createdAt: string;
  parentCommentId?: string;
  replies: MirrorPostComment[];
};

export type MirrorReelComment = {
  id: string;
  reelId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  stickerId?: string;
  stickerImageUrl?: string;
  messageType: 'text' | 'sticker';
  likes: string[];
  createdAt: string;
  parentCommentId?: string;
  replies: MirrorReelComment[];
};

function likesMapFromRows(rows: { comment_id: string; user_id: string }[]): Record<string, string[]> {
  const likesByComment: Record<string, string[]> = {};
  for (const like of rows) {
    if (!likesByComment[like.comment_id]) likesByComment[like.comment_id] = [];
    likesByComment[like.comment_id].push(like.user_id);
  }
  return likesByComment;
}

export function buildPostCommentsByPostId(
  commentsData: Record<string, unknown>[],
  commentLikesData: { comment_id: string; user_id: string }[]
): Record<string, MirrorPostComment[]> {
  const likesByComment = likesMapFromRows(commentLikesData);
  const allComments: MirrorPostComment[] = [];

  for (const c of commentsData) {
    const users = c.users as Record<string, unknown> | undefined;
    const stickers = c.stickers as { image_url?: string } | undefined;
    allComments.push({
      id: c.id as string,
      postId: c.post_id as string,
      userId: c.user_id as string,
      userName: getDisplayName(users as Parameters<typeof getDisplayName>[0]),
      userAvatar: users?.profile_picture as string | undefined,
      content: (c.content as string) || '',
      stickerId: (c.sticker_id as string) || undefined,
      stickerImageUrl: stickers?.image_url,
      messageType: ((c.message_type as string) || 'text') as 'text' | 'sticker',
      likes: likesByComment[c.id as string] || [],
      createdAt: c.created_at as string,
      parentCommentId: (c.parent_comment_id as string) || undefined,
      replies: [],
    });
  }

  const commentsByPost: Record<string, MirrorPostComment[]> = {};
  for (const comment of allComments) {
    if (!comment.parentCommentId) {
      if (!commentsByPost[comment.postId]) commentsByPost[comment.postId] = [];
      commentsByPost[comment.postId].push(comment);
    } else {
      const parent = allComments.find((x) => x.id === comment.parentCommentId);
      if (parent) {
        if (!parent.replies) parent.replies = [];
        parent.replies.push(comment);
      }
    }
  }
  return commentsByPost;
}

export function buildReelCommentsByReelId(
  commentsData: Record<string, unknown>[],
  commentLikesData: { comment_id: string; user_id: string }[]
): Record<string, MirrorReelComment[]> {
  const likesByComment = likesMapFromRows(commentLikesData);
  const allComments: MirrorReelComment[] = [];

  for (const c of commentsData) {
    const users = c.users as Record<string, unknown> | undefined;
    const stickers = c.stickers as { image_url?: string } | undefined;
    allComments.push({
      id: c.id as string,
      reelId: c.reel_id as string,
      userId: c.user_id as string,
      userName: getDisplayName(users as Parameters<typeof getDisplayName>[0]),
      userAvatar: users?.profile_picture as string | undefined,
      content: (c.content as string) || '',
      stickerId: (c.sticker_id as string) || undefined,
      stickerImageUrl: stickers?.image_url,
      messageType: ((c.message_type as string) || 'text') as 'text' | 'sticker',
      likes: likesByComment[c.id as string] || [],
      createdAt: c.created_at as string,
      parentCommentId: (c.parent_comment_id as string) || undefined,
      replies: [],
    });
  }

  const commentsByReel: Record<string, MirrorReelComment[]> = {};
  for (const comment of allComments) {
    if (!comment.parentCommentId) {
      if (!commentsByReel[comment.reelId]) commentsByReel[comment.reelId] = [];
      commentsByReel[comment.reelId].push(comment);
    } else {
      const parent = allComments.find((x) => x.id === comment.parentCommentId);
      if (parent) {
        if (!parent.replies) parent.replies = [];
        parent.replies.push(comment);
      }
    }
  }
  return commentsByReel;
}
