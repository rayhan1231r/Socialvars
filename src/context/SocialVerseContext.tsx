import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  DEFAULT_STICKERS,
  INITIAL_BROADCASTS,
  INITIAL_CHATS,
  INITIAL_COMMENTS,
  INITIAL_CREATORS,
  INITIAL_FRIEND_REQUESTS,
  INITIAL_MESSAGES,
  INITIAL_NOTES,
  INITIAL_NOTIFICATIONS,
  INITIAL_POSTS,
  INITIAL_STORIES,
  INITIAL_USER,
  INITIAL_USER_PRIVATE,
} from '../data/seed';
import type {
  ActiveModalOrSubscreen,
  AppLanguage,
  AppNotification,
  BroadcastChannel,
  CallState,
  Chat,
  ChatMessage,
  ChatThemeConfig,
  FriendRequest,
  GroupRestrictions,
  MainTab,
  MediaType,
  NicknameFontStyle,
  NoteItem,
  Post,
  PostComment,
  PostVisibility,
  ReportItem,
  SavedLoginEntry,
  StickerItem,
  Story,
  StoryHighlight,
  StoryHighlightItem,
  ThemeMode,
  UploadTaskState,
  UserPrivate,
  UserPublic,
} from '../types/social';
import { TRANSLATIONS, type TranslationBundle } from '../utils/i18n';
import {
  DEFAULT_NOTIFICATION_PREFS,
  MAX_BIO_LENGTH,
  mapFirebaseAuthError,
  parseAppRouteFromLocation,
  shouldNotifyUser,
} from '../utils/validation';
import { auth, validateFirestoreConnection } from '../firebase';
import { handleStandaloneApi, isStandaloneAndroidRuntime } from '../utils/standaloneBackend';

export type AuthStage = 'splash' | 'app';

export class ApiError extends Error {
  status: number;
  code?: string;
  existingEmail?: string;
  alreadyVerified?: boolean;

  constructor(
    message: string,
    status: number,
    code?: string,
    existingEmail?: string,
    alreadyVerified?: boolean
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.existingEmail = existingEmail;
    this.alreadyVerified = alreadyVerified;
  }
}

export interface ProfileUpdatePayload {
  username?: string;
  displayName?: string;
  nicknameFont?: NicknameFontStyle;
  bio?: string;
  pronouns?: string;
  website?: string;
  dateOfBirth?: string;
  photoUrl?: string;
  coverUrl?: string;
  interests?: string[];
  isPrivate?: boolean;
}

interface NavSnapshot {
  tab: MainTab;
  viewedProfileUid: string | null;
  subscreen: ActiveModalOrSubscreen;
  activeChatId: string | null;
  mobileThreadOpen: boolean;
}

function isSettingsSubscreen(sub: ActiveModalOrSubscreen): boolean {
  return Boolean(sub && (sub.startsWith('settings_') || sub === 'android_project'));
}

interface BackendStateResponse {
  currentUser: UserPublic | null;
  userPrivate: UserPrivate | null;
  creators: UserPublic[];
  posts: Post[];
  commentsByPost: Record<string, PostComment[]>;
  stories: Story[];
  storyHighlights?: StoryHighlight[];
  chats: Chat[];
  messagesByChat: Record<string, ChatMessage[]>;
  notes: NoteItem[];
  stickers: StickerItem[];
  favoriteStickerIds: string[];
  broadcastChannels: BroadcastChannel[];
  followingIds: string[];
  followerIds: string[];
  friendRequests: FriendRequest[];
  notifications: AppNotification[];
}

interface SocialVerseContextValue {
  stage: AuthStage;
  setStage: (s: AuthStage) => void;
  authReady: boolean;
  firebaseUser: FirebaseUser | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  authModalOpen: boolean;
  authModalReason: string | null;
  authModalPrefill: string | null;
  openAuthModal: (reason?: string, prefillIdentifier?: string) => void;
  closeAuthModal: () => void;
  requireAuth: (reason?: string) => boolean;
  isLocked: boolean;
  unlockBiometric: () => void;
  pendingPhotoSetup: boolean;
  setPendingPhotoSetup: (v: boolean) => void;
  savedLogins: SavedLoginEntry[];
  removeSavedLogin: (uid: string) => void;
  signInWithGoogle: () => Promise<void>;

  currentUser: UserPublic;
  userPrivate: UserPrivate;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: TranslationBundle;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  subscreen: ActiveModalOrSubscreen;
  setSubscreen: (sub: ActiveModalOrSubscreen) => void;
  viewedProfileUid: string | null;
  openUserProfile: (uid: string) => void;
  canGoBack: boolean;
  goBack: () => void;
  activeStoryIndex: number | null;
  setActiveStoryIndex: (idx: number | null) => void;
  activeHighlightId: string | null;
  setActiveHighlightId: (id: string | null) => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  mobileThreadOpen: boolean;
  setMobileThreadOpen: (v: boolean) => void;
  reportTarget: { type: 'post' | 'user' | 'story' | 'comment'; id: string; label: string } | null;
  openReportModal: (type: 'post' | 'user' | 'story' | 'comment', id: string, label: string) => void;

  creators: UserPublic[];
  posts: Post[];
  isFeedLoading: boolean;
  isReelsLoading: boolean;
  refreshFeed: () => Promise<void>;
  refreshReels: () => Promise<void>;
  visiblePostLimit: number;
  loadMorePosts: () => void;
  commentsByPost: Record<string, PostComment[]>;
  stories: Story[];
  storyHighlights: StoryHighlight[];
  chats: Chat[];
  messagesByChat: Record<string, ChatMessage[]>;
  notes: NoteItem[];
  stickers: StickerItem[];
  favoriteStickerIds: string[];
  broadcastChannels: BroadcastChannel[];
  friendRequests: FriendRequest[];
  followingIds: string[];
  followerIds: string[];
  notifications: AppNotification[];
  reports: ReportItem[];
  toastMessage: string | null;
  showToast: (msg: string) => void;
  uploadTask: UploadTaskState | null;
  clearUploadTask: () => void;
  browserNotifPermission: 'default' | 'granted' | 'denied' | 'unsupported';
  notifBannerDismissed: boolean;
  dismissNotifBanner: () => void;
  requestBrowserNotificationPermission: () => Promise<'default' | 'granted' | 'denied' | 'unsupported'>;
  sendTestNotification: () => Promise<void>;
  closeFriendsModalOpen: boolean;
  setCloseFriendsModalOpen: (open: boolean) => void;
  toggleCloseFriend: (targetUid: string) => Promise<void>;

  // Calls (WebRTC + WebSocket signaling)
  activeCall: CallState | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (chatId: string, peerUid: string, mode: 'voice' | 'video') => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  declineIncomingCall: () => void;
  endCall: () => void;
  toggleCallMute: () => void;
  toggleCallCamera: () => void;

  // Auth Actions (Email OTP + Username/Email Login + Saved Logins)
  sendOtp: (email: string, purpose: 'signup' | 'reset' | '2fa') => Promise<{ sentViaSmtp: boolean; devOtpCode?: string }>;
  verifyOtp: (email: string, code: string, purpose: 'signup' | 'reset' | '2fa') => Promise<string>;
  checkUsernameAvailability: (username: string, excludeUid?: string) => Promise<{ available: boolean; normalized: string; reason?: string }>;
  completeSignupRegistration: (payload: {
    verificationToken: string;
    email: string;
    password: string;
    displayName: string;
    nicknameFont: NicknameFontStyle;
    username: string;
    dateOfBirth: string;
    photoUrl?: string;
    saveLogin?: boolean;
  }) => Promise<void>;
  loginWithIdentifier: (
    identifier: string,
    password: string,
    saveLogin?: boolean
  ) => Promise<{ requires2fa?: boolean; email?: string; sentViaSmtp?: boolean; devOtpCode?: string }>;
  verifyTwoFactorLogin: (email: string, code: string, saveLogin?: boolean) => Promise<void>;
  loginWithSavedAccount: (entry: SavedLoginEntry) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  resetPasswordWithOtp: (
    verificationToken: string,
    email: string,
    newPassword: string
  ) => Promise<{ method?: 'direct' | 'email_link'; message?: string }>;
  deactivateAccount: (days: number) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;

  // Feed, Reels & Stories
  createPost: (payload: {
    caption: string;
    mediaUrls: string[];
    coverUrl?: string;
    mediaType: MediaType;
    visibility: PostVisibility;
  }) => Promise<void>;
  editPost: (postId: string, caption: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  toggleLikePost: (postId: string) => Promise<void>;
  likePostIfNeeded: (postId: string) => Promise<void>;
  toggleSavePost: (postId: string) => Promise<void>;
  sharePost: (postId: string) => Promise<void>;
  shareReelToInbox: (post: Post, targetUserUid: string) => Promise<void>;
  addComment: (
    postId: string,
    text: string,
    parentCommentId?: string,
    stickerUrl?: string,
    gifUrl?: string
  ) => Promise<void>;
  createStory: (payload: {
    mediaType: 'photo' | 'video' | 'text';
    mediaUrl?: string;
    textContent?: string;
    privacy: 'everyone' | 'followers' | 'close_friends';
  }) => Promise<void>;
  reactToStory: (storyId: string, emoji: string) => Promise<void>;
  replyToStory: (storyId: string, text: string) => Promise<void>;
  deleteStory: (storyId: string) => Promise<void>;
  muteStoryAuthor: (authorId: string) => void;
  createHighlight: (payload: {
    title: string;
    coverUrl?: string;
    storyIds?: string[];
    items?: StoryHighlightItem[];
  }) => Promise<StoryHighlight | null>;
  updateHighlight: (
    highlightId: string,
    updates: { title?: string; coverUrl?: string; items?: StoryHighlightItem[] }
  ) => Promise<void>;
  deleteHighlight: (highlightId: string) => Promise<void>;
  fetchUserConnections: (targetUid: string) => Promise<{ followerIds: string[]; followingIds: string[] }>;

  // Notes & Stickers
  publishNote: (text: string, audience?: 'followers' | 'close_friends') => Promise<void>;
  deleteMyNote: () => Promise<void>;
  toggleLikeNote: (noteId: string) => Promise<void>;
  createSticker: (label: string, imageUrl: string, kind?: 'sticker' | 'gif') => Promise<StickerItem | null>;
  toggleFavoriteSticker: (stickerId: string, imageUrl?: string, label?: string) => Promise<void>;

  // Messaging, Themes & Groups
  typingByChat: Record<string, string[]>;
  sendTypingSignal: (chatId: string) => void;
  sendMessage: (
    chatId: string,
    payload: {
      type: ChatMessage['type'];
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
      forwarded?: boolean;
    }
  ) => Promise<void>;
  editMessage: (chatId: string, messageId: string, text: string) => Promise<void>;
  reactToMessage: (chatId: string, messageId: string, emoji: string) => Promise<void>;
  starMessage: (chatId: string, messageId: string) => Promise<void>;
  pinMessage: (chatId: string, messageId: string | null) => Promise<void>;
  forwardMessage: (chatId: string, messageId: string, targetChatId: string) => Promise<void>;
  updateChatPreferences: (
    chatId: string,
    prefs: {
      pinned?: boolean;
      muted?: boolean;
      archived?: boolean;
      unread?: boolean;
      disappearingMode?: 'off' | '24h' | '7d';
    }
  ) => Promise<void>;
  deleteChatFromInbox: (chatId: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  createDirectOrGroupChat: (
    title: string,
    participantUids: string[],
    type: 'direct' | 'group',
    extra?: { avatarUrl?: string; bio?: string; restrictions?: GroupRestrictions }
  ) => Promise<string | null>;
  updateChatTheme: (chatId: string, theme: ChatThemeConfig) => Promise<void>;
  updateChatNickname: (chatId: string, targetUid: string, nickname: string) => Promise<void>;
  addGroupMember: (chatId: string, targetUid: string) => Promise<string>;
  approveGroupMember: (chatId: string, targetUid: string, accept: boolean) => Promise<void>;
  removeGroupMember: (chatId: string, targetUid: string) => Promise<void>;
  updateGroupRole: (
    chatId: string,
    targetUid: string,
    action: 'promote_admin' | 'demote_admin' | 'transfer_owner'
  ) => Promise<void>;
  updateGroupSettings: (
    chatId: string,
    updates: {
      title?: string;
      bio?: string;
      avatarUrl?: string;
      requireAddApproval?: boolean;
      restrictions?: GroupRestrictions;
    }
  ) => Promise<void>;

  // Broadcast Channels
  createBroadcastChannel: (title: string, description: string) => Promise<void>;
  toggleFollowBroadcast: (channelId: string) => Promise<void>;
  assignBroadcastRole: (
    channelId: string,
    targetUid: string,
    role: 'admin' | 'moderator' | 'collaborator' | 'follower'
  ) => Promise<void>;
  sendBroadcastMessage: (channelId: string, text: string, mediaUrl?: string) => Promise<void>;
  reactBroadcastMessage: (
    channelId: string,
    msgId: string,
    opts: { like?: boolean; emoji?: string }
  ) => Promise<void>;

  // Social Graph, Profile & Moderation
  toggleFollow: (targetUid: string) => Promise<void>;
  respondToFriendRequest: (requestId: string, accept: boolean) => Promise<void>;
  removeFollower: (followerUid: string) => Promise<void>;
  blockUser: (targetUid: string) => Promise<void>;
  unblockUser: (targetUid: string) => Promise<void>;
  updateProfile: (updates: ProfileUpdatePayload) => Promise<string | null>;
  uploadImageDataUrl: (file: File, maxDim?: number) => Promise<string>;
  uploadProfileImage: (file: File, kind: 'avatar' | 'cover') => Promise<string>;
  updatePrivateSettings: (updates: Partial<UserPrivate>) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  submitReport: (reason: string) => Promise<void>;
  callAiAssistant: (task: string, contextText: string) => Promise<{ suggestions: string[]; tip: string }>;
}

const SocialVerseContext = createContext<SocialVerseContextValue | null>(null);

const TOKEN_STORAGE_KEY = 'sv_session_token';
const SAVED_LOGINS_KEY = 'sv_saved_logins';

export async function compressImageToDataUrl(
  file: File,
  maxDim = 960,
  quality = 0.82
): Promise<string> {
  if (file.type === 'image/gif') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read GIF'));
      reader.readAsDataURL(file);
    });
  }
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width || maxDim;
        const naturalH = img.naturalHeight || img.height || maxDim;
        const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
        const w = Math.max(1, Math.round(naturalW * scale));
        const h = Math.max(1, Math.round(naturalH * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          readFileAsDataUrl(file).then(resolve).catch(reject);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        // Use webp/jpeg so large PNG screenshots stay compact & fast to upload
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch {
        URL.revokeObjectURL(objectUrl);
        readFileAsDataUrl(file).then(resolve).catch(reject);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Fallback for SVG / exotic image files readable directly as data URL
      if (file.size <= 5 * 1024 * 1024) {
        readFileAsDataUrl(file).then(resolve).catch(() => reject(new Error('Could not decode selected image')));
      } else {
        reject(new Error('Could not decode selected image'));
      }
    };
    img.src = objectUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function loadSavedLogins(): SavedLoginEntry[] {
  try {
    const raw = localStorage.getItem(SAVED_LOGINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function SocialVerseProvider({ children }: { children: React.ReactNode }) {
  const autostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const initialRoute = useMemo(
    () =>
      typeof window !== 'undefined'
        ? parseAppRouteFromLocation(
            window.location.pathname,
            window.location.hash,
            window.location.search
          )
        : { tab: 'home' as const, subscreen: null },
    []
  );

  const [stage, setStage] = useState<AuthStage>(autostart ? 'app' : 'splash');
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [savedLogins, setSavedLogins] = useState<SavedLoginEntry[]>(() => loadSavedLogins());
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalReason, setAuthModalReason] = useState<string | null>(null);
  const [authModalPrefill, setAuthModalPrefill] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [pendingPhotoSetup, setPendingPhotoSetup] = useState<boolean>(false);

  const [currentUser, setCurrentUser] = useState<UserPublic>(INITIAL_USER);
  const [userPrivate, setUserPrivate] = useState<UserPrivate>(INITIAL_USER_PRIVATE);
  const [language, setLanguageState] = useState<AppLanguage>('en');
  const [theme, setThemeState] = useState<ThemeMode>('light');

  const [activeTab, setActiveTabState] = useState<MainTab>(initialRoute.tab);
  const [subscreen, setSubscreenState] = useState<ActiveModalOrSubscreen>(initialRoute.subscreen);
  const [viewedProfileUid, setViewedProfileUid] = useState<string | null>(null);
  const [navHistory, setNavHistory] = useState<NavSnapshot[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState<boolean>(false);
  const [reportTarget, setReportTarget] = useState<{
    type: 'post' | 'user' | 'story' | 'comment';
    id: string;
    label: string;
  } | null>(null);

  const [creators, setCreators] = useState<UserPublic[]>(INITIAL_CREATORS);
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [isFeedLoading, setIsFeedLoading] = useState<boolean>(true);
  const [isReelsLoading, setIsReelsLoading] = useState<boolean>(true);
  const [visiblePostLimit, setVisiblePostLimit] = useState<number>(10);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>(INITIAL_COMMENTS);
  const [stories, setStories] = useState<Story[]>(INITIAL_STORIES);
  const [storyHighlights, setStoryHighlights] = useState<StoryHighlight[]>([]);
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>(INITIAL_MESSAGES);
  const [notes, setNotes] = useState<NoteItem[]>(INITIAL_NOTES);
  const [stickers, setStickers] = useState<StickerItem[]>(DEFAULT_STICKERS);
  const [favoriteStickerIds, setFavoriteStickerIds] = useState<string[]>([]);
  const [broadcastChannels, setBroadcastChannels] = useState<BroadcastChannel[]>(INITIAL_BROADCASTS);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>(INITIAL_FRIEND_REQUESTS);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [uploadTask, setUploadTask] = useState<UploadTaskState | null>(null);
  const [browserNotifPermission, setBrowserNotifPermission] = useState<
    'default' | 'granted' | 'denied' | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return window.Notification.permission;
  });
  const [notifBannerDismissed, setNotifBannerDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sv_notif_banner_dismissed') === '1';
    } catch {
      return false;
    }
  });
  const [closeFriendsModalOpen, setCloseFriendsModalOpen] = useState<boolean>(false);
  const [typingByChat, setTypingByChat] = useState<Record<string, string[]>>({});
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastTypingSentRef = useRef<Record<string, number>>({});
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const notifsInitializedRef = useRef<boolean>(false);
  const sessionTokenRef = useRef<string | null>(sessionToken);
  sessionTokenRef.current = sessionToken;
  const firebaseExchangeInFlightRef = useRef<boolean>(false);

  // WebRTC Call State
  const [activeCall, setActiveCall] = useState<CallState | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);
  const pendingOfferRef = useRef<{ fromUid: string; sdp: RTCSessionDescriptionInit } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const isAuthenticated = Boolean(sessionToken && currentUser.uid);
  const t = useMemo(() => TRANSLATIONS[language], [language]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  const clearUploadTask = useCallback(() => {
    setUploadTask(null);
  }, []);

  const dismissNotifBanner = useCallback(() => {
    setNotifBannerDismissed(true);
    try {
      localStorage.setItem('sv_notif_banner_dismissed', '1');
    } catch {
      // ignore storage errors
    }
  }, []);

  const dispatchDeviceNotification = useCallback(
    async (title: string, body: string, tag?: string, icon?: string) => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (window.Notification.permission !== 'granted') return;
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && 'showNotification' in reg) {
            await reg.showNotification(title, {
              body,
              tag,
              icon: icon || undefined,
            });
            return;
          }
        }
        new window.Notification(title, {
          body,
          tag,
          icon: icon || undefined,
        });
      } catch {
        // Fallback if Notifications constructor blocked inside strict iframe
      }
    },
    []
  );

  const requestBrowserNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserNotifPermission('unsupported');
      return 'unsupported' as const;
    }
    try {
      const result = await window.Notification.requestPermission();
      setBrowserNotifPermission(result);
      if (result === 'granted') {
        dismissNotifBanner();
        void dispatchDeviceNotification(
          'SocialVerse Notifications Enabled',
          language === 'bn'
            ? 'এখন থেকে মেসেজ, গ্রুপ, আপলোড ও সব অ্যাক্টিভিটির নোটিফিকেশন পাবেন।'
            : 'You will now receive alerts for DMs, group messages, uploads, and activity.',
          'sv-welcome'
        );
      }
      return result;
    } catch {
      return browserNotifPermission;
    }
  }, [browserNotifPermission, dismissNotifBanner, dispatchDeviceNotification, language]);

  const sendTestNotification = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast(language === 'bn' ? 'এই ব্রাউজারে নোটিফিকেশন সাপোর্ট নেই' : 'Notifications unsupported in this browser');
      return;
    }
    if (window.Notification.permission !== 'granted') {
      const perm = await requestBrowserNotificationPermission();
      if (perm !== 'granted') {
        showToast(language === 'bn' ? 'ব্রাউজার থেকে নোটিফিকেশন পারমিশন দিন' : 'Enable browser notification permission first');
        return;
      }
    }
    await dispatchDeviceNotification(
      'SocialVerse',
      language === 'bn'
        ? 'টেস্ট নোটিফিকেশন সফল হয়েছে!'
        : 'Notifications are active on this device!',
      'sv-test'
    );
    showToast(language === 'bn' ? 'টেস্ট নোটিফিকেশন পাঠানো হয়েছে' : 'Test notification sent');
  }, [dispatchDeviceNotification, language, requestBrowserNotificationPermission, showToast]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    const bridge = (window as unknown as { SocialVerseNative?: { setSystemTheme?: (dark: boolean) => void } }).SocialVerseNative;
    bridge?.setSystemTheme?.(theme === 'dark');
  }, [theme]);

  // Brief splash loading on initial launch -> Home
  useEffect(() => {
    if (stage !== 'splash') return;
    const timer = setTimeout(() => {
      setStage((prev) => (prev === 'splash' ? 'app' : prev));
    }, 1100);
    return () => clearTimeout(timer);
  }, [stage]);

  const upsertSavedLogin = useCallback(
    (user: UserPublic, email: string, token: string, shouldSave = true) => {
      if (!shouldSave) return;
      setSavedLogins((prev) => {
        const entry: SavedLoginEntry = {
          uid: user.uid,
          username: user.username,
          displayName: user.displayName,
          email,
          photoUrl: user.photoUrl,
          sessionToken: token,
          savedAt: new Date().toISOString(),
        };
        const next = [entry, ...prev.filter((item) => item.uid !== user.uid)].slice(0, 6);
        try {
          localStorage.setItem(SAVED_LOGINS_KEY, JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
        return next;
      });
    },
    []
  );

  const removeSavedLogin = useCallback((uid: string) => {
    setSavedLogins((prev) => {
      const next = prev.filter((item) => item.uid !== uid);
      try {
        localStorage.setItem(SAVED_LOGINS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const applyServerState = useCallback(
    (data: BackendStateResponse) => {
      if (data.currentUser) {
        setCurrentUser(data.currentUser);
      }
      const nextPrivate: UserPrivate | null = data.userPrivate
        ? {
            ...INITIAL_USER_PRIVATE,
            ...data.userPrivate,
            notificationPrefs: {
              ...DEFAULT_NOTIFICATION_PREFS,
              ...(data.userPrivate.notificationPrefs || {}),
            },
            closeFriendUids: data.userPrivate.closeFriendUids || [],
          }
        : null;

      if (nextPrivate) {
        setUserPrivate(nextPrivate);
        if (nextPrivate.language) setLanguageState(nextPrivate.language);
        if (nextPrivate.themeMode)
          setThemeState(nextPrivate.themeMode === 'dark' ? 'dark' : 'light');
      }
      setCreators(data.creators || []);
      setPosts(data.posts || []);
      setCommentsByPost(data.commentsByPost || {});
      setStories(data.stories || []);
      setStoryHighlights(data.storyHighlights || []);
      setChats(data.chats || []);
      setMessagesByChat(data.messagesByChat || {});
      setNotes(data.notes || []);
      setStickers([...(data.stickers || []), ...DEFAULT_STICKERS]);
      setFavoriteStickerIds(data.favoriteStickerIds || []);
      setBroadcastChannels(data.broadcastChannels || []);
      setFollowingIds(data.followingIds || []);
      setFollowerIds(data.followerIds || []);
      setFriendRequests(data.friendRequests || []);
      const incomingNotifs = data.notifications || [];
      setNotifications(incomingNotifs);

      if (!notifsInitializedRef.current) {
        incomingNotifs.forEach((n) => seenNotifIdsRef.current.add(n.id));
        if (data.currentUser) notifsInitializedRef.current = true;
      } else {
        const activePrefs = nextPrivate?.notificationPrefs || userPrivate.notificationPrefs;
        const viewerUid = data.currentUser?.uid || currentUser.uid;
        incomingNotifs.forEach((n) => {
          if (seenNotifIdsRef.current.has(n.id)) return;
          seenNotifIdsRef.current.add(n.id);
          const matchedChat = n.targetId
            ? (data.chats || []).find((c) => c.id === n.targetId)
            : undefined;
          const isMutedChat = Boolean(
            matchedChat && viewerUid && matchedChat.mutedByUids?.includes(viewerUid)
          );
          if (!n.read && shouldNotifyUser(activePrefs, n.type, isMutedChat)) {
            void dispatchDeviceNotification(
              `@${n.actorUsername}`,
              n.summary,
              `sv-notif-${n.targetId || n.type}`,
              n.actorAvatar
            );
          }
        });
      }
    },
    [currentUser.uid, dispatchDeviceNotification, userPrivate.notificationPrefs]
  );

  const apiFetch = useCallback(
    async <T,>(url: string, options: RequestInit = {}, overrideToken?: string): Promise<T> => {
      const tokenToUse = overrideToken ?? sessionToken;
      if (isStandaloneAndroidRuntime()) {
        const res = await handleStandaloneApi(url, options, tokenToUse);
        if (!res.ok) {
          const errBody = res.data as {
            error?: string;
            code?: string;
            existingEmail?: string;
            alreadyVerified?: boolean;
          };
          throw new ApiError(
            errBody.error || `Request failed (${res.status})`,
            res.status,
            errBody.code,
            errBody.existingEmail,
            errBody.alreadyVerified
          );
        }
        return res.data as T;
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      };
      if (tokenToUse) {
        headers.Authorization = `Bearer ${tokenToUse}`;
      }
      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errBody = data as {
          error?: string;
          code?: string;
          existingEmail?: string;
          alreadyVerified?: boolean;
        };
        throw new ApiError(
          errBody.error || `Request failed (${res.status})`,
          res.status,
          errBody.code,
          errBody.existingEmail,
          errBody.alreadyVerified
        );
      }
      return data as T;
    },
    [sessionToken]
  );

  const refreshState = useCallback(
    async (overrideToken?: string) => {
      try {
        const data = await apiFetch<BackendStateResponse>('/api/state', {}, overrideToken);
        if (overrideToken && !data.currentUser) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setSessionToken(null);
          setCurrentUser(INITIAL_USER);
          setUserPrivate(INITIAL_USER_PRIVATE);
        }
        applyServerState(data);
      } catch (err) {
        console.warn('State refresh error:', err);
      }
    },
    [apiFetch, applyServerState]
  );

  useEffect(() => {
    let active = true;
    refreshState(sessionToken || undefined).finally(() => {
      if (!active) return;
      setIsFeedLoading(false);
      setIsReelsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [sessionToken, refreshState]);

  const refreshFeed = useCallback(async () => {
    setIsFeedLoading(true);
    const minDelay = new Promise((r) => setTimeout(r, 340));
    try {
      await Promise.all([refreshState(sessionTokenRef.current || undefined), minDelay]);
    } finally {
      setIsFeedLoading(false);
    }
  }, [refreshState]);

  const refreshReels = useCallback(async () => {
    setIsReelsLoading(true);
    const minDelay = new Promise((r) => setTimeout(r, 340));
    try {
      await Promise.all([refreshState(sessionTokenRef.current || undefined), minDelay]);
    } finally {
      setIsReelsLoading(false);
    }
  }, [refreshState]);

  useEffect(() => {
    void validateFirestoreConnection();
  }, []);

  // Browser back/forward route sync
  useEffect(() => {
    const onPopState = () => {
      const next = parseAppRouteFromLocation(
        window.location.pathname,
        window.location.hash,
        window.location.search
      );
      setActiveTabState(next.tab);
      setSubscreenState(next.subscreen);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const cleanupMediaAndPeer = useCallback(() => {
    if (peerConnRef.current) {
      peerConnRef.current.close();
      peerConnRef.current = null;
    }
    setLocalStream((prev) => {
      prev?.getTracks().forEach((tr) => tr.stop());
      return null;
    });
    setRemoteStream(null);
    pendingOfferRef.current = null;
  }, []);

  // Stable refs for WebSocket message handler to avoid tearing down WS on UI navigation
  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const currentUidRef = useRef(currentUser.uid);
  currentUidRef.current = currentUser.uid;
  const notifPrefsRef = useRef(userPrivate.notificationPrefs);
  notifPrefsRef.current = userPrivate.notificationPrefs;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const activeChatIdRef = useRef(activeChatId);
  activeChatIdRef.current = activeChatId;
  const applyServerStateRef = useRef(applyServerState);
  applyServerStateRef.current = applyServerState;
  const refreshStateRef = useRef(refreshState);
  refreshStateRef.current = refreshState;
  const cleanupMediaRef = useRef(cleanupMediaAndPeer);
  cleanupMediaRef.current = cleanupMediaAndPeer;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const dispatchDeviceNotifRef = useRef(dispatchDeviceNotification);
  dispatchDeviceNotifRef.current = dispatchDeviceNotification;
  const languageRef = useRef(language);
  languageRef.current = language;

  // WebSocket Real-Time Listener & Call Signaling (only reconnects when sessionToken changes)
  useEffect(() => {
    if (!sessionToken || isStandaloneAndroidRuntime()) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token: sessionToken }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'state:sync') {
          if (msg.state) applyServerStateRef.current(msg.state);
          else refreshStateRef.current(sessionToken);
        } else if (msg.type === 'notification:new' && msg.notification) {
          const notif = msg.notification as AppNotification;
          if (!seenNotifIdsRef.current.has(notif.id)) {
            seenNotifIdsRef.current.add(notif.id);
            setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
            const matchedChat = notif.targetId
              ? chatsRef.current.find((c) => c.id === notif.targetId)
              : undefined;
            const isMutedChat = Boolean(
              matchedChat && matchedChat.mutedByUids?.includes(currentUidRef.current)
            );
            if (shouldNotifyUser(notifPrefsRef.current, notif.type, isMutedChat)) {
              void dispatchDeviceNotifRef.current(
                `@${notif.actorUsername}`,
                notif.summary,
                `sv-notif-${notif.targetId || notif.type}`,
                notif.actorAvatar
              );
              const isInsideSameChat =
                activeTabRef.current === 'messages' &&
                activeChatIdRef.current &&
                activeChatIdRef.current === notif.targetId;
              if (!isInsideSameChat) {
                showToastRef.current(`@${notif.actorUsername}: ${notif.summary}`);
              }
            }
          }
        } else if (msg.type === 'call:offer') {
          pendingOfferRef.current = { fromUid: msg.fromUid, sdp: msg.sdp };
          setActiveCall({
            callId: msg.callId || `call_${Date.now()}`,
            chatId: msg.chatId || '',
            mode: msg.mode || 'voice',
            direction: 'incoming',
            status: 'ringing',
            peerUid: msg.fromUid,
            peerName: msg.fromName || 'Caller',
            peerAvatar: msg.fromAvatar || '',
            muted: false,
            cameraOff: msg.mode !== 'video',
          });
        } else if (msg.type === 'call:answer' && peerConnRef.current) {
          await peerConnRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          setActiveCall((prev) =>
            prev ? { ...prev, status: 'connected', startedAt: Date.now() } : prev
          );
        } else if (msg.type === 'call:ice' && peerConnRef.current && msg.candidate) {
          await peerConnRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        } else if (msg.type === 'chat:typing' && msg.chatId && msg.fromUid) {
          const key = `${msg.chatId}:${msg.fromUid}`;
          setTypingByChat((prev) => ({
            ...prev,
            [msg.chatId]: Array.from(new Set([...(prev[msg.chatId] || []), msg.fromUid])),
          }));
          if (typingTimersRef.current[key]) clearTimeout(typingTimersRef.current[key]);
          typingTimersRef.current[key] = setTimeout(() => {
            setTypingByChat((prev) => ({
              ...prev,
              [msg.chatId]: (prev[msg.chatId] || []).filter((id) => id !== msg.fromUid),
            }));
          }, 2600);
        } else if (msg.type === 'call:decline' || msg.type === 'call:end') {
          cleanupMediaRef.current();
          setActiveCall(null);
          showToastRef.current(msg.type === 'call:decline' ? 'Call declined' : 'Call ended');
        }
      } catch {
        // ignore invalid packets
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionToken]);

  const openAuthModal = (reason?: string, prefillIdentifier?: string) => {
    setAuthModalReason(reason || null);
    setAuthModalPrefill(prefillIdentifier || null);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setAuthModalReason(null);
    setAuthModalPrefill(null);
  };

  const requireAuth = (reason?: string): boolean => {
    if (isAuthenticated) return true;
    openAuthModal(reason);
    return false;
  };

  const setActiveTab = (tab: MainTab) => {
    setActiveTabState(tab);
    setViewedProfileUid(null);
    if (subscreen === 'notifications' || isSettingsSubscreen(subscreen) || subscreen === 'profile_about') {
      setSubscreenState(null);
    }
  };

  const setSubscreen = (sub: ActiveModalOrSubscreen) => {
    if (
      (sub === 'edit_profile' ||
        sub === 'story_creator' ||
        sub === 'highlight_creator' ||
        sub === 'ai_assistant' ||
        sub === 'create_sheet' ||
        sub === 'broadcast_channel') &&
      !isAuthenticated
    ) {
      openAuthModal();
      return;
    }
    const enteringNotifications = sub === 'notifications' && subscreen !== 'notifications';
    const enteringSettings = isSettingsSubscreen(sub) && !isSettingsSubscreen(subscreen);
    const enteringProfileAbout = sub === 'profile_about' && subscreen !== 'profile_about';
    if (enteringNotifications || enteringSettings || enteringProfileAbout) {
      setNavHistory((prev) => [
        ...prev.slice(-19),
        { tab: activeTab, viewedProfileUid, subscreen, activeChatId, mobileThreadOpen },
      ]);
    }
    setSubscreenState(sub);
  };

  // WebRTC Call helpers
  const setupPeerConnection = (targetUid: string, callId: string, chatId: string, stream: MediaStream | null) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }
    pc.ontrack = (ev) => {
      if (ev.streams[0]) setRemoteStream(ev.streams[0]);
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'call:ice',
            targetUid,
            callId,
            chatId,
            candidate: ev.candidate,
          })
        );
      }
    };
    peerConnRef.current = pc;
    return pc;
  };

  const startCall = async (chatId: string, peerUid: string, mode: 'voice' | 'video') => {
    if (!requireAuth('Sign in to start voice or video calls.')) return;
    const peer = creators.find((c) => c.uid === peerUid);
    const callId = `call_${Date.now()}`;

    let stream: MediaStream | null = null;
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === 'video',
        });
        setLocalStream(stream);
      }
    } catch {
      stream = null;
    }

    setActiveCall({
      callId,
      chatId,
      mode,
      direction: 'outgoing',
      status: 'ringing',
      peerUid,
      peerName: peer?.displayName || 'User',
      peerAvatar: peer?.photoUrl || '',
      muted: false,
      cameraOff: mode !== 'video',
    });

    try {
      const pc = setupPeerConnection(peerUid, callId, chatId, stream);
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: mode === 'video' });
      await pc.setLocalDescription(offer);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'call:offer',
            targetUid: peerUid,
            callId,
            chatId,
            mode,
            sdp: offer,
          })
        );
      }
    } catch {
      // Fallback ringing state stays visible cleanly in environments without audio/video devices
    }
  };

  const acceptIncomingCall = async () => {
    if (!activeCall || !pendingOfferRef.current) return;
    let stream: MediaStream | null = null;
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: activeCall.mode === 'video',
        });
        setLocalStream(stream);
      }
    } catch {
      stream = null;
    }

    const pc = setupPeerConnection(activeCall.peerUid, activeCall.callId, activeCall.chatId, stream);
    await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:answer',
          targetUid: activeCall.peerUid,
          callId: activeCall.callId,
          chatId: activeCall.chatId,
          sdp: answer,
        })
      );
    }
    setActiveCall((prev) => (prev ? { ...prev, status: 'connected', startedAt: Date.now() } : prev));
  };

  const declineIncomingCall = () => {
    if (activeCall && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:decline',
          targetUid: activeCall.peerUid,
          callId: activeCall.callId,
        })
      );
    }
    cleanupMediaAndPeer();
    setActiveCall(null);
  };

  const endCall = () => {
    if (activeCall && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:end',
          targetUid: activeCall.peerUid,
          callId: activeCall.callId,
        })
      );
    }
    cleanupMediaAndPeer();
    setActiveCall(null);
  };

  const toggleCallMute = () => {
    setActiveCall((prev) => {
      if (!prev) return null;
      const nextMuted = !prev.muted;
      localStream?.getAudioTracks().forEach((tr) => {
        tr.enabled = !nextMuted;
      });
      return { ...prev, muted: nextMuted };
    });
  };

  const toggleCallCamera = () => {
    setActiveCall((prev) => {
      if (!prev) return null;
      const nextOff = !prev.cameraOff;
      localStream?.getVideoTracks().forEach((tr) => {
        tr.enabled = !nextOff;
      });
      return { ...prev, cameraOff: nextOff };
    });
  };

  // Auth Actions
  const sendOtp = async (email: string, purpose: 'signup' | 'reset' | '2fa') => {
    return apiFetch<{ sentViaSmtp: boolean; devOtpCode?: string }>('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email, purpose, language }),
    });
  };

  const verifyOtp = async (email: string, code: string, purpose: 'signup' | 'reset' | '2fa') => {
    const res = await apiFetch<{ verificationToken: string }>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code, purpose }),
    });
    return res.verificationToken;
  };

  const checkUsernameAvailability = async (username: string, excludeUid?: string) => {
    const params = new URLSearchParams({ username });
    if (excludeUid) params.set('excludeUid', excludeUid);
    return apiFetch<{ available: boolean; normalized: string; reason?: string }>(
      `/api/users/check-username?${params.toString()}`
    );
  };

  const finishLoginSession = useCallback(
    async (token: string, user: UserPublic, priv: UserPrivate, saveLogin = true) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      setSessionToken(token);
      setCurrentUser(user);
      setUserPrivate(priv);
      setLanguageState(priv.language || 'en');
      setThemeState(priv.themeMode === 'dark' ? 'dark' : 'light');
      if (priv.biometricLockEnabled) setIsLocked(true);
      upsertSavedLogin(user, priv.email, token, saveLogin);
      setAuthModalOpen(false);
      setAuthModalReason(null);
      await refreshState(token);
    },
    [refreshState, upsertSavedLogin]
  );

  // Firebase Auth listener tracking authReady and auto-syncing Google/Firebase sessions
  useEffect(() => {
    let resolved = false;
    const fallbackTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setAuthReady(true);
      }
    }, 1500);

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      resolved = true;
      clearTimeout(fallbackTimer);
      setFirebaseUser(fbUser);
      setAuthReady(true);

      if (fbUser && !sessionTokenRef.current && !firebaseExchangeInFlightRef.current) {
        firebaseExchangeInFlightRef.current = true;
        try {
          const idToken = await fbUser.getIdToken();
          if (isStandaloneAndroidRuntime()) {
            const localRes = await handleStandaloneApi(
              '/api/auth/firebase',
              {
                method: 'POST',
                body: JSON.stringify({ idToken, language: languageRef.current }),
              },
              null
            );
            if (localRes.ok) {
              const data = localRes.data as {
                token?: string;
                user?: UserPublic;
                userPrivate?: UserPrivate;
              };
              if (data.token && data.user && data.userPrivate) {
                await finishLoginSession(data.token, data.user, data.userPrivate, true);
              }
            }
          } else {
            const res = await fetch('/api/auth/firebase', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken, language: languageRef.current }),
            });
            if (res.ok) {
              const data = (await res.json()) as {
                token?: string;
                user?: UserPublic;
                userPrivate?: UserPrivate;
              };
              if (data.token && data.user && data.userPrivate) {
                await finishLoginSession(data.token, data.user, data.userPrivate, true);
              }
            }
          }
        } catch {
          // Keep guest/session fallback graceful if Firebase token exchange fails offline
        } finally {
          firebaseExchangeInFlightRef.current = false;
        }
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [finishLoginSession]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    firebaseExchangeInFlightRef.current = true;
    try {
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();
      const res = await apiFetch<{
        token: string;
        user: UserPublic;
        userPrivate: UserPrivate;
      }>('/api/auth/firebase', {
        method: 'POST',
        body: JSON.stringify({ idToken, language }),
      });
      await finishLoginSession(res.token, res.user, res.userPrivate, true);
      showToast(language === 'bn' ? 'গুগল দিয়ে সাইন ইন সফল হয়েছে' : 'Signed in with Google');
    } catch (err) {
      const friendly = mapFirebaseAuthError(err, language);
      throw new Error(friendly);
    } finally {
      firebaseExchangeInFlightRef.current = false;
    }
  };

  const completeSignupRegistration: SocialVerseContextValue['completeSignupRegistration'] = async (
    payload
  ) => {
    const res = await apiFetch<{ token: string; user: UserPublic; userPrivate: UserPrivate }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ ...payload, language }),
      }
    );
    await finishLoginSession(res.token, res.user, res.userPrivate, payload.saveLogin ?? true);
    setPendingPhotoSetup(true);
    setActiveTab('profile');
    setViewedProfileUid(res.user.uid);
    showToast(language === 'bn' ? 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!' : 'Account created! Welcome to SocialVerse.');
  };

  const loginWithIdentifier: SocialVerseContextValue['loginWithIdentifier'] = async (
    identifier,
    password,
    saveLogin = true
  ) => {
    const res = await apiFetch<{
      requires2fa?: boolean;
      email?: string;
      sentViaSmtp?: boolean;
      devOtpCode?: string;
      token?: string;
      user?: UserPublic;
      userPrivate?: UserPrivate;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    if (res.requires2fa) {
      return {
        requires2fa: true,
        email: res.email,
        sentViaSmtp: res.sentViaSmtp,
        devOtpCode: res.devOtpCode,
      };
    }
    if (res.token && res.user && res.userPrivate) {
      await finishLoginSession(res.token, res.user, res.userPrivate, saveLogin);
      showToast(language === 'bn' ? 'স্বাগতম! সাইন ইন সফল হয়েছে' : 'Signed in successfully');
    }
    return {};
  };

  const verifyTwoFactorLogin = async (email: string, code: string, saveLogin = true) => {
    const res = await apiFetch<{ token: string; user: UserPublic; userPrivate: UserPrivate }>(
      '/api/auth/verify-2fa',
      {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      }
    );
    await finishLoginSession(res.token, res.user, res.userPrivate, saveLogin);
    showToast(language === 'bn' ? 'স্বাগতম!' : 'Verified & signed in');
  };

  const loginWithSavedAccount = async (entry: SavedLoginEntry) => {
    if (!entry.sessionToken) {
      throw new Error(
        language === 'bn'
          ? `@${entry.username}-এ সাইন ইন করতে আপনার পাসওয়ার্ড লিখুন।`
          : `Enter your password to sign back in to @${entry.username}.`
      );
    }
    const res = await apiFetch<{ token: string; user: UserPublic; userPrivate: UserPrivate }>(
      '/api/auth/login-token',
      {
        method: 'POST',
        body: JSON.stringify({ token: entry.sessionToken }),
      }
    );
    await finishLoginSession(res.token, res.user, res.userPrivate, true);
    showToast(
      language === 'bn' ? `@${res.user.username}-এ সুইচ করা হয়েছে` : `Switched to @${res.user.username}`
    );
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    showToast(language === 'bn' ? 'পাসওয়ার্ড পরিবর্তন হয়েছে' : 'Password updated');
  };

  const resetPasswordWithOtp = async (
    verificationToken: string,
    email: string,
    newPassword: string
  ) => {
    const res = await apiFetch<{ ok: boolean; method?: 'direct' | 'email_link'; message?: string }>(
      '/api/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({ verificationToken, email, newPassword }),
      }
    );
    showToast(
      res.message || (language === 'bn' ? 'পাসওয়ার্ড রিসেট সম্পন্ন হয়েছে' : 'Password reset complete')
    );
    return res;
  };

  const deactivateAccount = async (days: number) => {
    await apiFetch('/api/auth/deactivate', {
      method: 'POST',
      body: JSON.stringify({ days }),
    });
    await logout();
    showToast(
      language === 'bn'
        ? `অ্যাকাউন্ট ${days} দিনের জন্য ডিঅ্যাক্টিভেট হয়েছে`
        : `Account deactivated for ${days} days. Log back in anytime to reactivate.`
    );
  };

  const logout = async () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setSessionToken(null);
    setCurrentUser(INITIAL_USER);
    setUserPrivate(INITIAL_USER_PRIVATE);
    setChats([]);
    setMessagesByChat({});
    setFollowingIds([]);
    setFollowerIds([]);
    setFriendRequests([]);
    setNotifications([]);
    setSubscreenState(null);
    setViewedProfileUid(null);
    setNavHistory([]);
    setActiveChatId(null);
    setActiveTabState('home');
    await firebaseSignOut(auth).catch(() => {});
    await refreshState('');
    showToast(language === 'bn' ? 'লগ আউট সম্পন্ন হয়েছে' : 'Logged out');
  };

  const deleteAccount = async () => {
    const uid = currentUser.uid;
    await apiFetch('/api/auth/account', { method: 'DELETE' });
    removeSavedLogin(uid);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setSessionToken(null);
    setCurrentUser(INITIAL_USER);
    setUserPrivate(INITIAL_USER_PRIVATE);
    setSubscreenState(null);
    setViewedProfileUid(null);
    setNavHistory([]);
    setActiveTabState('home');
    await firebaseSignOut(auth).catch(() => {});
    await refreshState('');
    showToast(language === 'bn' ? 'অ্যাকাউন্ট স্থায়ীভাবে মুছে ফেলা হয়েছে' : 'Account deleted permanently.');
  };

  // Language & Theme
  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    setUserPrivate((prev) => ({ ...prev, language: lang }));
    if (isAuthenticated) {
      apiFetch('/api/settings/private', {
        method: 'PATCH',
        body: JSON.stringify({ language: lang }),
      }).catch(() => {});
    }
  };

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    setUserPrivate((prev) => ({ ...prev, themeMode: nextTheme }));
    if (isAuthenticated) {
      apiFetch('/api/settings/private', {
        method: 'PATCH',
        body: JSON.stringify({ themeMode: nextTheme }),
      }).catch(() => {});
    }
  };

  // XHR Upload Helper with smooth 1%–100% progress + device/in-app notification updates
  const uploadJsonWithProgress = useCallback(
    async <T,>(
      url: string,
      payload: unknown,
      kind: 'post' | 'reel' | 'story',
      label: string
    ): Promise<T> => {
      const taskId = `up_${Date.now()}`;
      let highestPct = 1;
      const allowUploadAlert = shouldNotifyUser(userPrivate.notificationPrefs, 'upload');

      setUploadTask({
        id: taskId,
        kind,
        label,
        progress: 1,
        status: 'uploading',
      });
      if (allowUploadAlert) {
        void dispatchDeviceNotification(label, '1% · Starting upload...', 'sv-upload-progress');
      }

      let lastOsMilestone = 0;

      const data = await (isStandaloneAndroidRuntime()
        ? handleStandaloneApi(
            url,
            { method: 'POST', body: JSON.stringify(payload) },
            sessionToken
          ).then((res) => {
            if (!res.ok) {
              throw new Error((res.data?.error as string) || `Upload failed (${res.status})`);
            }
            return res.data as T;
          })
        : new Promise<T>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            if (sessionToken) {
              xhr.setRequestHeader('Authorization', `Bearer ${sessionToken}`);
            }

            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable && evt.total > 0) {
                const rawPct = Math.round((evt.loaded / evt.total) * 88);
                const pct = Math.max(highestPct, Math.min(88, Math.max(5, rawPct)));
                highestPct = pct;
                setUploadTask((prev) =>
                  prev && prev.id === taskId ? { ...prev, progress: pct } : prev
                );
                if (allowUploadAlert && pct - lastOsMilestone >= 35) {
                  lastOsMilestone = pct;
                  void dispatchDeviceNotification(label, `${pct}% · Uploading...`, 'sv-upload-progress');
                }
              }
            };

            xhr.onload = () => {
              let parsed: unknown = {};
              try {
                parsed = JSON.parse(xhr.responseText || '{}');
              } catch {
                parsed = {};
              }
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(parsed as T);
              } else {
                const errMsg =
                  (parsed as { error?: string })?.error || `Upload failed (${xhr.status})`;
                reject(new Error(errMsg));
              }
            };

            xhr.onerror = () => reject(new Error('Network error during upload.'));
            xhr.send(JSON.stringify(payload));
          })
      ).catch((err) => {
        const errMsg = err instanceof Error ? err.message : 'Upload failed';
        setUploadTask({
          id: taskId,
          kind,
          label,
          progress: highestPct,
          status: 'error',
          error: errMsg,
        });
        if (allowUploadAlert) {
          void dispatchDeviceNotification(`${label} failed`, errMsg, 'sv-upload-progress');
        }
        window.setTimeout(() => {
          setUploadTask((prev) => (prev?.id === taskId ? null : prev));
        }, 4200);
        throw err;
      });

      // Ensure 1% -> 100% progress is smoothly visible even on rapid local uploads
      const milestones = highestPct < 55 ? [28, 62, 88, 96, 100] : [95, 100];
      for (const pct of milestones) {
        if (pct <= highestPct && pct < 100) continue;
        setUploadTask((prev) =>
          prev && prev.id === taskId
            ? { ...prev, progress: pct, status: pct === 100 ? 'done' : 'uploading' }
            : prev
        );
        if (pct < 100) {
          await new Promise((r) => setTimeout(r, 85));
        }
      }

      if (allowUploadAlert) {
        void dispatchDeviceNotification(
          `${label} · 100%`,
          language === 'bn' ? 'সফলভাবে প্রকাশিত হয়েছে!' : 'Published successfully!',
          'sv-upload-progress'
        );
      }

      window.setTimeout(() => {
        setUploadTask((prev) => (prev?.id === taskId ? null : prev));
      }, 2800);

      return data;
    },
    [dispatchDeviceNotification, language, sessionToken, userPrivate.notificationPrefs]
  );

  // Posts, Reels & Stories
  const createPost: SocialVerseContextValue['createPost'] = async (payload) => {
    if (!requireAuth()) return;
    const isReel = payload.mediaType === 'reel';
    const label = isReel
      ? language === 'bn'
        ? 'রিল আপলোড হচ্ছে'
        : 'Uploading Reel'
      : language === 'bn'
      ? 'পোস্ট আপলোড হচ্ছে'
      : 'Uploading Post';
    setSubscreenState(null);
    await uploadJsonWithProgress('/api/posts', payload, isReel ? 'reel' : 'post', label);
    await refreshState();
    setActiveTab(isReel ? 'reels' : 'home');
    showToast(language === 'bn' ? 'প্রকাশিত হয়েছে!' : 'Published!');
  };

  const editPost = async (postId: string, caption: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify({ caption }),
    });
    await refreshState();
    showToast(language === 'bn' ? 'পোস্ট আপডেট হয়েছে' : 'Post updated');
  };

  const deletePost = async (postId: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
    await refreshState();
    showToast(language === 'bn' ? 'পোস্ট মুছে ফেলা হয়েছে' : 'Post deleted');
  };

  const toggleLikePost = async (postId: string) => {
    if (!requireAuth()) return;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const nextLiked = !p.likedByMe;
        return {
          ...p,
          likedByMe: nextLiked,
          likesCount: Math.max(0, p.likesCount + (nextLiked ? 1 : -1)),
        };
      })
    );
    try {
      await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' });
      await refreshState();
    } catch {
      await refreshState();
    }
  };

  const likePostIfNeeded = async (postId: string) => {
    if (!requireAuth()) return;
    const target = posts.find((p) => p.id === postId);
    if (target?.likedByMe) return;
    await toggleLikePost(postId);
  };

  const toggleSavePost = async (postId: string) => {
    if (!requireAuth()) return;
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, savedByMe: !p.savedByMe } : p))
    );
    try {
      await apiFetch(`/api/posts/${postId}/save`, { method: 'POST' });
      await refreshState();
    } catch {
      await refreshState();
    }
  };

  const sharePost = async (postId: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/posts/${postId}/share`, { method: 'POST' }).catch(() => {});
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/?post=${postId}`).catch(() => {});
    }
    showToast(language === 'bn' ? 'লিংক কপি হয়েছে' : 'Link copied');
  };

  const shareReelToInbox = async (post: Post, targetUserUid: string) => {
    if (!requireAuth()) return;
    if (!targetUserUid || targetUserUid === currentUser.uid) {
      showToast(
        language === 'bn'
          ? 'শেয়ার করতে অন্য একজন ব্যবহারকারী নির্বাচন করুন'
          : 'Select another account to share this reel.'
      );
      return;
    }
    const peer = creators.find((c) => c.uid === targetUserUid);
    const chatId = await createDirectOrGroupChat(
      peer?.displayName || 'Chat',
      [currentUser.uid, targetUserUid],
      'direct'
    );
    if (!chatId) return;
    await sendMessage(chatId, {
      type: 'reel_share',
      text: post.caption,
      sharedPostId: post.id,
      sharedPostCaption: post.caption,
      sharedPostThumb: post.coverUrl || post.mediaUrls[0],
      sharedPostAuthor: post.authorUsername,
    });
    showToast(
      language === 'bn'
        ? `@${peer?.username || 'user'}-কে রিল পাঠানো হয়েছে`
        : `Sent reel to @${peer?.username || 'user'}`
    );
  };

  const addComment = async (
    postId: string,
    text: string,
    parentCommentId?: string,
    stickerUrl?: string,
    gifUrl?: string
  ) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text, parentCommentId, stickerUrl, gifUrl }),
    });
    await refreshState();
  };

  const createStory: SocialVerseContextValue['createStory'] = async (payload) => {
    if (!requireAuth()) return;
    const label = language === 'bn' ? 'স্টোরি আপলোড হচ্ছে' : 'Uploading Story';
    setSubscreenState(null);
    await uploadJsonWithProgress('/api/stories', payload, 'story', label);
    await refreshState();
    setActiveTab('home');
    showToast(language === 'bn' ? '২৪ ঘণ্টার স্টোরি প্রকাশিত হয়েছে' : '24-hour story published');
  };

  const reactToStory = async (storyId: string, emoji: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/stories/${storyId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
    await refreshState();
    showToast(`${emoji} ${language === 'bn' ? 'প্রতিক্রিয়া পাঠানো হয়েছে' : 'Reaction sent'}`);
  };

  const replyToStory = async (storyId: string, text: string) => {
    if (!requireAuth()) return;
    const story = stories.find((s) => s.id === storyId);
    if (!story || !text.trim()) return;
    if (story.authorId === currentUser.uid) {
      showToast(
        language === 'bn'
          ? 'নিজের স্টোরিতে ইনবক্স উত্তর পাঠানো যায় না'
          : "You can't send an inbox reply to your own story."
      );
      return;
    }
    const chatId = await createDirectOrGroupChat(
      story.authorDisplayName,
      [currentUser.uid, story.authorId],
      'direct'
    );
    if (chatId) {
      await sendMessage(chatId, {
        type: 'text',
        text: `Replied to story: "${text.trim()}"`,
      });
      showToast(language === 'bn' ? 'স্টোরিতে উত্তর পাঠানো হয়েছে' : 'Reply sent to inbox');
    }
  };

  const deleteStory = async (storyId: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/stories/${storyId}`, { method: 'DELETE' });
    setActiveStoryIndex(null);
    await refreshState();
  };

  const muteStoryAuthor = (authorId: string) => {
    if (!requireAuth()) return;
    const next = Array.from(new Set([...(userPrivate.mutedStoryUserIds || []), authorId]));
    updatePrivateSettings({ mutedStoryUserIds: next });
    setActiveStoryIndex(null);
    showToast(language === 'bn' ? 'স্টোরি মিউট করা হয়েছে' : 'Stories muted');
  };

  const createHighlight: SocialVerseContextValue['createHighlight'] = async (payload) => {
    if (!requireAuth()) return null;
    const res = await apiFetch<{ highlight: StoryHighlight }>('/api/highlights', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoryHighlights((prev) => [res.highlight, ...prev.filter((h) => h.id !== res.highlight.id)]);
    void refreshState();
    showToast(language === 'bn' ? 'হাইলাইট যুক্ত হয়েছে' : 'Story highlight added');
    return res.highlight;
  };

  const updateHighlight: SocialVerseContextValue['updateHighlight'] = async (highlightId, updates) => {
    if (!requireAuth()) return;
    const res = await apiFetch<{ highlight: StoryHighlight }>(`/api/highlights/${highlightId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    setStoryHighlights((prev) => prev.map((h) => (h.id === highlightId ? res.highlight : h)));
    void refreshState();
    showToast(language === 'bn' ? 'হাইলাইট আপডেট হয়েছে' : 'Highlight updated');
  };

  const deleteHighlight = async (highlightId: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/highlights/${highlightId}`, { method: 'DELETE' });
    setStoryHighlights((prev) => prev.filter((h) => h.id !== highlightId));
    if (activeHighlightId === highlightId) setActiveHighlightId(null);
    void refreshState();
    showToast(language === 'bn' ? 'হাইলাইট মুছে ফেলা হয়েছে' : 'Highlight removed');
  };

  const fetchUserConnections = async (targetUid: string) => {
    return apiFetch<{ followerIds: string[]; followingIds: string[] }>(
      `/api/users/${targetUid}/connections`
    );
  };

  // Notes & Stickers
  const publishNote = async (text: string, audience: 'followers' | 'close_friends' = 'followers') => {
    if (!requireAuth()) return;
    await apiFetch('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ text, audience }),
    });
    await refreshState();
    showToast(language === 'bn' ? 'নোট শেয়ার হয়েছে' : 'Note shared');
  };

  const deleteMyNote = async () => {
    if (!requireAuth()) return;
    await apiFetch('/api/notes/mine', { method: 'DELETE' });
    await refreshState();
    showToast(language === 'bn' ? 'নোট মুছে ফেলা হয়েছে' : 'Note removed');
  };

  const toggleLikeNote = async (noteId: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/notes/${noteId}/like`, { method: 'POST' });
    await refreshState();
  };

  const createSticker = async (label: string, imageUrl: string, kind: 'sticker' | 'gif' = 'sticker') => {
    if (!requireAuth()) return null;
    const res = await apiFetch<{ sticker: StickerItem }>('/api/stickers', {
      method: 'POST',
      body: JSON.stringify({ label, imageUrl, kind }),
    });
    await refreshState();
    showToast(language === 'bn' ? 'স্টিকার তৈরি ও সেভ হয়েছে' : 'Sticker saved to your pack');
    return res.sticker;
  };

  const toggleFavoriteSticker = async (stickerId: string, imageUrl?: string, label?: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/stickers/${encodeURIComponent(stickerId)}/favorite`, {
      method: 'POST',
      body: JSON.stringify({ imageUrl, label }),
    });
    await refreshState();
    showToast(language === 'bn' ? 'ফেভারিট স্টিকার আপডেট হয়েছে' : 'Updated saved stickers');
  };

  // Messaging, Themes & Groups
  const sendTypingSignal = (chatId: string) => {
    if (!isAuthenticated || wsRef.current?.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (now - (lastTypingSentRef.current[chatId] || 0) < 1500) return;
    lastTypingSentRef.current[chatId] = now;
    wsRef.current.send(JSON.stringify({ type: 'chat:typing', chatId }));
  };

  const sendMessage: SocialVerseContextValue['sendMessage'] = async (chatId, payload) => {
    if (!requireAuth()) return;
    const tempId = `temp_m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();
    const targetChat = chats.find((c) => c.id === chatId);
    const optimisticMsg: ChatMessage = {
      id: tempId,
      chatId,
      senderId: currentUser.uid,
      senderName: targetChat?.chatNicknames?.[currentUser.uid] || currentUser.displayName,
      type: payload.type || 'text',
      text: payload.text,
      mediaUrl: payload.mediaUrl,
      stickerUrl: payload.stickerUrl,
      sharedPostId: payload.sharedPostId,
      sharedPostCaption: payload.sharedPostCaption,
      sharedPostThumb: payload.sharedPostThumb,
      sharedPostAuthor: payload.sharedPostAuthor,
      fileName: payload.fileName,
      durationMs: payload.durationMs,
      replyToId: payload.replyToId,
      replyPreview: payload.replyPreview,
      forwarded: Boolean(payload.forwarded),
      starredByUids: [],
      status: 'delivered',
      reactions: {},
      createdAt: nowIso,
    };
    const previewText =
      optimisticMsg.type === 'sticker'
        ? 'Sent a sticker'
        : optimisticMsg.type === 'reel_share'
        ? 'Shared a reel'
        : optimisticMsg.type === 'voice'
        ? 'Voice message'
        : optimisticMsg.text || optimisticMsg.fileName || 'Attachment';

    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), optimisticMsg],
    }));
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              lastMessageText: previewText,
              lastMessageAt: nowIso,
              archivedByUids: [],
            }
          : c
      )
    );

    try {
      const res = await apiFetch<{ message: ChatMessage }>(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res?.message) {
        setMessagesByChat((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map((m) => (m.id === tempId ? res.message : m)),
        }));
      }
    } catch (err) {
      setMessagesByChat((prev) => ({
        ...prev,
        [chatId]: (prev[chatId] || []).filter((m) => m.id !== tempId),
      }));
      void refreshState();
      showToast(err instanceof Error ? err.message : 'Could not send message.');
    }
  };

  const editMessage = async (chatId: string, messageId: string, text: string) => {
    if (!requireAuth()) return;
    const trimmed = text.trim();
    const nowIso = new Date().toISOString();
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] || []).map((m) =>
        m.id === messageId ? { ...m, text: trimmed, editedAt: nowIso } : m
      ),
    }));
    showToast(language === 'bn' ? 'মেসেজ সম্পাদনা হয়েছে' : 'Message edited');
    try {
      const res = await apiFetch<{ message: ChatMessage }>(
        `/api/chats/${chatId}/messages/${messageId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ text: trimmed }),
        }
      );
      if (res?.message) {
        setMessagesByChat((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map((m) => (m.id === messageId ? res.message : m)),
        }));
      }
    } catch (err) {
      void refreshState();
      showToast(err instanceof Error ? err.message : 'Could not edit message.');
    }
  };

  const reactToMessage = async (chatId: string, messageId: string, emoji: string) => {
    if (!requireAuth()) return;
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] || []).map((m) => {
        if (m.id !== messageId) return m;
        const cur = m.reactions?.[emoji] || [];
        const nextList = cur.includes(currentUser.uid)
          ? cur.filter((id) => id !== currentUser.uid)
          : [...cur, currentUser.uid];
        return { ...m, reactions: { ...(m.reactions || {}), [emoji]: nextList } };
      }),
    }));
    try {
      const res = await apiFetch<{ reactions: Record<string, string[]> }>(
        `/api/chats/${chatId}/messages/${messageId}/react`,
        {
          method: 'POST',
          body: JSON.stringify({ emoji }),
        }
      );
      if (res?.reactions) {
        setMessagesByChat((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map((m) =>
            m.id === messageId ? { ...m, reactions: res.reactions } : m
          ),
        }));
      }
    } catch {
      void refreshState();
    }
  };

  const starMessage = async (chatId: string, messageId: string) => {
    if (!requireAuth()) return;
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] || []).map((m) => {
        if (m.id !== messageId) return m;
        const cur = m.starredByUids || [];
        const exists = cur.includes(currentUser.uid);
        return {
          ...m,
          starredByUids: exists ? cur.filter((id) => id !== currentUser.uid) : [...cur, currentUser.uid],
        };
      }),
    }));
    try {
      const res = await apiFetch<{ starredByUids: string[] }>(
        `/api/chats/${chatId}/messages/${messageId}/star`,
        {
          method: 'POST',
        }
      );
      if (Array.isArray(res?.starredByUids)) {
        setMessagesByChat((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || []).map((m) =>
            m.id === messageId ? { ...m, starredByUids: res.starredByUids } : m
          ),
        }));
      }
    } catch {
      void refreshState();
    }
  };

  const pinMessage = async (chatId: string, messageId: string | null) => {
    if (!requireAuth()) return;
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, pinnedMessageId: messageId || undefined } : c))
    );
    showToast(
      messageId
        ? language === 'bn'
          ? 'মেসেজ পিন করা হয়েছে'
          : 'Message pinned'
        : language === 'bn'
        ? 'পিন সরানো হয়েছে'
        : 'Message unpinned'
    );
    try {
      await apiFetch(`/api/chats/${chatId}/pin`, {
        method: 'POST',
        body: JSON.stringify({ messageId }),
      });
    } catch {
      void refreshState();
    }
  };

  const forwardMessage = async (chatId: string, messageId: string, targetChatId: string) => {
    if (!requireAuth()) return;
    const res = await apiFetch<{ message?: ChatMessage }>(
      `/api/chats/${chatId}/messages/${messageId}/forward`,
      {
        method: 'POST',
        body: JSON.stringify({ targetChatId }),
      }
    );
    if (res?.message) {
      setMessagesByChat((prev) => ({
        ...prev,
        [targetChatId]: [...(prev[targetChatId] || []), res.message!],
      }));
    }
    void refreshState();
    showToast(language === 'bn' ? 'মেসেজ ফরওয়ার্ড হয়েছে' : 'Message forwarded');
  };

  const updateChatPreferences: SocialVerseContextValue['updateChatPreferences'] = async (
    chatId,
    prefs
  ) => {
    if (!requireAuth()) return;
    const toggle = (arr: string[] | undefined, val: boolean | undefined) => {
      if (val === undefined) return arr || [];
      const cur = arr || [];
      return val
        ? Array.from(new Set([...cur, currentUser.uid]))
        : cur.filter((id) => id !== currentUser.uid);
    };
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              pinnedByUids: toggle(c.pinnedByUids, prefs.pinned),
              mutedByUids: toggle(c.mutedByUids, prefs.muted),
              archivedByUids: toggle(c.archivedByUids, prefs.archived),
              unreadByUids: toggle(c.unreadByUids, prefs.unread),
              unreadCount: prefs.unread === false ? 0 : c.unreadCount,
              ...(prefs.disappearingMode ? { disappearingMode: prefs.disappearingMode } : {}),
            }
          : c
      )
    );
    try {
      const res = await apiFetch<{ chat?: Chat }>(`/api/chats/${chatId}/preferences`, {
        method: 'PATCH',
        body: JSON.stringify(prefs),
      });
      if (res?.chat) {
        setChats((prev) => prev.map((c) => (c.id === chatId ? res.chat! : c)));
      }
    } catch {
      void refreshState();
    }
  };

  const deleteChatFromInbox = async (chatId: string) => {
    if (!requireAuth()) return;
    const target = chats.find((c) => c.id === chatId);
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    setMessagesByChat((prev) => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMobileThreadOpen(false);
    }
    showToast(
      target?.type === 'group'
        ? language === 'bn'
          ? 'গ্রুপ ইনবক্স থেকে মুছে ফেলা হয়েছে'
          : 'Group deleted from inbox'
        : language === 'bn'
        ? 'চ্যাট ইনবক্স থেকে মুছে ফেলা হয়েছে'
        : 'Chat deleted from inbox'
    );
    try {
      await apiFetch(`/api/chats/${chatId}`, { method: 'DELETE' });
    } catch {
      void refreshState();
    }
  };

  const deleteMessage = async (chatId: string, messageId: string) => {
    if (!requireAuth()) return;
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] || []).filter((m) => m.id !== messageId),
    }));
    try {
      await apiFetch(`/api/chats/${chatId}/messages/${messageId}`, { method: 'DELETE' });
    } catch {
      void refreshState();
    }
  };

  const createDirectOrGroupChat = async (
    title: string,
    participantUids: string[],
    type: 'direct' | 'group',
    extra?: { avatarUrl?: string; bio?: string; restrictions?: GroupRestrictions }
  ): Promise<string | null> => {
    if (!requireAuth()) return null;
    const uniqueParticipants = Array.from(
      new Set([currentUser.uid, ...participantUids].filter(Boolean))
    );
    if (uniqueParticipants.length < 2) {
      showToast(
        language === 'bn'
          ? 'চ্যাট শুরু করতে অন্তত অন্য একজন ব্যবহারকারী প্রয়োজন।'
          : 'Select at least one other user to start a chat.'
      );
      return null;
    }

    const tempId = type === 'group' ? `temp_grp_${Date.now()}` : null;
    if (tempId) {
      const nowIso = new Date().toISOString();
      const participantNames: Record<string, string> = {};
      const participantAvatars: Record<string, string> = {};
      for (const uid of uniqueParticipants) {
        const profile =
          uid === currentUser.uid ? currentUser : creators.find((c) => c.uid === uid);
        if (profile) {
          participantNames[uid] = profile.displayName;
          participantAvatars[uid] = profile.photoUrl || '';
        }
      }
      const optimisticGroup: Chat = {
        id: tempId,
        type: 'group',
        title: title.trim() || 'New Group',
        bio: extra?.bio?.trim() || '',
        avatarUrl: extra?.avatarUrl || '',
        participantIds: uniqueParticipants,
        participantNames,
        participantAvatars,
        ownerUid: currentUser.uid,
        adminUids: [currentUser.uid],
        restrictions: extra?.restrictions || {},
        lastMessageText: '',
        lastMessageAt: nowIso,
        unreadCount: 0,
        unreadByUids: [],
        createdBy: currentUser.uid,
        createdAt: nowIso,
        typingUsers: [],
      };
      setChats((prev) => [optimisticGroup, ...prev]);
      setActiveChatId(tempId);
    }

    try {
      const res = await apiFetch<{ chat: Chat }>('/api/chats', {
        method: 'POST',
        body: JSON.stringify({ title, participantUids: uniqueParticipants, type, ...extra }),
      });
      setChats((prev) => {
        const filtered = prev.filter((c) => c.id !== tempId && c.id !== res.chat.id);
        return [res.chat, ...filtered];
      });
      setActiveChatId((prev) => (!prev || prev === tempId ? res.chat.id : res.chat.id));
      void refreshState();
      return res.chat.id;
    } catch (err) {
      if (tempId) {
        setChats((prev) => prev.filter((c) => c.id !== tempId));
        setActiveChatId((prev) => (prev === tempId ? null : prev));
      }
      showToast(err instanceof Error ? err.message : 'Could not create chat.');
      return null;
    }
  };

  const updateChatTheme = async (chatId: string, nextTheme: ChatThemeConfig) => {
    if (!requireAuth()) return;
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, theme: nextTheme } : c)));
    showToast(language === 'bn' ? 'চ্যাট থিম আপডেট হয়েছে' : 'Chat theme updated');
    try {
      await apiFetch(`/api/chats/${chatId}/theme`, {
        method: 'PATCH',
        body: JSON.stringify(nextTheme),
      });
    } catch (err) {
      void refreshState();
      showToast(err instanceof Error ? err.message : 'Failed to update chat theme.');
    }
  };

  const updateChatNickname = async (chatId: string, targetUid: string, nickname: string) => {
    if (!requireAuth()) return;
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              chatNicknames: {
                ...(c.chatNicknames || {}),
                [targetUid]: nickname,
              },
            }
          : c
      )
    );
    showToast(language === 'bn' ? 'নিকনেম সেভ হয়েছে' : 'Chat nickname updated');
    try {
      const res = await apiFetch<{ chatNicknames: Record<string, string> }>(
        `/api/chats/${chatId}/nicknames`,
        {
          method: 'PATCH',
          body: JSON.stringify({ targetUid, nickname }),
        }
      );
      if (res?.chatNicknames) {
        setChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, chatNicknames: res.chatNicknames } : c))
        );
      }
    } catch (err) {
      void refreshState();
      showToast(err instanceof Error ? err.message : 'Failed to update nickname.');
    }
  };

  const addGroupMember = async (chatId: string, targetUid: string) => {
    const existing = chats.find((c) => c.id === chatId);
    const isAdmin =
      existing?.ownerUid === currentUser.uid || existing?.adminUids?.includes(currentUser.uid);
    const optimisticPending = Boolean(existing?.requireAddApproval && !isAdmin);
    const targetUser = creators.find((c) => c.uid === targetUid);

    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        if (optimisticPending) {
          const pending = Array.from(new Set([...(c.pendingMemberIds || []), targetUid]));
          return { ...c, pendingMemberIds: pending };
        }
        const participantIds = Array.from(new Set([...c.participantIds, targetUid]));
        return {
          ...c,
          participantIds,
          participantNames: targetUser
            ? { ...(c.participantNames || {}), [targetUid]: targetUser.displayName }
            : c.participantNames,
          participantAvatars: targetUser
            ? { ...(c.participantAvatars || {}), [targetUid]: targetUser.photoUrl || '' }
            : c.participantAvatars,
        };
      })
    );

    try {
      const res = await apiFetch<{ status: string; chat?: Chat }>(`/api/chats/${chatId}/members`, {
        method: 'POST',
        body: JSON.stringify({ targetUid }),
      });
      if (res.chat) {
        setChats((prev) => prev.map((c) => (c.id === chatId ? res.chat! : c)));
      }
      return res.status;
    } catch (err) {
      void refreshState();
      showToast(err instanceof Error ? err.message : 'Failed to add member.');
      return 'error';
    }
  };

  const approveGroupMember = async (chatId: string, targetUid: string, accept: boolean) => {
    const targetUser = creators.find((c) => c.uid === targetUid);
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const pendingMemberIds = (c.pendingMemberIds || []).filter((id) => id !== targetUid);
        const participantIds = accept
          ? Array.from(new Set([...c.participantIds, targetUid]))
          : c.participantIds;
        return {
          ...c,
          pendingMemberIds,
          participantIds,
          participantNames:
            accept && targetUser
              ? { ...(c.participantNames || {}), [targetUid]: targetUser.displayName }
              : c.participantNames,
          participantAvatars:
            accept && targetUser
              ? { ...(c.participantAvatars || {}), [targetUid]: targetUser.photoUrl || '' }
              : c.participantAvatars,
        };
      })
    );

    try {
      const res = await apiFetch<{ ok: boolean; chat?: Chat }>(
        `/api/chats/${chatId}/members/approve`,
        {
          method: 'POST',
          body: JSON.stringify({ targetUid, accept }),
        }
      );
      if (res.chat) {
        setChats((prev) => prev.map((c) => (c.id === chatId ? res.chat! : c)));
      }
    } catch (err) {
      void refreshState();
      showToast(err instanceof Error ? err.message : 'Failed to update member request.');
    }
  };

  const removeGroupMember = async (chatId: string, targetUid: string) => {
    if (targetUid === currentUser.uid) {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChatId === chatId) setActiveChatId(null);
    } else {
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                participantIds: c.participantIds.filter((id) => id !== targetUid),
                adminUids: (c.adminUids || []).filter((id) => id !== targetUid),
              }
            : c
        )
      );
    }

    try {
      const res = await apiFetch<{ ok: boolean; chat?: Chat }>(
        `/api/chats/${chatId}/members/${targetUid}`,
        {
          method: 'DELETE',
        }
      );
      if (targetUid !== currentUser.uid && res.chat) {
        setChats((prev) => prev.map((c) => (c.id === chatId ? res.chat! : c)));
      }
    } catch (err) {
      void refreshState();
      showToast(err instanceof Error ? err.message : 'Failed to remove member.');
    }
  };

  const updateGroupRole = async (
    chatId: string,
    targetUid: string,
    action: 'promote_admin' | 'demote_admin' | 'transfer_owner'
  ) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const currentAdmins = c.adminUids || [];
        if (action === 'promote_admin') {
          return { ...c, adminUids: Array.from(new Set([...currentAdmins, targetUid])) };
        }
        if (action === 'demote_admin') {
          return { ...c, adminUids: currentAdmins.filter((id) => id !== targetUid) };
        }
        return {
          ...c,
          ownerUid: targetUid,
          adminUids: Array.from(new Set([...currentAdmins, currentUser.uid, targetUid])),
        };
      })
    );

    try {
      const res = await apiFetch<{ chat: Chat }>(`/api/chats/${chatId}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ targetUid, action }),
      });
      if (res?.chat) {
        setChats((prev) => prev.map((c) => (c.id === chatId ? res.chat : c)));
      }
    } catch (err) {
      void refreshState();
      showToast(err instanceof Error ? err.message : 'Failed to update role.');
    }
  };

  const updateGroupSettings = async (
    chatId: string,
    updates: {
      title?: string;
      bio?: string;
      avatarUrl?: string;
      requireAddApproval?: boolean;
      restrictions?: GroupRestrictions;
    }
  ) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        return {
          ...c,
          ...(updates.title !== undefined ? { title: updates.title } : {}),
          ...(updates.bio !== undefined ? { bio: updates.bio } : {}),
          ...(updates.avatarUrl !== undefined ? { avatarUrl: updates.avatarUrl } : {}),
          ...(updates.requireAddApproval !== undefined
            ? { requireAddApproval: updates.requireAddApproval }
            : {}),
          ...(updates.restrictions !== undefined
            ? {
                restrictions: {
                  ...(c.restrictions || {}),
                  ...updates.restrictions,
                },
              }
            : {}),
        };
      })
    );
    try {
      const res = await apiFetch<{ chat: Chat }>(`/api/chats/${chatId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      if (res?.chat) {
        setChats((prev) => prev.map((c) => (c.id === chatId ? res.chat : c)));
      }
    } catch (err) {
      void refreshState();
      showToast(err instanceof Error ? err.message : 'Failed to update group settings.');
    }
  };

  // Broadcast Channels
  const createBroadcastChannel = async (title: string, description: string) => {
    await apiFetch('/api/broadcasts', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });
    await refreshState();
    showToast(language === 'bn' ? 'ব্রডকাস্ট চ্যানেল তৈরি হয়েছে!' : 'Broadcast channel created!');
  };

  const toggleFollowBroadcast = async (channelId: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/broadcasts/${channelId}/follow`, { method: 'POST' });
    await refreshState();
  };

  const assignBroadcastRole = async (
    channelId: string,
    targetUid: string,
    role: 'admin' | 'moderator' | 'collaborator' | 'follower'
  ) => {
    await apiFetch(`/api/broadcasts/${channelId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ targetUid, role }),
    });
    await refreshState();
  };

  const sendBroadcastMessage = async (channelId: string, text: string, mediaUrl?: string) => {
    await apiFetch(`/api/broadcasts/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text, mediaUrl }),
    });
    await refreshState();
  };

  const reactBroadcastMessage = async (
    channelId: string,
    msgId: string,
    opts: { like?: boolean; emoji?: string }
  ) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/broadcasts/${channelId}/messages/${msgId}/react`, {
      method: 'POST',
      body: JSON.stringify(opts),
    });
    await refreshState();
  };

  // Social Graph & Profile
  const toggleFollow = async (targetUid: string) => {
    if (!requireAuth()) return;
    const target = creators.find((c) => c.uid === targetUid);
    const wasFollowing = followingIds.includes(targetUid);
    const wasPending = friendRequests.some(
      (r) => r.fromUid === currentUser.uid && r.toUid === targetUid && r.status === 'pending'
    );
    const tempReqId = `temp_fr_${Date.now()}`;

    // Optimistic update for snappy Follow / Follow Back / Private Request feedback
    if (wasFollowing) {
      setFollowingIds((prev) => prev.filter((id) => id !== targetUid));
    } else if (wasPending) {
      setFriendRequests((prev) =>
        prev.filter(
          (r) => !(r.fromUid === currentUser.uid && r.toUid === targetUid && r.status === 'pending')
        )
      );
    } else if (target?.isPrivate) {
      setFriendRequests((prev) => [
        {
          id: tempReqId,
          fromUid: currentUser.uid,
          fromUsername: currentUser.username,
          fromDisplayName: currentUser.displayName,
          fromAvatar: currentUser.photoUrl,
          toUid: targetUid,
          status: 'pending',
          mutualCount: 0,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    } else {
      setFollowingIds((prev) => Array.from(new Set([...prev, targetUid])));
    }

    try {
      const res = await apiFetch<{
        status: string;
        request?: FriendRequest;
        followingIds?: string[];
        targetFollowersCount?: number;
      }>(`/api/users/${targetUid}/follow`, {
        method: 'POST',
      });
      if (Array.isArray(res.followingIds)) {
        setFollowingIds(res.followingIds);
      }
      if (res.status === 'requested') {
        const nextReq: FriendRequest = res.request || {
          id: tempReqId,
          fromUid: currentUser.uid,
          fromUsername: currentUser.username,
          fromDisplayName: currentUser.displayName,
          fromAvatar: currentUser.photoUrl,
          toUid: targetUid,
          status: 'pending',
          mutualCount: 0,
          createdAt: new Date().toISOString(),
        };
        setFriendRequests((prev) => {
          const withoutTempOrDup = prev.filter(
            (r) =>
              r.id !== tempReqId &&
              !(r.fromUid === currentUser.uid && r.toUid === targetUid && r.status === 'pending')
          );
          return [nextReq, ...withoutTempOrDup];
        });
        showToast(language === 'bn' ? 'ফলো রিকোয়েস্ট পাঠানো হয়েছে' : 'Follow request sent');
      } else if (res.status === 'cancelled') {
        setFriendRequests((prev) =>
          prev.filter(
            (r) => !(r.fromUid === currentUser.uid && r.toUid === targetUid && r.status === 'pending')
          )
        );
        showToast(language === 'bn' ? 'ফলো রিকোয়েস্ট বাতিল হয়েছে' : 'Follow request cancelled');
      }
      void refreshState();
    } catch (err) {
      void refreshState();
      showToast(err instanceof Error ? err.message : 'Could not update follow status');
    }
  };

  const respondToFriendRequest = async (requestId: string, accept: boolean) => {
    if (!requireAuth()) return;
    setFriendRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: accept ? 'accepted' : 'rejected' } : r))
    );
    try {
      const res = await apiFetch<{ ok: boolean; followerIds?: string[]; followingIds?: string[] }>(
        `/api/friend-requests/${requestId}/respond`,
        {
          method: 'POST',
          body: JSON.stringify({ accept }),
        }
      );
      if (Array.isArray(res.followerIds)) setFollowerIds(res.followerIds);
      if (Array.isArray(res.followingIds)) setFollowingIds(res.followingIds);
      void refreshState();
    } catch (err) {
      void refreshState();
      showToast(err instanceof Error ? err.message : 'Could not update follow request');
    }
  };

  const removeFollower = async (followerUid: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/followers/${followerUid}`, { method: 'DELETE' });
    await refreshState();
  };

  const blockUser = async (targetUid: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/users/${targetUid}/block`, { method: 'POST' });
    await refreshState();
    showToast(language === 'bn' ? 'ইউজার ব্লক করা হয়েছে' : 'User blocked');
  };

  const unblockUser = async (targetUid: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/users/${targetUid}/block`, { method: 'DELETE' });
    await refreshState();
    showToast(language === 'bn' ? 'আনব্লক করা হয়েছে' : 'User unblocked');
  };

  const updateProfile: SocialVerseContextValue['updateProfile'] = async (updates) => {
    if (!requireAuth()) return 'Authentication required.';
    if (updates.bio !== undefined && updates.bio.length > MAX_BIO_LENGTH) {
      return `Bio must be ${MAX_BIO_LENGTH} characters or fewer.`;
    }
    try {
      const res = await apiFetch<{ user: UserPublic }>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      setCurrentUser(res.user);
      upsertSavedLogin(res.user, userPrivate.email, sessionToken || '', Boolean(userPrivate.saveLoginInfo));
      await refreshState();
      showToast(language === 'bn' ? 'প্রোফাইল আপডেট হয়েছে' : 'Profile updated');
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Failed to update profile.';
    }
  };

  const uploadImageDataUrl = async (file: File, maxDim = 960): Promise<string> => {
    if (file.type.startsWith('video/')) {
      return readFileAsDataUrl(file);
    }
    return compressImageToDataUrl(file, maxDim, 0.82);
  };

  const uploadProfileImage = async (file: File, kind: 'avatar' | 'cover'): Promise<string> => {
    const maxDim = kind === 'avatar' ? 480 : 1200;
    return compressImageToDataUrl(file, maxDim, 0.82);
  };

  const updatePrivateSettings = async (updates: Partial<UserPrivate>) => {
    setUserPrivate((prev) => ({ ...prev, ...updates }));
    if (isAuthenticated) {
      await apiFetch('/api/settings/private', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }).catch(() => {});
    }
  };

  const toggleCloseFriend = async (targetUid: string) => {
    if (!requireAuth() || !targetUid || targetUid === currentUser.uid) return;
    const currentList = userPrivate.closeFriendUids || [];
    const exists = currentList.includes(targetUid);
    const nextList = exists
      ? currentList.filter((id) => id !== targetUid)
      : [...currentList, targetUid];
    await updatePrivateSettings({ closeFriendUids: nextList });
    showToast(
      exists
        ? language === 'bn'
          ? 'ক্লোজ ফ্রেন্ডস থেকে সরানো হয়েছে'
          : 'Removed from Close Friends'
        : language === 'bn'
        ? 'ক্লোজ ফ্রেন্ডসে যোগ করা হয়েছে'
        : 'Added to Close Friends'
    );
  };

  const markAllNotificationsRead = async () => {
    if (!isAuthenticated) return;
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    await refreshState();
  };

  const openReportModal = (
    type: 'post' | 'user' | 'story' | 'comment',
    id: string,
    label: string
  ) => {
    if (!requireAuth()) return;
    setReportTarget({ type, id, label });
    setSubscreenState('report');
  };

  const submitReport = async (reason: string) => {
    if (!reportTarget || !reason.trim()) return;
    const res = await apiFetch<{ report: ReportItem }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify({
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        reason,
      }),
    });
    setReports((prev) => [res.report, ...prev]);
    setSubscreenState(null);
    setReportTarget(null);
    showToast(language === 'bn' ? 'রিপোর্ট জমা হয়েছে' : 'Report submitted for review');
  };

  const openUserProfile = (uid: string) => {
    const isAlreadyThatProfile =
      activeTab === 'profile' && (viewedProfileUid ?? currentUser.uid) === uid && subscreen === null;
    if (!isAlreadyThatProfile) {
      setNavHistory((prev) => [
        ...prev.slice(-19),
        { tab: activeTab, viewedProfileUid, subscreen, activeChatId, mobileThreadOpen },
      ]);
    }
    setViewedProfileUid(uid);
    setActiveTabState('profile');
    setSubscreenState(null);
  };

  const goBack = () => {
    const prevSnap = navHistory[navHistory.length - 1];
    if (prevSnap) {
      setNavHistory((prev) => prev.slice(0, -1));
      setActiveTabState(prevSnap.tab);
      setViewedProfileUid(prevSnap.viewedProfileUid);
      setSubscreenState(prevSnap.subscreen);
      setActiveChatId(prevSnap.activeChatId);
      setMobileThreadOpen(prevSnap.mobileThreadOpen);
      return;
    }
    if (subscreen === 'notifications' || isSettingsSubscreen(subscreen) || subscreen === 'profile_about') {
      setSubscreenState(null);
      return;
    }
    setViewedProfileUid(null);
    setActiveTabState('home');
    setSubscreenState(null);
  };

  const callAiAssistant = async (
    task: string,
    contextText: string
  ): Promise<{ suggestions: string[]; tip: string }> => {
    if (!sessionToken) {
      throw new Error('AUTH_REQUIRED');
    }
    return apiFetch<{ suggestions: string[]; tip: string }>('/api/ai/profile-assist', {
      method: 'POST',
      body: JSON.stringify({
        task,
        contextText,
        currentBio: currentUser.bio,
        language,
      }),
    });
  };

  const activeStories = useMemo(() => {
    const muted = userPrivate.mutedStoryUserIds || [];
    const blocked = userPrivate.blockedUserIds || [];
    return stories.filter(
      (s) => !muted.includes(s.authorId) && !blocked.includes(s.authorId)
    );
  }, [stories, userPrivate.mutedStoryUserIds, userPrivate.blockedUserIds]);

  const visibleHighlights = useMemo(() => {
    const blocked = userPrivate.blockedUserIds || [];
    return storyHighlights.filter((h) => !blocked.includes(h.ownerUid));
  }, [storyHighlights, userPrivate.blockedUserIds]);

  const visiblePosts = useMemo(() => {
    const blocked = userPrivate.blockedUserIds || [];
    return posts.filter((p) => !blocked.includes(p.authorId));
  }, [posts, userPrivate.blockedUserIds]);

  return (
    <SocialVerseContext.Provider
      value={{
        stage,
        setStage,
        authReady,
        firebaseUser,
        sessionToken,
        isAuthenticated,
        authModalOpen,
        authModalReason,
        authModalPrefill,
        openAuthModal,
        closeAuthModal,
        requireAuth,
        isLocked,
        unlockBiometric: () => setIsLocked(false),
        pendingPhotoSetup,
        setPendingPhotoSetup,
        savedLogins,
        removeSavedLogin,
        signInWithGoogle,
        currentUser,
        userPrivate,
        language,
        setLanguage,
        t,
        theme,
        setTheme,
        activeTab,
        setActiveTab,
        subscreen,
        setSubscreen,
        viewedProfileUid,
        openUserProfile,
        canGoBack:
          navHistory.length > 0 ||
          subscreen === 'notifications' ||
          subscreen === 'profile_about' ||
          isSettingsSubscreen(subscreen) ||
          Boolean(viewedProfileUid && viewedProfileUid !== currentUser.uid),
        goBack,
        activeStoryIndex,
        setActiveStoryIndex,
        activeHighlightId,
        setActiveHighlightId,
        activeChatId,
        setActiveChatId,
        mobileThreadOpen,
        setMobileThreadOpen,
        reportTarget,
        openReportModal,
        creators,
        posts: visiblePosts,
        isFeedLoading,
        isReelsLoading,
        refreshFeed,
        refreshReels,
        visiblePostLimit,
        loadMorePosts: () => setVisiblePostLimit((v) => v + 6),
        commentsByPost,
        stories: activeStories,
        storyHighlights: visibleHighlights,
        chats,
        messagesByChat,
        notes,
        stickers,
        favoriteStickerIds,
        broadcastChannels,
        friendRequests,
        followingIds,
        followerIds,
        notifications,
        reports,
        toastMessage,
        showToast,
        uploadTask,
        clearUploadTask,
        browserNotifPermission,
        notifBannerDismissed,
        dismissNotifBanner,
        requestBrowserNotificationPermission,
        sendTestNotification,
        closeFriendsModalOpen,
        setCloseFriendsModalOpen,
        toggleCloseFriend,
        activeCall,
        localStream,
        remoteStream,
        startCall,
        acceptIncomingCall,
        declineIncomingCall,
        endCall,
        toggleCallMute,
        toggleCallCamera,
        sendOtp,
        verifyOtp,
        checkUsernameAvailability,
        completeSignupRegistration,
        loginWithIdentifier,
        verifyTwoFactorLogin,
        loginWithSavedAccount,
        changePassword,
        resetPasswordWithOtp,
        deactivateAccount,
        logout,
        deleteAccount,
        createPost,
        editPost,
        deletePost,
        toggleLikePost,
        likePostIfNeeded,
        toggleSavePost,
        sharePost,
        shareReelToInbox,
        addComment,
        createStory,
        reactToStory,
        replyToStory,
        deleteStory,
        muteStoryAuthor,
        createHighlight,
        updateHighlight,
        deleteHighlight,
        fetchUserConnections,
        publishNote,
        deleteMyNote,
        toggleLikeNote,
        createSticker,
        toggleFavoriteSticker,
        typingByChat,
        sendTypingSignal,
        sendMessage,
        editMessage,
        reactToMessage,
        starMessage,
        pinMessage,
        forwardMessage,
        updateChatPreferences,
        deleteChatFromInbox,
        deleteMessage,
        createDirectOrGroupChat,
        updateChatTheme,
        updateChatNickname,
        addGroupMember,
        approveGroupMember,
        removeGroupMember,
        updateGroupRole,
        updateGroupSettings,
        createBroadcastChannel,
        toggleFollowBroadcast,
        assignBroadcastRole,
        sendBroadcastMessage,
        reactBroadcastMessage,
        toggleFollow,
        respondToFriendRequest,
        removeFollower,
        blockUser,
        unblockUser,
        updateProfile,
        uploadImageDataUrl,
        uploadProfileImage,
        updatePrivateSettings,
        markAllNotificationsRead,
        submitReport,
        callAiAssistant,
      }}
    >
      {children}
    </SocialVerseContext.Provider>
  );
}

export function useSocialVerse() {
  const ctx = useContext(SocialVerseContext);
  if (!ctx) throw new Error('useSocialVerse must be used inside SocialVerseProvider');
  return ctx;
}
