import type {
  AppLanguage,
  AppNotification,
  BroadcastChannel,
  Chat,
  ChatMessage,
  FriendRequest,
  NicknameFontStyle,
  NoteItem,
  Post,
  PostComment,
  PostVisibility,
  ReportItem,
  StickerItem,
  Story,
  StoryHighlight,
  UserPrivate,
  UserPublic,
} from '../types/social';
import {
  DEFAULT_NOTIFICATION_PREFS,
  MAX_BIO_LENGTH,
  MAX_GROUP_MEMBERS,
  BROADCAST_MIN_FOLLOWERS,
  canChangeNickname,
  canChangeUsername,
  canOpenBroadcastChannel,
  canonicalizeEmail,
  extractHashtags,
  isDisposableEmail,
  isValidBio,
  isValidCommentText,
  isValidDateOfBirth,
  isValidDisplayName,
  isValidEmailFormat,
  isValidHighlightTitle,
  isValidPostCaption,
  isValidUsername,
  normalizeUsername,
  requiresFollowApproval,
  validateSignupEmail,
} from './validation';

const BASE_USER_PUBLIC: UserPublic = {
  uid: '',
  username: '',
  displayName: '',
  nicknameFont: 'classic',
  bio: '',
  pronouns: '',
  website: '',
  noteText: '',
  photoUrl: '',
  coverUrl: '',
  interests: [],
  isPrivate: false,
  isDeactivated: false,
  deactivatedUntil: null,
  followersCount: 0,
  followingCount: 0,
  postsCount: 0,
  onlineStatus: 'online',
  lastSeenAt: '',
  lastNicknameChangedAt: null,
  lastUsernameChangedAt: null,
  onboardingCompleted: false,
  createdAt: '',
};

const BASE_USER_PRIVATE: UserPrivate = {
  uid: '',
  email: '',
  language: 'en',
  themeMode: 'light',
  biometricLockEnabled: false,
  twoFactorEnabled: false,
  saveLoginInfo: true,
  whoCanMessage: 'everyone',
  whoCanViewStories: 'everyone',
  whoCanFollow: 'everyone',
  notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
  blockedUserIds: [],
  mutedStoryUserIds: [],
  closeFriendUids: [],
  updatedAt: '',
};

const STORE_KEY = 'sv_standalone_android_store_v1';

interface StoredAccount {
  uid: string;
  email: string;
  canonicalEmail: string;
  username: string;
  password: string;
  deleted?: boolean;
  createdAt: string;
}

interface StandaloneStore {
  accounts: Record<string, StoredAccount>;
  usersPublic: Record<string, UserPublic>;
  usersPrivate: Record<string, UserPrivate>;
  tokens: Record<string, string>; // token -> uid
  otps: Record<string, { code: string; expiresAt: number }>;
  verifications: Record<string, { email: string; purpose: string; expiresAt: number }>;
  posts: Post[];
  postLikes: Record<string, string[]>; // postId -> uid[]
  postSaves: Record<string, string[]>; // uid -> postId[]
  commentsByPost: Record<string, PostComment[]>;
  stories: Story[];
  storyHighlights: StoryHighlight[];
  chats: Chat[];
  messagesByChat: Record<string, ChatMessage[]>;
  notes: NoteItem[];
  stickers: StickerItem[];
  favoriteStickersByUid: Record<string, string[]>;
  broadcastChannels: BroadcastChannel[];
  followingByUid: Record<string, string[]>;
  followersByUid: Record<string, string[]>;
  friendRequests: FriendRequest[];
  notifications: AppNotification[];
  reports: ReportItem[];
}

export interface StandaloneResponse {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}

const memoryStorage = new Map<string, string>();

function readRawStore(): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(STORE_KEY);
    }
  } catch {
    // ignore storage restriction
  }
  return memoryStorage.get(STORE_KEY) ?? null;
}

function writeRawStore(raw: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORE_KEY, raw);
      return;
    }
  } catch {
    // ignore quota error
  }
  memoryStorage.set(STORE_KEY, raw);
}

function emptyStore(): StandaloneStore {
  return {
    accounts: {},
    usersPublic: {},
    usersPrivate: {},
    tokens: {},
    otps: {},
    verifications: {},
    posts: [],
    postLikes: {},
    postSaves: {},
    commentsByPost: {},
    stories: [],
    storyHighlights: [],
    chats: [],
    messagesByChat: {},
    notes: [],
    stickers: [],
    favoriteStickersByUid: {},
    broadcastChannels: [],
    followingByUid: {},
    followersByUid: {},
    friendRequests: [],
    notifications: [],
    reports: [],
  };
}

function loadStore(): StandaloneStore {
  const raw = readRawStore();
  if (!raw) return emptyStore();
  try {
    const parsed = JSON.parse(raw) as Partial<StandaloneStore>;
    return { ...emptyStore(), ...parsed };
  } catch {
    return emptyStore();
  }
}

function saveStore(store: StandaloneStore): void {
  writeRawStore(JSON.stringify(store));
}

export function resetStandaloneStoreForTesting(): void {
  memoryStorage.delete(STORE_KEY);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORE_KEY);
    }
  } catch {
    // ignore
  }
}

export function isStandaloneAndroidRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { __SOCIALVERSE_ANDROID__?: boolean; SocialVerseNative?: unknown };
  if (w.__SOCIALVERSE_ANDROID__ || w.SocialVerseNative) return true;
  if (window.location.hostname === 'appassets.androidplatform.net') return true;
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('SocialVerseAndroid')) return true;
  return false;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function ok(data: Record<string, unknown>, status = 200): StandaloneResponse {
  return { ok: true, status, data };
}

function fail(
  error: string,
  status = 400,
  extra: Record<string, unknown> = {}
): StandaloneResponse {
  return { ok: false, status, data: { error, ...extra } };
}

function activeUsersPublic(store: StandaloneStore): UserPublic[] {
  return Object.values(store.usersPublic).filter((u) => {
    const acc = store.accounts[u.uid];
    return !acc?.deleted && !u.isDeactivated;
  });
}

function hydrateStateForUid(store: StandaloneStore, uid: string | null) {
  const user = uid && store.usersPublic[uid] && !store.accounts[uid]?.deleted ? store.usersPublic[uid] : null;
  const userPrivate =
    uid && store.usersPrivate[uid] && !store.accounts[uid]?.deleted ? store.usersPrivate[uid] : null;

  const creators = activeUsersPublic(store);
  const blocked = new Set(userPrivate?.blockedUserIds || []);
  const followingIds = uid ? store.followingByUid[uid] || [] : [];
  const followerIds = uid ? store.followersByUid[uid] || [] : [];
  const savedSet = new Set(uid ? store.postSaves[uid] || [] : []);

  const posts = store.posts
    .filter((p) => {
      if (blocked.has(p.authorId)) return false;
      if (p.visibility === 'public') return true;
      if (!uid) return false;
      if (p.authorId === uid) return true;
      if (p.visibility === 'followers') return followingIds.includes(p.authorId);
      return false;
    })
    .map((p) => {
      const likes = store.postLikes[p.id] || [];
      return {
        ...p,
        likesCount: likes.length,
        commentsCount: (store.commentsByPost[p.id] || []).length,
        likedByMe: uid ? likes.includes(uid) : false,
        savedByMe: savedSet.has(p.id),
      };
    });

  const nowMs = Date.now();
  const stories = store.stories.filter((s) => {
    if (new Date(s.expiresAt).getTime() <= nowMs) return false;
    if (blocked.has(s.authorId)) return false;
    if (s.privacy === 'everyone') return true;
    if (!uid) return false;
    if (s.authorId === uid) return true;
    if (s.privacy === 'followers') return followingIds.includes(s.authorId);
    const authorPriv = store.usersPrivate[s.authorId];
    return Boolean(authorPriv?.closeFriendUids?.includes(uid));
  });

  const chats = uid
    ? store.chats.filter((c) => c.participantIds.includes(uid) && !(c.deletedByUids || []).includes(uid))
    : [];

  const messagesByChat: Record<string, ChatMessage[]> = {};
  chats.forEach((c) => {
    messagesByChat[c.id] = store.messagesByChat[c.id] || [];
  });

  const notes = store.notes.filter((n) => new Date(n.expiresAt).getTime() > nowMs && !blocked.has(n.authorUid));
  const friendRequests = uid
    ? store.friendRequests.filter((r) => r.fromUid === uid || r.toUid === uid)
    : [];
  const notifications = uid
    ? store.notifications.filter((n) => n.recipientUid === uid)
    : [];

  return {
    currentUser: user,
    userPrivate,
    creators,
    posts,
    commentsByPost: store.commentsByPost,
    stories,
    storyHighlights: store.storyHighlights,
    chats,
    messagesByChat,
    notes,
    stickers: store.stickers,
    favoriteStickerIds: uid ? store.favoriteStickersByUid[uid] || [] : [],
    broadcastChannels: store.broadcastChannels,
    followingIds,
    followerIds,
    friendRequests,
    notifications,
  };
}

function decodeJwtPayload(token: string): { sub?: string; email?: string; name?: string; picture?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json) as { sub?: string; email?: string; name?: string; picture?: string };
  } catch {
    return null;
  }
}

function buildUniqueUsername(store: StandaloneStore, seed: string): string {
  const base = normalizeUsername(seed).slice(0, 18);
  const root = base.length >= 3 ? base : 'socialuser';
  const taken = new Set(
    Object.values(store.accounts)
      .filter((a) => !a.deleted)
      .map((a) => a.username)
  );
  if (!taken.has(root)) return root;
  for (let i = 1; i <= 999; i++) {
    const candidate = `${root.slice(0, 20)}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `user_${Date.now().toString(36).slice(-6)}`;
}

function pushNotification(
  store: StandaloneStore,
  recipientUid: string,
  actor: UserPublic,
  type: AppNotification['type'],
  summary: string,
  targetId?: string
): void {
  if (!recipientUid || recipientUid === actor.uid) return;
  store.notifications.unshift({
    id: genId('notif'),
    recipientUid,
    actorUid: actor.uid,
    actorUsername: actor.username,
    actorAvatar: actor.photoUrl,
    type,
    summary,
    targetId,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

function aiSuggestions(
  task: string,
  contextText: string,
  currentBio: string,
  language: AppLanguage
): { suggestions: string[]; tip: string } {
  const topic = contextText.trim() || 'creator & lifestyle';
  if (language === 'bn') {
    if (task === 'usernames') {
      const slug = normalizeUsername(topic).slice(0, 12) || 'socialverse';
      return {
        suggestions: [`${slug}_bd`, `the_${slug}`, `${slug}_studio`],
        tip: 'ছোট ও সহজ ইউজারনেম ব্যবহার করলে সবাই দ্রুত খুঁজে পাবে।',
      };
    }
    if (task === 'caption') {
      return {
        suggestions: [
          `${topic} নিয়ে নতুন একটি মুহূর্ত ✨ #SocialVerse #বাংলা`,
          `আজকের গল্প: ${topic} 🌊✨`,
          `নতুন ভাবনা, নতুন অনুভূতি — ${topic} 💫`,
        ],
        tip: '২–৩টি প্রাসঙ্গিক হ্যাশট্যাগ যোগ করলে পোস্টের রিচ বাড়ে।',
      };
    }
    if (task === 'smart_replies') {
      return {
        suggestions: [
          'অসাধারণ হয়েছে! দারুণ লাগল ✨',
          'একদম ঠিক বলেছ! 👍',
          'আরও এমন কন্টেন্ট দেখতে চাই 🙌',
        ],
        tip: 'আন্তরিক ও সংক্ষিপ্ত রিপ্লাই দ্রুত সংযোগ তৈরি করে।',
      };
    }
    return {
      suggestions: [
        `${topic} · গল্প, ছবি ও প্রতিদিনের অনুপ্রেরণা ✨`,
        `ক্রিয়েটর | ${topic} | ঢাকায় ✨`,
        `${currentBio ? `${currentBio.slice(0, 60)} · ` : ''}${topic} নিয়ে কাজ করছি 🚀`,
      ],
      tip: 'বায়ো ১৫০ অক্ষরের মধ্যে স্পষ্ট ও আকর্ষণীয় রাখুন।',
    };
  }

  if (task === 'usernames') {
    const slug = normalizeUsername(topic).slice(0, 14) || 'creator';
    return {
      suggestions: [`${slug}_hq`, `its_${slug}`, `${slug}_studio`],
      tip: 'Short, memorable handles with underscores are easiest to discover.',
    };
  }
  if (task === 'caption') {
    return {
      suggestions: [
        `Chasing clarity and golden light around ${topic}. ✨ #SocialVerse`,
        `Notes from today's ${topic} session — keeping it real. 🌊`,
        `Fresh perspective on ${topic}. What do you think? 💫`,
      ],
      tip: 'Pair 1 crisp line with 2–3 focused hashtags for clean engagement.',
    };
  }
  if (task === 'smart_replies') {
    return {
      suggestions: [
        'Love the energy in this! ✨',
        'So clean — appreciate you sharing this.',
        'Count me in! Tell me more about this 🙌',
      ],
      tip: 'Warm, specific replies keep conversations flowing naturally.',
    };
  }
  return {
    suggestions: [
      `Building & sharing moments in ${topic} ✨`,
      `${topic} · visual stories, notes & daily craft`,
      `${currentBio ? `${currentBio.slice(0, 60)} · ` : ''}${topic} creator`,
    ],
    tip: 'Lead with what you share and keep your bio crisp under 150 characters.',
  };
}

export async function handleStandaloneApi(
  rawUrl: string,
  options: RequestInit = {},
  token?: string | null
): Promise<StandaloneResponse> {
  const parsedUrl = new URL(rawUrl, 'https://appassets.androidplatform.net');
  const pathname = parsedUrl.pathname;
  const method = (options.method || 'GET').toUpperCase();
  let body: Record<string, unknown> = {};
  if (typeof options.body === 'string' && options.body.trim()) {
    try {
      body = JSON.parse(options.body) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }

  const store = loadStore();
  const uid = token ? store.tokens[token] || null : null;
  const currentUser = uid ? store.usersPublic[uid] || null : null;

  // 1. State Hydration
  if (method === 'GET' && pathname === '/api/state') {
    return ok(hydrateStateForUid(store, uid));
  }

  // 2. Check username
  if (method === 'GET' && pathname === '/api/users/check-username') {
    const rawUsername = parsedUrl.searchParams.get('username') || '';
    const excludeUid = parsedUrl.searchParams.get('excludeUid') || '';
    const normalized = normalizeUsername(rawUsername);
    if (!isValidUsername(normalized)) {
      return ok({
        available: false,
        normalized,
        reason: 'Use 3–24 lowercase letters, numbers, or underscores.',
      });
    }
    const taken = Object.values(store.accounts).some(
      (a) => !a.deleted && a.uid !== excludeUid && a.username === normalized
    );
    return ok({
      available: !taken,
      normalized,
      reason: taken ? 'Username is already taken.' : undefined,
    });
  }

  // 3. Send OTP
  if (method === 'POST' && pathname === '/api/auth/send-otp') {
    const emailRaw = String(body.email || '').trim().toLowerCase();
    const purpose = String(body.purpose || 'signup') as 'signup' | 'reset' | '2fa';
    const lang = (body.language === 'bn' ? 'bn' : 'en') as AppLanguage;

    if (!isValidEmailFormat(emailRaw)) {
      return fail(lang === 'bn' ? 'সঠিক ইমেইল দিন' : 'Please enter a valid email address.', 400);
    }
    if (purpose === 'signup') {
      const check = validateSignupEmail(emailRaw);
      if (!check.valid) {
        return fail(check.reason || 'Invalid signup email', 400);
      }
      const canonical = canonicalizeEmail(emailRaw);
      const exists = Object.values(store.accounts).some(
        (a) => !a.deleted && (a.email === emailRaw || a.canonicalEmail === canonical)
      );
      if (exists) {
        return fail(
          lang === 'bn'
            ? 'এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে'
            : 'An account already exists with this email.',
          409,
          { code: 'EMAIL_EXISTS', existingEmail: emailRaw }
        );
      }
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    store.otps[`${purpose}:${emailRaw}`] = {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    saveStore(store);
    return ok({ sentViaSmtp: false, devOtpCode: code });
  }

  // 4. Verify OTP
  if (method === 'POST' && pathname === '/api/auth/verify-otp') {
    const emailRaw = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    const purpose = String(body.purpose || 'signup');
    const rec = store.otps[`${purpose}:${emailRaw}`];
    if (!rec || rec.expiresAt < Date.now() || rec.code !== code) {
      return fail('Invalid or expired verification code.', 400);
    }
    delete store.otps[`${purpose}:${emailRaw}`];
    const verificationToken = genId('vtok');
    store.verifications[verificationToken] = {
      email: emailRaw,
      purpose,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    saveStore(store);
    return ok({ verificationToken });
  }

  // 5. Complete Sign Up Registration
  if (method === 'POST' && pathname === '/api/auth/register') {
    const verificationToken = String(body.verificationToken || '');
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const displayName = String(body.displayName || '').trim();
    const nicknameFont = (String(body.nicknameFont || 'classic') as NicknameFontStyle);
    const username = normalizeUsername(String(body.username || ''));
    const dateOfBirth = String(body.dateOfBirth || '');
    const photoUrl = String(body.photoUrl || '');
    const language = (body.language === 'bn' ? 'bn' : 'en') as AppLanguage;

    const ver = store.verifications[verificationToken];
    if (!ver || ver.email !== email || ver.expiresAt < Date.now()) {
      return fail('Email verification expired. Please verify your code again.', 400);
    }
    if (isDisposableEmail(email) || !isValidEmailFormat(email)) {
      return fail('Please use a valid non-disposable email.', 400);
    }
    if (password.length < 6) {
      return fail('Password must be at least 6 characters.', 400);
    }
    if (!isValidDisplayName(displayName)) {
      return fail('Display name must be 1–50 characters.', 400);
    }
    if (!isValidUsername(username)) {
      return fail('Username must be 3–24 lowercase letters, numbers, or underscores.', 400);
    }
    if (!isValidDateOfBirth(dateOfBirth).valid) {
      return fail('You must be at least 13 years old with a valid date of birth.', 400);
    }
    const usernameTaken = Object.values(store.accounts).some(
      (a) => !a.deleted && a.username === username
    );
    if (usernameTaken) {
      return fail('Username is already taken.', 409);
    }

    const newUid = genId('u');
    const now = new Date().toISOString();
    const sessionTok = genId('svtok');
    store.accounts[newUid] = {
      uid: newUid,
      email,
      canonicalEmail: canonicalizeEmail(email),
      username,
      password,
      createdAt: now,
    };
    const userPublic: UserPublic = {
      ...BASE_USER_PUBLIC,
      uid: newUid,
      username,
      displayName,
      nicknameFont,
      dateOfBirth,
      photoUrl,
      onboardingCompleted: true,
      createdAt: now,
      lastSeenAt: now,
    };
    const userPriv: UserPrivate = {
      ...BASE_USER_PRIVATE,
      uid: newUid,
      email,
      language,
      updatedAt: now,
    };
    store.usersPublic[newUid] = userPublic;
    store.usersPrivate[newUid] = userPriv;
    store.tokens[sessionTok] = newUid;
    delete store.verifications[verificationToken];
    saveStore(store);

    return ok({ token: sessionTok, user: userPublic, userPrivate: userPriv }, 201);
  }

  // 6. Login with identifier + password
  if (method === 'POST' && pathname === '/api/auth/login') {
    const identifier = String(body.identifier || '').trim().toLowerCase();
    const password = String(body.password || '');
    const normUser = normalizeUsername(identifier);
    const acc = Object.values(store.accounts).find(
      (a) =>
        !a.deleted &&
        (a.email === identifier ||
          a.canonicalEmail === canonicalizeEmail(identifier) ||
          a.username === normUser)
    );
    if (!acc || acc.password !== password) {
      return fail('Invalid email/username or password.', 401);
    }
    const user = store.usersPublic[acc.uid];
    const priv = store.usersPrivate[acc.uid];
    if (!user || !priv) return fail('Account profile missing.', 404);
    if (user.isDeactivated) {
      user.isDeactivated = false;
      user.deactivatedUntil = null;
    }
    const sessionTok = genId('svtok');
    store.tokens[sessionTok] = acc.uid;
    saveStore(store);
    return ok({ token: sessionTok, user, userPrivate: priv });
  }

  // 7. Login with saved session token
  if (method === 'POST' && pathname === '/api/auth/login-token') {
    const savedTok = String(body.token || '');
    const targetUid = store.tokens[savedTok];
    if (!targetUid || store.accounts[targetUid]?.deleted) {
      return fail('Saved session expired. Please sign in with your password.', 401);
    }
    const user = store.usersPublic[targetUid];
    const priv = store.usersPrivate[targetUid];
    if (!user || !priv) return fail('Account not found.', 404);
    return ok({ token: savedTok, user, userPrivate: priv });
  }

  // 8. Firebase ID Token Exchange
  if (method === 'POST' && pathname === '/api/auth/firebase') {
    const idToken = String(body.idToken || '').trim();
    const lang = (body.language === 'bn' ? 'bn' : 'en') as AppLanguage;
    const decoded = decodeJwtPayload(idToken);
    if (!decoded?.sub) {
      return fail('Invalid Firebase ID token.', 401);
    }
    const fbEmail = (decoded.email || `${decoded.sub}@firebase.local`).toLowerCase();
    const canonical = canonicalizeEmail(fbEmail);
    let acc = Object.values(store.accounts).find(
      (a) => !a.deleted && (a.uid === decoded.sub || a.canonicalEmail === canonical)
    );
    const now = new Date().toISOString();
    if (!acc) {
      const targetUid = decoded.sub;
      const username = buildUniqueUsername(store, decoded.name || fbEmail.split('@')[0] || 'member');
      acc = {
        uid: targetUid,
        email: fbEmail,
        canonicalEmail: canonical,
        username,
        password: '',
        createdAt: now,
      };
      store.accounts[targetUid] = acc;
      store.usersPublic[targetUid] = {
        ...BASE_USER_PUBLIC,
        uid: targetUid,
        username,
        displayName: (decoded.name || username).slice(0, 50),
        photoUrl: decoded.picture || '',
        onboardingCompleted: true,
        createdAt: now,
        lastSeenAt: now,
      };
      store.usersPrivate[targetUid] = {
        ...BASE_USER_PRIVATE,
        uid: targetUid,
        email: fbEmail,
        language: lang,
        updatedAt: now,
      };
    }
    const sessionTok = genId('svtok');
    store.tokens[sessionTok] = acc.uid;
    saveStore(store);
    return ok({
      token: sessionTok,
      user: store.usersPublic[acc.uid],
      userPrivate: store.usersPrivate[acc.uid],
    });
  }

  // 9. Reset password with OTP token
  if (method === 'POST' && pathname === '/api/auth/reset-password') {
    const verificationToken = String(body.verificationToken || '');
    const email = String(body.email || '').trim().toLowerCase();
    const newPassword = String(body.newPassword || '');
    const ver = store.verifications[verificationToken];
    if (!ver || ver.email !== email || ver.expiresAt < Date.now()) {
      return fail('Verification token expired.', 400);
    }
    if (newPassword.length < 6) return fail('Password must be at least 6 characters.', 400);
    const acc = Object.values(store.accounts).find((a) => !a.deleted && a.email === email);
    if (!acc) return fail('Account not found.', 404);
    acc.password = newPassword;
    delete store.verifications[verificationToken];
    saveStore(store);
    return ok({ ok: true, method: 'direct' });
  }

  // Require auth for mutating user actions below
  if (!uid || !currentUser) {
    return fail('Authentication required.', 401);
  }
  const currentPrivate = store.usersPrivate[uid];

  if (method === 'POST' && pathname === '/api/auth/change-password') {
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    const acc = store.accounts[uid];
    if (!acc || acc.password !== currentPassword) {
      return fail('Current password is incorrect.', 400);
    }
    if (newPassword.length < 6) return fail('New password must be at least 6 characters.', 400);
    acc.password = newPassword;
    saveStore(store);
    return ok({ ok: true });
  }

  if (method === 'POST' && pathname === '/api/auth/deactivate') {
    const days = Number(body.days || 30);
    currentUser.isDeactivated = true;
    currentUser.deactivatedUntil = new Date(Date.now() + days * 86400000).toISOString();
    saveStore(store);
    return ok({ ok: true });
  }

  if (method === 'DELETE' && pathname === '/api/auth/account') {
    if (store.accounts[uid]) store.accounts[uid].deleted = true;
    Object.keys(store.tokens).forEach((t) => {
      if (store.tokens[t] === uid) delete store.tokens[t];
    });
    saveStore(store);
    return ok({ deleted: true });
  }

  // Settings & Profile
  if (method === 'PATCH' && pathname === '/api/settings/private') {
    Object.assign(currentPrivate, body, { updatedAt: new Date().toISOString() });
    saveStore(store);
    return ok({ userPrivate: currentPrivate });
  }

  if (method === 'PATCH' && pathname === '/api/profile') {
    if (typeof body.username === 'string') {
      const nextU = normalizeUsername(body.username);
      if (nextU !== currentUser.username) {
        if (!isValidUsername(nextU)) return fail('Invalid username.', 400);
        const cd = canChangeUsername(currentUser.lastUsernameChangedAt);
        if (!cd.allowed) return fail(`Username cooldown active (${cd.remainingDays}d left).`, 400);
        const taken = Object.values(store.accounts).some(
          (a) => !a.deleted && a.uid !== uid && a.username === nextU
        );
        if (taken) return fail('Username is already taken.', 409);
        currentUser.username = nextU;
        store.accounts[uid].username = nextU;
        currentUser.lastUsernameChangedAt = new Date().toISOString();
      }
    }
    if (typeof body.displayName === 'string' && body.displayName.trim() !== currentUser.displayName) {
      if (!isValidDisplayName(body.displayName)) return fail('Invalid display name.', 400);
      const cd = canChangeNickname(currentUser.lastNicknameChangedAt);
      if (!cd.allowed) return fail(`Display name cooldown active (${cd.remainingDays}d left).`, 400);
      currentUser.displayName = body.displayName.trim();
      currentUser.lastNicknameChangedAt = new Date().toISOString();
    }
    if (typeof body.bio === 'string') {
      if (!isValidBio(body.bio)) return fail(`Bio max ${MAX_BIO_LENGTH} characters.`, 400);
      currentUser.bio = body.bio;
    }
    const copyFields = ['nicknameFont', 'pronouns', 'website', 'dateOfBirth', 'photoUrl', 'coverUrl', 'interests', 'isPrivate'] as const;
    copyFields.forEach((key) => {
      if (body[key] !== undefined) {
        (currentUser as unknown as Record<string, unknown>)[key] = body[key];
      }
    });
    currentUser.updatedAt = new Date().toISOString();
    saveStore(store);
    return ok({ user: currentUser });
  }

  // Posts & Reels
  if (method === 'POST' && pathname === '/api/posts') {
    const caption = String(body.caption || '');
    const mediaUrls = Array.isArray(body.mediaUrls) ? (body.mediaUrls as string[]) : [];
    if (!isValidPostCaption(caption) && mediaUrls.length === 0) {
      return fail('Post caption or media is required.', 400);
    }
    const post: Post = {
      id: genId('post'),
      authorId: uid,
      authorUsername: currentUser.username,
      authorDisplayName: currentUser.displayName,
      authorAvatar: currentUser.photoUrl,
      caption: caption.trim(),
      mediaUrls,
      coverUrl: typeof body.coverUrl === 'string' ? body.coverUrl : undefined,
      mediaType: (body.mediaType as Post['mediaType']) || 'text',
      hashtags: extractHashtags(caption),
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      visibility: (body.visibility as PostVisibility) || 'public',
      createdAt: new Date().toISOString(),
    };
    store.posts.unshift(post);
    currentUser.postsCount = store.posts.filter((p) => p.authorId === uid).length;
    saveStore(store);
    return ok({ post }, 201);
  }

  const postMatch = pathname.match(/^\/api\/posts\/([^/]+)(?:\/(like|save|share|comments))?$/);
  if (postMatch) {
    const postId = postMatch[1];
    const sub = postMatch[2];
    const post = store.posts.find((p) => p.id === postId);
    if (!post) return fail('Post not found.', 404);

    if (!sub && method === 'PATCH') {
      if (post.authorId !== uid) return fail('Forbidden.', 403);
      const caption = String(body.caption || '');
      if (!isValidPostCaption(caption)) return fail('Invalid caption.', 400);
      post.caption = caption;
      post.hashtags = extractHashtags(caption);
      saveStore(store);
      return ok({ post });
    }
    if (!sub && method === 'DELETE') {
      if (post.authorId !== uid) return fail('Forbidden.', 403);
      store.posts = store.posts.filter((p) => p.id !== postId);
      currentUser.postsCount = store.posts.filter((p) => p.authorId === uid).length;
      saveStore(store);
      return ok({ ok: true });
    }
    if (sub === 'like' && method === 'POST') {
      const list = store.postLikes[postId] || [];
      const idx = list.indexOf(uid);
      if (idx >= 0) list.splice(idx, 1);
      else {
        list.push(uid);
        pushNotification(store, post.authorId, currentUser, 'like', 'liked your post', postId);
      }
      store.postLikes[postId] = list;
      saveStore(store);
      return ok({ liked: idx < 0, likesCount: list.length });
    }
    if (sub === 'save' && method === 'POST') {
      const list = store.postSaves[uid] || [];
      const idx = list.indexOf(postId);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(postId);
      store.postSaves[uid] = list;
      saveStore(store);
      return ok({ saved: idx < 0 });
    }
    if (sub === 'share' && method === 'POST') {
      post.sharesCount += 1;
      saveStore(store);
      return ok({ sharesCount: post.sharesCount });
    }
    if (sub === 'comments' && method === 'POST') {
      const text = String(body.text || '');
      if (!isValidCommentText(text) && !body.stickerUrl && !body.gifUrl) {
        return fail('Comment cannot be empty.', 400);
      }
      const comment: PostComment = {
        id: genId('cmt'),
        postId,
        authorId: uid,
        authorUsername: currentUser.username,
        authorAvatar: currentUser.photoUrl,
        text: text.trim(),
        stickerUrl: typeof body.stickerUrl === 'string' ? body.stickerUrl : undefined,
        gifUrl: typeof body.gifUrl === 'string' ? body.gifUrl : undefined,
        parentCommentId: typeof body.parentCommentId === 'string' ? body.parentCommentId : undefined,
        createdAt: new Date().toISOString(),
      };
      store.commentsByPost[postId] = [...(store.commentsByPost[postId] || []), comment];
      pushNotification(store, post.authorId, currentUser, 'comment', 'commented on your post', postId);
      saveStore(store);
      return ok({ comment }, 201);
    }
  }

  // Stories
  if (method === 'POST' && pathname === '/api/stories') {
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 3600 * 1000);
    const story: Story = {
      id: genId('story'),
      authorId: uid,
      authorUsername: currentUser.username,
      authorDisplayName: currentUser.displayName,
      authorAvatar: currentUser.photoUrl,
      mediaType: (body.mediaType as Story['mediaType']) || 'text',
      mediaUrl: typeof body.mediaUrl === 'string' ? body.mediaUrl : undefined,
      textContent: typeof body.textContent === 'string' ? body.textContent : undefined,
      backgroundGradient: typeof body.backgroundGradient === 'string' ? body.backgroundGradient : undefined,
      privacy: (body.privacy as Story['privacy']) || 'everyone',
      viewersCount: 0,
      viewerUsernames: [],
      reactions: [],
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    };
    store.stories.unshift(story);
    saveStore(store);
    return ok({ story }, 201);
  }

  const storyMatch = pathname.match(/^\/api\/stories\/([^/]+)(?:\/(react))?$/);
  if (storyMatch) {
    const storyId = storyMatch[1];
    const sub = storyMatch[2];
    const story = store.stories.find((s) => s.id === storyId);
    if (!story) return fail('Story not found.', 404);
    if (sub === 'react' && method === 'POST') {
      const emoji = String(body.emoji || '❤️');
      story.reactions.push({ username: currentUser.username, emoji });
      if (!story.viewerUsernames.includes(currentUser.username)) {
        story.viewerUsernames.push(currentUser.username);
        story.viewersCount = story.viewerUsernames.length;
      }
      saveStore(store);
      return ok({ ok: true });
    }
    if (!sub && method === 'DELETE') {
      if (story.authorId !== uid) return fail('Forbidden.', 403);
      store.stories = store.stories.filter((s) => s.id !== storyId);
      saveStore(store);
      return ok({ ok: true });
    }
  }

  // Story Highlights
  if (method === 'POST' && pathname === '/api/highlights') {
    const title = String(body.title || '').trim();
    if (!isValidHighlightTitle(title)) return fail('Highlight title must be 1–40 chars.', 400);
    const hl: StoryHighlight = {
      id: genId('hl'),
      ownerUid: uid,
      title,
      coverUrl: String(body.coverUrl || currentUser.photoUrl || ''),
      items: Array.isArray(body.items) ? (body.items as StoryHighlight['items']) : [],
      createdAt: new Date().toISOString(),
    };
    store.storyHighlights.unshift(hl);
    saveStore(store);
    return ok({ highlight: hl }, 201);
  }
  const hlMatch = pathname.match(/^\/api\/highlights\/([^/]+)$/);
  if (hlMatch) {
    const hl = store.storyHighlights.find((h) => h.id === hlMatch[1]);
    if (!hl || hl.ownerUid !== uid) return fail('Highlight not found.', 404);
    if (method === 'PATCH') {
      if (typeof body.title === 'string') hl.title = body.title.trim();
      if (typeof body.coverUrl === 'string') hl.coverUrl = body.coverUrl;
      if (Array.isArray(body.items)) hl.items = body.items as StoryHighlight['items'];
      hl.updatedAt = new Date().toISOString();
      saveStore(store);
      return ok({ highlight: hl });
    }
    if (method === 'DELETE') {
      store.storyHighlights = store.storyHighlights.filter((h) => h.id !== hl.id);
      saveStore(store);
      return ok({ ok: true });
    }
  }

  // Connections, Follow, Block
  const connMatch = pathname.match(/^\/api\/users\/([^/]+)\/(connections|follow|block)$/);
  if (connMatch) {
    const targetUid = connMatch[1];
    const action = connMatch[2];
    const targetUser = store.usersPublic[targetUid];
    if (!targetUser) return fail('User not found.', 404);

    if (action === 'connections' && method === 'GET') {
      return ok({
        followers: (store.followersByUid[targetUid] || []).map((id) => store.usersPublic[id]).filter(Boolean),
        following: (store.followingByUid[targetUid] || []).map((id) => store.usersPublic[id]).filter(Boolean),
      });
    }
    if (action === 'follow' && method === 'POST') {
      const myFollowing = store.followingByUid[uid] || [];
      const targetFollowers = store.followersByUid[targetUid] || [];
      if (myFollowing.includes(targetUid)) {
        store.followingByUid[uid] = myFollowing.filter((x) => x !== targetUid);
        store.followersByUid[targetUid] = targetFollowers.filter((x) => x !== uid);
        currentUser.followingCount = store.followingByUid[uid].length;
        targetUser.followersCount = store.followersByUid[targetUid].length;
        saveStore(store);
        return ok({ status: 'unfollowed' });
      }
      const targetPriv = store.usersPrivate[targetUid];
      if (requiresFollowApproval(targetUser, targetPriv)) {
        const req: FriendRequest = {
          id: genId('freq'),
          fromUid: uid,
          fromUsername: currentUser.username,
          fromDisplayName: currentUser.displayName,
          fromAvatar: currentUser.photoUrl,
          toUid: targetUid,
          status: 'pending',
          mutualCount: 0,
          createdAt: new Date().toISOString(),
        };
        store.friendRequests.unshift(req);
        pushNotification(store, targetUid, currentUser, 'friend_request', 'requested to follow you', req.id);
        saveStore(store);
        return ok({ status: 'requested' });
      }
      store.followingByUid[uid] = [...myFollowing, targetUid];
      store.followersByUid[targetUid] = [...targetFollowers, uid];
      currentUser.followingCount = store.followingByUid[uid].length;
      targetUser.followersCount = store.followersByUid[targetUid].length;
      pushNotification(store, targetUid, currentUser, 'follow', 'started following you', uid);
      saveStore(store);
      return ok({ status: 'following' });
    }
    if (action === 'block') {
      if (method === 'POST') {
        if (!currentPrivate.blockedUserIds.includes(targetUid)) {
          currentPrivate.blockedUserIds.push(targetUid);
        }
      } else if (method === 'DELETE') {
        currentPrivate.blockedUserIds = currentPrivate.blockedUserIds.filter((x) => x !== targetUid);
      }
      saveStore(store);
      return ok({ ok: true });
    }
  }

  // Friend requests & followers removal
  const frMatch = pathname.match(/^\/api\/friend-requests\/([^/]+)\/respond$/);
  if (frMatch && method === 'POST') {
    const req = store.friendRequests.find((r) => r.id === frMatch[1] && r.toUid === uid);
    if (!req) return fail('Request not found.', 404);
    const decision = body.action === 'accept' ? 'accepted' : 'rejected';
    req.status = decision;
    if (decision === 'accepted') {
      const fromF = store.followingByUid[req.fromUid] || [];
      if (!fromF.includes(uid)) store.followingByUid[req.fromUid] = [...fromF, uid];
      const myF = store.followersByUid[uid] || [];
      if (!myF.includes(req.fromUid)) store.followersByUid[uid] = [...myF, req.fromUid];
      currentUser.followersCount = store.followersByUid[uid].length;
      if (store.usersPublic[req.fromUid]) {
        store.usersPublic[req.fromUid].followingCount = store.followingByUid[req.fromUid].length;
      }
    }
    saveStore(store);
    return ok({ ok: true });
  }

  const removeFollowerMatch = pathname.match(/^\/api\/followers\/([^/]+)$/);
  if (removeFollowerMatch && method === 'DELETE') {
    const fUid = removeFollowerMatch[1];
    store.followersByUid[uid] = (store.followersByUid[uid] || []).filter((x) => x !== fUid);
    store.followingByUid[fUid] = (store.followingByUid[fUid] || []).filter((x) => x !== uid);
    currentUser.followersCount = store.followersByUid[uid].length;
    if (store.usersPublic[fUid]) store.usersPublic[fUid].followingCount = store.followingByUid[fUid].length;
    saveStore(store);
    return ok({ ok: true });
  }

  // Notes & Stickers
  if (method === 'POST' && pathname === '/api/notes') {
    const text = String(body.text || '').trim().slice(0, 80);
    if (!text) return fail('Note cannot be empty.', 400);
    store.notes = store.notes.filter((n) => n.authorUid !== uid);
    const note: NoteItem = {
      id: genId('note'),
      authorUid: uid,
      authorUsername: currentUser.username,
      authorDisplayName: currentUser.displayName,
      authorAvatar: currentUser.photoUrl,
      text,
      audience: body.audience === 'close_friends' ? 'close_friends' : 'followers',
      likedByUids: [],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    };
    store.notes.unshift(note);
    saveStore(store);
    return ok({ note }, 201);
  }
  if (method === 'DELETE' && pathname === '/api/notes/mine') {
    store.notes = store.notes.filter((n) => n.authorUid !== uid);
    saveStore(store);
    return ok({ ok: true });
  }
  const noteLikeMatch = pathname.match(/^\/api\/notes\/([^/]+)\/like$/);
  if (noteLikeMatch && method === 'POST') {
    const note = store.notes.find((n) => n.id === noteLikeMatch[1]);
    if (!note) return fail('Note not found.', 404);
    if (note.likedByUids.includes(uid)) note.likedByUids = note.likedByUids.filter((x) => x !== uid);
    else note.likedByUids.push(uid);
    saveStore(store);
    return ok({ ok: true });
  }
  if (method === 'POST' && pathname === '/api/stickers') {
    const sticker: StickerItem = {
      id: genId('stk'),
      creatorUid: uid,
      label: String(body.label || 'Sticker').slice(0, 50),
      imageUrl: String(body.imageUrl || ''),
      kind: body.kind === 'gif' ? 'gif' : 'sticker',
      createdAt: new Date().toISOString(),
    };
    store.stickers.unshift(sticker);
    saveStore(store);
    return ok({ sticker }, 201);
  }
  const stkFavMatch = pathname.match(/^\/api\/stickers\/([^/]+)\/favorite$/);
  if (stkFavMatch && method === 'POST') {
    const stkId = decodeURIComponent(stkFavMatch[1]);
    const list = store.favoriteStickersByUid[uid] || [];
    store.favoriteStickersByUid[uid] = list.includes(stkId) ? list.filter((x) => x !== stkId) : [stkId, ...list];
    saveStore(store);
    return ok({ ok: true });
  }

  // Chats & Messages
  if (method === 'POST' && pathname === '/api/chats') {
    const type = body.type === 'group' ? 'group' : 'direct';
    const rawParticipants = Array.isArray(body.participantIds) ? (body.participantIds as string[]) : [];
    const participants = Array.from(new Set([uid, ...rawParticipants])).slice(0, MAX_GROUP_MEMBERS);
    if (type === 'direct' && participants.length === 2) {
      const existing = store.chats.find(
        (c) => c.type === 'direct' && participants.every((p) => c.participantIds.includes(p)) && c.participantIds.length === 2
      );
      if (existing) return ok({ chat: existing });
    }
    const participantNames: Record<string, string> = {};
    const participantAvatars: Record<string, string> = {};
    participants.forEach((pId) => {
      const u = store.usersPublic[pId];
      if (u) {
        participantNames[pId] = u.displayName;
        participantAvatars[pId] = u.photoUrl;
      }
    });
    const chat: Chat = {
      id: genId('chat'),
      type,
      title: type === 'group' ? String(body.title || 'New Group').slice(0, 80) : '',
      participantIds: participants,
      participantNames,
      participantAvatars,
      ownerUid: type === 'group' ? uid : undefined,
      adminUids: type === 'group' ? [uid] : undefined,
      maxMembers: MAX_GROUP_MEMBERS,
      lastMessageText: '',
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
      createdBy: uid,
      createdAt: new Date().toISOString(),
    };
    store.chats.unshift(chat);
    store.messagesByChat[chat.id] = [];
    saveStore(store);
    return ok({ chat }, 201);
  }

  const chatMsgCreate = pathname.match(/^\/api\/chats\/([^/]+)\/messages$/);
  if (chatMsgCreate && method === 'POST') {
    const chat = store.chats.find((c) => c.id === chatMsgCreate[1] && c.participantIds.includes(uid));
    if (!chat) return fail('Chat not found.', 404);
    const msg: ChatMessage = {
      id: genId('msg'),
      chatId: chat.id,
      senderId: uid,
      senderName: currentUser.displayName,
      type: (body.type as ChatMessage['type']) || 'text',
      text: typeof body.text === 'string' ? body.text : undefined,
      mediaUrl: typeof body.mediaUrl === 'string' ? body.mediaUrl : undefined,
      stickerUrl: typeof body.stickerUrl === 'string' ? body.stickerUrl : undefined,
      sharedPostId: typeof body.sharedPostId === 'string' ? body.sharedPostId : undefined,
      durationMs: typeof body.durationMs === 'number' ? body.durationMs : undefined,
      replyToId: typeof body.replyToId === 'string' ? body.replyToId : undefined,
      status: 'sent',
      reactions: {},
      createdAt: new Date().toISOString(),
    };
    store.messagesByChat[chat.id] = [...(store.messagesByChat[chat.id] || []), msg];
    chat.lastMessageText = msg.text || `[${msg.type}]`;
    chat.lastMessageAt = msg.createdAt;
    saveStore(store);
    return ok({ message: msg }, 201);
  }

  const chatMsgOp = pathname.match(/^\/api\/chats\/([^/]+)\/messages\/([^/]+)(?:\/(react|star|forward))?$/);
  if (chatMsgOp) {
    const [, chatId, msgId, sub] = chatMsgOp;
    const msgs = store.messagesByChat[chatId] || [];
    const msg = msgs.find((m) => m.id === msgId);
    if (!msg) return fail('Message not found.', 404);
    if (!sub && method === 'PATCH') {
      if (msg.senderId !== uid) return fail('Forbidden.', 403);
      msg.text = String(body.text || '');
      msg.editedAt = new Date().toISOString();
      saveStore(store);
      return ok({ ok: true });
    }
    if (!sub && method === 'DELETE') {
      if (msg.senderId !== uid) return fail('Forbidden.', 403);
      store.messagesByChat[chatId] = msgs.filter((m) => m.id !== msgId);
      saveStore(store);
      return ok({ ok: true });
    }
    if (sub === 'react' && method === 'POST') {
      const emoji = String(body.emoji || '❤️');
      const existingList = msg.reactions[emoji] || [];
      msg.reactions[emoji] = existingList.includes(uid)
        ? existingList.filter((x) => x !== uid)
        : [...existingList, uid];
      saveStore(store);
      return ok({ ok: true });
    }
    if (sub === 'star' && method === 'POST') {
      const starred = msg.starredByUids || [];
      msg.starredByUids = starred.includes(uid) ? starred.filter((x) => x !== uid) : [...starred, uid];
      saveStore(store);
      return ok({ ok: true });
    }
    if (sub === 'forward' && method === 'POST') {
      const targetChatId = String(body.targetChatId || '');
      const targetChat = store.chats.find((c) => c.id === targetChatId && c.participantIds.includes(uid));
      if (!targetChat) return fail('Target chat not found.', 404);
      const fwd: ChatMessage = {
        ...msg,
        id: genId('msg'),
        chatId: targetChatId,
        senderId: uid,
        senderName: currentUser.displayName,
        forwarded: true,
        reactions: {},
        createdAt: new Date().toISOString(),
      };
      store.messagesByChat[targetChatId] = [...(store.messagesByChat[targetChatId] || []), fwd];
      saveStore(store);
      return ok({ message: fwd });
    }
  }

  const chatAction = pathname.match(/^\/api\/chats\/([^/]+)(?:\/(pin|preferences|theme|nicknames|members|roles|settings))?$/);
  if (chatAction) {
    const [, chatId, sub] = chatAction;
    const chat = store.chats.find((c) => c.id === chatId && c.participantIds.includes(uid));
    if (!chat) return fail('Chat not found.', 404);
    if (!sub && method === 'DELETE') {
      chat.deletedByUids = Array.from(new Set([...(chat.deletedByUids || []), uid]));
      saveStore(store);
      return ok({ ok: true });
    }
    if (sub === 'pin' && method === 'POST') {
      chat.pinnedMessageId = typeof body.messageId === 'string' ? body.messageId : undefined;
      saveStore(store);
      return ok({ chat });
    }
    if (sub === 'preferences' && method === 'PATCH') {
      if (typeof body.muted === 'boolean') {
        chat.mutedByUids = body.muted
          ? Array.from(new Set([...(chat.mutedByUids || []), uid]))
          : (chat.mutedByUids || []).filter((x) => x !== uid);
      }
      if (typeof body.pinned === 'boolean') {
        chat.pinnedByUids = body.pinned
          ? Array.from(new Set([...(chat.pinnedByUids || []), uid]))
          : (chat.pinnedByUids || []).filter((x) => x !== uid);
      }
      if (typeof body.archived === 'boolean') {
        chat.archivedByUids = body.archived
          ? Array.from(new Set([...(chat.archivedByUids || []), uid]))
          : (chat.archivedByUids || []).filter((x) => x !== uid);
      }
      saveStore(store);
      return ok({ chat });
    }
    if (sub === 'theme' && method === 'PATCH') {
      chat.theme = body as unknown as Chat['theme'];
      saveStore(store);
      return ok({ chat });
    }
    if (sub === 'nicknames' && method === 'PATCH') {
      const targetUid = String(body.targetUid || '');
      const nickname = String(body.nickname || '').trim();
      chat.chatNicknames = { ...(chat.chatNicknames || {}), [targetUid]: nickname };
      saveStore(store);
      return ok({ chat });
    }
    if (sub === 'settings' && method === 'PATCH') {
      if (typeof body.title === 'string') chat.title = body.title.slice(0, 80);
      if (typeof body.bio === 'string') chat.bio = body.bio;
      if (typeof body.requireAddApproval === 'boolean') chat.requireAddApproval = body.requireAddApproval;
      saveStore(store);
      return ok({ chat });
    }
    if (sub === 'members' && method === 'POST') {
      const addUid = String(body.targetUid || '');
      if (addUid && !chat.participantIds.includes(addUid) && store.usersPublic[addUid]) {
        chat.participantIds.push(addUid);
        chat.participantNames[addUid] = store.usersPublic[addUid].displayName;
        chat.participantAvatars[addUid] = store.usersPublic[addUid].photoUrl;
      }
      saveStore(store);
      return ok({ status: 'added', chat });
    }
    return ok({ chat });
  }

  // Broadcasts
  if (method === 'POST' && pathname === '/api/broadcasts') {
    if (!canOpenBroadcastChannel(currentUser.followersCount)) {
      return fail(`Requires ${BROADCAST_MIN_FOLLOWERS} followers.`, 403);
    }
    const ch: BroadcastChannel = {
      id: genId('bc'),
      title: String(body.title || 'Channel').slice(0, 80),
      description: String(body.description || '').slice(0, 300),
      ownerUid: uid,
      adminUids: [uid],
      moderatorUids: [],
      collaboratorUids: [],
      followerUids: [uid],
      messages: [],
      createdAt: new Date().toISOString(),
    };
    store.broadcastChannels.unshift(ch);
    saveStore(store);
    return ok({ channel: ch }, 201);
  }
  const bcMatch = pathname.match(/^\/api\/broadcasts\/([^/]+)\/(follow|messages)$/);
  if (bcMatch && method === 'POST') {
    const ch = store.broadcastChannels.find((c) => c.id === bcMatch[1]);
    if (!ch) return fail('Channel not found.', 404);
    if (bcMatch[2] === 'follow') {
      ch.followerUids = ch.followerUids.includes(uid)
        ? ch.followerUids.filter((x) => x !== uid)
        : [...ch.followerUids, uid];
      saveStore(store);
      return ok({ ok: true });
    }
    if (bcMatch[2] === 'messages') {
      ch.messages.push({
        id: genId('bcmsg'),
        channelId: ch.id,
        senderUid: uid,
        senderName: currentUser.displayName,
        text: String(body.text || ''),
        likesCount: 0,
        likedByUids: [],
        reactions: {},
        createdAt: new Date().toISOString(),
      });
      saveStore(store);
      return ok({ ok: true });
    }
  }

  // Notifications & Reports & AI
  if (method === 'POST' && pathname === '/api/notifications/read-all') {
    store.notifications.forEach((n) => {
      if (n.recipientUid === uid) n.read = true;
    });
    saveStore(store);
    return ok({ ok: true });
  }

  if (method === 'POST' && pathname === '/api/reports') {
    const report: ReportItem = {
      id: genId('rep'),
      reporterUid: uid,
      targetType: (body.targetType as ReportItem['targetType']) || 'post',
      targetId: String(body.targetId || ''),
      reason: String(body.reason || ''),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    store.reports.unshift(report);
    saveStore(store);
    return ok({ report }, 201);
  }

  if (method === 'POST' && pathname === '/api/ai/profile-assist') {
    const task = String(body.task || 'bio');
    const contextText = String(body.contextText || '');
    const currentBio = String(body.currentBio || currentUser.bio || '');
    const lang = (body.language === 'bn' ? 'bn' : 'en') as AppLanguage;
    return ok(aiSuggestions(task, contextText, currentBio, lang));
  }

  return fail(`Endpoint not available offline: ${method} ${pathname}`, 404);
}
