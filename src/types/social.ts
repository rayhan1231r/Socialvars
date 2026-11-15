export type AppLanguage = 'en' | 'bn';
export type ThemeMode = 'light' | 'dark';

export type MainTab = 'home' | 'explore' | 'create' | 'messages' | 'profile';

export type ActiveModalOrSubscreen =
  | null
  | 'notifications'
  | 'reels'
  | 'saved'
  | 'ai_assistant'
  | 'edit_profile'
  | 'followers'
  | 'following'
  | 'friend_requests'
  | 'settings_privacy'
  | 'settings_security'
  | 'settings_account'
  | 'settings_blocked'
  | 'settings_language'
  | 'settings_about'
  | 'report'
  | 'story_viewer'
  | 'story_creator'
  | 'android_project';

export interface UserPublic {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  pronouns?: string;
  website?: string;
  noteText?: string;
  photoUrl: string;
  coverUrl: string;
  interests: string[];
  isPrivate: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  onlineStatus: 'online' | 'offline' | 'away';
  lastSeenAt: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationPrefs {
  follows: boolean;
  friendRequests: boolean;
  likes: boolean;
  comments: boolean;
  stories: boolean;
  messages: boolean;
  mentions: boolean;
  announcements: boolean;
}

export interface UserPrivate {
  uid: string;
  email: string;
  language: AppLanguage;
  themeMode: ThemeMode;
  biometricLockEnabled: boolean;
  whoCanMessage: 'everyone' | 'followers' | 'nobody';
  whoCanViewStories: 'everyone' | 'followers' | 'close_friends';
  whoCanFollow: 'everyone' | 'approval';
  notificationPrefs: NotificationPrefs;
  blockedUserIds: string[];
  mutedStoryUserIds: string[];
  updatedAt: string;
}

export type MediaType = 'text' | 'image' | 'carousel' | 'video' | 'reel';

export interface Post {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar: string;
  caption: string;
  mediaUrls: string[];
  mediaType: MediaType;
  hashtags: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  visibility: 'public' | 'followers';
  createdAt: string;
  likedByMe?: boolean;
  savedByMe?: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorUsername: string;
  authorAvatar?: string;
  text: string;
  parentCommentId?: string;
  createdAt: string;
}

export interface Story {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar: string;
  mediaType: 'photo' | 'video' | 'text';
  mediaUrl?: string;
  textContent?: string;
  backgroundGradient?: string;
  privacy: 'everyone' | 'followers' | 'close_friends';
  viewersCount: number;
  viewerUsernames: string[];
  reactions: { username: string; emoji: string }[];
  expiresAt: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  title: string;
  participantIds: string[];
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string>;
  lastMessageText: string;
  lastMessageAt: string;
  unreadCount: number;
  typingUsers?: string[];
  createdBy: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  type: 'text' | 'voice' | 'image' | 'video' | 'file';
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  durationMs?: number;
  replyToId?: string;
  replyPreview?: string;
  status: 'sent' | 'delivered' | 'seen';
  reactions: Record<string, string[]>;
  createdAt: string;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromUsername: string;
  fromDisplayName: string;
  fromAvatar: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  mutualCount: number;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  recipientUid: string;
  actorUid: string;
  actorUsername: string;
  actorAvatar: string;
  type:
    | 'follow'
    | 'friend_request'
    | 'like'
    | 'comment'
    | 'reply'
    | 'story_reaction'
    | 'message'
    | 'group_message'
    | 'mention'
    | 'announcement';
  summary: string;
  targetId?: string;
  read: boolean;
  createdAt: string;
}

export interface ReportItem {
  id: string;
  reporterUid: string;
  targetType: 'post' | 'user' | 'story' | 'comment';
  targetId: string;
  reason: string;
  status: 'pending' | 'reviewed';
  createdAt: string;
}
