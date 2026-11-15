import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  ThemeMode,
  UserPrivate,
  UserPublic,
} from '../types/social';
import { TRANSLATIONS, type TranslationBundle } from '../utils/i18n';
import { MAX_BIO_LENGTH } from '../utils/validation';
import { validateFirestoreConnection } from '../firebase';

export type AuthStage = 'splash' | 'app';

export class ApiError extends Error {
  status: number;
  code?: string;
  existingEmail?: string;

  constructor(message: string, status: number, code?: string, existingEmail?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.existingEmail = existingEmail;
  }
}

export interface ProfileUpdatePayload {
  username?: string;
  displayName?: string;
  nicknameFont?: NicknameFontStyle;
  bio?: string;
  pronouns?: string;
  website?: string;
  photoUrl?: string;
  coverUrl?: string;
  interests?: string[];
  isPrivate?: boolean;
}

interface BackendStateResponse {
  currentUser: UserPublic | null;
  userPrivate: UserPrivate | null;
  creators: UserPublic[];
  posts: Post[];
  commentsByPost: Record<string, PostComment[]>;
  stories: Story[];
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
  sessionToken: string | null;
  isAuthenticated: boolean;
  authModalOpen: boolean;
  authModalReason: string | null;
  openAuthModal: (reason?: string) => void;
  closeAuthModal: () => void;
  requireAuth: (reason?: string) => boolean;
  isLocked: boolean;
  unlockBiometric: () => void;
  pendingPhotoSetup: boolean;
  setPendingPhotoSetup: (v: boolean) => void;
  savedLogins: SavedLoginEntry[];
  removeSavedLogin: (uid: string) => void;

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
  activeStoryIndex: number | null;
  setActiveStoryIndex: (idx: number | null) => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  reportTarget: { type: 'post' | 'user' | 'story' | 'comment'; id: string; label: string } | null;
  openReportModal: (type: 'post' | 'user' | 'story' | 'comment', id: string, label: string) => void;

  creators: UserPublic[];
  posts: Post[];
  visiblePostLimit: number;
  loadMorePosts: () => void;
  commentsByPost: Record<string, PostComment[]>;
  stories: Story[];
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
  resetPasswordWithOtp: (verificationToken: string, email: string, newPassword: string) => Promise<void>;
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

  // Notes & Stickers
  publishNote: (text: string) => Promise<void>;
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
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  createDirectOrGroupChat: (
    title: string,
    participantUids: string[],
    type: 'direct' | 'group'
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
  updateGroupSettings: (chatId: string, updates: { title?: string; requireAddApproval?: boolean }) => Promise<void>;

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

  const [stage, setStage] = useState<AuthStage>(autostart ? 'app' : 'splash');
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
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [pendingPhotoSetup, setPendingPhotoSetup] = useState<boolean>(false);

  const [currentUser, setCurrentUser] = useState<UserPublic>(INITIAL_USER);
  const [userPrivate, setUserPrivate] = useState<UserPrivate>(INITIAL_USER_PRIVATE);
  const [language, setLanguageState] = useState<AppLanguage>('en');
  const [theme, setThemeState] = useState<ThemeMode>('light');

  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [subscreen, setSubscreenState] = useState<ActiveModalOrSubscreen>(null);
  const [viewedProfileUid, setViewedProfileUid] = useState<string | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    type: 'post' | 'user' | 'story' | 'comment';
    id: string;
    label: string;
  } | null>(null);

  const [creators, setCreators] = useState<UserPublic[]>(INITIAL_CREATORS);
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [visiblePostLimit, setVisiblePostLimit] = useState<number>(10);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>(INITIAL_COMMENTS);
  const [stories, setStories] = useState<Story[]>(INITIAL_STORIES);
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
  const [typingByChat, setTypingByChat] = useState<Record<string, string[]>>({});
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastTypingSentRef = useRef<Record<string, number>>({});

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

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
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

  const applyServerState = useCallback((data: BackendStateResponse) => {
    if (data.currentUser) {
      setCurrentUser(data.currentUser);
    }
    if (data.userPrivate) {
      setUserPrivate(data.userPrivate);
      if (data.userPrivate.language) setLanguageState(data.userPrivate.language);
      if (data.userPrivate.themeMode) setThemeState(data.userPrivate.themeMode === 'dark' ? 'dark' : 'light');
    }
    setCreators(data.creators || []);
    setPosts(data.posts || []);
    setCommentsByPost(data.commentsByPost || {});
    setStories(data.stories || []);
    setChats(data.chats || []);
    setMessagesByChat(data.messagesByChat || {});
    setNotes(data.notes || []);
    setStickers([...(data.stickers || []), ...DEFAULT_STICKERS]);
    setFavoriteStickerIds(data.favoriteStickerIds || []);
    setBroadcastChannels(data.broadcastChannels || []);
    setFollowingIds(data.followingIds || []);
    setFollowerIds(data.followerIds || []);
    setFriendRequests(data.friendRequests || []);
    setNotifications(data.notifications || []);
  }, []);

  const apiFetch = useCallback(
    async <T,>(url: string, options: RequestInit = {}, overrideToken?: string): Promise<T> => {
      const tokenToUse = overrideToken ?? sessionToken;
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
        const errBody = data as { error?: string; code?: string; existingEmail?: string };
        throw new ApiError(
          errBody.error || `Request failed (${res.status})`,
          res.status,
          errBody.code,
          errBody.existingEmail
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
    refreshState(sessionToken || undefined);
  }, [sessionToken, refreshState]);

  useEffect(() => {
    void validateFirestoreConnection();
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

  // WebSocket Real-Time Listener & Call Signaling
  useEffect(() => {
    if (!sessionToken) {
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
          if (msg.state) applyServerState(msg.state);
          else refreshState(sessionToken);
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
          cleanupMediaAndPeer();
          setActiveCall(null);
          showToast(msg.type === 'call:decline' ? 'Call declined' : 'Call ended');
        }
      } catch {
        // ignore invalid packets
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionToken, applyServerState, refreshState, cleanupMediaAndPeer, showToast]);

  const openAuthModal = (reason?: string) => {
    setAuthModalReason(reason || null);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setAuthModalReason(null);
  };

  const requireAuth = (reason?: string): boolean => {
    if (isAuthenticated) return true;
    openAuthModal(reason);
    return false;
  };

  const setSubscreen = (sub: ActiveModalOrSubscreen) => {
    if (
      (sub === 'edit_profile' ||
        sub === 'story_creator' ||
        sub === 'ai_assistant' ||
        sub === 'create_sheet' ||
        sub === 'broadcast_channel') &&
      !isAuthenticated
    ) {
      openAuthModal();
      return;
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

  const finishLoginSession = async (
    token: string,
    user: UserPublic,
    priv: UserPrivate,
    saveLogin = true
  ) => {
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
    await apiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ verificationToken, email, newPassword }),
    });
    showToast(language === 'bn' ? 'পাসওয়ার্ড রিসেট সম্পন্ন হয়েছে' : 'Password reset complete');
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
    setActiveChatId(null);
    setActiveTab('home');
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
    setActiveTab('home');
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

  // Posts, Reels & Stories
  const createPost: SocialVerseContextValue['createPost'] = async (payload) => {
    if (!requireAuth()) return;
    await apiFetch('/api/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await refreshState();
    setSubscreenState(null);
    setActiveTab(payload.mediaType === 'reel' ? 'reels' : 'home');
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
    await apiFetch('/api/stories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await refreshState();
    setSubscreenState(null);
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
    const next = Array.from(new Set([...userPrivate.mutedStoryUserIds, authorId]));
    updatePrivateSettings({ mutedStoryUserIds: next });
    setActiveStoryIndex(null);
    showToast(language === 'bn' ? 'স্টোরি মিউট করা হয়েছে' : 'Stories muted');
  };

  // Notes & Stickers
  const publishNote = async (text: string) => {
    if (!requireAuth()) return;
    await apiFetch('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ text }),
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
    await apiFetch(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await refreshState();
  };

  const editMessage = async (chatId: string, messageId: string, text: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/chats/${chatId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ text }),
    });
    await refreshState();
    showToast(language === 'bn' ? 'মেসেজ সম্পাদনা হয়েছে' : 'Message edited');
  };

  const reactToMessage = async (chatId: string, messageId: string, emoji: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/chats/${chatId}/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
    await refreshState();
  };

  const starMessage = async (chatId: string, messageId: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/chats/${chatId}/messages/${messageId}/star`, {
      method: 'POST',
    });
    await refreshState();
  };

  const pinMessage = async (chatId: string, messageId: string | null) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/chats/${chatId}/pin`, {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    });
    await refreshState();
    showToast(
      messageId
        ? language === 'bn'
          ? 'মেসেজ পিন করা হয়েছে'
          : 'Message pinned'
        : language === 'bn'
        ? 'পিন সরানো হয়েছে'
        : 'Message unpinned'
    );
  };

  const forwardMessage = async (chatId: string, messageId: string, targetChatId: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/chats/${chatId}/messages/${messageId}/forward`, {
      method: 'POST',
      body: JSON.stringify({ targetChatId }),
    });
    await refreshState();
    showToast(language === 'bn' ? 'মেসেজ ফরওয়ার্ড হয়েছে' : 'Message forwarded');
  };

  const updateChatPreferences: SocialVerseContextValue['updateChatPreferences'] = async (
    chatId,
    prefs
  ) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/chats/${chatId}/preferences`, {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    });
    await refreshState();
  };

  const deleteMessage = async (chatId: string, messageId: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/chats/${chatId}/messages/${messageId}`, { method: 'DELETE' });
    await refreshState();
  };

  const createDirectOrGroupChat = async (
    title: string,
    participantUids: string[],
    type: 'direct' | 'group'
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
    const res = await apiFetch<{ chat: Chat }>('/api/chats', {
      method: 'POST',
      body: JSON.stringify({ title, participantUids: uniqueParticipants, type }),
    });
    await refreshState();
    setActiveChatId(res.chat.id);
    return res.chat.id;
  };

  const updateChatTheme = async (chatId: string, nextTheme: ChatThemeConfig) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/chats/${chatId}/theme`, {
      method: 'PATCH',
      body: JSON.stringify(nextTheme),
    });
    await refreshState();
    showToast(language === 'bn' ? 'চ্যাট থিম আপডেট হয়েছে' : 'Chat theme updated');
  };

  const updateChatNickname = async (chatId: string, targetUid: string, nickname: string) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/chats/${chatId}/nicknames`, {
      method: 'PATCH',
      body: JSON.stringify({ targetUid, nickname }),
    });
    await refreshState();
    showToast(language === 'bn' ? 'নিকনেম সেভ হয়েছে' : 'Chat nickname updated');
  };

  const addGroupMember = async (chatId: string, targetUid: string) => {
    const res = await apiFetch<{ status: string }>(`/api/chats/${chatId}/members`, {
      method: 'POST',
      body: JSON.stringify({ targetUid }),
    });
    await refreshState();
    return res.status;
  };

  const approveGroupMember = async (chatId: string, targetUid: string, accept: boolean) => {
    await apiFetch(`/api/chats/${chatId}/members/approve`, {
      method: 'POST',
      body: JSON.stringify({ targetUid, accept }),
    });
    await refreshState();
  };

  const removeGroupMember = async (chatId: string, targetUid: string) => {
    await apiFetch(`/api/chats/${chatId}/members/${targetUid}`, { method: 'DELETE' });
    await refreshState();
  };

  const updateGroupRole = async (
    chatId: string,
    targetUid: string,
    action: 'promote_admin' | 'demote_admin' | 'transfer_owner'
  ) => {
    await apiFetch(`/api/chats/${chatId}/roles`, {
      method: 'PATCH',
      body: JSON.stringify({ targetUid, action }),
    });
    await refreshState();
  };

  const updateGroupSettings = async (
    chatId: string,
    updates: { title?: string; requireAddApproval?: boolean }
  ) => {
    await apiFetch(`/api/chats/${chatId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    await refreshState();
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
    const res = await apiFetch<{ status: string }>(`/api/users/${targetUid}/follow`, {
      method: 'POST',
    });
    await refreshState();
    if (res.status === 'requested') {
      showToast(language === 'bn' ? 'ফলো রিকোয়েস্ট পাঠানো হয়েছে' : 'Follow request sent');
    }
  };

  const respondToFriendRequest = async (requestId: string, accept: boolean) => {
    if (!requireAuth()) return;
    await apiFetch(`/api/friend-requests/${requestId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ accept }),
    });
    await refreshState();
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
    setViewedProfileUid(uid);
    setActiveTab('profile');
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

  const activeStories = useMemo(
    () =>
      stories.filter(
        (s) =>
          !userPrivate.mutedStoryUserIds.includes(s.authorId) &&
          !userPrivate.blockedUserIds.includes(s.authorId)
      ),
    [stories, userPrivate.mutedStoryUserIds, userPrivate.blockedUserIds]
  );

  const visiblePosts = useMemo(
    () => posts.filter((p) => !userPrivate.blockedUserIds.includes(p.authorId)),
    [posts, userPrivate.blockedUserIds]
  );

  return (
    <SocialVerseContext.Provider
      value={{
        stage,
        setStage,
        sessionToken,
        isAuthenticated,
        authModalOpen,
        authModalReason,
        openAuthModal,
        closeAuthModal,
        requireAuth,
        isLocked,
        unlockBiometric: () => setIsLocked(false),
        pendingPhotoSetup,
        setPendingPhotoSetup,
        savedLogins,
        removeSavedLogin,
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
        activeStoryIndex,
        setActiveStoryIndex,
        activeChatId,
        setActiveChatId,
        reportTarget,
        openReportModal,
        creators,
        posts: visiblePosts,
        visiblePostLimit,
        loadMorePosts: () => setVisiblePostLimit((v) => v + 6),
        commentsByPost,
        stories: activeStories,
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
