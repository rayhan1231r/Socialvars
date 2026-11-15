import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  storage,
  validateFirestoreConnection,
} from '../firebase';
import {
  INITIAL_CHATS,
  INITIAL_COMMENTS,
  INITIAL_CREATORS,
  INITIAL_FRIEND_REQUESTS,
  INITIAL_MESSAGES,
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
  Chat,
  ChatMessage,
  FriendRequest,
  MainTab,
  MediaType,
  Post,
  PostComment,
  ReportItem,
  Story,
  ThemeMode,
  UserPrivate,
  UserPublic,
} from '../types/social';
import { TRANSLATIONS, type TranslationBundle } from '../utils/i18n';
import {
  extractHashtags,
  isStoryActive,
  isValidBio,
  isValidCommentText,
  isValidDisplayName,
  isValidPostCaption,
  isValidUsername,
  isValidWebsiteUrl,
  mapFirebaseAuthError,
  normalizeUsername,
  normalizeWebsiteUrl,
} from '../utils/validation';

export type AuthStage = 'splash' | 'auth' | 'verify_email' | 'onboarding' | 'app';

export interface ProfileUpdatePayload {
  username?: string;
  displayName?: string;
  bio?: string;
  pronouns?: string;
  website?: string;
  photoUrl?: string;
  coverUrl?: string;
  interests?: string[];
  isPrivate?: boolean;
}

interface SocialVerseContextValue {
  stage: AuthStage;
  setStage: (s: AuthStage) => void;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isPreviewMode: boolean;
  authModalOpen: boolean;
  authModalReason: string | null;
  openAuthModal: (reason?: string) => void;
  closeAuthModal: () => void;
  requireAuth: (reason?: string) => boolean;
  isLocked: boolean;
  unlockBiometric: () => void;
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
  friendRequests: FriendRequest[];
  followingIds: string[];
  followerIds: string[];
  notifications: AppNotification[];
  reports: ReportItem[];
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Auth actions
  enterPreviewMode: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  completeOnboarding: (payload: {
    username: string;
    displayName: string;
    bio: string;
    photoUrl: string;
    interests: string[];
    isPrivate: boolean;
  }) => Promise<string | null>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;

  // Feed & Story actions
  createPost: (payload: {
    caption: string;
    mediaUrls: string[];
    mediaType: MediaType;
    visibility: 'public' | 'followers';
  }) => Promise<void>;
  editPost: (postId: string, caption: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  toggleLikePost: (postId: string) => void;
  toggleSavePost: (postId: string) => void;
  sharePost: (postId: string) => void;
  addComment: (postId: string, text: string, parentCommentId?: string) => void;
  createStory: (payload: {
    mediaType: 'photo' | 'video' | 'text';
    mediaUrl?: string;
    textContent?: string;
    privacy: 'everyone' | 'followers' | 'close_friends';
  }) => Promise<void>;
  reactToStory: (storyId: string, emoji: string) => void;
  replyToStory: (storyId: string, text: string) => void;
  deleteStory: (storyId: string) => void;
  muteStoryAuthor: (authorId: string) => void;

  // Messaging actions
  sendMessage: (
    chatId: string,
    payload: {
      type: 'text' | 'voice' | 'image' | 'video' | 'file';
      text?: string;
      mediaUrl?: string;
      fileName?: string;
      durationMs?: number;
      replyToId?: string;
      replyPreview?: string;
    }
  ) => void;
  reactToMessage: (chatId: string, messageId: string, emoji: string) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  createDirectOrGroupChat: (title: string, participantUids: string[], type: 'direct' | 'group') => string | null;

  // Social Graph & Profile actions
  toggleFollow: (targetUid: string) => void;
  respondToFriendRequest: (requestId: string, accept: boolean) => void;
  removeFollower: (followerUid: string) => void;
  blockUser: (targetUid: string) => void;
  unblockUser: (targetUid: string) => void;
  updateProfile: (updates: ProfileUpdatePayload) => Promise<string | null>;
  uploadProfileImage: (file: File, kind: 'avatar' | 'cover') => Promise<string>;
  updatePrivateSettings: (updates: Partial<UserPrivate>) => void;
  markAllNotificationsRead: () => void;
  submitReport: (reason: string) => void;
  callAiAssistant: (task: string, contextText: string) => Promise<{ suggestions: string[]; tip: string }>;
}

const SocialVerseContext = createContext<SocialVerseContextValue | null>(null);

async function compressImageToDataUrl(file: File, maxDim: number, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not decode selected image'));
    };
    img.src = objectUrl;
  });
}

export function SocialVerseProvider({ children }: { children: React.ReactNode }) {
  const autostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [stage, setStage] = useState<AuthStage>(autostart ? 'app' : 'splash');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalReason, setAuthModalReason] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);

  const [currentUser, setCurrentUser] = useState<UserPublic>(INITIAL_USER);
  const [userPrivate, setUserPrivate] = useState<UserPrivate>(INITIAL_USER_PRIVATE);
  const [language, setLanguageState] = useState<AppLanguage>('en');
  const [theme, setThemeState] = useState<ThemeMode>('light');

  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [subscreen, setSubscreenState] = useState<ActiveModalOrSubscreen>(null);
  const [viewedProfileUid, setViewedProfileUid] = useState<string | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(INITIAL_CHATS[0].id);
  const [reportTarget, setReportTarget] = useState<{
    type: 'post' | 'user' | 'story' | 'comment';
    id: string;
    label: string;
  } | null>(null);

  const [creators, setCreators] = useState<UserPublic[]>(INITIAL_CREATORS);
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [visiblePostLimit, setVisiblePostLimit] = useState<number>(6);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>(INITIAL_COMMENTS);
  const [stories, setStories] = useState<Story[]>(INITIAL_STORIES);
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>(INITIAL_MESSAGES);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>(INITIAL_FRIEND_REQUESTS);
  const [followingIds, setFollowingIds] = useState<string[]>(['user_rafi_02']);
  const [followerIds, setFollowerIds] = useState<string[]>(['user_rafi_02', 'user_tania_03']);
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isAuthenticated = Boolean(firebaseUser);
  const t = useMemo(() => TRANSLATIONS[language], [language]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    validateFirestoreConnection();
  }, []);

  // Instagram-style 2.3s splash loading -> directly opens Home Feed in browse preview mode
  useEffect(() => {
    if (stage !== 'splash') return;
    const timer = setTimeout(() => {
      setStage((prev) => (prev === 'splash' ? 'app' : prev));
    }, 2300);
    return () => clearTimeout(timer);
  }, [stage]);

  const openAuthModal = (reason?: string) => {
    setAuthModalReason(reason || null);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setAuthModalReason(null);
  };

  const requireAuth = (reason?: string): boolean => {
    if (firebaseUser) return true;
    openAuthModal(reason);
    return false;
  };

  const setSubscreen = (sub: ActiveModalOrSubscreen) => {
    if (
      (sub === 'edit_profile' ||
        sub === 'story_creator' ||
        sub === 'ai_assistant') &&
      !firebaseUser
    ) {
      openAuthModal(
        sub === 'edit_profile'
          ? language === 'bn'
            ? 'আপনার প্রোফাইল এডিট করতে সাইন ইন বা অ্যাকাউন্ট তৈরি করুন।'
            : 'Sign in or create an account to edit your profile.'
          : sub === 'story_creator'
          ? language === 'bn'
            ? 'নতুন স্টোরি প্রকাশ করতে সাইন ইন করুন।'
            : 'Sign in or create an account to publish a story.'
          : language === 'bn'
          ? 'এআই প্রোফাইল অ্যাসিস্ট্যান্ট ব্যবহার করতে সাইন ইন করুন।'
          : 'Sign in to use the Gemini AI Profile Assistant.'
      );
      return;
    }
    setSubscreenState(sub);
  };

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setIsPreviewMode(true);
        return;
      }

      setIsPreviewMode(false);
      setAuthModalOpen(false);
      setAuthModalReason(null);

      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const raw = snap.data() as Partial<UserPublic>;
          const loadedUser: UserPublic = {
            ...INITIAL_USER,
            ...raw,
            uid: user.uid,
            username: raw.username || normalizeUsername(user.email?.split('@')[0] || `sv_${user.uid.slice(0, 6)}`),
            displayName: raw.displayName || user.displayName || 'SocialVerse Member',
            photoUrl: raw.photoUrl || user.photoURL || INITIAL_USER.photoUrl,
            coverUrl: raw.coverUrl || INITIAL_USER.coverUrl,
            bio: raw.bio ?? '',
            pronouns: raw.pronouns ?? '',
            website: raw.website ?? '',
            interests: Array.isArray(raw.interests) ? raw.interests : [],
            isPrivate: Boolean(raw.isPrivate),
            followersCount: typeof raw.followersCount === 'number' ? raw.followersCount : 0,
            followingCount: typeof raw.followingCount === 'number' ? raw.followingCount : 0,
            postsCount: typeof raw.postsCount === 'number' ? raw.postsCount : 0,
            onlineStatus: raw.onlineStatus || 'online',
            lastSeenAt: typeof raw.lastSeenAt === 'string' ? raw.lastSeenAt : new Date().toISOString(),
            onboardingCompleted: Boolean(raw.onboardingCompleted),
            createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
          };
          setCurrentUser(loadedUser);
          setCreators((prev) => {
            const exists = prev.some((c) => c.uid === loadedUser.uid);
            return exists
              ? prev.map((c) => (c.uid === loadedUser.uid ? loadedUser : c))
              : [loadedUser, ...prev];
          });

          try {
            const privSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'info'));
            if (privSnap.exists()) {
              const privData = privSnap.data() as UserPrivate;
              setUserPrivate({ ...INITIAL_USER_PRIVATE, ...privData, uid: user.uid });
              if (privData.language) setLanguageState(privData.language);
              if (privData.themeMode) setThemeState(privData.themeMode === 'dark' ? 'dark' : 'light');
              if (privData.biometricLockEnabled) {
                setIsLocked(true);
              }
            }
          } catch (privErr) {
            console.warn('Could not load private user settings:', privErr);
          }

          setStage(loadedUser.onboardingCompleted ? 'app' : 'onboarding');
        } else {
          const base = normalizeUsername(user.email?.split('@')[0] || user.displayName || `user_${user.uid.slice(0, 6)}`);
          const defaultUsername = base.length >= 3 ? base.slice(0, 24) : `sv_${user.uid.slice(0, 6)}`;
          setCurrentUser({
            ...INITIAL_USER,
            uid: user.uid,
            username: defaultUsername,
            displayName: user.displayName || 'SocialVerse Member',
            bio: '',
            pronouns: '',
            website: '',
            photoUrl: user.photoURL || INITIAL_USER.photoUrl,
            followersCount: 0,
            followingCount: 0,
            postsCount: 0,
            onboardingCompleted: false,
            createdAt: new Date().toISOString(),
          });
          setUserPrivate({
            ...INITIAL_USER_PRIVATE,
            uid: user.uid,
            email: user.email || '',
          });
          setStage('onboarding');
        }
      } catch (err) {
        console.error('Auth profile sync error:', err);
        const defaultUsername = normalizeUsername(user.email?.split('@')[0] || `sv_${user.uid.slice(0, 6)}`);
        setCurrentUser((prev) => ({
          ...prev,
          uid: user.uid,
          username: defaultUsername.length >= 3 ? defaultUsername : `sv_${user.uid.slice(0, 6)}`,
          displayName: user.displayName || prev.displayName,
          photoUrl: user.photoURL || prev.photoUrl,
        }));
        setStage('app');
      }
    });
    return () => unsub();
  }, []);

  // Firestore real-time listeners when Firebase authenticated & in app
  useEffect(() => {
    if (!firebaseUser || stage !== 'app' || isPreviewMode) return;

    const postsQuery = query(
      collection(db, 'posts'),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc')
    );
    const unsubPosts = onSnapshot(
      postsQuery,
      (snap) => {
        if (!snap.empty) {
          const remote = snap.docs.map((d) => d.data() as Post);
          setPosts((prev) => {
            const remoteIds = new Set(remote.map((r) => r.id));
            const localSeed = prev.filter((p) => !remoteIds.has(p.id));
            return [...remote, ...localSeed];
          });
        }
      },
      (error) => {
        console.warn('Posts listener error:', error);
      }
    );

    const notifQuery = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', firebaseUser.uid)
    );
    const unsubNotifs = onSnapshot(
      notifQuery,
      (snap) => {
        if (!snap.empty) {
          setNotifications(snap.docs.map((d) => d.data() as AppNotification));
        }
      },
      (error) => {
        console.warn('Notifications listener error:', error);
      }
    );

    return () => {
      unsubPosts();
      unsubNotifs();
    };
  }, [firebaseUser, stage, isPreviewMode]);

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    setUserPrivate((prev) => ({ ...prev, language: lang }));
    if (firebaseUser && !isPreviewMode) {
      updateDoc(doc(db, 'users', firebaseUser.uid, 'private', 'info'), {
        language: lang,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  };

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    setUserPrivate((prev) => ({ ...prev, themeMode: nextTheme }));
    if (firebaseUser && !isPreviewMode) {
      updateDoc(doc(db, 'users', firebaseUser.uid, 'private', 'info'), {
        themeMode: nextTheme,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  };

  const enterPreviewMode = () => {
    setIsPreviewMode(true);
    setAuthModalOpen(false);
    setCurrentUser(INITIAL_USER);
    setUserPrivate(INITIAL_USER_PRIVATE);
    setStage('app');
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setAuthModalOpen(false);
      showToast(language === 'bn' ? 'সফলভাবে সাইন ইন হয়েছে' : 'Signed in with Google');
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err, language));
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setAuthModalOpen(false);
      showToast(language === 'bn' ? 'স্বাগতম! সাইন ইন সফল হয়েছে' : 'Signed in successfully');
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err, language));
    }
  };

  const registerWithEmail = async (email: string, password: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // Send verification non-blocking so new users can immediately complete onboarding
      sendEmailVerification(cred.user).catch(() => {});
      setAuthModalOpen(false);
      showToast(language === 'bn' ? 'অ্যাকাউন্ট তৈরি হয়েছে!' : 'Account created! Complete your profile.');
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err, language));
    }
  };

  const resendVerificationEmail = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        showToast(language === 'bn' ? 'ভেরিফিকেশন ইমেইল পাঠানো হয়েছে' : 'Verification email sent.');
      } catch (err) {
        showToast(mapFirebaseAuthError(err, language));
      }
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showToast(language === 'bn' ? 'পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে' : 'Password reset link sent.');
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err, language));
    }
  };

  const completeOnboarding: SocialVerseContextValue['completeOnboarding'] = async (payload) => {
    const cleanUsername = normalizeUsername(payload.username);
    if (!isValidUsername(cleanUsername)) {
      return t.auth.usernameInvalid;
    }
    if (!isValidDisplayName(payload.displayName)) {
      return 'Display name must be 1–50 characters.';
    }
    if (!isValidBio(payload.bio)) {
      return 'Bio must be 240 characters or fewer.';
    }

    const takenLocally = creators.some(
      (c) => c.username === cleanUsername && c.uid !== (firebaseUser?.uid || currentUser.uid)
    );
    if (takenLocally) {
      return t.auth.usernameTaken;
    }

    const targetUid = firebaseUser?.uid || currentUser.uid;
    const updatedUser: UserPublic = {
      ...currentUser,
      uid: targetUid,
      username: cleanUsername,
      displayName: payload.displayName.trim(),
      bio: payload.bio.trim(),
      photoUrl: payload.photoUrl || currentUser.photoUrl || INITIAL_USER.photoUrl,
      coverUrl: currentUser.coverUrl || INITIAL_USER.coverUrl,
      interests: payload.interests,
      isPrivate: payload.isPrivate,
      onlineStatus: 'online',
      lastSeenAt: new Date().toISOString(),
      onboardingCompleted: true,
    };

    if (firebaseUser) {
      try {
        await runTransaction(db, async (tx) => {
          const usernameRef = doc(db, 'usernames', cleanUsername);
          const existingClaim = await tx.get(usernameRef);
          if (existingClaim.exists() && existingClaim.data()?.uid !== firebaseUser.uid) {
            throw new Error('USERNAME_TAKEN');
          }
          tx.set(usernameRef, {
            uid: firebaseUser.uid,
            username: cleanUsername,
            createdAt: serverTimestamp(),
          });
          tx.set(doc(db, 'users', firebaseUser.uid), {
            uid: firebaseUser.uid,
            username: updatedUser.username,
            displayName: updatedUser.displayName,
            bio: updatedUser.bio,
            pronouns: updatedUser.pronouns || '',
            website: updatedUser.website || '',
            photoUrl: updatedUser.photoUrl,
            coverUrl: updatedUser.coverUrl,
            interests: updatedUser.interests,
            isPrivate: updatedUser.isPrivate,
            followersCount: updatedUser.followersCount,
            followingCount: updatedUser.followingCount,
            postsCount: updatedUser.postsCount,
            onlineStatus: 'online',
            lastSeenAt: updatedUser.lastSeenAt,
            onboardingCompleted: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          tx.set(doc(db, 'users', firebaseUser.uid, 'private', 'info'), {
            uid: firebaseUser.uid,
            email: firebaseUser.email || userPrivate.email || '',
            language: userPrivate.language,
            themeMode: userPrivate.themeMode,
            biometricLockEnabled: userPrivate.biometricLockEnabled,
            whoCanMessage: userPrivate.whoCanMessage,
            whoCanViewStories: userPrivate.whoCanViewStories,
            whoCanFollow: userPrivate.whoCanFollow,
            notificationPrefs: userPrivate.notificationPrefs,
            blockedUserIds: userPrivate.blockedUserIds,
            mutedStoryUserIds: userPrivate.mutedStoryUserIds,
            updatedAt: serverTimestamp(),
          });
        });
      } catch (err) {
        if (err instanceof Error && err.message === 'USERNAME_TAKEN') {
          return t.auth.usernameTaken;
        }
        console.error('Onboarding Firestore error:', err);
        return err instanceof Error ? err.message : 'Could not save profile to Firebase.';
      }
    }

    setCurrentUser(updatedUser);
    setCreators((prev) => {
      const exists = prev.some((u) => u.uid === updatedUser.uid);
      return exists ? prev.map((u) => (u.uid === updatedUser.uid ? updatedUser : u)) : [updatedUser, ...prev];
    });
    setStage('app');
    showToast(language === 'bn' ? 'প্রোফাইল প্রস্তুত!' : 'Welcome to SocialVerse!');
    return null;
  };

  const logout = async () => {
    if (firebaseUser) {
      await signOut(auth);
    }
    setFirebaseUser(null);
    setIsPreviewMode(true);
    setCurrentUser(INITIAL_USER);
    setUserPrivate(INITIAL_USER_PRIVATE);
    setSubscreenState(null);
    setViewedProfileUid(null);
    setStage('app');
    setActiveTab('home');
    showToast(language === 'bn' ? 'লগ আউট সম্পন্ন হয়েছে' : 'Logged out');
  };

  const deleteAccount = async () => {
    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'users', firebaseUser.uid, 'private', 'info'));
        await deleteDoc(doc(db, 'users', firebaseUser.uid));
        await deleteUser(firebaseUser);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${firebaseUser.uid}`);
      }
    }
    setFirebaseUser(null);
    setIsPreviewMode(true);
    setCurrentUser(INITIAL_USER);
    setSubscreenState(null);
    setStage('app');
    showToast(language === 'bn' ? 'অ্যাকাউন্ট মুছে ফেলা হয়েছে' : 'Account deleted.');
  };

  const createPost: SocialVerseContextValue['createPost'] = async (payload) => {
    if (!requireAuth(language === 'bn' ? 'নতুন পোস্ট প্রকাশ করতে সাইন ইন করুন।' : 'Sign in or create an account to publish posts.')) {
      return;
    }
    if (!isValidPostCaption(payload.caption)) {
      showToast('Please enter a valid caption (1–2200 characters).');
      return;
    }
    const id = `post_${Date.now()}`;
    const newPost: Post = {
      id,
      authorId: currentUser.uid,
      authorUsername: currentUser.username,
      authorDisplayName: currentUser.displayName,
      authorAvatar: currentUser.photoUrl,
      caption: payload.caption.trim(),
      mediaUrls: payload.mediaUrls,
      mediaType: payload.mediaType,
      hashtags: extractHashtags(payload.caption),
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      visibility: payload.visibility,
      createdAt: new Date().toISOString(),
      likedByMe: false,
      savedByMe: false,
    };

    setPosts((prev) => [newPost, ...prev]);
    setCurrentUser((prev) => ({ ...prev, postsCount: prev.postsCount + 1 }));

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'posts', id), {
          id: newPost.id,
          authorId: firebaseUser.uid,
          authorUsername: newPost.authorUsername,
          authorDisplayName: newPost.authorDisplayName,
          authorAvatar: newPost.authorAvatar.startsWith('data:') ? '' : newPost.authorAvatar,
          caption: newPost.caption,
          mediaUrls: newPost.mediaUrls.filter((u) => !u.startsWith('blob:') && u.length <= 128),
          mediaType: newPost.mediaType,
          hashtags: newPost.hashtags,
          likesCount: 0,
          commentsCount: 0,
          sharesCount: 0,
          visibility: newPost.visibility,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore createPost sync note:', err);
      }
    }
    setActiveTab('home');
    showToast(language === 'bn' ? 'পোস্ট প্রকাশিত হয়েছে' : 'Post published');
  };

  const editPost = async (postId: string, caption: string) => {
    if (!requireAuth('Sign in to edit your post.')) return;
    if (!isValidPostCaption(caption)) return;
    const hashtags = extractHashtags(caption);
    setPosts((prev) =>
      prev.map((p) => (p.id === postId && p.authorId === currentUser.uid ? { ...p, caption, hashtags } : p))
    );
    if (firebaseUser) {
      updateDoc(doc(db, 'posts', postId), {
        caption,
        hashtags,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
    showToast(language === 'bn' ? 'পোস্ট আপডেট হয়েছে' : 'Post updated');
  };

  const deletePost = async (postId: string) => {
    if (!requireAuth('Sign in to delete your post.')) return;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setCurrentUser((prev) => ({ ...prev, postsCount: Math.max(0, prev.postsCount - 1) }));
    if (firebaseUser) {
      deleteDoc(doc(db, 'posts', postId)).catch(() => {});
    }
    showToast(language === 'bn' ? 'পোস্ট মুছে ফেলা হয়েছে' : 'Post deleted');
  };

  const toggleLikePost = (postId: string) => {
    if (!requireAuth(language === 'bn' ? 'পোস্টে লাইক দিতে সাইন ইন বা সাইন আপ করুন।' : 'Sign in or create an account to like posts.')) {
      return;
    }
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const nextLiked = !p.likedByMe;
        const nextCount = Math.max(0, p.likesCount + (nextLiked ? 1 : -1));
        if (firebaseUser && !postId.startsWith('post_0')) {
          updateDoc(doc(db, 'posts', postId), { likesCount: nextCount }).catch(() => {});
        }
        return {
          ...p,
          likedByMe: nextLiked,
          likesCount: nextCount,
        };
      })
    );
  };

  const toggleSavePost = (postId: string) => {
    if (!requireAuth(language === 'bn' ? 'পোস্ট সেভ করতে সাইন ইন করুন।' : 'Sign in or create an account to save posts.')) {
      return;
    }
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const nextSaved = !p.savedByMe;
        if (firebaseUser) {
          const saveRef = doc(db, 'saved_posts', `${firebaseUser.uid}_${postId}`);
          if (nextSaved) {
            setDoc(saveRef, {
              uid: firebaseUser.uid,
              postId,
              createdAt: serverTimestamp(),
            }).catch(() => {});
          } else {
            deleteDoc(saveRef).catch(() => {});
          }
        }
        return { ...p, savedByMe: nextSaved };
      })
    );
  };

  const sharePost = (postId: string) => {
    if (!requireAuth(language === 'bn' ? 'পোস্ট শেয়ার করতে সাইন ইন করুন।' : 'Sign in or create an account to share posts.')) {
      return;
    }
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const nextShares = p.sharesCount + 1;
        if (firebaseUser && !postId.startsWith('post_0')) {
          updateDoc(doc(db, 'posts', postId), { sharesCount: nextShares }).catch(() => {});
        }
        return { ...p, sharesCount: nextShares };
      })
    );
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/?post=${postId}`).catch(() => {});
    }
    showToast(language === 'bn' ? 'পোস্টের লিংক কপি হয়েছে' : 'Post link copied');
  };

  const addComment = (postId: string, text: string, parentCommentId?: string) => {
    if (!requireAuth(language === 'bn' ? 'মন্তব্য করতে সাইন ইন করুন।' : 'Sign in or create an account to comment.')) {
      return;
    }
    if (!isValidCommentText(text)) return;
    const newComment: PostComment = {
      id: `c_${Date.now()}`,
      postId,
      authorId: currentUser.uid,
      authorUsername: currentUser.username,
      authorAvatar: currentUser.photoUrl,
      text: text.trim(),
      parentCommentId,
      createdAt: new Date().toISOString(),
    };
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), newComment],
    }));
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p))
    );
    if (firebaseUser && !postId.startsWith('post_0')) {
      setDoc(doc(db, 'posts', postId, 'comments', newComment.id), {
        id: newComment.id,
        postId,
        authorId: firebaseUser.uid,
        authorUsername: currentUser.username,
        text: newComment.text,
        ...(parentCommentId ? { parentCommentId } : {}),
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }
  };

  const activeStories = useMemo(
    () =>
      stories.filter(
        (s) =>
          isStoryActive(s) &&
          !userPrivate.mutedStoryUserIds.includes(s.authorId) &&
          !userPrivate.blockedUserIds.includes(s.authorId)
      ),
    [stories, userPrivate.mutedStoryUserIds, userPrivate.blockedUserIds]
  );

  const createStory: SocialVerseContextValue['createStory'] = async (payload) => {
    if (!requireAuth(language === 'bn' ? 'স্টোরি প্রকাশ করতে সাইন ইন করুন।' : 'Sign in or create an account to post a story.')) {
      return;
    }
    const id = `story_${Date.now()}`;
    const newStory: Story = {
      id,
      authorId: currentUser.uid,
      authorUsername: currentUser.username,
      authorDisplayName: currentUser.displayName,
      authorAvatar: currentUser.photoUrl,
      mediaType: payload.mediaType,
      mediaUrl: payload.mediaUrl,
      textContent: payload.textContent,
      backgroundGradient: 'from-sky-600 via-indigo-700 to-slate-900',
      privacy: payload.privacy,
      viewersCount: 0,
      viewerUsernames: [],
      reactions: [],
      expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    setStories((prev) => [newStory, ...prev]);
    setSubscreenState(null);
    setActiveTab('home');
    showToast(language === 'bn' ? '২৪ ঘণ্টার স্টোরি প্রকাশিত হয়েছে' : '24-hour story published');
  };

  const reactToStory = (storyId: string, emoji: string) => {
    if (!requireAuth(language === 'bn' ? 'স্টোরিতে প্রতিক্রিয়া জানাতে সাইন ইন করুন।' : 'Sign in to react to stories.')) {
      return;
    }
    setStories((prev) =>
      prev.map((s) =>
        s.id === storyId
          ? { ...s, reactions: [...s.reactions, { username: currentUser.username, emoji }] }
          : s
      )
    );
    showToast(`${emoji} ${language === 'bn' ? 'প্রতিক্রিয়া পাঠানো হয়েছে' : 'Reaction sent'}`);
  };

  const replyToStory = (storyId: string, text: string) => {
    if (!requireAuth(language === 'bn' ? 'স্টোরিতে উত্তর দিতে সাইন ইন করুন।' : 'Sign in to reply to stories.')) {
      return;
    }
    const story = stories.find((s) => s.id === storyId);
    if (!story || !text.trim()) return;
    const chatId = createDirectOrGroupChat(story.authorDisplayName, [currentUser.uid, story.authorId], 'direct');
    if (chatId) {
      sendMessage(chatId, {
        type: 'text',
        text: `Replied to story: "${text.trim()}"`,
      });
    }
    showToast(language === 'bn' ? 'স্টোরিতে উত্তর পাঠানো হয়েছে' : 'Reply sent to chat');
  };

  const deleteStory = (storyId: string) => {
    if (!requireAuth('Sign in to delete stories.')) return;
    setStories((prev) => prev.filter((s) => s.id !== storyId));
    setActiveStoryIndex(null);
    setSubscreenState(null);
    showToast(language === 'bn' ? 'স্টোরি মুছে ফেলা হয়েছে' : 'Story deleted');
  };

  const muteStoryAuthor = (authorId: string) => {
    if (!requireAuth('Sign in to manage muted stories.')) return;
    setUserPrivate((prev) => ({
      ...prev,
      mutedStoryUserIds: Array.from(new Set([...prev.mutedStoryUserIds, authorId])),
    }));
    setActiveStoryIndex(null);
    setSubscreenState(null);
    showToast(language === 'bn' ? 'স্টোরি মিউট করা হয়েছে' : 'Stories muted');
  };

  const sendMessage: SocialVerseContextValue['sendMessage'] = (chatId, payload) => {
    if (!requireAuth(language === 'bn' ? 'মেসেজ পাঠাতে সাইন ইন বা সাইন আপ করুন।' : 'Sign in or create an account to send messages.')) {
      return;
    }
    const msg: ChatMessage = {
      id: `m_${Date.now()}`,
      chatId,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      type: payload.type,
      text: payload.text,
      mediaUrl: payload.mediaUrl,
      fileName: payload.fileName,
      durationMs: payload.durationMs,
      replyToId: payload.replyToId,
      replyPreview: payload.replyPreview,
      status: 'delivered',
      reactions: {},
      createdAt: new Date().toISOString(),
    };
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), msg],
    }));
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              unreadCount: 0,
              lastMessageText:
                payload.type === 'voice'
                  ? 'Voice message'
                  : payload.text || payload.fileName || 'Media attachment',
              lastMessageAt: msg.createdAt,
            }
          : c
      )
    );
  };

  const reactToMessage = (chatId: string, messageId: string, emoji: string) => {
    if (!requireAuth('Sign in to react to messages.')) return;
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] || []).map((m) => {
        if (m.id !== messageId) return m;
        const currentReactors = m.reactions[emoji] || [];
        const hasReacted = currentReactors.includes(currentUser.uid);
        const nextReactors = hasReacted
          ? currentReactors.filter((u) => u !== currentUser.uid)
          : [...currentReactors, currentUser.uid];
        return {
          ...m,
          reactions: {
            ...m.reactions,
            [emoji]: nextReactors,
          },
        };
      }),
    }));
  };

  const deleteMessage = (chatId: string, messageId: string) => {
    if (!requireAuth('Sign in to delete messages.')) return;
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] || []).filter((m) => m.id !== messageId),
    }));
  };

  const createDirectOrGroupChat = (
    title: string,
    participantUids: string[],
    type: 'direct' | 'group'
  ): string | null => {
    if (!requireAuth(language === 'bn' ? 'চ্যাট শুরু করতে সাইন ইন করুন।' : 'Sign in or create an account to start a chat.')) {
      return null;
    }
    if (type === 'direct') {
      const existing = chats.find(
        (c) =>
          c.type === 'direct' &&
          participantUids.every((id) => c.participantIds.includes(id))
      );
      if (existing) {
        setActiveChatId(existing.id);
        return existing.id;
      }
    }
    const id = `chat_${Date.now()}`;
    const participantNames: Record<string, string> = {};
    const participantAvatars: Record<string, string> = {};
    participantUids.forEach((uid) => {
      const found = creators.find((u) => u.uid === uid) || currentUser;
      participantNames[uid] = found.displayName;
      participantAvatars[uid] = found.photoUrl;
    });
    const newChat: Chat = {
      id,
      type,
      title: title.trim() || 'New Chat',
      participantIds: Array.from(new Set(participantUids)),
      participantNames,
      participantAvatars,
      lastMessageText: type === 'group' ? 'Group created' : 'Conversation started',
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
      createdBy: currentUser.uid,
      createdAt: new Date().toISOString(),
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(id);
    return id;
  };

  const toggleFollow = (targetUid: string) => {
    if (!requireAuth(language === 'bn' ? 'কাউকে ফলো করতে সাইন ইন করুন।' : 'Sign in or create an account to follow creators.')) {
      return;
    }
    if (targetUid === currentUser.uid) return;
    const isCurrentlyFollowing = followingIds.includes(targetUid);
    setFollowingIds((prev) =>
      isCurrentlyFollowing ? prev.filter((id) => id !== targetUid) : [...prev, targetUid]
    );
    setCurrentUser((prev) => ({
      ...prev,
      followingCount: Math.max(0, prev.followingCount + (isCurrentlyFollowing ? -1 : 1)),
    }));
    setCreators((prev) =>
      prev.map((c) =>
        c.uid === targetUid
          ? { ...c, followersCount: Math.max(0, c.followersCount + (isCurrentlyFollowing ? -1 : 1)) }
          : c
      )
    );
    if (firebaseUser) {
      const edgeRef = doc(db, 'followers', `${firebaseUser.uid}_${targetUid}`);
      if (isCurrentlyFollowing) {
        deleteDoc(edgeRef).catch(() => {});
      } else {
        setDoc(edgeRef, {
          followerUid: firebaseUser.uid,
          targetUid,
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    }
  };

  const respondToFriendRequest = (requestId: string, accept: boolean) => {
    if (!requireAuth('Sign in to respond to friend requests.')) return;
    const req = friendRequests.find((r) => r.id === requestId);
    setFriendRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: accept ? 'accepted' : 'rejected' } : r))
    );
    if (accept && req) {
      setFollowerIds((prev) => Array.from(new Set([...prev, req.fromUid])));
      setCurrentUser((prev) => ({ ...prev, followersCount: prev.followersCount + 1 }));
    }
    showToast(accept ? (language === 'bn' ? 'অনুরোধ গৃহীত হয়েছে' : 'Friend request accepted') : 'Declined');
  };

  const removeFollower = (followerUid: string) => {
    if (!requireAuth('Sign in to manage followers.')) return;
    setFollowerIds((prev) => prev.filter((id) => id !== followerUid));
    setCurrentUser((prev) => ({ ...prev, followersCount: Math.max(0, prev.followersCount - 1) }));
  };

  const blockUser = (targetUid: string) => {
    if (!requireAuth('Sign in to block or unblock users.')) return;
    setUserPrivate((prev) => ({
      ...prev,
      blockedUserIds: Array.from(new Set([...prev.blockedUserIds, targetUid])),
    }));
    setFollowingIds((prev) => prev.filter((id) => id !== targetUid));
    showToast(language === 'bn' ? 'ব্যবহারকারীকে ব্লক করা হয়েছে' : 'User blocked');
  };

  const unblockUser = (targetUid: string) => {
    if (!requireAuth('Sign in to manage blocked users.')) return;
    setUserPrivate((prev) => ({
      ...prev,
      blockedUserIds: prev.blockedUserIds.filter((id) => id !== targetUid),
    }));
    showToast(language === 'bn' ? 'ব্লক সরানো হয়েছে' : 'User unblocked');
  };

  const uploadProfileImage = async (file: File, kind: 'avatar' | 'cover'): Promise<string> => {
    const compressed = await compressImageToDataUrl(file, kind === 'avatar' ? 320 : 960, 0.82);
    if (firebaseUser) {
      try {
        const res = await fetch(compressed);
        const blob = await res.blob();
        const folder = kind === 'avatar' ? 'avatars' : 'covers';
        const storageRef = ref(storage, `${folder}/${firebaseUser.uid}/${Date.now()}.jpg`);
        await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
      } catch {
        // Fallback to compact JPEG data URL (bounded <= 200KB in firestore.rules)
        return compressed;
      }
    }
    return compressed;
  };

  const updateProfile: SocialVerseContextValue['updateProfile'] = async (updates) => {
    if (!requireAuth(language === 'bn' ? 'প্রোফাইল এডিট করতে সাইন ইন করুন।' : 'Sign in or create an account to edit your profile.')) {
      return 'Authentication required';
    }

    const nextUsername =
      updates.username !== undefined ? normalizeUsername(updates.username) : currentUser.username;
    const nextDisplayName =
      updates.displayName !== undefined ? updates.displayName.trim() : currentUser.displayName;
    const nextBio = updates.bio !== undefined ? updates.bio.trim() : currentUser.bio;
    const nextPronouns =
      updates.pronouns !== undefined ? updates.pronouns.trim().slice(0, 32) : currentUser.pronouns || '';
    const nextWebsite =
      updates.website !== undefined ? normalizeWebsiteUrl(updates.website) : currentUser.website || '';
    const nextPhotoUrl = updates.photoUrl ?? currentUser.photoUrl;
    const nextCoverUrl = updates.coverUrl ?? currentUser.coverUrl;
    const nextInterests = updates.interests ?? currentUser.interests;
    const nextIsPrivate = updates.isPrivate ?? currentUser.isPrivate;

    if (!isValidUsername(nextUsername)) {
      return t.auth.usernameInvalid;
    }
    if (!isValidDisplayName(nextDisplayName)) {
      return 'Display name must be 1–50 characters.';
    }
    if (!isValidBio(nextBio)) {
      return 'Bio must be 240 characters or fewer.';
    }
    if (updates.website !== undefined && !isValidWebsiteUrl(updates.website)) {
      return 'Please enter a valid website URL (e.g. https://yourdomain.com).';
    }

    const usernameChanged = nextUsername !== currentUser.username;
    if (
      usernameChanged &&
      creators.some((c) => c.username === nextUsername && c.uid !== currentUser.uid)
    ) {
      return t.auth.usernameTaken;
    }

    if (firebaseUser) {
      try {
        await runTransaction(db, async (tx) => {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await tx.get(userRef);

          if (usernameChanged) {
            const newClaimRef = doc(db, 'usernames', nextUsername);
            const newClaimSnap = await tx.get(newClaimRef);
            if (newClaimSnap.exists() && newClaimSnap.data()?.uid !== firebaseUser.uid) {
              throw new Error('USERNAME_TAKEN');
            }
            if (currentUser.username) {
              const oldClaimRef = doc(db, 'usernames', currentUser.username);
              const oldClaimSnap = await tx.get(oldClaimRef);
              if (oldClaimSnap.exists() && oldClaimSnap.data()?.uid === firebaseUser.uid) {
                tx.delete(oldClaimRef);
              }
            }
            tx.set(newClaimRef, {
              uid: firebaseUser.uid,
              username: nextUsername,
              createdAt: serverTimestamp(),
            });
          }

          if (userSnap.exists()) {
            tx.update(userRef, {
              username: nextUsername,
              displayName: nextDisplayName,
              bio: nextBio,
              pronouns: nextPronouns,
              website: nextWebsite,
              photoUrl: nextPhotoUrl,
              coverUrl: nextCoverUrl,
              interests: nextInterests,
              isPrivate: nextIsPrivate,
              onlineStatus: 'online',
              lastSeenAt: new Date().toISOString(),
              onboardingCompleted: true,
              updatedAt: serverTimestamp(),
            });
          } else {
            tx.set(userRef, {
              uid: firebaseUser.uid,
              username: nextUsername,
              displayName: nextDisplayName,
              bio: nextBio,
              pronouns: nextPronouns,
              website: nextWebsite,
              photoUrl: nextPhotoUrl,
              coverUrl: nextCoverUrl,
              interests: nextInterests,
              isPrivate: nextIsPrivate,
              followersCount: currentUser.followersCount,
              followingCount: currentUser.followingCount,
              postsCount: currentUser.postsCount,
              onlineStatus: 'online',
              lastSeenAt: new Date().toISOString(),
              onboardingCompleted: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        });
      } catch (err) {
        if (err instanceof Error && err.message === 'USERNAME_TAKEN') {
          return t.auth.usernameTaken;
        }
        console.error('Firestore updateProfile error:', err);
        return err instanceof Error ? err.message : 'Failed to save profile changes.';
      }
    }

    const updatedUser: UserPublic = {
      ...currentUser,
      username: nextUsername,
      displayName: nextDisplayName,
      bio: nextBio,
      pronouns: nextPronouns,
      website: nextWebsite,
      photoUrl: nextPhotoUrl,
      coverUrl: nextCoverUrl,
      interests: nextInterests,
      isPrivate: nextIsPrivate,
      updatedAt: new Date().toISOString(),
    };

    setCurrentUser(updatedUser);
    setCreators((all) => {
      const exists = all.some((c) => c.uid === updatedUser.uid);
      return exists ? all.map((c) => (c.uid === updatedUser.uid ? updatedUser : c)) : [updatedUser, ...all];
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.authorId === updatedUser.uid
          ? {
              ...p,
              authorUsername: updatedUser.username,
              authorDisplayName: updatedUser.displayName,
              authorAvatar: updatedUser.photoUrl,
            }
          : p
      )
    );

    showToast(language === 'bn' ? 'প্রোফাইল আপডেট হয়েছে' : 'Profile saved');
    return null;
  };

  const updatePrivateSettings = (updates: Partial<UserPrivate>) => {
    if (!requireAuth('Sign in to change privacy & security settings.')) return;
    setUserPrivate((prev) => ({ ...prev, ...updates, updatedAt: new Date().toISOString() }));
    if (firebaseUser) {
      updateDoc(doc(db, 'users', firebaseUser.uid, 'private', 'info'), {
        ...updates,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
    showToast(language === 'bn' ? 'সেটিংস সংরক্ষিত হয়েছে' : 'Preferences updated');
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const openReportModal = (
    type: 'post' | 'user' | 'story' | 'comment',
    id: string,
    label: string
  ) => {
    if (!requireAuth(language === 'bn' ? 'রিপোর্ট করতে সাইন ইন করুন।' : 'Sign in to report content.')) {
      return;
    }
    setReportTarget({ type, id, label });
    setSubscreenState('report');
  };

  const submitReport = (reason: string) => {
    if (!requireAuth('Sign in to submit reports.')) return;
    if (!reportTarget || reason.trim().length < 3) return;
    const item: ReportItem = {
      id: `rep_${Date.now()}`,
      reporterUid: currentUser.uid,
      targetType: reportTarget.type,
      targetId: reportTarget.id,
      reason: reason.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setReports((prev) => [item, ...prev]);
    if (firebaseUser) {
      setDoc(doc(db, 'reports', item.id), {
        id: item.id,
        reporterUid: firebaseUser.uid,
        targetType: item.targetType,
        targetId: item.targetId,
        reason: item.reason,
        status: 'pending',
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }
    setSubscreenState(null);
    setReportTarget(null);
    showToast(language === 'bn' ? 'রিপোর্ট জমা দেওয়া হয়েছে' : 'Report submitted for review');
  };

  const openUserProfile = (uid: string) => {
    setViewedProfileUid(uid === currentUser.uid ? null : uid);
    setActiveTab('profile');
    setSubscreenState(null);
  };

  const callAiAssistant = async (task: string, contextText: string) => {
    if (firebaseUser) {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/ai/profile-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          task,
          contextText,
          currentBio: currentUser.bio,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI Assistant request failed');
      }
      return data as { suggestions: string[]; tip: string };
    }
    throw new Error('AUTH_REQUIRED');
  };

  const value: SocialVerseContextValue = {
    stage,
    setStage,
    firebaseUser,
    isAuthenticated,
    isPreviewMode,
    authModalOpen,
    authModalReason,
    openAuthModal,
    closeAuthModal,
    requireAuth,
    isLocked,
    unlockBiometric: () => setIsLocked(false),
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
    posts: posts.filter((p) => !userPrivate.blockedUserIds.includes(p.authorId)),
    visiblePostLimit,
    loadMorePosts: () => setVisiblePostLimit((n) => n + 6),
    commentsByPost,
    stories: activeStories,
    chats,
    messagesByChat,
    friendRequests,
    followingIds,
    followerIds,
    notifications,
    reports,
    toastMessage,
    showToast,
    enterPreviewMode,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resendVerificationEmail,
    sendPasswordReset,
    completeOnboarding,
    logout,
    deleteAccount,
    createPost,
    editPost,
    deletePost,
    toggleLikePost,
    toggleSavePost,
    sharePost,
    addComment,
    createStory,
    reactToStory,
    replyToStory,
    deleteStory,
    muteStoryAuthor,
    sendMessage,
    reactToMessage,
    deleteMessage,
    createDirectOrGroupChat,
    toggleFollow,
    respondToFriendRequest,
    removeFollower,
    blockUser,
    unblockUser,
    updateProfile,
    uploadProfileImage,
    updatePrivateSettings,
    markAllNotificationsRead,
    submitReport,
    callAiAssistant,
  };

  return <SocialVerseContext.Provider value={value}>{children}</SocialVerseContext.Provider>;
}

export function useSocialVerse() {
  const ctx = useContext(SocialVerseContext);
  if (!ctx) throw new Error('useSocialVerse must be used inside SocialVerseProvider');
  return ctx;
}
