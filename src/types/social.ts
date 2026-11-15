export type AppLanguage = 'en' | 'bn';
export type ThemeMode = 'light' | 'dark';

export type MainTab = 'home' | 'reels' | 'messages' | 'explore' | 'profile';

export type NicknameFontStyle = 'classic' | 'serif' | 'mono' | 'display' | 'italic';

export type PostVisibility = 'public' | 'followers' | 'only_me';

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
  | 'create_sheet'
  | 'settings_home'
  | 'settings_privacy'
  | 'settings_security'
  | 'settings_account'
  | 'settings_blocked'
  | 'settings_language'
  | 'settings_about'
  | 'broadcast_channel'
  | 'report'
  | 'story_viewer'
  | 'story_creator'
  | 'android_project';

export interface UserPublic {
  uid: string;
  username: string;
  displayName: string;
  nicknameFont?: NicknameFontStyle;
  bio: string;
  pronouns?: string;
  website?: string;
  noteText?: string;
  photoUrl: string;
  coverUrl: string;
  interests: string[];
  isPrivate: boolean;
  isDeactivated?: boolean;
  deactivatedUntil?: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  onlineStatus: 'online' | 'offline' | 'away';
  lastSeenAt: string;
  lastNicknameChangedAt?: string | null;
  lastUsernameChangedAt?: string | null;
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
  twoFactorEnabled?: boolean;
  saveLoginInfo?: boolean;
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
  coverUrl?: string;
  mediaType: MediaType;
  hashtags: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  visibility: PostVisibility;
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
  stickerUrl?: string;
  gifUrl?: string;
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

export interface ChatThemeConfig {
  presetId: 'default' | 'love' | 'ocean' | 'aurora' | 'sunset' | 'emerald' | 'custom';
  customImageUrl?: string;
  imageFit?: 'cover' | 'contain';
  imageScale?: number;
  overlayOpacity?: number;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  title: string;
  participantIds: string[];
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string>;
  chatNicknames?: Record<string, string>;
  ownerUid?: string;
  adminUids?: string[];
  requireAddApproval?: boolean;
  pendingMemberIds?: string[];
  maxMembers?: number;
  theme?: ChatThemeConfig;
  pinnedMessageId?: string;
  pinnedByUids?: string[];
  mutedByUids?: string[];
  archivedByUids?: string[];
  unreadByUids?: string[];
  disappearingMode?: 'off' | '24h' | '7d';
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
  type: 'text' | 'voice' | 'image' | 'video' | 'file' | 'sticker' | 'reel_share';
  text?: string;
  mediaUrl?: string;
  stickerUrl?: string;
  sharedPostId?: string;
  sharedPostCaption?: string;
  sharedPostThumb?: string;
  sharedPostAuthor?: string;
  fileName?: string;
  durationMs?: number;
  replyToId?: string;
  replyPreview?: string;
  status: 'sent' | 'delivered' | 'seen';
  reactions: Record<string, string[]>;
  editedAt?: string;
  forwarded?: boolean;
  starredByUids?: string[];
  createdAt: string;
}

export interface NoteItem {
  id: string;
  authorUid: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar: string;
  text: string;
  likedByUids: string[];
  createdAt: string;
  expiresAt: string;
}

export interface StickerItem {
  id: string;
  creatorUid: string;
  label: string;
  imageUrl: string;
  kind: 'sticker' | 'gif';
  createdAt: string;
}

export type BroadcastRole = 'owner' | 'admin' | 'moderator' | 'collaborator' | 'follower';

export interface BroadcastMessage {
  id: string;
  channelId: string;
  senderUid: string;
  senderName: string;
  text: string;
  mediaUrl?: string;
  likesCount: number;
  likedByUids: string[];
  reactions: Record<string, string[]>;
  createdAt: string;
}

export interface BroadcastChannel {
  id: string;
  title: string;
  description: string;
  ownerUid: string;
  adminUids: string[];
  moderatorUids: string[];
  collaboratorUids: string[];
  followerUids: string[];
  messages: BroadcastMessage[];
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

export interface SavedLoginEntry {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  photoUrl: string;
  sessionToken?: string;
  savedAt: string;
}

export interface CallState {
  callId: string;
  chatId: string;
  mode: 'voice' | 'video';
  direction: 'outgoing' | 'incoming';
  status: 'ringing' | 'connected' | 'ended';
  peerUid: string;
  peerName: string;
  peerAvatar: string;
  startedAt?: number;
  muted: boolean;
  cameraOff: boolean;
}
