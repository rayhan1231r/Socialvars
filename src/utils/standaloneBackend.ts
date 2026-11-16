import firebaseConfig from '../../firebase-applet-config.json';
import type {
  AppLanguage,
  AppNotification,
  BroadcastChannel,
  Chat,
  ChatMessage,
  ChatPoll,
  FriendRequest,
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
  extractMentions,
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
  togglePollVote,
  validateSignupEmail,
} from './validation';

const CLOUD_FUNCTIONS_BASE_URL = 'https://us-central1-socialvars.cloudfunctions.net/socialverseApi';
const SAVED_LOGINS_STORAGE_KEY = 'sv_saved_logins';
const STORE_KEY = 'sv_standalone_android_store_v1';
const FB_SESSIONS_KEY = 'sv_standalone_firebase_sessions_v1';
const FB_GUEST_KEY = 'sv_standalone_guest_session_v1';
const USERNAME_EMAIL_MAP_KEY = 'sv_standalone_username_map_v1';

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
  verifications: Record<
    string,
    { email: string; purpose: string; expiresAt: number; remoteToken?: string; code?: string }
  >;
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

interface FirebaseSessionRecord {
  uid: string;
  email: string;
  username: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface GuestTokenRecord {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface StandaloneResponse {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}

const memoryStorage = new Map<string, string>();

function storageGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore storage restriction
  }
  return memoryStorage.get(key) ?? null;
}

function storageSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // ignore quota error
  }
  memoryStorage.set(key, value);
}

function storageRemove(key: string): void {
  memoryStorage.delete(key);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

function readRawStore(): string | null {
  return storageGet(STORE_KEY);
}

function writeRawStore(raw: string): void {
  storageSet(STORE_KEY, raw);
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
  storageRemove(STORE_KEY);
  storageRemove(FB_SESSIONS_KEY);
  storageRemove(FB_GUEST_KEY);
  storageRemove(USERNAME_EMAIL_MAP_KEY);
}

export function isStandaloneAndroidRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { __SOCIALVERSE_ANDROID__?: boolean; SocialVerseNative?: unknown };
  if (w.__SOCIALVERSE_ANDROID__ || w.SocialVerseNative) return true;
  if (window.location.hostname === 'appassets.androidplatform.net') return true;
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('SocialVerseAndroid')) return true;
  try {
    if (new URLSearchParams(window.location.search).get('standalone') === '1') return true;
  } catch {
    // ignore malformed URL
  }
  return false;
}

function isRemoteFirebaseEnabled(): boolean {
  return typeof window !== 'undefined' && typeof fetch === 'function';
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

// Synchronous pure-TS SHA-256 helper (works identically in Android WebView, Browser, and Node)
export function sha256Hex(message: string): string {
  const utf8 = unescape(encodeURIComponent(message));
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  const bitLen = utf8.length * 8;
  words[bitLen >> 5] |= 0x80 << (24 - (bitLen % 32));
  words[(((bitLen + 64) >> 9) << 4) + 15] = bitLen;

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const W = new Array<number>(64);
  const rotr = (n: number, c: number) => (n >>> c) | (n << (32 - c));

  for (let i = 0; i < words.length; i += 16) {
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      if (t < 16) {
        W[t] = words[i + t] | 0;
      } else {
        const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

// --- Firestore REST & Firebase Auth Helpers ---
export type FirestoreRestValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreRestValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreRestValue> } };

export function toFirestoreValue(val: unknown): FirestoreRestValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((item) => toFirestoreValue(item)) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreRestValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function toFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreRestValue> {
  const fields: Record<string, FirestoreRestValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  return fields;
}

export function fromFirestoreValue(val: FirestoreRestValue | undefined): unknown {
  if (!val) return undefined;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('stringValue' in val) return val.stringValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map((v) => fromFirestoreValue(v));
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return undefined;
}

function firestoreDocPathName(docPath: string): string {
  return `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/${docPath}`;
}

export function normalizeFirestorePost(
  raw: Record<string, unknown>,
  authorProfile?: Partial<UserPublic>
): Post {
  const rawMedia = Array.isArray(raw.mediaUrls)
    ? raw.mediaUrls.filter((u): u is string => typeof u === 'string' && u.length > 0)
    : [];
  const rawCover = typeof raw.coverUrl === 'string' && raw.coverUrl.length > 0 ? raw.coverUrl : undefined;
  const mediaType = (typeof raw.mediaType === 'string' ? raw.mediaType : 'text') as Post['mediaType'];
  // Under strict live rules, large WebP/JPEG data URLs reside in coverUrl; surface in mediaUrls for identical UI rendering
  const mediaUrls =
    rawMedia.length > 0
      ? rawMedia
      : rawCover && mediaType !== 'text'
      ? [rawCover]
      : [];

  return {
    id: String(raw.id || ''),
    authorId: String(raw.authorId || ''),
    authorUsername: String(raw.authorUsername || authorProfile?.username || 'creator'),
    authorDisplayName: String(
      raw.authorDisplayName || authorProfile?.displayName || raw.authorUsername || 'Creator'
    ),
    authorAvatar: String(raw.authorAvatar || authorProfile?.photoUrl || ''),
    caption: String(raw.caption || ''),
    mediaUrls,
    coverUrl: rawCover,
    mediaType,
    hashtags: Array.isArray(raw.hashtags)
      ? raw.hashtags.filter((h): h is string => typeof h === 'string')
      : [],
    likesCount: typeof raw.likesCount === 'number' ? raw.likesCount : Number(raw.likesCount || 0),
    commentsCount: typeof raw.commentsCount === 'number' ? raw.commentsCount : Number(raw.commentsCount || 0),
    sharesCount: typeof raw.sharesCount === 'number' ? raw.sharesCount : Number(raw.sharesCount || 0),
    visibility: (typeof raw.visibility === 'string' ? raw.visibility : 'public') as PostVisibility,
    createdAt: typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt : new Date().toISOString(),
  };
}

function normalizeFirestoreUserPublic(raw: Record<string, unknown>): UserPublic {
  return {
    ...BASE_USER_PUBLIC,
    uid: String(raw.uid || ''),
    username: String(raw.username || ''),
    displayName: String(raw.displayName || raw.username || 'SocialVerse User'),
    nicknameFont: (typeof raw.nicknameFont === 'string' ? raw.nicknameFont : 'classic') as NicknameFontStyle,
    bio: String(raw.bio || ''),
    pronouns: String(raw.pronouns || ''),
    website: String(raw.website || ''),
    noteText: String(raw.noteText || ''),
    dateOfBirth: typeof raw.dateOfBirth === 'string' ? raw.dateOfBirth : undefined,
    photoUrl: String(raw.photoUrl || ''),
    coverUrl: String(raw.coverUrl || ''),
    interests: Array.isArray(raw.interests)
      ? raw.interests.filter((x): x is string => typeof x === 'string')
      : [],
    isPrivate: Boolean(raw.isPrivate),
    isDeactivated: Boolean(raw.isDeactivated),
    deactivatedUntil: typeof raw.deactivatedUntil === 'string' ? raw.deactivatedUntil : null,
    followersCount: Number(raw.followersCount || 0),
    followingCount: Number(raw.followingCount || 0),
    postsCount: Number(raw.postsCount || 0),
    onlineStatus:
      raw.onlineStatus === 'offline' || raw.onlineStatus === 'away' ? raw.onlineStatus : 'online',
    lastSeenAt: typeof raw.lastSeenAt === 'string' ? raw.lastSeenAt : '',
    lastNicknameChangedAt:
      typeof raw.lastNicknameChangedAt === 'string' ? raw.lastNicknameChangedAt : null,
    lastUsernameChangedAt:
      typeof raw.lastUsernameChangedAt === 'string' ? raw.lastUsernameChangedAt : null,
    onboardingCompleted: Boolean(raw.onboardingCompleted),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

function normalizeFirestoreUserPrivate(raw: Record<string, unknown>): UserPrivate {
  return {
    ...BASE_USER_PRIVATE,
    uid: String(raw.uid || ''),
    email: String(raw.email || ''),
    language: raw.language === 'bn' ? 'bn' : 'en',
    themeMode: raw.themeMode === 'dark' ? 'dark' : 'light',
    biometricLockEnabled: Boolean(raw.biometricLockEnabled),
    twoFactorEnabled: Boolean(raw.twoFactorEnabled),
    saveLoginInfo: raw.saveLoginInfo !== undefined ? Boolean(raw.saveLoginInfo) : true,
    whoCanMessage:
      raw.whoCanMessage === 'followers' || raw.whoCanMessage === 'nobody'
        ? raw.whoCanMessage
        : 'everyone',
    whoCanViewStories:
      raw.whoCanViewStories === 'followers' || raw.whoCanViewStories === 'close_friends'
        ? raw.whoCanViewStories
        : 'everyone',
    whoCanFollow: raw.whoCanFollow === 'approval' ? 'approval' : 'everyone',
    notificationPrefs: {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...((raw.notificationPrefs as Record<string, boolean> | undefined) || {}),
    },
    blockedUserIds: Array.isArray(raw.blockedUserIds)
      ? raw.blockedUserIds.filter((x): x is string => typeof x === 'string')
      : [],
    mutedStoryUserIds: Array.isArray(raw.mutedStoryUserIds)
      ? raw.mutedStoryUserIds.filter((x): x is string => typeof x === 'string')
      : [],
    closeFriendUids: Array.isArray(raw.closeFriendUids)
      ? raw.closeFriendUids.filter((x): x is string => typeof x === 'string')
      : [],
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

function loadFirebaseSessions(): Record<string, FirebaseSessionRecord> {
  const raw = storageGet(FB_SESSIONS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, FirebaseSessionRecord>;
  } catch {
    return {};
  }
}

function saveFirebaseSessions(map: Record<string, FirebaseSessionRecord>): void {
  storageSet(FB_SESSIONS_KEY, JSON.stringify(map));
}

function loadUsernameEmailMap(): Record<string, string> {
  const raw = storageGet(USERNAME_EMAIL_MAP_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function recordUsernameEmail(username: string, email: string): void {
  const norm = normalizeUsername(username);
  const clean = email.trim().toLowerCase();
  if (!norm || !clean || !clean.includes('@')) return;
  const map = loadUsernameEmailMap();
  map[norm] = clean;
  storageSet(USERNAME_EMAIL_MAP_KEY, JSON.stringify(map));
}

function findEmailInSavedLogins(usernameNorm: string): string | null {
  const raw = storageGet(SAVED_LOGINS_STORAGE_KEY);
  if (!raw) return null;
  try {
    const list = JSON.parse(raw) as SavedLoginEntry[];
    const match = list.find((item) => normalizeUsername(item.username) === usernameNorm && item.email);
    return match?.email?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

async function firebaseAuthPost<T>(endpoint: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: T & { error?: { message?: string } } }> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  return { ok: res.ok, status: res.status, data };
}

async function refreshFirebaseToken(refreshToken: string): Promise<{ idToken: string; refreshToken: string; expiresInSec: number } | null> {
  if (!refreshToken) return null;
  try {
    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      id_token?: string;
      refresh_token?: string;
      expires_in?: string;
    };
    if (!data.id_token) return null;
    return {
      idToken: data.id_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresInSec: Number(data.expires_in || 3600),
    };
  } catch {
    return null;
  }
}

async function ensureGuestIdToken(): Promise<string | null> {
  if (!isRemoteFirebaseEnabled()) return null;
  const now = Date.now();
  const raw = storageGet(FB_GUEST_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as GuestTokenRecord;
      if (parsed.idToken && parsed.expiresAt > now + 60_000) {
        return parsed.idToken;
      }
      if (parsed.refreshToken) {
        const refreshed = await refreshFirebaseToken(parsed.refreshToken);
        if (refreshed) {
          storageSet(
            FB_GUEST_KEY,
            JSON.stringify({
              idToken: refreshed.idToken,
              refreshToken: refreshed.refreshToken,
              expiresAt: now + refreshed.expiresInSec * 1000,
            })
          );
          return refreshed.idToken;
        }
      }
    } catch {
      // mint fresh below
    }
  }
  try {
    const res = await firebaseAuthPost<{
      idToken?: string;
      refreshToken?: string;
      expiresIn?: string;
    }>('accounts:signUp', { returnSecureToken: true });
    if (res.ok && res.data.idToken) {
      const expiresInSec = Number(res.data.expiresIn || 3600);
      storageSet(
        FB_GUEST_KEY,
        JSON.stringify({
          idToken: res.data.idToken,
          refreshToken: res.data.refreshToken || '',
          expiresAt: now + expiresInSec * 1000,
        })
      );
      return res.data.idToken;
    }
  } catch {
    // offline
  }
  return null;
}

async function ensureSessionIdToken(sessionToken: string | null | undefined): Promise<{
  uid: string | null;
  idToken: string | null;
  session?: FirebaseSessionRecord;
}> {
  if (!sessionToken || !isRemoteFirebaseEnabled()) {
    return { uid: null, idToken: null };
  }
  const sessions = loadFirebaseSessions();
  const rec = sessions[sessionToken];
  if (!rec) return { uid: null, idToken: null };

  const now = Date.now();
  if (rec.idToken && rec.expiresAt > now + 60_000) {
    return { uid: rec.uid, idToken: rec.idToken, session: rec };
  }
  if (rec.refreshToken) {
    const refreshed = await refreshFirebaseToken(rec.refreshToken);
    if (refreshed) {
      rec.idToken = refreshed.idToken;
      rec.refreshToken = refreshed.refreshToken;
      rec.expiresAt = now + refreshed.expiresInSec * 1000;
      sessions[sessionToken] = rec;
      saveFirebaseSessions(sessions);
      return { uid: rec.uid, idToken: rec.idToken, session: rec };
    }
  }
  return { uid: rec.uid, idToken: rec.idToken || null, session: rec };
}

async function firestoreGetDoc(
  docPath: string,
  idToken?: string | null
): Promise<Record<string, unknown> | null> {
  if (!isRemoteFirebaseEnabled()) return null;
  try {
    const url = `https://firestore.googleapis.com/v1/${firestoreDocPathName(docPath)}?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
    const headers: Record<string, string> = {};
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const raw = (await res.json()) as { fields?: Record<string, FirestoreRestValue> };
    if (!raw.fields) return null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw.fields)) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  } catch {
    return null;
  }
}

async function firestoreRunQuery(
  collectionId: string,
  filters: Array<{ field: string; op: 'EQUAL' | 'ARRAY_CONTAINS' | 'GREATER_THAN'; value: FirestoreRestValue }>,
  idToken?: string | null,
  parentDocPath?: string
): Promise<{ ok: boolean; status: number; rows: Array<{ id: string; data: Record<string, unknown> }> }> {
  if (!isRemoteFirebaseEnabled()) return { ok: false, status: 0, rows: [] };
  try {
    const base = parentDocPath
      ? `https://firestore.googleapis.com/v1/${firestoreDocPathName(parentDocPath)}:runQuery?key=${encodeURIComponent(firebaseConfig.apiKey)}`
      : `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents:runQuery?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
    const structuredQuery: Record<string, unknown> = {
      from: [{ collectionId }],
    };
    if (filters.length === 1) {
      structuredQuery.where = {
        fieldFilter: {
          field: { fieldPath: filters[0].field },
          op: filters[0].op,
          value: filters[0].value,
        },
      };
    } else if (filters.length > 1) {
      structuredQuery.where = {
        compositeFilter: {
          op: 'AND',
          filters: filters.map((f) => ({
            fieldFilter: {
              field: { fieldPath: f.field },
              op: f.op,
              value: f.value,
            },
          })),
        },
      };
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    const res = await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({ structuredQuery }),
    });
    if (!res.ok) return { ok: false, status: res.status, rows: [] };
    const rows = (await res.json()) as Array<{
      document?: { name?: string; fields?: Record<string, FirestoreRestValue> };
    }>;
    const out: Array<{ id: string; data: Record<string, unknown> }> = [];
    for (const row of rows) {
      if (!row.document?.fields || !row.document.name) continue;
      const id = row.document.name.split('/').pop() || '';
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row.document.fields)) {
        data[k] = fromFirestoreValue(v);
      }
      out.push({ id, data });
    }
    return { ok: true, status: res.status, rows: out };
  } catch {
    return { ok: false, status: 0, rows: [] };
  }
}

async function firestoreCommitWrites(
  writes: Array<Record<string, unknown>>,
  idToken: string | null | undefined
): Promise<{ ok: boolean; status?: number }> {
  if (!writes.length || !idToken || !isRemoteFirebaseEnabled()) return { ok: false };
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents:commit?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ writes }),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false };
  }
}

async function callCloudFunction<T>(
  path: string,
  body: Record<string, unknown>,
  bearerToken?: string | null,
  timeoutMs = 6000
): Promise<{ ok: boolean; status: number; networkError?: boolean; data: T & { error?: string; code?: string } }> {
  if (!isRemoteFirebaseEnabled()) {
    return { ok: false, status: 0, networkError: true, data: {} as T & { error?: string; code?: string } };
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
    const res = await fetch(`${CLOUD_FUNCTIONS_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, networkError: true, data: {} as T & { error?: string; code?: string } };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildPublicFieldsForFirestore(userPublic: UserPublic): Record<string, unknown> {
  const safePhotoUrl = userPublic.photoUrl.length <= 200000 ? userPublic.photoUrl : '';
  const safeCoverUrl = userPublic.coverUrl.length <= 200000 ? userPublic.coverUrl : '';
  return {
    uid: userPublic.uid,
    username: userPublic.username,
    displayName: userPublic.displayName,
    nicknameFont: userPublic.nicknameFont || 'classic',
    bio: userPublic.bio,
    pronouns: userPublic.pronouns || '',
    website: userPublic.website || '',
    noteText: userPublic.noteText || '',
    ...(userPublic.dateOfBirth ? { dateOfBirth: userPublic.dateOfBirth } : {}),
    photoUrl: safePhotoUrl,
    coverUrl: safeCoverUrl,
    interests: userPublic.interests || [],
    isPrivate: userPublic.isPrivate,
    isDeactivated: Boolean(userPublic.isDeactivated),
    deactivatedUntil: userPublic.deactivatedUntil ?? null,
    followersCount: Math.max(0, Math.floor(userPublic.followersCount || 0)),
    followingCount: Math.max(0, Math.floor(userPublic.followingCount || 0)),
    postsCount: Math.max(0, Math.floor(userPublic.postsCount || 0)),
    onlineStatus: userPublic.onlineStatus || 'online',
    lastSeenAt: userPublic.lastSeenAt ?? null,
    lastNicknameChangedAt: userPublic.lastNicknameChangedAt ?? null,
    lastUsernameChangedAt: userPublic.lastUsernameChangedAt ?? null,
    onboardingCompleted: true,
  };
}

function buildPrivateFieldsForFirestore(userPrivate: UserPrivate): Record<string, unknown> {
  return {
    uid: userPrivate.uid,
    email: userPrivate.email,
    language: userPrivate.language,
    themeMode: userPrivate.themeMode,
    biometricLockEnabled: userPrivate.biometricLockEnabled,
    twoFactorEnabled: userPrivate.twoFactorEnabled,
    saveLoginInfo: userPrivate.saveLoginInfo,
    whoCanMessage: userPrivate.whoCanMessage,
    whoCanViewStories: userPrivate.whoCanViewStories,
    whoCanFollow: userPrivate.whoCanFollow || 'everyone',
    notificationPrefs: userPrivate.notificationPrefs,
    blockedUserIds: userPrivate.blockedUserIds,
    mutedStoryUserIds: userPrivate.mutedStoryUserIds,
    closeFriendUids: userPrivate.closeFriendUids || [],
  };
}

function buildPostFieldsForFirestore(post: Post, forceCoverFallback = false): Record<string, unknown> {
  const safeAvatar = post.authorAvatar && post.authorAvatar.length <= 200000 ? post.authorAvatar : '';
  const rawMedia = Array.isArray(post.mediaUrls) ? post.mediaUrls.slice(0, 10) : [];
  const hasOversizedMedia = rawMedia.some((u) => u.length > 128);
  let finalMediaUrls = rawMedia;
  let finalCoverUrl = post.coverUrl && post.coverUrl.length <= 200000 ? post.coverUrl : undefined;

  if (forceCoverFallback || hasOversizedMedia) {
    if (!finalCoverUrl && rawMedia[0] && rawMedia[0].length <= 200000) {
      finalCoverUrl = rawMedia[0];
    }
    finalMediaUrls = rawMedia.filter((u) => u.length <= 128);
  }

  return {
    id: post.id,
    authorId: post.authorId,
    authorUsername: post.authorUsername,
    authorDisplayName: post.authorDisplayName,
    authorAvatar: safeAvatar,
    caption: post.caption.slice(0, 2200),
    mediaUrls: finalMediaUrls,
    ...(finalCoverUrl ? { coverUrl: finalCoverUrl } : {}),
    mediaType: post.mediaType,
    hashtags: (post.hashtags || []).slice(0, 20).map((h) => h.slice(0, 128)),
    likesCount: Math.max(0, Math.floor(post.likesCount || 0)),
    commentsCount: Math.max(0, Math.floor(post.commentsCount || 0)),
    sharesCount: Math.max(0, Math.floor(post.sharesCount || 0)),
    visibility: post.visibility || 'public',
  };
}

async function createFirebaseUserSessionAndProfile(params: {
  store: StandaloneStore;
  uid: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresInSec: number;
  displayNameSeed?: string;
  usernameSeed?: string;
  photoUrlSeed?: string;
  dateOfBirth?: string;
  nicknameFont?: NicknameFontStyle;
  language?: AppLanguage;
}): Promise<{ token: string; userPublic: UserPublic; userPrivate: UserPrivate }> {
  const {
    store,
    uid,
    email,
    idToken,
    refreshToken,
    expiresInSec,
    displayNameSeed,
    usernameSeed,
    photoUrlSeed,
    dateOfBirth,
    nicknameFont,
    language = 'en',
  } = params;

  const cleanEmail = email.trim().toLowerCase();
  const canonical = canonicalizeEmail(cleanEmail);
  const now = new Date().toISOString();

  const [remotePubRaw, remotePrivRaw] = await Promise.all([
    firestoreGetDoc(`users/${uid}`, idToken),
    firestoreGetDoc(`users/${uid}/private/info`, idToken),
  ]);

  let userPublic = remotePubRaw
    ? normalizeFirestoreUserPublic(remotePubRaw)
    : store.usersPublic[uid];

  let userPrivate = remotePrivRaw
    ? normalizeFirestoreUserPrivate(remotePrivRaw)
    : store.usersPrivate[uid];

  const needCreatePub = !remotePubRaw;
  const needCreatePriv = !remotePrivRaw;

  if (!userPublic) {
    const username = usernameSeed
      ? normalizeUsername(usernameSeed)
      : buildUniqueUsername(store, displayNameSeed || cleanEmail.split('@')[0] || 'member');
    userPublic = {
      ...BASE_USER_PUBLIC,
      uid,
      username,
      displayName: (displayNameSeed || username).slice(0, 50),
      nicknameFont: nicknameFont || 'classic',
      dateOfBirth,
      photoUrl: photoUrlSeed || '',
      onboardingCompleted: true,
      createdAt: now,
      lastSeenAt: now,
    };
  }

  if (!userPrivate) {
    userPrivate = {
      ...BASE_USER_PRIVATE,
      uid,
      email: cleanEmail,
      language,
      updatedAt: now,
    };
  } else if (!userPrivate.email) {
    userPrivate.email = cleanEmail;
  }

  if (needCreatePub || needCreatePriv) {
    const emailHash = sha256Hex(canonical);
    const writes: Array<Record<string, unknown>> = [];
    if (needCreatePub) {
      writes.push({
        update: {
          name: firestoreDocPathName(`users/${uid}`),
          fields: toFirestoreFields(buildPublicFieldsForFirestore(userPublic)),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
      });
    }
    if (needCreatePriv) {
      writes.push({
        update: {
          name: firestoreDocPathName(`users/${uid}/private/info`),
          fields: toFirestoreFields(buildPrivateFieldsForFirestore(userPrivate)),
        },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
      });
    }
    const existingU = await firestoreGetDoc(`usernames/${userPublic.username}`, idToken);
    if (!existingU) {
      writes.push({
        update: {
          name: firestoreDocPathName(`usernames/${userPublic.username}`),
          fields: toFirestoreFields({
            uid,
            username: userPublic.username,
          }),
        },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
      });
    }
    const existingClaim = await firestoreGetDoc(`email_claims/${emailHash}`, idToken);
    if (!existingClaim) {
      writes.push({
        update: {
          name: firestoreDocPathName(`email_claims/${emailHash}`),
          fields: toFirestoreFields({
            uid,
            emailHash,
          }),
        },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
      });
    }
    await firestoreCommitWrites(writes, idToken);
  }

  const sessionToken = genId('svfb');
  const sessions = loadFirebaseSessions();
  sessions[sessionToken] = {
    uid,
    email: cleanEmail,
    username: userPublic.username,
    idToken,
    refreshToken,
    expiresAt: Date.now() + expiresInSec * 1000,
  };
  saveFirebaseSessions(sessions);
  recordUsernameEmail(userPublic.username, cleanEmail);

  store.accounts[uid] = {
    uid,
    email: cleanEmail,
    canonicalEmail: canonical,
    username: userPublic.username,
    password: store.accounts[uid]?.password || '',
    createdAt: userPublic.createdAt || now,
  };
  store.usersPublic[uid] = userPublic;
  store.usersPrivate[uid] = userPrivate;
  store.tokens[sessionToken] = uid;
  try {
    saveStore(store);
  } catch {
    // ignore storage quota errors on large media
  }

  return { token: sessionToken, userPublic, userPrivate };
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
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((p) => {
      const likes = store.postLikes[p.id] || [];
      const commentsLen = (store.commentsByPost[p.id] || []).length;
      return {
        ...p,
        likesCount: Math.max(p.likesCount || 0, likes.length),
        commentsCount: Math.max(p.commentsCount || 0, commentsLen),
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
): AppNotification | null {
  if (!recipientUid || recipientUid === actor.uid) return null;
  const notif: AppNotification = {
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
  };
  store.notifications.unshift(notif);
  return notif;
}

function emitMentionNotificationsStandalone(
  store: StandaloneStore,
  actor: UserPublic,
  text: string,
  summaryPrefix: string,
  targetId?: string
): void {
  const handles = extractMentions(text);
  if (!handles.length) return;
  for (const handle of handles) {
    const targetUser = Object.values(store.usersPublic).find(
      (u) => !u.isDeactivated && u.username.toLowerCase() === handle.toLowerCase()
    );
    if (!targetUser || targetUser.uid === actor.uid) continue;
    pushNotification(store, targetUser.uid, actor, 'mention', summaryPrefix, targetId);
  }
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

async function hydrateFromCloudFirestore(
  store: StandaloneStore,
  uid: string | null,
  idToken: string | null
): Promise<void> {
  if (!isRemoteFirebaseEnabled()) return;
  const readToken = idToken || (await ensureGuestIdToken());
  if (!readToken) return;

  const [usersRes, publicPostsRes, publicStoriesRes] = await Promise.all([
    firestoreRunQuery(
      'users',
      [{ field: 'onboardingCompleted', op: 'EQUAL', value: { booleanValue: true } }],
      readToken
    ),
    firestoreRunQuery(
      'posts',
      [{ field: 'visibility', op: 'EQUAL', value: { stringValue: 'public' } }],
      readToken
    ),
    firestoreRunQuery(
      'stories',
      [{ field: 'privacy', op: 'EQUAL', value: { stringValue: 'everyone' } }],
      readToken
    ),
  ]);

  const creatorMap = new Map<string, UserPublic>();
  if (usersRes.ok) {
    for (const row of usersRes.rows) {
      const u = normalizeFirestoreUserPublic(row.data);
      if (!u.uid) continue;
      creatorMap.set(u.uid, u);
      store.usersPublic[u.uid] = u;
      if (!store.accounts[u.uid]) {
        store.accounts[u.uid] = {
          uid: u.uid,
          email: '',
          canonicalEmail: '',
          username: u.username,
          password: '',
          createdAt: u.createdAt || new Date().toISOString(),
        };
      }
    }
  }

  let rawPostRows = publicPostsRes.ok ? [...publicPostsRes.rows] : [];
  let rawStoryRows = publicStoriesRes.ok ? [...publicStoriesRes.rows] : [];

  if (uid && idToken) {
    const [
      ownPub,
      ownPriv,
      ownPostsRes,
      ownStoriesRes,
      followingRes,
      followersRes,
      frToRes,
      frFromRes,
      chatsRes,
      savedRes,
      notifsRes,
    ] = await Promise.all([
      firestoreGetDoc(`users/${uid}`, idToken),
      firestoreGetDoc(`users/${uid}/private/info`, idToken),
      firestoreRunQuery('posts', [{ field: 'authorId', op: 'EQUAL', value: { stringValue: uid } }], idToken),
      firestoreRunQuery('stories', [{ field: 'authorId', op: 'EQUAL', value: { stringValue: uid } }], idToken),
      firestoreRunQuery('followers', [{ field: 'followerUid', op: 'EQUAL', value: { stringValue: uid } }], idToken),
      firestoreRunQuery('followers', [{ field: 'targetUid', op: 'EQUAL', value: { stringValue: uid } }], idToken),
      firestoreRunQuery('friend_requests', [{ field: 'toUid', op: 'EQUAL', value: { stringValue: uid } }], idToken),
      firestoreRunQuery('friend_requests', [{ field: 'fromUid', op: 'EQUAL', value: { stringValue: uid } }], idToken),
      firestoreRunQuery('chats', [{ field: 'participantIds', op: 'ARRAY_CONTAINS', value: { stringValue: uid } }], idToken),
      firestoreRunQuery('saved_posts', [{ field: 'uid', op: 'EQUAL', value: { stringValue: uid } }], idToken),
      firestoreRunQuery('notifications', [{ field: 'recipientUid', op: 'EQUAL', value: { stringValue: uid } }], idToken),
    ]);

    if (ownPub) {
      const normalizedOwn = normalizeFirestoreUserPublic(ownPub);
      creatorMap.set(uid, normalizedOwn);
      store.usersPublic[uid] = normalizedOwn;
    }
    if (ownPriv) {
      store.usersPrivate[uid] = normalizeFirestoreUserPrivate(ownPriv);
    }
    if (ownPostsRes.ok) rawPostRows = [...rawPostRows, ...ownPostsRes.rows];
    if (ownStoriesRes.ok) rawStoryRows = [...rawStoryRows, ...ownStoriesRes.rows];

    if (followingRes.ok) {
      store.followingByUid[uid] = Array.from(
        new Set(
          followingRes.rows
            .map((r) => String(r.data.targetUid || ''))
            .filter(Boolean)
        )
      );
      if (store.usersPublic[uid]) {
        store.usersPublic[uid].followingCount = store.followingByUid[uid].length;
      }
    }
    if (followersRes.ok) {
      store.followersByUid[uid] = Array.from(
        new Set(
          followersRes.rows
            .map((r) => String(r.data.followerUid || ''))
            .filter(Boolean)
        )
      );
      if (store.usersPublic[uid]) {
        store.usersPublic[uid].followersCount = store.followersByUid[uid].length;
      }
    }

    if (frToRes.ok || frFromRes.ok) {
      const frMap = new Map<string, FriendRequest>();
      for (const row of [...frToRes.rows, ...frFromRes.rows]) {
        const fromUid = String(row.data.fromUid || '');
        const sender = creatorMap.get(fromUid) || store.usersPublic[fromUid];
        frMap.set(row.id, {
          id: String(row.data.id || row.id),
          fromUid,
          fromUsername: sender?.username || 'member',
          fromDisplayName: sender?.displayName || 'Member',
          fromAvatar: sender?.photoUrl || '',
          toUid: String(row.data.toUid || ''),
          status: (row.data.status as FriendRequest['status']) || 'pending',
          mutualCount: 0,
          createdAt: String(row.data.createdAt || new Date().toISOString()),
        });
      }
      store.friendRequests = Array.from(frMap.values());
    }

    if (savedRes.ok) {
      store.postSaves[uid] = Array.from(
        new Set(savedRes.rows.map((r) => String(r.data.postId || '')).filter(Boolean))
      );
    }

    if (notifsRes.ok) {
      const remoteNotifs: AppNotification[] = notifsRes.rows.map((row) => {
        const actorUid = String(row.data.actorUid || '');
        const actor = creatorMap.get(actorUid) || store.usersPublic[actorUid];
        return {
          id: String(row.data.id || row.id),
          recipientUid: String(row.data.recipientUid || uid),
          actorUid,
          actorUsername: actor?.username || 'member',
          actorAvatar: actor?.photoUrl || '',
          type: (row.data.type as AppNotification['type']) || 'follow',
          summary: String(row.data.summary || row.data.type || 'interacted with you'),
          targetId: typeof row.data.targetId === 'string' ? row.data.targetId : undefined,
          read: Boolean(row.data.read),
          createdAt: String(row.data.createdAt || new Date().toISOString()),
        };
      });
      if (remoteNotifs.length > 0) {
        remoteNotifs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        store.notifications = remoteNotifs;
      }
    }

    if (chatsRes.ok) {
      const hydratedChats: Chat[] = [];
      await Promise.all(
        chatsRes.rows.map(async (row) => {
          const pIds = Array.isArray(row.data.participantIds)
            ? row.data.participantIds.filter((x): x is string => typeof x === 'string')
            : [];
          const pNames: Record<string, string> = {};
          const pAvatars: Record<string, string> = {};
          pIds.forEach((pId) => {
            const pUser = creatorMap.get(pId) || store.usersPublic[pId];
            if (pUser) {
              pNames[pId] = pUser.displayName;
              pAvatars[pId] = pUser.photoUrl;
            }
          });
          const chat: Chat = {
            id: String(row.data.id || row.id),
            type: row.data.type === 'group' ? 'group' : 'direct',
            title: String(row.data.title || ''),
            participantIds: pIds,
            participantNames: pNames,
            participantAvatars: pAvatars,
            ownerUid: typeof row.data.ownerUid === 'string' ? row.data.ownerUid : undefined,
            adminUids: Array.isArray(row.data.adminUids)
              ? row.data.adminUids.filter((x): x is string => typeof x === 'string')
              : undefined,
            requireAddApproval: Boolean(row.data.requireAddApproval),
            pendingMemberIds: Array.isArray(row.data.pendingMemberIds)
              ? row.data.pendingMemberIds.filter((x): x is string => typeof x === 'string')
              : undefined,
            maxMembers: typeof row.data.maxMembers === 'number' ? row.data.maxMembers : MAX_GROUP_MEMBERS,
            lastMessageText: String(row.data.lastMessageText || ''),
            lastMessageAt: String(row.data.lastMessageAt || row.data.createdAt || new Date().toISOString()),
            unreadCount: 0,
            createdBy: String(row.data.createdBy || ''),
            createdAt: String(row.data.createdAt || new Date().toISOString()),
          };
          hydratedChats.push(chat);

          const msgsRes = await firestoreRunQuery(
            'messages',
            [{ field: 'chatId', op: 'EQUAL', value: { stringValue: chat.id } }],
            idToken,
            `chats/${chat.id}`
          );
          if (msgsRes.ok) {
            store.messagesByChat[chat.id] = msgsRes.rows
              .map((mr) => {
                const senderId = String(mr.data.senderId || '');
                const sender = creatorMap.get(senderId) || store.usersPublic[senderId];
                return {
                  id: String(mr.data.id || mr.id),
                  chatId: chat.id,
                  senderId,
                  senderName: sender?.displayName || 'Member',
                  type: (mr.data.type as ChatMessage['type']) || 'text',
                  text: typeof mr.data.text === 'string' ? mr.data.text : undefined,
                  mediaUrl: typeof mr.data.mediaUrl === 'string' ? mr.data.mediaUrl : undefined,
                  stickerUrl: typeof mr.data.stickerUrl === 'string' ? mr.data.stickerUrl : undefined,
                  sharedPostId: typeof mr.data.sharedPostId === 'string' ? mr.data.sharedPostId : undefined,
                  durationMs: typeof mr.data.durationMs === 'number' ? mr.data.durationMs : undefined,
                  replyToId: typeof mr.data.replyToId === 'string' ? mr.data.replyToId : undefined,
                  status: (mr.data.status as ChatMessage['status']) || 'sent',
                  reactions: (mr.data.reactions as Record<string, string[]>) || {},
                  createdAt: String(mr.data.createdAt || new Date().toISOString()),
                } satisfies ChatMessage;
              })
              .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
          }
        })
      );
      if (hydratedChats.length > 0) {
        hydratedChats.sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
        store.chats = hydratedChats;
      }
    }
  }

  if (publicPostsRes.ok || rawPostRows.length > 0) {
    const postMap = new Map<string, Post>();
    for (const row of rawPostRows) {
      const authorId = String(row.data.authorId || '');
      const author = creatorMap.get(authorId) || store.usersPublic[authorId];
      const normalized = normalizeFirestorePost({ ...row.data, id: String(row.data.id || row.id) }, author);
      if (normalized.id) {
        postMap.set(normalized.id, normalized);
      }
    }
    const remotePosts = Array.from(postMap.values()).sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
    store.posts = remotePosts;

    // Hydrate comments for top posts in parallel
    await Promise.all(
      remotePosts.slice(0, 25).map(async (p) => {
        const cmRes = await firestoreRunQuery(
          'comments',
          [{ field: 'postId', op: 'EQUAL', value: { stringValue: p.id } }],
          readToken,
          `posts/${p.id}`
        );
        if (cmRes.ok) {
          store.commentsByPost[p.id] = cmRes.rows
            .map((cr) => {
              const cAuthorId = String(cr.data.authorId || '');
              const cAuthor = creatorMap.get(cAuthorId) || store.usersPublic[cAuthorId];
              return {
                id: String(cr.data.id || cr.id),
                postId: p.id,
                authorId: cAuthorId,
                authorUsername: String(cr.data.authorUsername || cAuthor?.username || 'member'),
                authorAvatar: cAuthor?.photoUrl || '',
                text: String(cr.data.text || ''),
                stickerUrl: typeof cr.data.stickerUrl === 'string' ? cr.data.stickerUrl : undefined,
                gifUrl: typeof cr.data.gifUrl === 'string' ? cr.data.gifUrl : undefined,
                parentCommentId:
                  typeof cr.data.parentCommentId === 'string' ? cr.data.parentCommentId : undefined,
                createdAt: String(cr.data.createdAt || new Date().toISOString()),
              } satisfies PostComment;
            })
            .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        }
      })
    );

    // Sync per-author post counts cleanly
    const countsByAuthor: Record<string, number> = {};
    for (const p of remotePosts) {
      countsByAuthor[p.authorId] = (countsByAuthor[p.authorId] || 0) + 1;
    }
    for (const u of Object.values(store.usersPublic)) {
      u.postsCount = Math.max(u.postsCount || 0, countsByAuthor[u.uid] || 0);
    }
  }

  if (publicStoriesRes.ok || rawStoryRows.length > 0) {
    const storyMap = new Map<string, Story>();
    for (const row of rawStoryRows) {
      const sAuthorId = String(row.data.authorId || '');
      const sAuthor = creatorMap.get(sAuthorId) || store.usersPublic[sAuthorId];
      const story: Story = {
        id: String(row.data.id || row.id),
        authorId: sAuthorId,
        authorUsername: String(row.data.authorUsername || sAuthor?.username || 'member'),
        authorDisplayName: sAuthor?.displayName || String(row.data.authorUsername || 'Member'),
        authorAvatar: sAuthor?.photoUrl || '',
        mediaType: (row.data.mediaType as Story['mediaType']) || 'text',
        mediaUrl: typeof row.data.mediaUrl === 'string' ? row.data.mediaUrl : undefined,
        textContent: typeof row.data.textContent === 'string' ? row.data.textContent : undefined,
        privacy: (row.data.privacy as Story['privacy']) || 'everyone',
        viewersCount: Number(row.data.viewersCount || 0),
        viewerUsernames: [],
        reactions: [],
        createdAt: String(row.data.createdAt || new Date().toISOString()),
        expiresAt: String(row.data.expiresAt || new Date(Date.now() + 86400000).toISOString()),
      };
      storyMap.set(story.id, story);
    }
    store.stories = Array.from(storyMap.values());
  }

  try {
    saveStore(store);
  } catch {
    // ignore storage quota errors on large base64 payloads
  }
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
  const useRemote = isRemoteFirebaseEnabled();
  const remoteSession = useRemote ? await ensureSessionIdToken(token) : { uid: null, idToken: null };
  const uid = remoteSession.uid || (token ? store.tokens[token] || null : null);
  const userIdToken = remoteSession.idToken;
  let currentUser = uid ? store.usersPublic[uid] || null : null;

  // 1. State Hydration (live Cloud Firestore -> local cache fallback)
  if (method === 'GET' && pathname === '/api/state') {
    if (useRemote) {
      await hydrateFromCloudFirestore(store, uid, userIdToken);
    }
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
    let taken = Object.values(store.accounts).some(
      (a) => !a.deleted && a.uid !== excludeUid && a.username === normalized
    );
    if (!taken && useRemote) {
      const claimDoc = await firestoreGetDoc(`usernames/${normalized}`);
      if (claimDoc && claimDoc.uid && claimDoc.uid !== excludeUid) {
        taken = true;
      }
    }
    return ok({
      available: !taken,
      normalized,
      reason: taken ? 'Username is already taken.' : undefined,
    });
  }

  // 3. Send OTP
  if (method === 'POST' && pathname === '/api/auth/send-otp') {
    const emailRaw = String(body.email || '').trim().toLowerCase();
    const purpose = String(body.purpose || 'signup') as 'signup' | 'reset' | '2fa' | 'change_email';
    const lang = (body.language === 'bn' ? 'bn' : 'en') as AppLanguage;

    if (!isValidEmailFormat(emailRaw)) {
      return fail(lang === 'bn' ? 'সঠিক ইমেইল দিন' : 'Please enter a valid email address.', 400);
    }

    if (purpose === 'change_email' && !uid) {
      return fail('Authentication required.', 401);
    }

    let cleanEmail = emailRaw;
    let canonical = canonicalizeEmail(cleanEmail);
    if (purpose === 'signup' || purpose === 'change_email') {
      const check = validateSignupEmail(emailRaw, lang);
      if (!check.valid) {
        return fail(check.reason || 'Invalid email address.', 400);
      }
      cleanEmail = check.cleanEmail;
      canonical = check.canonicalEmail;
    }

    if (purpose === 'change_email' && uid) {
      const currentPriv = store.usersPrivate[uid];
      const currentAcc = store.accounts[uid];
      const existingCurEmail = (currentPriv?.email || currentAcc?.email || '').trim().toLowerCase();
      if (existingCurEmail && canonicalizeEmail(existingCurEmail) === canonical) {
        return fail(
          lang === 'bn'
            ? 'নতুন ইমেইলটি বর্তমান ইমেইল থেকে আলাদা হতে হবে।'
            : 'New email must be different from your current email.',
          400
        );
      }
    }

    if (useRemote) {
      const emailHash = sha256Hex(canonical);
      const [remoteClaim, authUri] = await Promise.all([
        firestoreGetDoc(`email_claims/${emailHash}`),
        firebaseAuthPost<{ registered?: boolean }>('accounts:createAuthUri', {
          identifier: cleanEmail,
          continueUri: 'https://appassets.androidplatform.net',
        }).catch(() => ({ ok: false, status: 0, data: {} as { registered?: boolean } })),
      ]);

      const remoteExists = Boolean((remoteClaim && remoteClaim.uid) || authUri.data?.registered);
      if ((purpose === 'signup' || purpose === 'change_email') && remoteExists) {
        return fail(
          lang === 'bn'
            ? 'এই ইমেইলটি ইতিমধ্যেই ভেরিফাই করা এবং এটি দিয়ে একটি অ্যাকাউন্ট খোলা আছে — অনুগ্রহ করে অন্য ইমেইল ব্যবহার করুন।'
            : 'This email is already verified and registered to an account — please use a different email.',
          409,
          { code: 'EMAIL_ALREADY_EXISTS', alreadyVerified: true, existingEmail: cleanEmail }
        );
      }

      // Attempt real Gmail SMTP delivery via deployed Cloud Functions
      const fnRes = await callCloudFunction<{ ok?: boolean; sentViaSmtp?: boolean }>(
        '/auth/send-otp',
        { email: cleanEmail, purpose, language: lang }
      );
      if (fnRes.ok && fnRes.data.sentViaSmtp) {
        return ok({ ok: true, sentViaSmtp: true });
      }
      if (!fnRes.networkError && fnRes.status >= 400 && fnRes.status < 500 && fnRes.status !== 404) {
        return fail(
          fnRes.data.error || 'Could not send verification code.',
          fnRes.status,
          fnRes.data.code ? { code: fnRes.data.code } : {}
        );
      }

      if (purpose === 'reset' && !remoteExists) {
        const localExists = Object.values(store.accounts).some(
          (a) => !a.deleted && (a.email === cleanEmail || a.canonicalEmail === canonical)
        );
        if (!localExists) {
          return fail(
            lang === 'bn'
              ? 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।'
              : 'No account found with that email address.',
            404
          );
        }
      }
    } else if (purpose === 'signup' || purpose === 'change_email') {
      const exists = Object.values(store.accounts).some(
        (a) =>
          !a.deleted &&
          (purpose === 'signup' || a.uid !== uid) &&
          (a.email === cleanEmail || a.canonicalEmail === canonical)
      );
      if (exists) {
        return fail(
          lang === 'bn'
            ? 'এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে'
            : 'An account already exists with this email.',
          409,
          { code: 'EMAIL_EXISTS', existingEmail: cleanEmail }
        );
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    store.otps[`${purpose}:${cleanEmail}`] = {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    saveStore(store);
    return ok({ ok: true, sentViaSmtp: false, devOtpCode: code });
  }

  // 4. Verify OTP
  if (method === 'POST' && pathname === '/api/auth/verify-otp') {
    const emailRaw = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    const purpose = String(body.purpose || 'signup');
    const rec = store.otps[`${purpose}:${emailRaw}`];

    if (rec) {
      if (rec.expiresAt < Date.now() || rec.code !== code) {
        return fail('Invalid or expired verification code.', 400);
      }
      delete store.otps[`${purpose}:${emailRaw}`];
      const verificationToken = genId('vtok');
      store.verifications[verificationToken] = {
        email: emailRaw,
        purpose,
        expiresAt: Date.now() + 20 * 60 * 1000,
      };
      saveStore(store);
      return ok({ ok: true, verificationToken });
    }

    if (useRemote) {
      const fnRes = await callCloudFunction<{ verificationToken?: string }>(
        '/auth/verify-otp',
        { email: emailRaw, code, purpose }
      );
      if (fnRes.ok && fnRes.data.verificationToken) {
        const verificationToken = fnRes.data.verificationToken;
        store.verifications[verificationToken] = {
          email: emailRaw,
          purpose,
          expiresAt: Date.now() + 20 * 60 * 1000,
          remoteToken: verificationToken,
          code,
        };
        saveStore(store);
        return ok({ ok: true, verificationToken });
      }
      if (!fnRes.networkError && fnRes.data.error) {
        return fail(fnRes.data.error, fnRes.status || 400);
      }
    }

    return fail('Invalid or expired verification code.', 400);
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

    if (useRemote) {
      const existingUsername = await firestoreGetDoc(`usernames/${username}`);
      if (existingUsername && existingUsername.uid) {
        return fail('Username is already taken.', 409);
      }

      const signUpRes = await firebaseAuthPost<{
        localId?: string;
        idToken?: string;
        refreshToken?: string;
        expiresIn?: string;
      }>('accounts:signUp', {
        email,
        password,
        returnSecureToken: true,
      });

      if (!signUpRes.ok || !signUpRes.data.localId || !signUpRes.data.idToken) {
        const msg = signUpRes.data.error?.message || '';
        if (msg.includes('EMAIL_EXISTS')) {
          return fail(
            language === 'bn'
              ? 'এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট খোলা আছে — অনুগ্রহ করে সাইন ইন করুন।'
              : 'An account already exists with this email — please sign in.',
            409
          );
        }
        return fail('Could not create Firebase account. Please verify your details.', 400);
      }

      delete store.verifications[verificationToken];
      const session = await createFirebaseUserSessionAndProfile({
        store,
        uid: signUpRes.data.localId,
        email,
        idToken: signUpRes.data.idToken,
        refreshToken: signUpRes.data.refreshToken || '',
        expiresInSec: Number(signUpRes.data.expiresIn || 3600),
        displayNameSeed: displayName,
        usernameSeed: username,
        photoUrlSeed: photoUrl,
        dateOfBirth,
        nicknameFont,
        language,
      });

      return ok({ token: session.token, user: session.userPublic, userPrivate: session.userPrivate }, 201);
    }

    // Offline unit test fallback
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

  // 6. Login with identifier (email OR @username) + password
  if (method === 'POST' && pathname === '/api/auth/login') {
    const rawIdentifier = String(body.identifier || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (useRemote) {
      let targetEmail: string | null = null;
      const isEmailLogin = rawIdentifier.indexOf('@') > 0;
      if (isEmailLogin) {
        targetEmail = rawIdentifier;
      } else {
        const normUser = normalizeUsername(rawIdentifier.replace(/^@+/, ''));
        const usernameMap = loadUsernameEmailMap();
        const localAcct = Object.values(store.accounts).find(
          (a) => !a.deleted && a.username.toLowerCase() === normUser && a.email
        );
        targetEmail =
          usernameMap[normUser] ||
          findEmailInSavedLogins(normUser) ||
          localAcct?.email ||
          null;

        if (!targetEmail) {
          const fnRes = await callCloudFunction<{ email?: string }>(
            '/auth/resolve-login',
            { identifier: normUser },
            null,
            4000
          );
          if (fnRes.ok && fnRes.data.email) {
            targetEmail = fnRes.data.email.trim().toLowerCase();
          }
        }

        if (!targetEmail) {
          const claimDoc = await firestoreGetDoc(`usernames/${normUser}`);
          if (claimDoc && claimDoc.uid) {
            const claimUid = String(claimDoc.uid);
            const fallbackEmail =
              store.accounts[claimUid]?.email ||
              store.usersPrivate[claimUid]?.email ||
              '';
            if (fallbackEmail) {
              targetEmail = fallbackEmail.trim().toLowerCase();
            } else {
              return fail(
                `Account @${normUser} found! Please sign in with your registered email address once on this device (after that, @${normUser} login will work automatically).`,
                400
              );
            }
          }
        }
      }

      if (!targetEmail) {
        return fail('Invalid email/username or password.', 401);
      }

      const signInRes = await firebaseAuthPost<{
        localId?: string;
        idToken?: string;
        refreshToken?: string;
        expiresIn?: string;
        email?: string;
      }>('accounts:signInWithPassword', {
        email: targetEmail,
        password,
        returnSecureToken: true,
      });

      if (!signInRes.ok || !signInRes.data.localId || !signInRes.data.idToken) {
        return fail('Invalid email/username or password.', 401);
      }

      const session = await createFirebaseUserSessionAndProfile({
        store,
        uid: signInRes.data.localId,
        email: signInRes.data.email || targetEmail,
        idToken: signInRes.data.idToken,
        refreshToken: signInRes.data.refreshToken || '',
        expiresInSec: Number(signInRes.data.expiresIn || 3600),
      });

      if (session.userPublic.username) {
        recordUsernameEmail(session.userPublic.username, session.userPrivate.email);
      }

      if (session.userPublic.isDeactivated) {
        session.userPublic.isDeactivated = false;
        session.userPublic.deactivatedUntil = null;
        const fields = buildPublicFieldsForFirestore(session.userPublic);
        delete fields.followersCount;
        delete fields.followingCount;
        delete fields.postsCount;
        await firestoreCommitWrites(
          [
            {
              update: {
                name: firestoreDocPathName(`users/${session.userPublic.uid}`),
                fields: toFirestoreFields(fields),
              },
              updateMask: { fieldPaths: ['isDeactivated', 'deactivatedUntil'] },
              updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
            },
          ],
          signInRes.data.idToken
        );
      }

      return ok({ token: session.token, user: session.userPublic, userPrivate: session.userPrivate });
    }

    // Offline unit test login
    const stripped = rawIdentifier.replace(/^@+/, '');
    const normUser = normalizeUsername(stripped);
    const acc = Object.values(store.accounts).find(
      (a) =>
        !a.deleted &&
        (a.email === rawIdentifier ||
          a.canonicalEmail === canonicalizeEmail(rawIdentifier) ||
          a.username.toLowerCase() === normUser)
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

  // 7. Login with saved session token (refreshes Firebase refreshToken cleanly!)
  if (method === 'POST' && pathname === '/api/auth/login-token') {
    const savedTok = String(body.token || '');
    if (useRemote) {
      const refreshedSession = await ensureSessionIdToken(savedTok);
      if (refreshedSession.uid && refreshedSession.idToken && refreshedSession.session) {
        const [pubRaw, privRaw] = await Promise.all([
          firestoreGetDoc(`users/${refreshedSession.uid}`, refreshedSession.idToken),
          firestoreGetDoc(`users/${refreshedSession.uid}/private/info`, refreshedSession.idToken),
        ]);
        const user = pubRaw ? normalizeFirestoreUserPublic(pubRaw) : store.usersPublic[refreshedSession.uid];
        const priv = privRaw ? normalizeFirestoreUserPrivate(privRaw) : store.usersPrivate[refreshedSession.uid];
        if (user && priv) {
          store.usersPublic[refreshedSession.uid] = user;
          store.usersPrivate[refreshedSession.uid] = priv;
          saveStore(store);
          return ok({ token: savedTok, user, userPrivate: priv });
        }
      }
      return fail('Saved session expired. Please sign in with your password.', 401);
    }

    const targetUid = store.tokens[savedTok];
    if (!targetUid || store.accounts[targetUid]?.deleted) {
      return fail('Saved session expired. Please sign in with your password.', 401);
    }
    const user = store.usersPublic[targetUid];
    const priv = store.usersPrivate[targetUid];
    if (!user || !priv) return fail('Account not found.', 404);
    return ok({ token: savedTok, user, userPrivate: priv });
  }

  // 7b. Verify 2FA Login
  if (method === 'POST' && pathname === '/api/auth/verify-2fa') {
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    const rec = store.otps[`2fa:${email}`];
    if (!rec || rec.expiresAt < Date.now() || rec.code !== code) {
      return fail('Invalid or expired 2FA verification code.', 400);
    }
    delete store.otps[`2fa:${email}`];
    const acc = Object.values(store.accounts).find((a) => !a.deleted && a.email === email);
    if (!acc) return fail('Account not found.', 404);
    const sessionTok = genId('svtok');
    store.tokens[sessionTok] = acc.uid;
    saveStore(store);
    return ok({
      token: sessionTok,
      user: store.usersPublic[acc.uid],
      userPrivate: store.usersPrivate[acc.uid],
    });
  }

  // 8. Firebase ID Token Exchange (Google Sign-In / native Firebase Auth session)
  if (method === 'POST' && pathname === '/api/auth/firebase') {
    const idToken = String(body.idToken || '').trim();
    const lang = (body.language === 'bn' ? 'bn' : 'en') as AppLanguage;
    const decoded = decodeJwtPayload(idToken);
    if (!decoded?.sub) {
      return fail('Invalid Firebase ID token.', 401);
    }
    const fbEmail = (decoded.email || `${decoded.sub}@firebase.local`).toLowerCase();

    if (useRemote) {
      // Lookup full account metadata from Identity Toolkit accounts:lookup
      const lookupRes = await firebaseAuthPost<{
        users?: Array<{ localId?: string; email?: string; displayName?: string; photoUrl?: string }>;
      }>('accounts:lookup', { idToken }).catch(() => null);
      const fbUserInfo = lookupRes?.ok ? lookupRes.data.users?.[0] : undefined;
      const targetUid = fbUserInfo?.localId || decoded.sub;
      const resolvedEmail = (fbUserInfo?.email || fbEmail).toLowerCase();

      const session = await createFirebaseUserSessionAndProfile({
        store,
        uid: targetUid,
        email: resolvedEmail,
        idToken,
        refreshToken: '',
        expiresInSec: 3500,
        displayNameSeed: fbUserInfo?.displayName || decoded.name || resolvedEmail.split('@')[0],
        photoUrlSeed: fbUserInfo?.photoUrl || decoded.picture || '',
        language: lang,
      });

      return ok({
        token: session.token,
        user: session.userPublic,
        userPrivate: session.userPrivate,
      });
    }

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

    if (useRemote) {
      if (ver.remoteToken) {
        const fnRes = await callCloudFunction<{ ok?: boolean; method?: string; message?: string }>(
          '/auth/reset-password',
          { verificationToken: ver.remoteToken, email, newPassword }
        );
        if (fnRes.ok) {
          delete store.verifications[verificationToken];
          saveStore(store);
          return ok({ ok: true, method: fnRes.data.method || 'direct', message: fnRes.data.message });
        }
      }
      const oob = await firebaseAuthPost<{ email?: string }>('accounts:sendOobCode', {
        requestType: 'PASSWORD_RESET',
        email,
      });
      if (oob.ok) {
        delete store.verifications[verificationToken];
        saveStore(store);
        return ok({
          ok: true,
          method: 'email_link',
          message: `Password reset link sent to ${email}. Check your inbox to complete resetting your password.`,
        });
      }
      return fail('Could not reset password for this email right now.', 400);
    }

    const acc = Object.values(store.accounts).find((a) => !a.deleted && a.email === email);
    if (!acc) return fail('Account not found.', 404);
    acc.password = newPassword;
    delete store.verifications[verificationToken];
    saveStore(store);
    return ok({ ok: true, method: 'direct' });
  }

  // Require auth for mutating user actions below
  if (!uid) {
    return fail('Authentication required.', 401);
  }
  if (!currentUser && useRemote && userIdToken) {
    const pubRaw = await firestoreGetDoc(`users/${uid}`, userIdToken);
    if (pubRaw) {
      currentUser = normalizeFirestoreUserPublic(pubRaw);
      store.usersPublic[uid] = currentUser;
    }
  }
  if (!currentUser) {
    return fail('Authentication required.', 401);
  }
  if (!store.usersPrivate[uid]) {
    store.usersPrivate[uid] = { ...BASE_USER_PRIVATE, uid, updatedAt: new Date().toISOString() };
  }
  const currentPrivate = store.usersPrivate[uid];

  if (method === 'POST' && pathname === '/api/auth/change-password') {
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 6) return fail('New password must be at least 6 characters.', 400);

    if (useRemote && remoteSession.session?.email) {
      const verifyRes = await firebaseAuthPost<{ idToken?: string }>('accounts:signInWithPassword', {
        email: remoteSession.session.email,
        password: currentPassword,
        returnSecureToken: true,
      });
      if (!verifyRes.ok || !verifyRes.data.idToken) {
        return fail('Current password is incorrect.', 400);
      }
      const updateRes = await firebaseAuthPost<{ idToken?: string; refreshToken?: string }>('accounts:update', {
        idToken: verifyRes.data.idToken,
        password: newPassword,
        returnSecureToken: true,
      });
      if (!updateRes.ok) {
        return fail('Could not update password.', 400);
      }
      if (token && updateRes.data.idToken) {
        const sessions = loadFirebaseSessions();
        if (sessions[token]) {
          sessions[token].idToken = updateRes.data.idToken;
          if (updateRes.data.refreshToken) sessions[token].refreshToken = updateRes.data.refreshToken;
          saveFirebaseSessions(sessions);
        }
      }
      return ok({ ok: true });
    }

    const acc = store.accounts[uid];
    if (!acc || acc.password !== currentPassword) {
      return fail('Current password is incorrect.', 400);
    }
    acc.password = newPassword;
    saveStore(store);
    return ok({ ok: true });
  }

  if (method === 'POST' && pathname === '/api/auth/change-email') {
    const verificationToken = String(body.verificationToken || '');
    const newEmailRaw = String(body.newEmail || '').trim().toLowerCase();
    const currentPassword = String(body.currentPassword || '');
    const ver = store.verifications[verificationToken];
    if (!ver || ver.purpose !== 'change_email' || ver.expiresAt < Date.now()) {
      return fail('Email verification expired. Please request a new OTP code.', 400);
    }
    const check = validateSignupEmail(newEmailRaw, currentPrivate.language);
    if (!check.valid || ver.email !== check.cleanEmail) {
      return fail('Verified email does not match the requested new email.', 400);
    }
    const oldEmail = currentPrivate.email || store.accounts[uid]?.email || '';
    const oldCanonical = oldEmail ? canonicalizeEmail(oldEmail) : '';

    if (useRemote && userIdToken) {
      if (oldEmail && currentPassword) {
        const reauth = await firebaseAuthPost('accounts:signInWithPassword', {
          email: oldEmail,
          password: currentPassword,
          returnSecureToken: false,
        });
        if (!reauth.ok) {
          return fail('Current password is incorrect.', 400);
        }
      }
      const updateRes = await firebaseAuthPost('accounts:update', {
        idToken: userIdToken,
        email: check.cleanEmail,
        returnSecureToken: false,
      });
      if (!updateRes.ok) {
        return fail('Could not update authentication email. Try signing in again.', 400);
      }
      const newHash = sha256Hex(check.canonicalEmail);
      const writes: Array<Record<string, unknown>> = [
        {
          update: {
            name: firestoreDocPathName(`users/${uid}/private/info`),
            fields: toFirestoreFields({ email: check.cleanEmail }),
          },
          updateMask: { fieldPaths: ['email'] },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        },
        {
          update: {
            name: firestoreDocPathName(`email_claims/${newHash}`),
            fields: toFirestoreFields({ uid, canonicalEmail: check.canonicalEmail }),
          },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        },
      ];
      if (oldCanonical && oldCanonical !== check.canonicalEmail) {
        writes.push({
          delete: firestoreDocPathName(`email_claims/${sha256Hex(oldCanonical)}`),
        });
      }
      await firestoreCommitWrites(writes, userIdToken);
    } else {
      const acc = store.accounts[uid];
      if (!acc || acc.password !== currentPassword) {
        return fail('Current password is incorrect.', 400);
      }
      const emailTaken = Object.values(store.accounts).some(
        (a) =>
          !a.deleted &&
          a.uid !== uid &&
          (a.email === check.cleanEmail || a.canonicalEmail === check.canonicalEmail)
      );
      if (emailTaken) {
        return fail('Another account already uses that email address.', 409);
      }
      acc.email = check.cleanEmail;
      acc.canonicalEmail = check.canonicalEmail;
    }

    delete store.verifications[verificationToken];
    currentPrivate.email = check.cleanEmail;
    currentPrivate.updatedAt = new Date().toISOString();
    if (store.accounts[uid]) {
      store.accounts[uid].email = check.cleanEmail;
      store.accounts[uid].canonicalEmail = check.canonicalEmail;
    }
    if (currentUser.username) {
      recordUsernameEmail(currentUser.username, check.cleanEmail);
    }
    saveStore(store);
    return ok({ ok: true, userPrivate: currentPrivate });
  }

  if (method === 'POST' && pathname === '/api/auth/deactivate') {
    const days = Number(body.days || 30);
    currentUser.isDeactivated = true;
    currentUser.deactivatedUntil = new Date(Date.now() + days * 86400000).toISOString();
    saveStore(store);
    if (useRemote && userIdToken) {
      const fields = buildPublicFieldsForFirestore(currentUser);
      await firestoreCommitWrites(
        [
          {
            update: { name: firestoreDocPathName(`users/${uid}`), fields: toFirestoreFields(fields) },
            updateMask: { fieldPaths: ['isDeactivated', 'deactivatedUntil'] },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
          },
        ],
        userIdToken
      );
    }
    return ok({ ok: true });
  }

  if (method === 'DELETE' && pathname === '/api/auth/account') {
    if (useRemote && userIdToken) {
      const writes: Array<Record<string, unknown>> = [
        { delete: firestoreDocPathName(`users/${uid}/private/info`) },
        { delete: firestoreDocPathName(`users/${uid}`) },
      ];
      if (isValidUsername(currentUser.username)) {
        writes.push({ delete: firestoreDocPathName(`usernames/${currentUser.username}`) });
      }
      if (currentPrivate.email) {
        writes.push({ delete: firestoreDocPathName(`email_claims/${sha256Hex(canonicalizeEmail(currentPrivate.email))}`) });
      }
      await firestoreCommitWrites(writes, userIdToken);
      await firebaseAuthPost('accounts:delete', { idToken: userIdToken }).catch(() => null);
      if (token) {
        const sessions = loadFirebaseSessions();
        delete sessions[token];
        saveFirebaseSessions(sessions);
      }
    }
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
    if (useRemote && userIdToken) {
      const fields = buildPrivateFieldsForFirestore(currentPrivate);
      await firestoreCommitWrites(
        [
          {
            update: {
              name: firestoreDocPathName(`users/${uid}/private/info`),
              fields: toFirestoreFields(fields),
            },
            updateMask: { fieldPaths: Object.keys(fields) },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
          },
        ],
        userIdToken
      );
    }
    return ok({ userPrivate: currentPrivate });
  }

  if (method === 'PATCH' && pathname === '/api/profile') {
    const previousUsername = currentUser.username;
    if (typeof body.username === 'string') {
      const nextU = normalizeUsername(body.username);
      if (nextU !== currentUser.username) {
        if (!isValidUsername(nextU)) return fail('Invalid username.', 400);
        const cd = canChangeUsername(currentUser.lastUsernameChangedAt);
        if (!cd.allowed) return fail(`Username cooldown active (${cd.remainingDays}d left).`, 400);
        const takenLocal = Object.values(store.accounts).some(
          (a) => !a.deleted && a.uid !== uid && a.username === nextU
        );
        const takenRemote = useRemote ? await firestoreGetDoc(`usernames/${nextU}`, userIdToken) : null;
        if (takenLocal || (takenRemote && takenRemote.uid && takenRemote.uid !== uid)) {
          return fail('Username is already taken.', 409);
        }
        currentUser.username = nextU;
        if (store.accounts[uid]) store.accounts[uid].username = nextU;
        currentUser.lastUsernameChangedAt = new Date().toISOString();
        if (currentPrivate.email) recordUsernameEmail(nextU, currentPrivate.email);
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
      const prevBio = currentUser.bio || '';
      currentUser.bio = body.bio;
      const oldMentions = new Set(extractMentions(prevBio));
      const newBioMentions = extractMentions(body.bio).filter((m) => !oldMentions.has(m));
      if (newBioMentions.length) {
        emitMentionNotificationsStandalone(
          store,
          currentUser,
          newBioMentions.map((m) => `@${m}`).join(' '),
          'mentioned you in their bio',
          uid
        );
      }
    }
    const copyFields = ['nicknameFont', 'pronouns', 'website', 'dateOfBirth', 'photoUrl', 'coverUrl', 'interests', 'isPrivate'] as const;
    copyFields.forEach((key) => {
      if (body[key] !== undefined) {
        (currentUser as unknown as Record<string, unknown>)[key] = body[key];
      }
    });
    currentUser.updatedAt = new Date().toISOString();
    saveStore(store);

    if (useRemote && userIdToken) {
      const fields = buildPublicFieldsForFirestore(currentUser);
      delete fields.followersCount;
      delete fields.followingCount;
      delete fields.postsCount;
      const writes: Array<Record<string, unknown>> = [
        {
          update: { name: firestoreDocPathName(`users/${uid}`), fields: toFirestoreFields(fields) },
          updateMask: { fieldPaths: Object.keys(fields) },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        },
      ];
      if (previousUsername && previousUsername !== currentUser.username) {
        writes.push({ delete: firestoreDocPathName(`usernames/${previousUsername}`) });
        writes.push({
          update: {
            name: firestoreDocPathName(`usernames/${currentUser.username}`),
            fields: toFirestoreFields({ uid, username: currentUser.username }),
          },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        });
      }
      await firestoreCommitWrites(writes, userIdToken);
    }

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
    emitMentionNotificationsStandalone(store, currentUser, post.caption, 'mentioned you in a post', post.id);
    try {
      saveStore(store);
    } catch {
      // ignore storage quota errors on huge videos
    }

    if (useRemote && userIdToken) {
      const docName = firestoreDocPathName(`posts/${post.id}`);
      const fields = buildPostFieldsForFirestore(post, false);
      let res = await firestoreCommitWrites(
        [
          {
            update: { name: docName, fields: toFirestoreFields(fields) },
            updateTransforms: [
              { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
              { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
            ],
          },
        ],
        userIdToken
      );
      if (!res.ok && res.status === 403) {
        const fallbackFields = buildPostFieldsForFirestore(post, true);
        res = await firestoreCommitWrites(
          [
            {
              update: { name: docName, fields: toFirestoreFields(fallbackFields) },
              updateTransforms: [
                { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
                { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
              ],
            },
          ],
          userIdToken
        );
      }
    }

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
      const prevCaption = post.caption || '';
      post.caption = caption;
      post.hashtags = extractHashtags(caption);
      const oldMentions = new Set(extractMentions(prevCaption));
      const addedMentions = extractMentions(caption).filter((m) => !oldMentions.has(m));
      if (addedMentions.length) {
        emitMentionNotificationsStandalone(
          store,
          currentUser,
          addedMentions.map((m) => `@${m}`).join(' '),
          'mentioned you in a post',
          post.id
        );
      }
      saveStore(store);
      if (useRemote && userIdToken) {
        await firestoreCommitWrites(
          [
            {
              update: {
                name: firestoreDocPathName(`posts/${post.id}`),
                fields: toFirestoreFields(buildPostFieldsForFirestore(post, true)),
              },
              updateMask: { fieldPaths: ['caption', 'hashtags'] },
              updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
            },
          ],
          userIdToken
        );
      }
      return ok({ post });
    }
    if (!sub && method === 'DELETE') {
      if (post.authorId !== uid) return fail('Forbidden.', 403);
      store.posts = store.posts.filter((p) => p.id !== postId);
      currentUser.postsCount = store.posts.filter((p) => p.authorId === uid).length;
      saveStore(store);
      if (useRemote && userIdToken) {
        await firestoreCommitWrites(
          [{ delete: firestoreDocPathName(`posts/${postId}`) }],
          userIdToken
        );
      }
      return ok({ ok: true });
    }
    if (sub === 'like' && method === 'POST') {
      const list = store.postLikes[postId] || [];
      const idx = list.indexOf(uid);
      if (idx >= 0) {
        list.splice(idx, 1);
        post.likesCount = Math.max(0, (post.likesCount || 1) - 1, list.length);
      } else {
        list.push(uid);
        post.likesCount = Math.max((post.likesCount || 0) + 1, list.length);
        const n = pushNotification(store, post.authorId, currentUser, 'like', 'liked your post', postId);
        if (useRemote && userIdToken && n) {
          void firestoreCommitWrites(
            [
              {
                update: {
                  name: firestoreDocPathName(`notifications/${n.id}`),
                  fields: toFirestoreFields({
                    id: n.id,
                    recipientUid: n.recipientUid,
                    actorUid: n.actorUid,
                    type: n.type,
                    targetId: postId,
                    read: false,
                  }),
                },
                updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
              },
            ],
            userIdToken
          );
        }
      }
      store.postLikes[postId] = list;
      saveStore(store);
      if (useRemote && userIdToken) {
        await firestoreCommitWrites(
          [
            {
              update: {
                name: firestoreDocPathName(`posts/${post.id}`),
                fields: toFirestoreFields({ likesCount: post.likesCount }),
              },
              updateMask: { fieldPaths: ['likesCount'] },
            },
          ],
          userIdToken
        );
      }
      return ok({ liked: idx < 0, likesCount: post.likesCount });
    }
    if (sub === 'save' && method === 'POST') {
      const list = store.postSaves[uid] || [];
      const idx = list.indexOf(postId);
      const savedNow = idx < 0;
      if (!savedNow) list.splice(idx, 1);
      else list.push(postId);
      store.postSaves[uid] = list;
      saveStore(store);
      if (useRemote && userIdToken) {
        const saveId = `${uid}_${postId}`.slice(0, 128);
        await firestoreCommitWrites(
          [
            savedNow
              ? {
                  update: {
                    name: firestoreDocPathName(`saved_posts/${saveId}`),
                    fields: toFirestoreFields({ uid, postId }),
                  },
                  updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
                }
              : { delete: firestoreDocPathName(`saved_posts/${saveId}`) },
          ],
          userIdToken
        );
      }
      return ok({ saved: savedNow });
    }
    if (sub === 'share' && method === 'POST') {
      post.sharesCount += 1;
      saveStore(store);
      if (useRemote && userIdToken) {
        await firestoreCommitWrites(
          [
            {
              update: {
                name: firestoreDocPathName(`posts/${post.id}`),
                fields: toFirestoreFields({ sharesCount: post.sharesCount }),
              },
              updateMask: { fieldPaths: ['sharesCount'] },
            },
          ],
          userIdToken
        );
      }
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
        text: text.trim() || (body.stickerUrl ? 'Sticker' : 'GIF'),
        stickerUrl: typeof body.stickerUrl === 'string' ? body.stickerUrl : undefined,
        gifUrl: typeof body.gifUrl === 'string' ? body.gifUrl : undefined,
        parentCommentId: typeof body.parentCommentId === 'string' ? body.parentCommentId : undefined,
        createdAt: new Date().toISOString(),
      };
      store.commentsByPost[postId] = [...(store.commentsByPost[postId] || []), comment];
      post.commentsCount = Math.max((post.commentsCount || 0) + 1, store.commentsByPost[postId].length);
      pushNotification(store, post.authorId, currentUser, 'comment', 'commented on your post', postId);
      emitMentionNotificationsStandalone(
        store,
        currentUser,
        comment.text,
        'mentioned you in a comment',
        postId
      );
      saveStore(store);

      if (useRemote && userIdToken) {
        const cFields: Record<string, unknown> = {
          id: comment.id,
          postId,
          authorId: uid,
          authorUsername: currentUser.username,
          text: comment.text.slice(0, 1000),
          ...(comment.stickerUrl && comment.stickerUrl.length <= 200000 ? { stickerUrl: comment.stickerUrl } : {}),
          ...(comment.gifUrl && comment.gifUrl.length <= 200000 ? { gifUrl: comment.gifUrl } : {}),
          ...(comment.parentCommentId ? { parentCommentId: comment.parentCommentId.slice(0, 128) } : {}),
        };
        await firestoreCommitWrites(
          [
            {
              update: {
                name: firestoreDocPathName(`posts/${postId}/comments/${comment.id}`),
                fields: toFirestoreFields(cFields),
              },
              updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
            },
            {
              update: {
                name: firestoreDocPathName(`posts/${post.id}`),
                fields: toFirestoreFields({ commentsCount: post.commentsCount }),
              },
              updateMask: { fieldPaths: ['commentsCount'] },
            },
          ],
          userIdToken
        );
      }
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

    if (useRemote && userIdToken) {
      const sFields: Record<string, unknown> = {
        id: story.id,
        authorId: story.authorId,
        authorUsername: story.authorUsername,
        mediaType: story.mediaType,
        ...(story.mediaUrl && story.mediaUrl.length <= 200000 ? { mediaUrl: story.mediaUrl } : {}),
        ...(story.textContent ? { textContent: story.textContent.slice(0, 500) } : {}),
        privacy: story.privacy,
        viewersCount: 0,
      };
      await firestoreCommitWrites(
        [
          {
            update: {
              name: firestoreDocPathName(`stories/${story.id}`),
              fields: {
                ...toFirestoreFields(sFields),
                expiresAt: { timestampValue: story.expiresAt },
              },
            },
            updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
          },
        ],
        userIdToken
      );
    }

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
      if (useRemote && userIdToken) {
        await firestoreCommitWrites(
          [{ delete: firestoreDocPathName(`stories/${storyId}`) }],
          userIdToken
        );
      }
      return ok({ ok: true });
    }
  }

  // Story Highlights
  if (method === 'POST' && pathname === '/api/highlights') {
    const title = String(body.title || '').trim();
    if (!isValidHighlightTitle(title)) return fail('Highlight title must be 1–36 chars.', 400);
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
      const fIds = store.followersByUid[targetUid] || [];
      const flgIds = store.followingByUid[targetUid] || [];
      return ok({
        followerIds: fIds,
        followingIds: flgIds,
        followers: fIds.map((id) => store.usersPublic[id]).filter(Boolean),
        following: flgIds.map((id) => store.usersPublic[id]).filter(Boolean),
      });
    }
    if (action === 'follow' && method === 'POST') {
      const myFollowing = store.followingByUid[uid] || [];
      const targetFollowers = store.followersByUid[targetUid] || [];
      const edgeId = `${uid}_${targetUid}`.slice(0, 128);
      if (myFollowing.includes(targetUid)) {
        store.followingByUid[uid] = myFollowing.filter((x) => x !== targetUid);
        store.followersByUid[targetUid] = targetFollowers.filter((x) => x !== uid);
        currentUser.followingCount = store.followingByUid[uid].length;
        targetUser.followersCount = store.followersByUid[targetUid].length;
        saveStore(store);
        if (useRemote && userIdToken) {
          await firestoreCommitWrites([{ delete: firestoreDocPathName(`followers/${edgeId}`) }], userIdToken);
        }
        return ok({ status: 'unfollowed', followerIds: store.followersByUid[uid], followingIds: store.followingByUid[uid] });
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
        if (useRemote && userIdToken) {
          await firestoreCommitWrites(
            [
              {
                update: {
                  name: firestoreDocPathName(`friend_requests/${req.id}`),
                  fields: toFirestoreFields({
                    id: req.id,
                    fromUid: uid,
                    toUid: targetUid,
                    status: 'pending',
                  }),
                },
                updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
              },
            ],
            userIdToken
          );
        }
        return ok({ status: 'requested', followingIds: store.followingByUid[uid] || [] });
      }
      store.followingByUid[uid] = [...myFollowing, targetUid];
      store.followersByUid[targetUid] = [...targetFollowers, uid];
      currentUser.followingCount = store.followingByUid[uid].length;
      targetUser.followersCount = store.followersByUid[targetUid].length;
      pushNotification(store, targetUid, currentUser, 'follow', 'started following you', uid);
      saveStore(store);
      if (useRemote && userIdToken) {
        await firestoreCommitWrites(
          [
            {
              update: {
                name: firestoreDocPathName(`followers/${edgeId}`),
                fields: toFirestoreFields({ followerUid: uid, targetUid }),
              },
              updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
            },
          ],
          userIdToken
        );
      }
      return ok({ status: 'following', followingIds: store.followingByUid[uid] });
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
    return ok({ ok: true, followerIds: store.followersByUid[uid] || [], followingIds: store.followingByUid[uid] || [] });
  }

  const removeFollowerMatch = pathname.match(/^\/api\/followers\/([^/]+)$/);
  if (removeFollowerMatch && method === 'DELETE') {
    const fUid = removeFollowerMatch[1];
    store.followersByUid[uid] = (store.followersByUid[uid] || []).filter((x) => x !== fUid);
    store.followingByUid[fUid] = (store.followingByUid[fUid] || []).filter((x) => x !== uid);
    currentUser.followersCount = store.followersByUid[uid].length;
    if (store.usersPublic[fUid]) store.usersPublic[fUid].followingCount = store.followingByUid[fUid].length;
    saveStore(store);
    if (useRemote && userIdToken) {
      const edgeId = `${fUid}_${uid}`.slice(0, 128);
      await firestoreCommitWrites([{ delete: firestoreDocPathName(`followers/${edgeId}`) }], userIdToken);
    }
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

    if (useRemote && userIdToken && participants.length >= 2) {
      const cFields: Record<string, unknown> = {
        id: chat.id,
        type: chat.type,
        title: (chat.title || '').slice(0, 80),
        participantIds: chat.participantIds,
        ...(chat.ownerUid ? { ownerUid: chat.ownerUid } : {}),
        ...(chat.adminUids ? { adminUids: chat.adminUids } : {}),
        maxMembers: chat.maxMembers || MAX_GROUP_MEMBERS,
        lastMessageText: '',
        createdBy: uid,
      };
      await firestoreCommitWrites(
        [
          {
            update: { name: firestoreDocPathName(`chats/${chat.id}`), fields: toFirestoreFields(cFields) },
            updateTransforms: [
              { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
              { fieldPath: 'lastMessageAt', setToServerValue: 'REQUEST_TIME' },
            ],
          },
        ],
        userIdToken
      );
    }

    return ok({ chat }, 201);
  }

  const chatMsgCreate = pathname.match(/^\/api\/chats\/([^/]+)\/messages$/);
  if (chatMsgCreate && method === 'POST') {
    const chat = store.chats.find((c) => c.id === chatMsgCreate[1] && c.participantIds.includes(uid));
    if (!chat) return fail('Chat not found.', 404);
    const rawPoll = body.poll && typeof body.poll === 'object' ? (body.poll as Record<string, unknown>) : null;
    let sanitizedPoll: ChatPoll | undefined;
    if ((body.type === 'poll' || rawPoll) && rawPoll) {
      const q = String(rawPoll.question || '').trim().slice(0, 200);
      const rawOpts = Array.isArray(rawPoll.options) ? rawPoll.options : [];
      const cleanOpts = rawOpts
        .map((opt, idx) => {
          const rec = (typeof opt === 'object' && opt !== null ? opt : { text: String(opt || '') }) as Record<string, unknown>;
          return {
            id: typeof rec.id === 'string' && rec.id ? rec.id : `opt_${idx + 1}`,
            text: String(rec.text || '').trim().slice(0, 100),
            voterUids: [] as string[],
          };
        })
        .filter((o) => o.text.length > 0)
        .slice(0, 6);
      if (!q || cleanOpts.length < 2) {
        return fail('Poll requires a question and at least 2 options.', 400);
      }
      sanitizedPoll = {
        question: q,
        options: cleanOpts,
        allowMultiple: Boolean(rawPoll.allowMultiple),
      };
    }

    const msgType = sanitizedPoll ? 'poll' : ((body.type as ChatMessage['type']) || 'text');
    const msg: ChatMessage = {
      id: genId('msg'),
      chatId: chat.id,
      senderId: uid,
      senderName: currentUser.displayName,
      type: msgType,
      text: sanitizedPoll ? sanitizedPoll.question : (typeof body.text === 'string' ? body.text : undefined),
      mediaUrl: typeof body.mediaUrl === 'string' ? body.mediaUrl : undefined,
      stickerUrl: typeof body.stickerUrl === 'string' ? body.stickerUrl : undefined,
      sharedPostId: typeof body.sharedPostId === 'string' ? body.sharedPostId : undefined,
      sharedPostCaption: typeof body.sharedPostCaption === 'string' ? body.sharedPostCaption : undefined,
      sharedPostThumb: typeof body.sharedPostThumb === 'string' ? body.sharedPostThumb : undefined,
      sharedPostAuthor: typeof body.sharedPostAuthor === 'string' ? body.sharedPostAuthor : undefined,
      sharedPostMediaType:
        typeof body.sharedPostMediaType === 'string'
          ? (body.sharedPostMediaType as ChatMessage['sharedPostMediaType'])
          : undefined,
      poll: sanitizedPoll,
      durationMs: typeof body.durationMs === 'number' ? body.durationMs : undefined,
      replyToId: typeof body.replyToId === 'string' ? body.replyToId : undefined,
      status: 'sent',
      reactions: {},
      createdAt: new Date().toISOString(),
    };
    store.messagesByChat[chat.id] = [...(store.messagesByChat[chat.id] || []), msg];
    chat.lastMessageText = (
      msg.type === 'poll'
        ? `Poll: ${msg.poll?.question || msg.text || ''}`
        : msg.type === 'post_share'
        ? 'Shared a post'
        : msg.type === 'reel_share'
        ? 'Shared a reel'
        : msg.text || `[${msg.type}]`
    ).slice(0, 300);
    chat.lastMessageAt = msg.createdAt;
    saveStore(store);

    if (useRemote && userIdToken) {
      const firestoreType = msg.type === 'poll' ? 'text' : msg.type === 'post_share' ? 'reel_share' : msg.type;
      const mFields: Record<string, unknown> = {
        id: msg.id,
        chatId: chat.id,
        senderId: uid,
        type: firestoreType,
        ...(msg.text ? { text: msg.text.slice(0, 2000) } : {}),
        ...(msg.mediaUrl && msg.mediaUrl.length <= 200000 ? { mediaUrl: msg.mediaUrl } : {}),
        ...(msg.stickerUrl && msg.stickerUrl.length <= 200000 ? { stickerUrl: msg.stickerUrl } : {}),
        ...(msg.sharedPostId ? { sharedPostId: msg.sharedPostId.slice(0, 128) } : {}),
        ...(msg.durationMs !== undefined ? { durationMs: Math.min(600000, Math.max(0, Math.round(msg.durationMs))) } : {}),
        ...(msg.replyToId ? { replyToId: msg.replyToId.slice(0, 128) } : {}),
        status: 'sent',
        reactions: {},
      };
      await firestoreCommitWrites(
        [
          {
            update: {
              name: firestoreDocPathName(`chats/${chat.id}/messages/${msg.id}`),
              fields: toFirestoreFields(mFields),
            },
            updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
          },
          {
            update: {
              name: firestoreDocPathName(`chats/${chat.id}`),
              fields: toFirestoreFields({ lastMessageText: chat.lastMessageText }),
            },
            updateMask: { fieldPaths: ['lastMessageText'] },
            updateTransforms: [{ fieldPath: 'lastMessageAt', setToServerValue: 'REQUEST_TIME' }],
          },
        ],
        userIdToken
      );
    }

    return ok({ message: msg }, 201);
  }

  const chatMsgOp = pathname.match(/^\/api\/chats\/([^/]+)\/messages\/([^/]+)(?:\/(react|star|forward|vote))?$/);
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
      return ok({ message: msg, ok: true });
    }
    if (!sub && method === 'DELETE') {
      if (msg.senderId !== uid) return fail('Forbidden.', 403);
      store.messagesByChat[chatId] = msgs.filter((m) => m.id !== msgId);
      saveStore(store);
      if (useRemote && userIdToken) {
        await firestoreCommitWrites(
          [{ delete: firestoreDocPathName(`chats/${chatId}/messages/${msgId}`) }],
          userIdToken
        );
      }
      return ok({ ok: true });
    }
    if (sub === 'react' && method === 'POST') {
      const emoji = String(body.emoji || '❤️');
      const existingList = msg.reactions[emoji] || [];
      msg.reactions[emoji] = existingList.includes(uid)
        ? existingList.filter((x) => x !== uid)
        : [...existingList, uid];
      saveStore(store);
      return ok({ reactions: msg.reactions, ok: true });
    }
    if (sub === 'vote' && method === 'POST') {
      if (msg.type !== 'poll' || !msg.poll) {
        return fail('Poll not found.', 400);
      }
      const optionId = String(body.optionId || '');
      msg.poll = togglePollVote(msg.poll, optionId, uid);
      saveStore(store);
      return ok({ poll: msg.poll, ok: true });
    }
    if (sub === 'star' && method === 'POST') {
      const starred = msg.starredByUids || [];
      msg.starredByUids = starred.includes(uid) ? starred.filter((x) => x !== uid) : [...starred, uid];
      saveStore(store);
      return ok({ starredByUids: msg.starredByUids, ok: true });
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
      return ok({ chatNicknames: chat.chatNicknames, chat });
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
    const myUnread = store.notifications.filter((n) => n.recipientUid === uid && !n.read);
    myUnread.forEach((n) => {
      n.read = true;
    });
    saveStore(store);
    if (useRemote && userIdToken && myUnread.length > 0) {
      await firestoreCommitWrites(
        myUnread.slice(0, 50).map((n) => ({
          update: {
            name: firestoreDocPathName(`notifications/${n.id}`),
            fields: toFirestoreFields({ read: true }),
          },
          updateMask: { fieldPaths: ['read'] },
        })),
        userIdToken
      );
    }
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
    if (useRemote && userIdToken) {
      await firestoreCommitWrites(
        [
          {
            update: {
              name: firestoreDocPathName(`reports/${report.id}`),
              fields: toFirestoreFields(report as unknown as Record<string, unknown>),
            },
            updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
          },
        ],
        userIdToken
      );
    }
    return ok({ report }, 201);
  }

  if (method === 'POST' && pathname === '/api/ai/profile-assist') {
    const task = String(body.task || 'bio');
    const contextText = String(body.contextText || '');
    const currentBio = String(body.currentBio || currentUser.bio || '');
    const lang = (body.language === 'bn' ? 'bn' : 'en') as AppLanguage;

    if (useRemote && userIdToken) {
      const fnRes = await callCloudFunction<{ suggestions?: string[]; tip?: string }>(
        '/ai/profile-assist',
        { task, contextText, currentBio, language: lang },
        userIdToken,
        8000
      );
      if (fnRes.ok && Array.isArray(fnRes.data.suggestions)) {
        return ok({ suggestions: fnRes.data.suggestions, tip: fnRes.data.tip || '' });
      }
    }
    return ok(aiSuggestions(task, contextText, currentBio, lang));
  }

  return fail(`Endpoint not available offline: ${method} ${pathname}`, 404);
}
