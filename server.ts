import 'dotenv/config';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import express, { type NextFunction, type Request, type Response } from 'express';
import nodemailer from 'nodemailer';
import { WebSocketServer, type WebSocket } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type {
  AppNotification,
  BroadcastChannel,
  BroadcastMessage,
  Chat,
  ChatMessage,
  ChatPoll,
  ChatThemeConfig,
  FriendRequest,
  GroupRestrictions,
  NicknameFontStyle,
  NoteItem,
  Post,
  PostComment,
  PostVisibility,
  ReportItem,
  StickerItem,
  Story,
  StoryHighlight,
  StoryHighlightItem,
  UserPrivate,
  UserPublic,
} from './src/types/social';
import {
  BROADCAST_MIN_FOLLOWERS,
  DEFAULT_NOTIFICATION_PREFS,
  MAX_BIO_LENGTH,
  MAX_GROUP_MEMBERS,
  canAddGroupMembers,
  canChangeNickname,
  canChangeUsername,
  canEditGroupInfo,
  canOpenBroadcastChannel,
  canPostInBroadcast,
  canRemoveGroupMember,
  canSendInGroupChat,
  DISPOSABLE_HOST_PATTERN,
  UPLOAD_CHUNK_SIZE_BYTES,
  canonicalizeEmail,
  extractHashtags,
  extractMentions,
  isAllowedUploadMime,
  isDisposableEmail,
  isGroupAdmin,
  isGroupOwner,
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
  resolveSafeUploadExtension,
  shouldNotifyUser,
  togglePollVote,
  validateMediaFileSize,
  validateSignupEmail,
} from './src/utils/validation';

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8')) as {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
};

if (getApps().length === 0) {
  initializeApp({ projectId: firebaseConfig.projectId });
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const FALLBACK_SESSION_SECRET = crypto
  .createHash('sha256')
  .update(`socialverse:${firebaseConfig.projectId}`)
  .digest('hex');

const SESSION_SECRET = process.env.AUTH_SESSION_SECRET || FALLBACK_SESSION_SECRET;

const LOOKUP_AES_KEY = crypto.createHash('sha256').update(SESSION_SECRET).digest();
const FALLBACK_LOOKUP_AES_KEY = crypto
  .createHash('sha256')
  .update(FALLBACK_SESSION_SECRET)
  .digest();

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'socialverse-store.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const UPLOAD_TMP_DIR = path.join(DATA_DIR, 'upload_tmp');

interface PendingUploadSession {
  uploadId: string;
  uid: string;
  fileName: string;
  mimeType: string;
  totalBytes: number;
  expectedChunks: number;
  receivedChunks: Set<number>;
  receivedBytes: number;
  createdAtMs: number;
}
const pendingUploadSessions = new Map<string, PendingUploadSession>();

interface StoredAccount {
  uid: string;
  email: string;
  canonicalEmail?: string;
  username: string;
  passwordHash: string;
  firebaseRefreshToken?: string;
  deleted?: boolean;
  createdAt: string;
}

interface OtpRecord {
  email: string;
  purpose: 'signup' | 'reset' | '2fa' | 'change_email';
  codeHash: string;
  expiresAt: number;
}

interface VerificationGrant {
  token: string;
  email: string;
  purpose: 'signup' | 'reset' | '2fa' | 'change_email';
  expiresAt: number;
}

interface PersistedStore {
  accounts: StoredAccount[];
  otpRecords?: Record<string, OtpRecord>;
  verificationGrants?: Record<string, VerificationGrant>;
  usersPublic: Record<string, UserPublic>;
  usersPrivate: Record<string, UserPrivate>;
  posts: Post[];
  commentsByPost: Record<string, PostComment[]>;
  likedPostIdsByUser: Record<string, string[]>;
  savedPostIdsByUser: Record<string, string[]>;
  stories: Story[];
  storyHighlights: StoryHighlight[];
  chats: Chat[];
  messagesByChat: Record<string, ChatMessage[]>;
  notes: NoteItem[];
  stickers: StickerItem[];
  favoriteStickersByUser: Record<string, string[]>;
  broadcastChannels: BroadcastChannel[];
  followingByUser: Record<string, string[]>;
  followersByUser: Record<string, string[]>;
  friendRequests: FriendRequest[];
  notifications: AppNotification[];
  reports: ReportItem[];
}

function createEmptyStore(): PersistedStore {
  return {
    accounts: [],
    otpRecords: {},
    verificationGrants: {},
    usersPublic: {},
    usersPrivate: {},
    posts: [],
    commentsByPost: {},
    likedPostIdsByUser: {},
    savedPostIdsByUser: {},
    stories: [],
    storyHighlights: [],
    chats: [],
    messagesByChat: {},
    notes: [],
    stickers: [],
    favoriteStickersByUser: {},
    broadcastChannels: [],
    followingByUser: {},
    followersByUser: {},
    friendRequests: [],
    notifications: [],
    reports: [],
  };
}

function loadStore(): PersistedStore {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return createEmptyStore();
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PersistedStore>;
    const merged: PersistedStore = {
      ...createEmptyStore(),
      ...parsed,
    };
    merged.accounts = (merged.accounts || []).map((a) => ({
      ...a,
      email: a.email.trim().toLowerCase(),
      canonicalEmail: a.canonicalEmail || canonicalizeEmail(a.email),
    }));
    return merged;
  } catch (err) {
    console.warn('Could not load store, starting clean:', err);
    return createEmptyStore();
  }
}

const store: PersistedStore = loadStore();
const otpRecords = new Map<string, OtpRecord>();
const verificationGrants = new Map<string, VerificationGrant>();

// Restore persisted non-expired OTPs and verification grants across restarts
{
  const now = Date.now();
  for (const [k, rec] of Object.entries(store.otpRecords || {})) {
    if (rec && rec.expiresAt > now) otpRecords.set(k, rec);
  }
  for (const [k, g] of Object.entries(store.verificationGrants || {})) {
    if (g && g.expiresAt > now) verificationGrants.set(k, g);
  }
}

function syncAuthMapsIntoStore() {
  const now = Date.now();
  const nextOtps: Record<string, OtpRecord> = {};
  for (const [k, rec] of otpRecords.entries()) {
    if (rec.expiresAt > now) nextOtps[k] = rec;
    else otpRecords.delete(k);
  }
  const nextGrants: Record<string, VerificationGrant> = {};
  for (const [k, g] of verificationGrants.entries()) {
    if (g.expiresAt > now) nextGrants[k] = g;
    else verificationGrants.delete(k);
  }
  store.otpRecords = nextOtps;
  store.verificationGrants = nextGrants;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persistStoreImmediate() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    syncAuthMapsIntoStore();
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    console.error('Failed to persist store immediately:', err);
  }
}

function persistStore() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persistStoreImmediate();
  }, 100);
}

process.on('SIGTERM', () => {
  persistStoreImmediate();
  process.exit(0);
});
process.on('SIGINT', () => {
  persistStoreImmediate();
  process.exit(0);
});

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function encryptLookupEmail(email: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', LOOKUP_AES_KEY, iv);
  const enc = Buffer.concat([cipher.update(email, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

function decryptWithKey(token: string, key: Buffer): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, encB64] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivB64, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(encB64, 'base64url')),
      decipher.final(),
    ]);
    return dec.toString('utf-8');
  } catch {
    return null;
  }
}

function decryptLookupEmail(token: string): string | null {
  return (
    decryptWithKey(token, LOOKUP_AES_KEY) ||
    (!LOOKUP_AES_KEY.equals(FALLBACK_LOOKUP_AES_KEY)
      ? decryptWithKey(token, FALLBACK_LOOKUP_AES_KEY)
      : null)
  );
}

// --- Firebase Auth & Firestore REST Persistence Helpers ---
async function firebaseAuthPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  } & T;
  if (!res.ok) {
    throw new Error(data.error?.message || `FIREBASE_AUTH_ERROR_${res.status}`);
  }
  return data;
}

async function refreshFirebaseIdToken(refreshToken: string): Promise<{ idToken: string; refreshToken: string } | null> {
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
    const data = (await res.json()) as { id_token?: string; refresh_token?: string };
    if (!data.id_token) return null;
    return {
      idToken: data.id_token,
      refreshToken: data.refresh_token || refreshToken,
    };
  } catch {
    return null;
  }
}

type FirestoreRestValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreRestValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreRestValue> } };

function toFirestoreValue(val: unknown): FirestoreRestValue {
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

function toFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreRestValue> {
  const fields: Record<string, FirestoreRestValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  return fields;
}

function fromFirestoreValue(val: FirestoreRestValue | undefined): unknown {
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

async function firestoreGetDoc(
  docPath: string,
  idToken?: string
): Promise<Record<string, unknown> | null> {
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

async function firestoreCommitWrites(
  writes: Array<Record<string, unknown>>,
  idToken: string
): Promise<{ ok: boolean; status?: number; errorText?: string }> {
  if (writes.length === 0) return { ok: true };
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
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.warn('Firestore commit warning:', res.status, errBody.slice(0, 300));
      return { ok: false, status: res.status, errorText: errBody };
    }
    return { ok: true };
  } catch (err) {
    console.warn('Firestore commit exception:', err);
    return { ok: false, errorText: err instanceof Error ? err.message : 'network error' };
  }
}

function buildPublicProfileFields(userPublic: UserPublic): Record<string, unknown> {
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
    followersCount: userPublic.followersCount,
    followingCount: userPublic.followingCount,
    postsCount: userPublic.postsCount,
    onlineStatus: userPublic.onlineStatus || 'online',
    lastSeenAt: userPublic.lastSeenAt ?? null,
    lastNicknameChangedAt: userPublic.lastNicknameChangedAt ?? null,
    lastUsernameChangedAt: userPublic.lastUsernameChangedAt ?? null,
    onboardingCompleted: true,
  };
}

function buildPrivateProfileFields(userPrivate: UserPrivate): Record<string, unknown> {
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
  };
}

async function createUserDocsInFirestore(params: {
  uid: string;
  userPublic: UserPublic;
  userPrivate: UserPrivate;
  canonicalEmail: string;
  idToken: string;
}): Promise<{ ok: boolean; status?: number; errorText?: string }> {
  const { uid, userPublic, userPrivate, canonicalEmail, idToken } = params;
  const emailHash = sha256Hex(canonicalEmail);
  const encEmail = encryptLookupEmail(userPrivate.email);

  const [existingPub, existingPriv, existingUsername, existingEmailClaim] = await Promise.all([
    firestoreGetDoc(`users/${uid}`, idToken),
    firestoreGetDoc(`users/${uid}/private/info`, idToken),
    firestoreGetDoc(`usernames/${userPublic.username}`, idToken),
    firestoreGetDoc(`email_claims/${emailHash}`, idToken),
  ]);

  const writes: Array<Record<string, unknown>> = [];

  if (!existingPub) {
    writes.push({
      update: {
        name: firestoreDocPathName(`users/${uid}`),
        fields: toFirestoreFields(buildPublicProfileFields(userPublic)),
      },
      updateTransforms: [
        { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
        { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
      ],
    });
  }

  if (!existingPriv) {
    writes.push({
      update: {
        name: firestoreDocPathName(`users/${uid}/private/info`),
        fields: toFirestoreFields(buildPrivateProfileFields(userPrivate)),
      },
      updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
    });
  }

  if (!existingUsername) {
    writes.push({
      update: {
        name: firestoreDocPathName(`usernames/${userPublic.username}`),
        fields: toFirestoreFields({
          uid,
          username: userPublic.username,
          encEmail,
        }),
      },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
    });
  }

  if (!existingEmailClaim) {
    writes.push({
      update: {
        name: firestoreDocPathName(`email_claims/${emailHash}`),
        fields: toFirestoreFields({
          uid,
          emailHash,
          encEmail,
        }),
      },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
    });
  }

  return firestoreCommitWrites(writes, idToken);
}

async function updateUserPublicInFirestore(params: {
  uid: string;
  userPublic: UserPublic;
  previousUsername?: string;
  emailForClaim?: string;
  idToken: string;
}): Promise<boolean> {
  const { uid, userPublic, previousUsername, emailForClaim, idToken } = params;
  const fields = buildPublicProfileFields(userPublic);
  // Omit createdAt & counters from updateMask so firestore.rules allows partial profile updates cleanly
  delete fields.followersCount;
  delete fields.followingCount;
  delete fields.postsCount;
  const fieldPaths = Object.keys(fields);

  const writes: Array<Record<string, unknown>> = [
    {
      update: {
        name: firestoreDocPathName(`users/${uid}`),
        fields: toFirestoreFields(fields),
      },
      updateMask: { fieldPaths },
      updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
    },
  ];

  if (previousUsername && previousUsername !== userPublic.username) {
    writes.push({
      delete: firestoreDocPathName(`usernames/${previousUsername}`),
    });
    writes.push({
      update: {
        name: firestoreDocPathName(`usernames/${userPublic.username}`),
        fields: toFirestoreFields({
          uid,
          username: userPublic.username,
          ...(emailForClaim ? { encEmail: encryptLookupEmail(emailForClaim) } : {}),
        }),
      },
      currentDocument: { exists: false },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
    });
  }

  const res = await firestoreCommitWrites(writes, idToken);
  return res.ok;
}

async function updateUserPrivateInFirestore(params: {
  uid: string;
  userPrivate: UserPrivate;
  idToken: string;
}): Promise<boolean> {
  const { uid, userPrivate, idToken } = params;
  const fields = buildPrivateProfileFields(userPrivate);
  const res = await firestoreCommitWrites(
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
    idToken
  );
  return res.ok;
}

async function deleteUserDocsFromFirestore(params: {
  uid: string;
  username: string;
  canonicalEmail: string;
  idToken: string;
}): Promise<void> {
  const { uid, username, canonicalEmail, idToken } = params;
  const emailHash = sha256Hex(canonicalEmail);
  const writes: Array<Record<string, unknown>> = [
    { delete: firestoreDocPathName(`users/${uid}/private/info`) },
    { delete: firestoreDocPathName(`users/${uid}`) },
    { delete: firestoreDocPathName(`email_claims/${emailHash}`) },
  ];
  if (isValidUsername(username)) {
    writes.push({ delete: firestoreDocPathName(`usernames/${username}`) });
  }
  await firestoreCommitWrites(writes, idToken);
}

async function firestoreRunQuery(
  collectionId: string,
  filters: Array<{ field: string; op: 'EQUAL' | 'ARRAY_CONTAINS' | 'GREATER_THAN'; value: FirestoreRestValue }>,
  idToken?: string,
  parentDocPath?: string
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
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
    if (!res.ok) return [];
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
    return out;
  } catch {
    return [];
  }
}

async function withUserIdToken(
  uid: string,
  fn: (idToken: string) => Promise<void>
): Promise<void> {
  const acct = store.accounts.find((a) => !a.deleted && a.uid === uid);
  if (!acct?.firebaseRefreshToken) return;
  try {
    const refreshed = await refreshFirebaseIdToken(acct.firebaseRefreshToken);
    if (!refreshed) return;
    acct.firebaseRefreshToken = refreshed.refreshToken;
    await fn(refreshed.idToken);
  } catch (err) {
    console.warn('Firestore background sync warning:', err);
  }
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

async function syncPostToFirestore(post: Post, idToken: string): Promise<boolean> {
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
    idToken
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
      idToken
    );
  }
  return res.ok;
}

async function updatePostMetaInFirestore(post: Post, idToken: string): Promise<boolean> {
  const docName = firestoreDocPathName(`posts/${post.id}`);
  const fields = buildPostFieldsForFirestore(post, true);
  const res = await firestoreCommitWrites(
    [
      {
        update: { name: docName, fields: toFirestoreFields(fields) },
        updateMask: { fieldPaths: ['caption', 'hashtags', 'visibility', ...(fields.coverUrl ? ['coverUrl'] : [])] },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
    idToken
  );
  return res.ok;
}

async function updatePostCountersInFirestore(post: Post, idToken: string): Promise<boolean> {
  const docName = firestoreDocPathName(`posts/${post.id}`);
  const fields = {
    likesCount: Math.max(0, Math.floor(post.likesCount || 0)),
    commentsCount: Math.max(0, Math.floor(post.commentsCount || 0)),
    sharesCount: Math.max(0, Math.floor(post.sharesCount || 0)),
  };
  const res = await firestoreCommitWrites(
    [
      {
        update: { name: docName, fields: toFirestoreFields(fields) },
        updateMask: { fieldPaths: ['likesCount', 'commentsCount', 'sharesCount'] },
      },
    ],
    idToken
  );
  return res.ok;
}

async function syncCommentToFirestore(comment: PostComment, idToken: string): Promise<boolean> {
  const fields: Record<string, unknown> = {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    authorUsername: comment.authorUsername,
    text: comment.text.slice(0, 1000),
    ...(comment.stickerUrl && comment.stickerUrl.length <= 200000 ? { stickerUrl: comment.stickerUrl } : {}),
    ...(comment.gifUrl && comment.gifUrl.length <= 200000 ? { gifUrl: comment.gifUrl } : {}),
    ...(comment.parentCommentId ? { parentCommentId: comment.parentCommentId.slice(0, 128) } : {}),
  };
  const res = await firestoreCommitWrites(
    [
      {
        update: {
          name: firestoreDocPathName(`posts/${comment.postId}/comments/${comment.id}`),
          fields: toFirestoreFields(fields),
        },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
    idToken
  );
  return res.ok;
}

async function syncStoryToFirestore(story: Story, idToken: string): Promise<boolean> {
  const fields: Record<string, unknown> = {
    id: story.id,
    authorId: story.authorId,
    authorUsername: story.authorUsername,
    mediaType: story.mediaType,
    ...(story.mediaUrl && story.mediaUrl.length <= 200000 ? { mediaUrl: story.mediaUrl } : {}),
    ...(story.textContent ? { textContent: story.textContent.slice(0, 500) } : {}),
    privacy: story.privacy,
    viewersCount: Math.max(0, Math.floor(story.viewersCount || 0)),
  };
  const restFields = {
    ...toFirestoreFields(fields),
    expiresAt: { timestampValue: new Date(story.expiresAt).toISOString() },
  };
  const res = await firestoreCommitWrites(
    [
      {
        update: {
          name: firestoreDocPathName(`stories/${story.id}`),
          fields: restFields,
        },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
    idToken
  );
  return res.ok;
}

async function syncSavedPostInFirestore(uid: string, postId: string, saved: boolean, idToken: string): Promise<void> {
  const docName = firestoreDocPathName(`saved_posts/${postId}__${uid}`);
  if (saved) {
    await firestoreCommitWrites(
      [
        {
          update: {
            name: docName,
            fields: toFirestoreFields({ uid, postId }),
          },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        },
      ],
      idToken
    );
  } else {
    await firestoreCommitWrites([{ delete: docName }], idToken);
  }
}

async function syncFollowEdgeInFirestore(followerUid: string, targetUid: string, following: boolean, idToken: string): Promise<void> {
  const docName = firestoreDocPathName(`followers/${followerUid}__${targetUid}`);
  if (following) {
    await firestoreCommitWrites(
      [
        {
          update: {
            name: docName,
            fields: toFirestoreFields({ followerUid, targetUid }),
          },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        },
      ],
      idToken
    );
  } else {
    await firestoreCommitWrites([{ delete: docName }], idToken);
  }
}

async function syncChatToFirestore(chat: Chat, idToken: string): Promise<void> {
  const fields: Record<string, unknown> = {
    id: chat.id,
    type: chat.type,
    ...(chat.title ? { title: chat.title.slice(0, 80) } : {}),
    participantIds: chat.participantIds.slice(0, 250),
    ...(chat.ownerUid ? { ownerUid: chat.ownerUid } : {}),
    ...(chat.adminUids ? { adminUids: chat.adminUids.slice(0, 250) } : {}),
    ...(chat.requireAddApproval !== undefined ? { requireAddApproval: chat.requireAddApproval } : {}),
    ...(chat.pendingMemberIds ? { pendingMemberIds: chat.pendingMemberIds.slice(0, 100) } : {}),
    ...(chat.maxMembers ? { maxMembers: chat.maxMembers } : {}),
    ...(chat.theme ? { theme: chat.theme } : {}),
    ...(chat.chatNicknames ? { chatNicknames: chat.chatNicknames } : {}),
    ...(chat.lastMessageText ? { lastMessageText: chat.lastMessageText.slice(0, 300) } : {}),
    createdBy: chat.createdBy,
  };
  await firestoreCommitWrites(
    [
      {
        update: {
          name: firestoreDocPathName(`chats/${chat.id}`),
          fields: toFirestoreFields(fields),
        },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'lastMessageAt', setToServerValue: 'REQUEST_TIME' },
        ],
      },
    ],
    idToken
  );
}

async function syncChatMessageToFirestore(chatId: string, msg: ChatMessage, idToken: string): Promise<void> {
  const fsType =
    msg.type === 'poll' ? 'text' : msg.type === 'post_share' ? 'reel_share' : msg.type;
  const fallbackText =
    msg.text ||
    (msg.type === 'poll' && msg.poll ? `📊 Poll: ${msg.poll.question}` : undefined);
  const fields: Record<string, unknown> = {
    id: msg.id,
    chatId,
    senderId: msg.senderId,
    type: fsType,
    ...(fallbackText ? { text: fallbackText.slice(0, 2000) } : {}),
    ...(msg.mediaUrl && msg.mediaUrl.length <= 200000 ? { mediaUrl: msg.mediaUrl } : {}),
    ...(msg.stickerUrl && msg.stickerUrl.length <= 200000 ? { stickerUrl: msg.stickerUrl } : {}),
    ...(msg.sharedPostId ? { sharedPostId: msg.sharedPostId.slice(0, 128) } : {}),
    ...(typeof msg.durationMs === 'number' ? { durationMs: Math.max(0, Math.min(600000, Math.floor(msg.durationMs))) } : {}),
    ...(msg.replyToId ? { replyToId: msg.replyToId.slice(0, 128) } : {}),
    status: msg.status,
    reactions: msg.reactions || {},
  };
  await firestoreCommitWrites(
    [
      {
        update: {
          name: firestoreDocPathName(`chats/${chatId}/messages/${msg.id}`),
          fields: toFirestoreFields(fields),
        },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
      },
    ],
    idToken
  );
}

async function backfillStoreToFirestore(): Promise<void> {
  try {
    const accountsWithToken = store.accounts.filter((a) => !a.deleted && a.firebaseRefreshToken);
    for (const acct of accountsWithToken) {
      await withUserIdToken(acct.uid, async (idToken) => {
        const pub = store.usersPublic[acct.uid];
        const priv = store.usersPrivate[acct.uid];
        if (pub && priv) {
          await createUserDocsInFirestore({
            uid: acct.uid,
            userPublic: pub,
            userPrivate: priv,
            canonicalEmail: acct.canonicalEmail || canonicalizeEmail(acct.email),
            idToken,
          });
        }
        const remotePosts = await firestoreRunQuery(
          'posts',
          [{ field: 'authorId', op: 'EQUAL', value: { stringValue: acct.uid } }],
          idToken
        );
        const remoteIds = new Set(remotePosts.map((r) => r.id));
        const localPosts = store.posts.filter((p) => p.authorId === acct.uid);
        for (const post of localPosts) {
          if (!remoteIds.has(post.id)) {
            const okSync = await syncPostToFirestore(post, idToken);
            if (okSync) {
              console.log(`Synced existing post ${post.id} ("${post.caption.slice(0, 24)}") to Cloud Firestore.`);
            }
          }
          const cmts = store.commentsByPost[post.id] || [];
          for (const cmt of cmts) {
            if (cmt.authorId === acct.uid) {
              await syncCommentToFirestore(cmt, idToken);
            }
          }
        }
        for (const story of store.stories.filter((s) => s.authorId === acct.uid)) {
          if (Date.parse(story.expiresAt) > Date.now()) {
            await syncStoryToFirestore(story, idToken);
          }
        }
      });
    }
  } catch (err) {
    console.warn('Startup Firestore backfill notice:', err);
  }
}

const TRUSTED_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.in',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'aol.com',
  'gmx.com',
  'yandex.com',
]);

async function verifyDomainCanReceiveEmail(
  email: string
): Promise<{ valid: boolean; reason?: 'disposable' | 'invalid_domain' }> {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (!domain) return { valid: false, reason: 'invalid_domain' };
  if (isDisposableEmail(email)) return { valid: false, reason: 'disposable' };
  if (TRUSTED_MAIL_DOMAINS.has(domain)) return { valid: true };
  try {
    const mxPromise = dns.resolveMx(domain);
    const timeoutPromise = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), 2500)
    );
    const result = await Promise.race([mxPromise, timeoutPromise]);
    if (result === 'timeout') return { valid: true };
    if (!Array.isArray(result) || result.length === 0) {
      return { valid: false, reason: 'invalid_domain' };
    }
    for (const record of result) {
      const mxHost = (record?.exchange || '').trim().toLowerCase().replace(/\.+$/, '');
      if (mxHost && (isDisposableEmail(`probe@${mxHost}`) || DISPOSABLE_HOST_PATTERN.test(mxHost))) {
        return { valid: false, reason: 'disposable' };
      }
    }
    return { valid: true };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'NXDOMAIN') {
      return { valid: false, reason: 'invalid_domain' };
    }
    return { valid: true };
  }
}

function signSessionToken(uid: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid,
      iat: Date.now(),
      exp: Date.now() + 30 * 24 * 3_600_000,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      uid?: string;
      exp?: number;
    };
    if (!decoded.uid || !decoded.exp || decoded.exp < Date.now()) return null;
    const acct = store.accounts.find((a) => a.uid === decoded.uid && !a.deleted);
    return acct ? acct.uid : null;
  } catch {
    return null;
  }
}

function hashOtp(code: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(code).digest('hex');
}

function isValidEmail(email: string): boolean {
  return isValidEmailFormat(email);
}

async function sendOtpEmail(
  recipientEmail: string,
  code: string,
  purpose: 'signup' | 'reset' | '2fa' | 'change_email'
): Promise<{ sentViaSmtp: boolean }> {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '').trim();
  if (!gmailUser || !gmailPass) {
    return { sentViaSmtp: false };
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });

  const subjectMap = {
    signup: 'SocialVerse Verification Code',
    reset: 'SocialVerse Password Reset Code',
    '2fa': 'SocialVerse Two-Factor Login Code',
    change_email: 'SocialVerse Email Change Verification Code',
  };

  const mailOptions = {
    from: `"SocialVerse" <${gmailUser}>`,
    to: recipientEmail,
    subject: subjectMap[purpose],
    text: `Your SocialVerse verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `<div style="font-family:sans-serif;padding:20px;max-width:460px;margin:auto;border-radius:16px;border:1px solid #e2e8f0">
      <h2 style="margin:0 0 8px;color:#0f172a">SocialVerse Verification</h2>
      <p style="color:#475569;font-size:14px">Use this 6-digit code to verify your account:</p>
      <div style="font-size:28px;font-weight:700;letter-spacing:6px;padding:14px 18px;background:#f1f5f9;border-radius:12px;text-align:center;color:#0284c7;margin:16px 0">${code}</div>
      <p style="color:#64748b;font-size:12px">Valid for 10 minutes. Ignore if you did not request this.</p>
    </div>`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (firstErr) {
    console.warn('Primary SMTP attempt failed, retrying once:', firstErr);
    await transporter.sendMail(mailOptions);
  }

  return { sentViaSmtp: true };
}

interface AuthenticatedRequest extends Request {
  uid?: string;
}

async function verifyFirebaseTokenViaIdentityToolkit(idToken: string): Promise<{
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string;
} | null> {
  try {
    const res = await firebaseAuthPost<{
      users?: Array<{
        localId?: string;
        email?: string;
        displayName?: string;
        photoUrl?: string;
      }>;
    }>('accounts:lookup', { idToken });
    const first = res.users?.[0];
    if (!first?.localId) return null;
    return {
      uid: first.localId,
      email: (first.email || '').trim().toLowerCase(),
      displayName: (first.displayName || '').trim(),
      photoUrl: (first.photoUrl || '').trim(),
    };
  } catch {
    return null;
  }
}

async function resolveUidFromHeader(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const localUid = verifySessionToken(token);
  if (localUid) return localUid;

  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    const lookedUp = await verifyFirebaseTokenViaIdentityToolkit(token);
    return lookedUp?.uid || null;
  }
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const uid = await resolveUidFromHeader(req);
  if (!uid) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  req.uid = uid;
  next();
}

function canViewerAccessAuthorContent(authorUid: string, viewerUid: string | null): boolean {
  const author = store.usersPublic[authorUid];
  if (!author) return false;
  if (viewerUid && author.uid === viewerUid) return true;
  if (author.isDeactivated) return false;
  if (!author.isPrivate) return true;
  if (!viewerUid) return false;
  return (store.followingByUser[viewerUid] || []).includes(authorUid);
}

function buildStateForUser(viewerUid: string | null) {
  const nowMs = Date.now();
  const activeCreators = Object.values(store.usersPublic)
    .filter((u) => {
      const acct = store.accounts.find((a) => a.uid === u.uid);
      if (acct?.deleted) return false;
      return true;
    })
    .map((u) => {
      // Auto-check temporary deactivation expiry
      if (u.isDeactivated && u.deactivatedUntil && Date.parse(u.deactivatedUntil) <= nowMs) {
        u.isDeactivated = false;
        u.deactivatedUntil = null;
      }
      if (u.isDeactivated && u.uid !== viewerUid) {
        return {
          ...u,
          displayName: 'SocialVerse User',
          username: 'socialverse_user',
          bio: '',
          dateOfBirth: undefined,
          photoUrl: '',
          coverUrl: '',
          onlineStatus: 'offline' as const,
        };
      }
      return u;
    });

  const viewerFollowing = viewerUid ? store.followingByUser[viewerUid] || [] : [];
  const viewerFollowers = viewerUid ? store.followersByUser[viewerUid] || [] : [];
  const likedSet = new Set(viewerUid ? store.likedPostIdsByUser[viewerUid] || [] : []);
  const savedSet = new Set(viewerUid ? store.savedPostIdsByUser[viewerUid] || [] : []);

  const visiblePosts = store.posts
    .filter((p) => {
      const author = store.usersPublic[p.authorId];
      if (!author || author.isDeactivated) return false;
      if (p.authorId === viewerUid) return true;
      if (p.visibility === 'only_me') return false;
      if (author.isPrivate && !viewerFollowing.includes(p.authorId)) return false;
      if (p.visibility === 'followers' && !viewerFollowing.includes(p.authorId)) return false;
      return true;
    })
    .map((p) => ({
      ...p,
      likedByMe: likedSet.has(p.id),
      savedByMe: savedSet.has(p.id),
    }));

  const activeStories = store.stories
    .filter((s) => {
      const exp = Date.parse(s.expiresAt);
      if (Number.isNaN(exp) || exp <= nowMs) return false;
      const author = store.usersPublic[s.authorId];
      if (!author || author.isDeactivated) return false;
      if (s.authorId === viewerUid) return true;
      if (!viewerUid) return false;
      if (s.privacy === 'close_friends') {
        return Boolean(store.usersPrivate[s.authorId]?.closeFriendUids?.includes(viewerUid));
      }
      if (author.isPrivate && !viewerFollowing.includes(s.authorId)) return false;
      if (s.privacy !== 'everyone' && !viewerFollowing.includes(s.authorId)) return false;
      return true;
    })
    .map((s) => ({
      ...s,
      viewerInCloseFriends:
        s.privacy === 'close_friends' &&
        Boolean(
          viewerUid &&
            (s.authorId === viewerUid ||
              store.usersPrivate[s.authorId]?.closeFriendUids?.includes(viewerUid))
        ),
    }));

  const visibleHighlights = (store.storyHighlights || []).filter((h) => {
    const author = store.usersPublic[h.ownerUid];
    if (!author || author.isDeactivated) return false;
    if (h.ownerUid === viewerUid) return true;
    if (author.isPrivate && !viewerFollowing.includes(h.ownerUid)) return false;
    return true;
  });

  const activeNotes = store.notes
    .filter((n) => {
      if (Date.parse(n.expiresAt) <= nowMs) return false;
      const author = store.usersPublic[n.authorUid];
      if (!author || author.isDeactivated) return false;
      if (n.authorUid === viewerUid) return true;
      if (!viewerUid) return false;
      if (n.audience === 'close_friends') {
        return Boolean(store.usersPrivate[n.authorUid]?.closeFriendUids?.includes(viewerUid));
      }
      if (author.isPrivate && !viewerFollowing.includes(n.authorUid)) return false;
      return true;
    })
    .map((n) => ({
      ...n,
      viewerInCloseFriends:
        n.audience === 'close_friends' &&
        Boolean(
          viewerUid &&
            (n.authorUid === viewerUid ||
              store.usersPrivate[n.authorUid]?.closeFriendUids?.includes(viewerUid))
        ),
    }));

  const userChats = viewerUid
    ? store.chats.filter(
        (c) => c.participantIds.includes(viewerUid) && !(c.deletedByUids || []).includes(viewerUid)
      )
    : [];

  const messagesByChat: Record<string, ChatMessage[]> = {};
  userChats.forEach((c) => {
    const rawMsgs = store.messagesByChat[c.id] || [];
    const clearedBeforeMs =
      viewerUid && c.clearedBeforeByUid?.[viewerUid]
        ? Date.parse(c.clearedBeforeByUid[viewerUid])
        : 0;
    const maxAgeMs =
      c.disappearingMode === '24h'
        ? 24 * 3_600_000
        : c.disappearingMode === '7d'
        ? 7 * 24 * 3_600_000
        : null;
    messagesByChat[c.id] = rawMsgs.filter((m) => {
      const createdMs = Date.parse(m.createdAt);
      if (clearedBeforeMs && !Number.isNaN(createdMs) && createdMs <= clearedBeforeMs) return false;
      if (maxAgeMs && !Number.isNaN(createdMs) && nowMs - createdMs > maxAgeMs) return false;
      return true;
    });
  });

  const userRequests = viewerUid
    ? store.friendRequests.filter((r) => r.toUid === viewerUid || r.fromUid === viewerUid)
    : [];

  const userNotifications = viewerUid
    ? store.notifications.filter((n) => n.recipientUid === viewerUid)
    : [];

  const favoriteStickerIds = viewerUid ? store.favoriteStickersByUser[viewerUid] || [] : [];

  const visiblePostIds = new Set(visiblePosts.map((p) => p.id));
  const filteredCommentsByPost: Record<string, PostComment[]> = {};
  for (const [postId, list] of Object.entries(store.commentsByPost)) {
    if (visiblePostIds.has(postId)) {
      filteredCommentsByPost[postId] = list;
    }
  }

  return {
    currentUser: viewerUid ? store.usersPublic[viewerUid] || null : null,
    userPrivate: viewerUid ? store.usersPrivate[viewerUid] || null : null,
    creators: activeCreators,
    posts: visiblePosts,
    commentsByPost: filteredCommentsByPost,
    stories: activeStories,
    storyHighlights: visibleHighlights,
    chats: userChats,
    messagesByChat,
    notes: activeNotes,
    stickers: store.stickers,
    favoriteStickerIds,
    broadcastChannels: store.broadcastChannels,
    followingIds: viewerFollowing,
    followerIds: viewerFollowers,
    friendRequests: userRequests,
    notifications: userNotifications,
  };
}

// WebSocket Client Registry
const wsClientsByUid = new Map<string, Set<WebSocket>>();

function sendWsToUser(uid: string, payload: unknown) {
  const sockets = wsClientsByUid.get(uid);
  if (!sockets) return;
  const serialized = JSON.stringify(payload);
  for (const sock of sockets) {
    if (sock.readyState === sock.OPEN) {
      sock.send(serialized);
    }
  }
}

function broadcastWsEvent(uids: string[], payload: unknown) {
  const unique = new Set(uids);
  unique.forEach((uid) => sendWsToUser(uid, payload));
}

function broadcastGlobalSync() {
  for (const [uid, sockets] of wsClientsByUid.entries()) {
    const serialized = JSON.stringify({ type: 'state:sync', state: buildStateForUser(uid) });
    for (const sock of sockets) {
      if (sock.readyState === sock.OPEN) {
        sock.send(serialized);
      }
    }
  }
}

function emitNotification(params: {
  recipientUid: string;
  actorUid: string;
  type: AppNotification['type'];
  summary: string;
  targetId?: string;
  isMutedChat?: boolean;
}) {
  const { recipientUid, actorUid, type, summary, targetId, isMutedChat = false } = params;
  if (!recipientUid || recipientUid === actorUid) return;
  const actor = store.usersPublic[actorUid];
  if (!actor) return;
  const recipientPriv = store.usersPrivate[recipientUid];
  if (!shouldNotifyUser(recipientPriv?.notificationPrefs, type, isMutedChat)) return;
  const notif: AppNotification = {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    recipientUid,
    actorUid,
    actorUsername: actor.username,
    actorAvatar: actor.photoUrl,
    type,
    summary,
    targetId,
    read: false,
    createdAt: new Date().toISOString(),
  };
  store.notifications.unshift(notif);
  if (store.notifications.length > 500) {
    store.notifications.length = 500;
  }
  sendWsToUser(recipientUid, { type: 'notification:new', notification: notif });
}

function emitMentionNotifications(params: {
  actorUid: string;
  text: string;
  summaryPrefix: string;
  targetId?: string;
  skipMentions?: Set<string>;
}) {
  const { actorUid, text, summaryPrefix, targetId, skipMentions } = params;
  const mentionedUsernames = extractMentions(text);
  for (const uname of mentionedUsernames) {
    if (skipMentions?.has(uname)) continue;
    const target = Object.values(store.usersPublic).find(
      (u) => !u.isDeactivated && u.username.toLowerCase() === uname
    );
    if (target && target.uid !== actorUid) {
      emitNotification({
        recipientUid: target.uid,
        actorUid,
        type: 'mention',
        summary: summaryPrefix,
        targetId,
      });
    }
  }
}

async function startServer() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });

  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      next();
    },
    express.static(UPLOADS_DIR)
  );

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'socialverse-api',
      projectId: firebaseConfig.projectId,
      smtpConfigured: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    });
  });

  // Chunked Binary Media Upload API (bypasses base64 bloat & proxy body size caps)
  app.post('/api/uploads/init', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const { fileName = 'media.bin', mimeType = 'application/octet-stream', totalBytes } = req.body as {
      fileName?: string;
      mimeType?: string;
      totalBytes?: number;
    };
    const numericBytes = Number(totalBytes);
    if (!isAllowedUploadMime(mimeType, fileName)) {
      res.status(400).json({ error: 'Unsupported or unsafe file type.' });
      return;
    }
    const sizeCheck = validateMediaFileSize(numericBytes, mimeType, 'en');
    if (!sizeCheck.valid) {
      res.status(413).json({ error: sizeCheck.reason || 'File exceeds maximum upload limit.' });
      return;
    }

    // Prune expired upload sessions (> 1 hour)
    const nowMs = Date.now();
    for (const [id, sess] of pendingUploadSessions.entries()) {
      if (nowMs - sess.createdAtMs > 3_600_000) {
        pendingUploadSessions.delete(id);
        fs.rmSync(path.join(UPLOAD_TMP_DIR, id), { recursive: true, force: true });
      }
    }

    const uploadId = `up_${nowMs}_${crypto.randomBytes(6).toString('hex')}`;
    const expectedChunks = Math.max(1, Math.ceil(numericBytes / UPLOAD_CHUNK_SIZE_BYTES));
    fs.mkdirSync(path.join(UPLOAD_TMP_DIR, uploadId), { recursive: true });
    pendingUploadSessions.set(uploadId, {
      uploadId,
      uid,
      fileName: String(fileName).slice(0, 180),
      mimeType: String(mimeType).slice(0, 120),
      totalBytes: numericBytes,
      expectedChunks,
      receivedChunks: new Set(),
      receivedBytes: 0,
      createdAtMs: nowMs,
    });
    res.json({ uploadId, chunkSize: UPLOAD_CHUNK_SIZE_BYTES, expectedChunks });
  });

  app.post(
    '/api/uploads/chunk',
    requireAuth,
    express.raw({ type: 'application/octet-stream', limit: '4mb' }),
    (req: AuthenticatedRequest, res) => {
      const uid = req.uid!;
      const uploadId = String(req.headers['x-upload-id'] || req.query.uploadId || '').trim();
      const indexRaw = req.headers['x-chunk-index'] ?? req.query.index;
      const chunkIndex = Number(indexRaw);
      if (!uploadId || !/^[a-zA-Z0-9_-]{8,80}$/.test(uploadId)) {
        res.status(400).json({ error: 'Invalid uploadId.' });
        return;
      }
      const session = pendingUploadSessions.get(uploadId);
      if (!session || session.uid !== uid) {
        res.status(404).json({ error: 'Upload session not found or expired.' });
        return;
      }
      if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.expectedChunks) {
        res.status(400).json({ error: 'Invalid chunk index.' });
        return;
      }
      const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (buf.length === 0) {
        res.status(400).json({ error: 'Empty chunk payload.' });
        return;
      }
      if (!session.receivedChunks.has(chunkIndex)) {
        if (session.receivedBytes + buf.length > session.totalBytes + 4096) {
          res.status(413).json({ error: 'Uploaded data exceeded declared file size.' });
          return;
        }
        session.receivedBytes += buf.length;
      }
      const partPath = path.join(UPLOAD_TMP_DIR, uploadId, `${chunkIndex}.part`);
      fs.writeFileSync(partPath, buf);
      session.receivedChunks.add(chunkIndex);
      res.json({
        ok: true,
        chunkIndex,
        receivedChunks: session.receivedChunks.size,
        expectedChunks: session.expectedChunks,
      });
    }
  );

  app.post('/api/uploads/complete', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const { uploadId } = req.body as { uploadId?: string };
    const cleanId = String(uploadId || '').trim();
    const session = pendingUploadSessions.get(cleanId);
    if (!session || session.uid !== uid) {
      res.status(404).json({ error: 'Upload session not found or expired.' });
      return;
    }
    if (session.receivedChunks.size < session.expectedChunks) {
      res.status(400).json({
        error: `Upload incomplete (${session.receivedChunks.size}/${session.expectedChunks} chunks received).`,
      });
      return;
    }

    const ext = resolveSafeUploadExtension(session.mimeType, session.fileName);
    const finalName = `${cleanId}.${ext}`;
    const finalPath = path.join(UPLOADS_DIR, finalName);
    const tmpDir = path.join(UPLOAD_TMP_DIR, cleanId);

    try {
      const fd = fs.openSync(finalPath, 'w');
      try {
        for (let i = 0; i < session.expectedChunks; i++) {
          const partPath = path.join(tmpDir, `${i}.part`);
          const chunkBuf = fs.readFileSync(partPath);
          fs.writeSync(fd, chunkBuf);
        }
      } finally {
        fs.closeSync(fd);
      }
      pendingUploadSessions.delete(cleanId);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      const stat = fs.statSync(finalPath);
      res.json({
        url: `/uploads/${finalName}`,
        mimeType: session.mimeType,
        size: stat.size,
      });
    } catch (err) {
      try {
        fs.rmSync(finalPath, { force: true });
      } catch {
        // ignore cleanup error
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to assemble uploaded file.',
      });
    }
  });

  // Live username availability check (local store + Cloud Firestore)
  app.get('/api/users/check-username', async (req, res) => {
    const raw = String(req.query.username || '');
    const excludeUid = String(req.query.excludeUid || '');
    const normalized = normalizeUsername(raw);
    if (!isValidUsername(normalized)) {
      res.json({ available: false, normalized, reason: 'invalid' });
      return;
    }
    let taken = store.accounts.some(
      (a) => !a.deleted && a.username === normalized && a.uid !== excludeUid
    );
    if (!taken) {
      const claimDoc = await firestoreGetDoc(`usernames/${normalized}`);
      if (claimDoc && claimDoc.uid && claimDoc.uid !== excludeUid) {
        taken = true;
      }
    }
    res.json({
      available: !taken,
      normalized,
      reason: taken ? 'taken' : undefined,
    });
  });

  // Send 6-digit OTP via Gmail SMTP (Nodemailer) with strict disposable-email blocking & 1-Gmail-1-account enforcement
  app.post('/api/auth/send-otp', async (req, res) => {
    try {
      const { email, purpose = 'signup', language = 'en' } = req.body as {
        email?: string;
        purpose?: 'signup' | 'reset' | '2fa' | 'change_email';
        language?: 'en' | 'bn';
      };

      let cleanEmail = (email || '').trim().toLowerCase();
      let canonicalEmail = canonicalizeEmail(cleanEmail);

      let requesterUid: string | null = null;
      if (purpose === 'change_email') {
        requesterUid = await resolveUidFromHeader(req);
        if (!requesterUid) {
          res.status(401).json({ error: 'Authentication required to change email.' });
          return;
        }
      }

      if (purpose === 'signup' || purpose === 'change_email') {
        const check = validateSignupEmail(email || '', language);
        if (!check.valid) {
          res.status(400).json({
            error: check.reason || 'Please enter a valid permanent email address.',
            code: isDisposableEmail(email || '') ? 'DISPOSABLE_EMAIL' : 'UNSUPPORTED_EMAIL',
          });
          return;
        }
        cleanEmail = check.cleanEmail;
        canonicalEmail = check.canonicalEmail;

        const domainCheck = await verifyDomainCanReceiveEmail(cleanEmail);
        if (!domainCheck.valid) {
          if (domainCheck.reason === 'disposable') {
            res.status(400).json({
              error:
                language === 'bn'
                  ? 'টেম্পোরারি বা ডিসপোজেবল ইমেইল অনুমোদিত নয়। শুধুমাত্র আসল Gmail, Yahoo, Hotmail বা Outlook ব্যবহার করুন।'
                  : 'This disposable email is not allowed. Please use a real Gmail, Yahoo, Hotmail, or Outlook address.',
              code: 'DISPOSABLE_EMAIL',
            });
            return;
          }
          res.status(400).json({
            error:
              language === 'bn'
                ? 'এই ইমেইল ডোমেইনটি কার্যকর নয়। আপনার আসল Gmail, Yahoo, Hotmail বা Outlook ব্যবহার করুন।'
                : 'This email domain cannot receive verification mail. Use a valid Gmail, Yahoo, Hotmail, or Outlook address.',
            code: 'INVALID_DOMAIN',
          });
          return;
        }
      } else {
        if (!isValidEmail(cleanEmail)) {
          res.status(400).json({
            error: language === 'bn' ? 'সঠিক ইমেইল ঠিকানা লিখুন।' : 'Please enter a valid email address.',
            code: 'INVALID_EMAIL',
          });
          return;
        }
        if (isDisposableEmail(cleanEmail)) {
          res.status(400).json({
            error:
              language === 'bn'
                ? 'টেম্পোরারি বা ডিসপোজেবল ইমেইল অনুমোদিত নয়।'
                : 'Temporary or disposable email addresses are not allowed.',
            code: 'DISPOSABLE_EMAIL',
          });
          return;
        }
      }

      const emailHash = sha256Hex(canonicalEmail);
      const localMatch = store.accounts.find(
        (a) =>
          !a.deleted &&
          (a.email === cleanEmail || (a.canonicalEmail || canonicalizeEmail(a.email)) === canonicalEmail)
      );
      const remoteClaim = !localMatch ? await firestoreGetDoc(`email_claims/${emailHash}`) : null;
      const authUriRes =
        (purpose === 'signup' || purpose === 'change_email') && !localMatch && !(remoteClaim && remoteClaim.uid)
          ? await firebaseAuthPost<{ registered?: boolean }>('accounts:createAuthUri', {
              identifier: cleanEmail,
              continueUri: 'http://localhost:3000',
            }).catch(() => null)
          : null;
      const accountExists = Boolean(localMatch || (remoteClaim && remoteClaim.uid) || authUriRes?.registered);

      if (purpose === 'change_email' && requesterUid) {
        const myAcct = store.accounts.find((a) => !a.deleted && a.uid === requesterUid);
        if (
          myAcct &&
          (myAcct.email === cleanEmail ||
            (myAcct.canonicalEmail || canonicalizeEmail(myAcct.email)) === canonicalEmail)
        ) {
          res.status(400).json({
            error:
              language === 'bn'
                ? 'নতুন ইমেইলটি আপনার বর্তমান ইমেইলের মতোই।'
                : 'Please enter a different email address from your current one.',
          });
          return;
        }
        const ownedByOther =
          (localMatch && localMatch.uid !== requesterUid) ||
          (remoteClaim && typeof remoteClaim.uid === 'string' && remoteClaim.uid !== requesterUid) ||
          Boolean(authUriRes?.registered && (!myAcct || myAcct.email !== cleanEmail));
        if (ownedByOther) {
          res.status(409).json({
            error:
              language === 'bn'
                ? 'এই ইমেইলটি ইতিমধ্যে অন্য একটি অ্যাকাউন্টে ব্যবহৃত হচ্ছে।'
                : 'This email address is already registered to another account.',
            code: 'EMAIL_ALREADY_EXISTS',
          });
          return;
        }
      }

      if (purpose === 'signup' && accountExists) {
        const resolvedExistingEmail =
          localMatch?.email ||
          (remoteClaim && typeof remoteClaim.encEmail === 'string'
            ? decryptLookupEmail(remoteClaim.encEmail) || cleanEmail
            : cleanEmail);
        res.status(409).json({
          error:
            language === 'bn'
              ? 'এই ইমেইলটি ইতিমধ্যেই ভেরিফাই করা এবং এটি দিয়ে একটি অ্যাকাউন্ট খোলা আছে — অনুগ্রহ করে সাইন ইন করুন অথবা নতুন ইমেইল ব্যবহার করুন।'
              : 'This email is already verified and registered to an account — please sign in or use a different email.',
          code: 'EMAIL_ALREADY_EXISTS',
          alreadyVerified: true,
          existingEmail: resolvedExistingEmail,
        });
        return;
      }

      if (purpose === 'reset' && !accountExists) {
        res.status(404).json({
          error:
            language === 'bn'
              ? 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।'
              : 'No account found with that email address.',
        });
        return;
      }

      const code = String(crypto.randomInt(100000, 1000000));
      const key = `${purpose}:${cleanEmail}`;
      otpRecords.set(key, {
        email: cleanEmail,
        purpose,
        codeHash: hashOtp(code),
        expiresAt: Date.now() + 10 * 60_000,
      });
      persistStoreImmediate();

      const { sentViaSmtp } = await sendOtpEmail(cleanEmail, code, purpose);
      res.json({
        ok: true,
        sentViaSmtp,
        ...(sentViaSmtp ? {} : { devOtpCode: code }),
      });
    } catch (err) {
      console.error('OTP send error:', err);
      res.status(500).json({
        error: 'Could not deliver verification code right now. Please verify your email address and retry.',
      });
    }
  });

  // Verify 6-digit OTP
  app.post('/api/auth/verify-otp', (req, res) => {
    const { email, code, purpose = 'signup' } = req.body as {
      email?: string;
      code?: string;
      purpose?: 'signup' | 'reset' | '2fa' | 'change_email';
    };
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();
    const key = `${purpose}:${cleanEmail}`;
    const record = otpRecords.get(key);
    if (!record || record.expiresAt < Date.now()) {
      res.status(400).json({ error: 'Verification code expired or not found. Please request a new code.' });
      return;
    }
    if (record.codeHash !== hashOtp(cleanCode)) {
      res.status(400).json({ error: 'Invalid 6-digit verification code.' });
      return;
    }
    otpRecords.delete(key);

    const verificationToken = crypto.randomBytes(24).toString('hex');
    verificationGrants.set(verificationToken, {
      token: verificationToken,
      email: cleanEmail,
      purpose,
      expiresAt: Date.now() + 20 * 60_000,
    });
    persistStoreImmediate();

    res.json({ ok: true, verificationToken });
  });

  // Register account after OTP verification + Nickname/Font + Unique Username (persisted to Firebase Auth + Firestore + disk)
  app.post('/api/auth/register', async (req, res) => {
    try {
      const {
        verificationToken,
        email,
        password,
        displayName,
        nicknameFont = 'classic',
        username,
        dateOfBirth,
        photoUrl = '',
        language = 'en',
      } = req.body as {
        verificationToken?: string;
        email?: string;
        password?: string;
        displayName?: string;
        nicknameFont?: NicknameFontStyle;
        username?: string;
        dateOfBirth?: string;
        photoUrl?: string;
        language?: 'en' | 'bn';
      };

      const emailCheck = validateSignupEmail(email || '', language === 'bn' ? 'bn' : 'en');
      if (!emailCheck.valid) {
        res.status(400).json({
          error: emailCheck.reason || 'Temporary or invalid email is not allowed.',
          code: isDisposableEmail(email || '') ? 'DISPOSABLE_EMAIL' : 'INVALID_EMAIL',
        });
        return;
      }

      const { cleanEmail, canonicalEmail } = emailCheck;
      const domainCheck = await verifyDomainCanReceiveEmail(cleanEmail);
      if (!domainCheck.valid) {
        res.status(400).json({
          error:
            domainCheck.reason === 'disposable'
              ? language === 'bn'
                ? 'টেম্পোরারি বা ডিসপোজেবল ইমেইল অনুমোদিত নয়। আপনার আসল Gmail বা স্থায়ী ইমেইল ব্যবহার করুন।'
                : 'Temporary or disposable email addresses are not allowed. Please use a real Gmail or permanent email.'
              : language === 'bn'
              ? 'এই ইমেইল ডোমেইনটি কার্যকর নয়। আপনার আসল Gmail বা স্থায়ী ইমেইল ব্যবহার করুন।'
              : 'This email domain cannot receive verification mail. Use a valid Gmail or permanent email.',
          code: domainCheck.reason === 'disposable' ? 'DISPOSABLE_EMAIL' : 'INVALID_DOMAIN',
        });
        return;
      }

      const grant = verificationToken ? verificationGrants.get(verificationToken) : undefined;
      if (!grant || grant.email !== cleanEmail || grant.purpose !== 'signup' || grant.expiresAt < Date.now()) {
        res.status(403).json({ error: 'Email verification required before completing sign up.' });
        return;
      }

      if (!password || password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters.' });
        return;
      }

      const cleanDisplayName = (displayName || '').trim();
      if (!isValidDisplayName(cleanDisplayName)) {
        res.status(400).json({ error: 'Nickname must be 1–50 characters.' });
        return;
      }

      const cleanUsername = normalizeUsername(username || '');
      if (!isValidUsername(cleanUsername)) {
        res.status(400).json({ error: 'Username must be 3–24 lowercase letters, numbers, or underscores.' });
        return;
      }

      const dobCheck = isValidDateOfBirth(dateOfBirth || '');
      if (!dobCheck.valid) {
        const dobErrorMsg =
          dobCheck.reason === 'too_young'
            ? language === 'bn'
              ? 'অ্যাকাউন্ট খুলতে আপনার বয়স কমপক্ষে ১৩ বছর হতে হবে।'
              : 'You must be at least 13 years old to create an account.'
            : dobCheck.reason === 'future'
            ? language === 'bn'
              ? 'জন্মতারিখ ভবিষ্যতের তারিখ হতে পারবে না।'
              : 'Date of birth cannot be in the future.'
            : language === 'bn'
            ? 'অনুগ্রহ করে সঠিক জন্মতারিখ নির্বাচন করুন।'
            : 'Please select a valid date of birth (YYYY-MM-DD).';
        res.status(400).json({ error: dobErrorMsg });
        return;
      }

      const emailHash = sha256Hex(canonicalEmail);
      const localEmailMatch = store.accounts.find(
        (a) =>
          !a.deleted &&
          (a.email === cleanEmail || (a.canonicalEmail || canonicalizeEmail(a.email)) === canonicalEmail)
      );
      const remoteEmailClaim = !localEmailMatch ? await firestoreGetDoc(`email_claims/${emailHash}`) : null;
      if (localEmailMatch || (remoteEmailClaim && remoteEmailClaim.uid)) {
        const existingEmail =
          localEmailMatch?.email ||
          (remoteEmailClaim && typeof remoteEmailClaim.encEmail === 'string'
            ? decryptLookupEmail(remoteEmailClaim.encEmail) || cleanEmail
            : cleanEmail);
        res.status(409).json({
          error:
            language === 'bn'
              ? 'একটি Gmail / ইমেইল দিয়ে শুধুমাত্র একটি অ্যাকাউন্ট খোলা যাবে। এই ইমেইলে ইতিমধ্যেই অ্যাকাউন্ট আছে — অনুগ্রহ করে সাইন ইন করুন।'
              : 'Only one account is allowed per Gmail/email. An account with this email already exists — please sign in.',
          code: 'EMAIL_ALREADY_EXISTS',
          existingEmail,
        });
        return;
      }

      const localUsernameTaken = store.accounts.some((a) => !a.deleted && a.username === cleanUsername);
      const remoteUsernameClaim = !localUsernameTaken
        ? await firestoreGetDoc(`usernames/${cleanUsername}`)
        : null;
      if (localUsernameTaken || (remoteUsernameClaim && remoteUsernameClaim.uid)) {
        res.status(409).json({ error: 'Username is already taken.' });
        return;
      }

      // Create user in Firebase Auth so account survives container restarts & deployments (retry once on transient error)
      let fbRes: {
        localId: string;
        idToken: string;
        refreshToken: string;
        email: string;
      } | null = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          fbRes = await firebaseAuthPost<{
            localId: string;
            idToken: string;
            refreshToken: string;
            email: string;
          }>('accounts:signUp', {
            email: cleanEmail,
            password,
            displayName: cleanDisplayName,
            returnSecureToken: true,
          });
          break;
        } catch (fbErr) {
          const msg = fbErr instanceof Error ? fbErr.message : '';
          if (msg.includes('EMAIL_EXISTS')) {
            res.status(409).json({
              error:
                language === 'bn'
                  ? 'একটি Gmail / ইমেইল দিয়ে শুধুমাত্র একটি অ্যাকাউন্ট খোলা যাবে। এই ইমেইলে ইতিমধ্যেই অ্যাকাউন্ট আছে — অনুগ্রহ করে সাইন ইন করুন।'
                  : 'Only one account is allowed per Gmail/email. An account with this email already exists — please sign in.',
              code: 'EMAIL_ALREADY_EXISTS',
              existingEmail: cleanEmail,
            });
            return;
          }
          if (msg.includes('WEAK_PASSWORD')) {
            res.status(400).json({ error: 'Password must be at least 6 characters.' });
            return;
          }
          if (msg.includes('INVALID_EMAIL')) {
            res.status(400).json({ error: 'Please enter a valid permanent email address.' });
            return;
          }
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 300));
            continue;
          }
          console.error('Firebase signUp error:', msg);
          res.status(503).json({
            error:
              language === 'bn'
                ? 'অ্যাকাউন্ট তৈরি করতে সাময়িক সমস্যা হচ্ছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
                : 'Could not reach authentication service to create your account. Please retry.',
          });
          return;
        }
      }

      if (!fbRes) {
        res.status(503).json({ error: 'Could not create account. Please retry.' });
        return;
      }

      const uid = fbRes.localId;
      const firebaseIdToken = fbRes.idToken;
      const firebaseRefreshToken = fbRes.refreshToken;
      const nowIso = new Date().toISOString();
      const passwordHash = await bcrypt.hash(password, 10);

      const userPublic: UserPublic = {
        uid,
        username: cleanUsername,
        displayName: cleanDisplayName,
        nicknameFont,
        bio: '',
        pronouns: '',
        website: '',
        noteText: '',
        dateOfBirth: dobCheck.normalized,
        photoUrl: photoUrl || '',
        coverUrl: '',
        interests: [],
        isPrivate: false,
        isDeactivated: false,
        deactivatedUntil: null,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        onlineStatus: 'online',
        lastSeenAt: nowIso,
        lastNicknameChangedAt: null,
        lastUsernameChangedAt: null,
        onboardingCompleted: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const userPrivate: UserPrivate = {
        uid,
        email: cleanEmail,
        language: language === 'bn' ? 'bn' : 'en',
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
        updatedAt: nowIso,
      };

      // Persist to Cloud Firestore BEFORE committing locally/consuming verificationToken
      let firestoreResult = await createUserDocsInFirestore({
        uid,
        userPublic,
        userPrivate,
        canonicalEmail,
        idToken: firebaseIdToken,
      });
      if (!firestoreResult.ok) {
        await new Promise((r) => setTimeout(r, 250));
        firestoreResult = await createUserDocsInFirestore({
          uid,
          userPublic,
          userPrivate,
          canonicalEmail,
          idToken: firebaseIdToken,
        });
      }
      if (!firestoreResult.ok) {
        // Roll back newly created Firebase Auth user so email isn't left orphaned without Firestore docs
        await firebaseAuthPost('accounts:delete', { idToken: firebaseIdToken }).catch(() => {});
        res.status(503).json({
          error:
            language === 'bn'
              ? 'ডাটাবেস সংরক্ষণে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
              : 'Could not save your profile to Cloud Firestore. Please retry.',
        });
        return;
      }

      // Remove any stale deleted local entry with the same uid/email/username before pushing fresh record
      store.accounts = store.accounts.filter((a) => a.uid !== uid);
      store.accounts.push({
        uid,
        email: cleanEmail,
        canonicalEmail,
        username: cleanUsername,
        passwordHash,
        firebaseRefreshToken,
        createdAt: nowIso,
      });
      store.usersPublic[uid] = userPublic;
      store.usersPrivate[uid] = userPrivate;

      // Consume verification token ONLY after Firebase Auth + Firestore + store creation succeeds
      verificationGrants.delete(verificationToken!);
      persistStoreImmediate();

      broadcastGlobalSync();

      const token = signSessionToken(uid);
      res.json({ token, user: userPublic, userPrivate });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Could not complete registration. Please try again.' });
    }
  });

  // Sign In with Email (or Gmail dot/plus alias) OR Username + Password — with automatic Firebase Auth + Firestore recovery
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { identifier, password } = req.body as { identifier?: string; password?: string };
      const rawId = (identifier || '').trim().toLowerCase();
      if (!rawId || !password) {
        res.status(400).json({ error: 'Enter your email or username and password.' });
        return;
      }

      const isEmailInput = rawId.indexOf('@') > 0;
      const rawCanonical = isEmailInput ? canonicalizeEmail(rawId) : '';
      const rawUsername = normalizeUsername(rawId.replace(/^@+/, ''));

      const pubMatchUid =
        !isEmailInput && rawUsername
          ? Object.values(store.usersPublic).find(
              (u) => u.username.toLowerCase() === rawUsername
            )?.uid
          : undefined;

      let acct = store.accounts.find(
        (a) =>
          !a.deleted &&
          (a.email === rawId ||
            (rawCanonical && (a.canonicalEmail || canonicalizeEmail(a.email)) === rawCanonical) ||
            (!isEmailInput &&
              (a.username.toLowerCase() === rawUsername ||
                (pubMatchUid && a.uid === pubMatchUid))))
      );

      let passwordValid = acct ? await bcrypt.compare(password, acct.passwordHash) : false;

      // Fallback / Cross-container Recovery via Firebase Auth + Cloud Firestore
      if (!acct || !passwordValid) {
        const candidateEmails: string[] = [];
        const fallbackUsername = rawUsername;

        if (acct?.email) {
          candidateEmails.push(acct.email);
        }
        if (pubMatchUid) {
          const privEmail = store.usersPrivate[pubMatchUid]?.email;
          if (privEmail) candidateEmails.push(privEmail);
        }
        if (isEmailInput) {
          const claim = await firestoreGetDoc(`email_claims/${sha256Hex(rawCanonical)}`);
          if (claim && typeof claim.encEmail === 'string') {
            const dec = decryptLookupEmail(claim.encEmail);
            if (dec) candidateEmails.push(dec);
          }
          candidateEmails.push(rawId);
          if (rawCanonical && rawCanonical !== rawId) {
            candidateEmails.push(rawCanonical);
          }
        } else if (isValidUsername(rawUsername)) {
          const usernameDoc = await firestoreGetDoc(`usernames/${rawUsername}`);
          if (usernameDoc && typeof usernameDoc.encEmail === 'string') {
            const dec = decryptLookupEmail(usernameDoc.encEmail);
            if (dec) candidateEmails.push(dec);
          }
          const resolvedUid =
            (usernameDoc && typeof usernameDoc.uid === 'string' && usernameDoc.uid) || pubMatchUid;
          if (resolvedUid) {
            const localUidAcct = store.accounts.find((a) => !a.deleted && a.uid === resolvedUid);
            if (localUidAcct?.email) candidateEmails.push(localUidAcct.email);
            const localPrivEmail = store.usersPrivate[resolvedUid]?.email;
            if (localPrivEmail) candidateEmails.push(localPrivEmail);
            try {
              const adminUser = await getAuth().getUser(resolvedUid);
              if (adminUser.email) candidateEmails.push(adminUser.email);
            } catch {
              // Admin SDK lookup optional fallback
            }
          }
        }

        const uniqueCandidateEmails = Array.from(
          new Set(candidateEmails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))
        );

        let fbLogin: {
          localId: string;
          idToken: string;
          refreshToken: string;
          email: string;
        } | null = null;

        for (const candidateEmail of uniqueCandidateEmails) {
          try {
            fbLogin = await firebaseAuthPost<{
              localId: string;
              idToken: string;
              refreshToken: string;
              email: string;
            }>('accounts:signInWithPassword', {
              email: candidateEmail,
              password,
              returnSecureToken: true,
            });
            break;
          } catch {
            // Try next candidate email
          }
        }

        if (fbLogin) {
          const recoveredUid = fbLogin.localId;
          const recoveredEmail = (fbLogin.email || uniqueCandidateEmails[0]).trim().toLowerCase();
          const recoveredCanonical = canonicalizeEmail(recoveredEmail);
          const freshHash = await bcrypt.hash(password, 10);

          // Hydrate public/private profile from Firestore if needed
          const [remotePub, remotePriv] = await Promise.all([
            firestoreGetDoc(`users/${recoveredUid}`, fbLogin.idToken),
            firestoreGetDoc(`users/${recoveredUid}/private/info`, fbLogin.idToken),
          ]);

          const nowIso = new Date().toISOString();
          const resolvedUsername =
            (remotePub && typeof remotePub.username === 'string' && remotePub.username) ||
            acct?.username ||
            (isValidUsername(fallbackUsername)
              ? fallbackUsername
              : normalizeUsername(recoveredEmail.split('@')[0]) || `user_${recoveredUid.slice(0, 6)}`);

          // Also check if another local record with the same uid exists (even if deleted flag was stale)
          if (!acct) {
            acct = store.accounts.find((a) => !a.deleted && a.uid === recoveredUid);
          }

          if (acct) {
            acct.email = recoveredEmail;
            acct.canonicalEmail = recoveredCanonical;
            acct.passwordHash = freshHash;
            acct.firebaseRefreshToken = fbLogin.refreshToken;
            acct.username = resolvedUsername;
            if (store.usersPrivate[recoveredUid]) {
              store.usersPrivate[recoveredUid].email = recoveredEmail;
            }
            passwordValid = true;
          } else {
            acct = {
              uid: recoveredUid,
              email: recoveredEmail,
              canonicalEmail: recoveredCanonical,
              username: resolvedUsername,
              passwordHash: freshHash,
              firebaseRefreshToken: fbLogin.refreshToken,
              createdAt:
                (remotePub && typeof remotePub.createdAt === 'string' && remotePub.createdAt) || nowIso,
            };
            store.accounts.push(acct);
            passwordValid = true;
          }

          if (!store.usersPublic[recoveredUid]) {
            const recPub: UserPublic = {
              uid: recoveredUid,
              username: resolvedUsername,
              displayName:
                (remotePub && typeof remotePub.displayName === 'string' && remotePub.displayName) ||
                resolvedUsername,
              nicknameFont:
                ((remotePub && remotePub.nicknameFont) as NicknameFontStyle) || 'classic',
              bio: (remotePub && typeof remotePub.bio === 'string' && remotePub.bio) || '',
              pronouns: (remotePub && typeof remotePub.pronouns === 'string' && remotePub.pronouns) || '',
              website: (remotePub && typeof remotePub.website === 'string' && remotePub.website) || '',
              noteText: (remotePub && typeof remotePub.noteText === 'string' && remotePub.noteText) || '',
              dateOfBirth:
                remotePub && typeof remotePub.dateOfBirth === 'string' ? remotePub.dateOfBirth : undefined,
              photoUrl: (remotePub && typeof remotePub.photoUrl === 'string' && remotePub.photoUrl) || '',
              coverUrl: (remotePub && typeof remotePub.coverUrl === 'string' && remotePub.coverUrl) || '',
              interests:
                remotePub && Array.isArray(remotePub.interests) ? (remotePub.interests as string[]) : [],
              isPrivate: Boolean(remotePub?.isPrivate),
              isDeactivated: Boolean(remotePub?.isDeactivated),
              deactivatedUntil:
                remotePub && typeof remotePub.deactivatedUntil === 'string' ? remotePub.deactivatedUntil : null,
              followersCount: Number(remotePub?.followersCount || 0),
              followingCount: Number(remotePub?.followingCount || 0),
              postsCount: Number(remotePub?.postsCount || 0),
              onlineStatus: 'online',
              lastSeenAt: nowIso,
              lastNicknameChangedAt:
                remotePub && typeof remotePub.lastNicknameChangedAt === 'string'
                  ? remotePub.lastNicknameChangedAt
                  : null,
              lastUsernameChangedAt:
                remotePub && typeof remotePub.lastUsernameChangedAt === 'string'
                  ? remotePub.lastUsernameChangedAt
                  : null,
              onboardingCompleted: true,
              createdAt:
                (remotePub && typeof remotePub.createdAt === 'string' && remotePub.createdAt) || nowIso,
              updatedAt: nowIso,
            };
            store.usersPublic[recoveredUid] = recPub;
          }

          if (!store.usersPrivate[recoveredUid]) {
            const recPriv: UserPrivate = {
              uid: recoveredUid,
              email: recoveredEmail,
              language: remotePriv?.language === 'bn' ? 'bn' : 'en',
              themeMode: remotePriv?.themeMode === 'dark' ? 'dark' : 'light',
              biometricLockEnabled: Boolean(remotePriv?.biometricLockEnabled),
              twoFactorEnabled: Boolean(remotePriv?.twoFactorEnabled),
              saveLoginInfo: remotePriv?.saveLoginInfo !== false,
              whoCanMessage:
                (remotePriv?.whoCanMessage as UserPrivate['whoCanMessage']) || 'everyone',
              whoCanViewStories:
                (remotePriv?.whoCanViewStories as UserPrivate['whoCanViewStories']) || 'everyone',
              whoCanFollow: (remotePriv?.whoCanFollow as UserPrivate['whoCanFollow']) || 'everyone',
              notificationPrefs: {
                ...DEFAULT_NOTIFICATION_PREFS,
                ...((remotePriv?.notificationPrefs as Partial<UserPrivate['notificationPrefs']>) || {}),
              },
              blockedUserIds: Array.isArray(remotePriv?.blockedUserIds)
                ? (remotePriv.blockedUserIds as string[])
                : [],
              mutedStoryUserIds: Array.isArray(remotePriv?.mutedStoryUserIds)
                ? (remotePriv.mutedStoryUserIds as string[])
                : [],
              closeFriendUids: Array.isArray(remotePriv?.closeFriendUids)
                ? (remotePriv.closeFriendUids as string[])
                : [],
              updatedAt: nowIso,
            };
            store.usersPrivate[recoveredUid] = recPriv;
          }

          // Backfill only missing docs (users, private/info, usernames, email_claims) safely
          await createUserDocsInFirestore({
            uid: recoveredUid,
            userPublic: store.usersPublic[recoveredUid],
            userPrivate: store.usersPrivate[recoveredUid],
            canonicalEmail: recoveredCanonical,
            idToken: fbLogin.idToken,
          });
        }
      }

      if (!acct || !passwordValid) {
        res.status(401).json({ error: 'Incorrect email/username or password.' });
        return;
      }

      const priv = store.usersPrivate[acct.uid];
      if (priv?.twoFactorEnabled) {
        const code = String(crypto.randomInt(100000, 1000000));
        otpRecords.set(`2fa:${acct.email}`, {
          email: acct.email,
          purpose: '2fa',
          codeHash: hashOtp(code),
          expiresAt: Date.now() + 10 * 60_000,
        });
        persistStoreImmediate();
        const { sentViaSmtp } = await sendOtpEmail(acct.email, code, '2fa');
        res.json({
          requires2fa: true,
          email: acct.email,
          sentViaSmtp,
          ...(sentViaSmtp ? {} : { devOtpCode: code }),
        });
        return;
      }

      const pub = store.usersPublic[acct.uid];
      const wasDeactivated = Boolean(pub?.isDeactivated);
      if (pub) {
        pub.isDeactivated = false;
        pub.deactivatedUntil = null;
        pub.onlineStatus = 'online';
        pub.lastSeenAt = new Date().toISOString();
      }
      persistStoreImmediate();
      if (wasDeactivated && pub && acct.firebaseRefreshToken) {
        refreshFirebaseIdToken(acct.firebaseRefreshToken)
          .then((refreshed) => {
            if (!refreshed) return;
            acct!.firebaseRefreshToken = refreshed.refreshToken;
            return updateUserPublicInFirestore({
              uid: acct!.uid,
              userPublic: pub,
              idToken: refreshed.idToken,
            });
          })
          .catch(() => {});
      }
      broadcastGlobalSync();

      const token = signSessionToken(acct.uid);
      res.json({ token, user: pub, userPrivate: priv });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed.' });
    }
  });

  app.post('/api/auth/verify-2fa', (req, res) => {
    const { email, code } = req.body as { email?: string; code?: string };
    const cleanEmail = (email || '').trim().toLowerCase();
    const key = `2fa:${cleanEmail}`;
    const record = otpRecords.get(key);
    if (!record || record.expiresAt < Date.now() || record.codeHash !== hashOtp((code || '').trim())) {
      res.status(401).json({ error: 'Invalid or expired 2FA code.' });
      return;
    }
    otpRecords.delete(key);

    const acct = store.accounts.find((a) => !a.deleted && a.email === cleanEmail);
    if (!acct) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const pub = store.usersPublic[acct.uid];
    if (pub) {
      pub.isDeactivated = false;
      pub.deactivatedUntil = null;
      pub.onlineStatus = 'online';
      pub.lastSeenAt = new Date().toISOString();
    }
    persistStoreImmediate();
    broadcastGlobalSync();

    res.json({
      token: signSessionToken(acct.uid),
      user: pub,
      userPrivate: store.usersPrivate[acct.uid],
    });
  });

  // One-tap saved login / account switcher
  app.post('/api/auth/login-token', (req, res) => {
    const { token } = req.body as { token?: string };
    const uid = token ? verifySessionToken(token) : null;
    if (!uid) {
      res.status(401).json({ error: 'Please enter your password to sign in to this account.' });
      return;
    }
    const pub = store.usersPublic[uid];
    if (pub) {
      pub.isDeactivated = false;
      pub.deactivatedUntil = null;
      pub.onlineStatus = 'online';
      pub.lastSeenAt = new Date().toISOString();
    }
    persistStoreImmediate();
    broadcastGlobalSync();
    res.json({
      token: signSessionToken(uid),
      user: pub,
      userPrivate: store.usersPrivate[uid],
    });
  });

  // Exchange Firebase Auth ID Token (Google Sign-In or Firebase Auth user) for SocialVerse session
  app.post('/api/auth/firebase', async (req, res) => {
    try {
      const { idToken, language = 'en' } = req.body as {
        idToken?: string;
        language?: 'en' | 'bn';
      };
      const cleanToken = (idToken || '').trim();
      if (!cleanToken) {
        res.status(400).json({ error: 'Firebase ID token is required.' });
        return;
      }

      let verified: {
        uid: string;
        email: string;
        displayName: string;
        photoUrl: string;
      } | null = null;

      try {
        const decoded = await getAuth().verifyIdToken(cleanToken);
        verified = {
          uid: decoded.uid,
          email: String(decoded.email || '').trim().toLowerCase(),
          displayName: String(decoded.name || '').trim(),
          photoUrl: String(decoded.picture || '').trim(),
        };
      } catch {
        verified = await verifyFirebaseTokenViaIdentityToolkit(cleanToken);
      }

      if (!verified?.uid) {
        res.status(401).json({ error: 'Invalid or expired Firebase authentication token.' });
        return;
      }

      const cleanEmail = verified.email || `${verified.uid}@firebase.local`;
      const canonicalEmail = canonicalizeEmail(cleanEmail);
      const nowIso = new Date().toISOString();

      let acct = store.accounts.find(
        (a) =>
          !a.deleted &&
          (a.uid === verified!.uid ||
            a.email === cleanEmail ||
            (a.canonicalEmail || canonicalizeEmail(a.email)) === canonicalEmail)
      );

      const activeUid = acct?.uid || verified.uid;

      if (!acct) {
        const [remotePub, remotePriv] = await Promise.all([
          firestoreGetDoc(`users/${activeUid}`, cleanToken),
          firestoreGetDoc(`users/${activeUid}/private/info`, cleanToken),
        ]);

        const rawBase =
          (remotePub && typeof remotePub.username === 'string' && remotePub.username) ||
          normalizeUsername(cleanEmail.split('@')[0] || verified.displayName || 'creator');
        const baseUsername =
          rawBase.length >= 3 ? rawBase.slice(0, 18) : `sv_${rawBase || 'user'}`;

        let candidateUsername = baseUsername;
        let suffix = 1;
        while (
          !isValidUsername(candidateUsername) ||
          store.accounts.some((a) => !a.deleted && a.username === candidateUsername)
        ) {
          candidateUsername = `${baseUsername.slice(0, 18)}_${suffix}`;
          suffix += 1;
        }

        const safeDisplayName = (
          (remotePub && typeof remotePub.displayName === 'string' && remotePub.displayName) ||
          verified.displayName ||
          candidateUsername
        )
          .trim()
          .slice(0, 50);

        const safePhotoUrl =
          (remotePub && typeof remotePub.photoUrl === 'string' && remotePub.photoUrl) ||
          (verified.photoUrl.length <= 200000 ? verified.photoUrl : '');

        const placeholderHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
        acct = {
          uid: activeUid,
          email: cleanEmail,
          canonicalEmail,
          username: candidateUsername,
          passwordHash: placeholderHash,
          createdAt:
            (remotePub && typeof remotePub.createdAt === 'string' && remotePub.createdAt) || nowIso,
        };
        store.accounts = store.accounts.filter((a) => a.uid !== activeUid);
        store.accounts.push(acct);

        if (!store.usersPublic[activeUid]) {
          store.usersPublic[activeUid] = {
            uid: activeUid,
            username: candidateUsername,
            displayName: safeDisplayName || candidateUsername,
            nicknameFont:
              ((remotePub && remotePub.nicknameFont) as NicknameFontStyle) || 'classic',
            bio: (remotePub && typeof remotePub.bio === 'string' && remotePub.bio) || '',
            pronouns:
              (remotePub && typeof remotePub.pronouns === 'string' && remotePub.pronouns) || '',
            website:
              (remotePub && typeof remotePub.website === 'string' && remotePub.website) || '',
            noteText:
              (remotePub && typeof remotePub.noteText === 'string' && remotePub.noteText) || '',
            dateOfBirth:
              remotePub && typeof remotePub.dateOfBirth === 'string'
                ? remotePub.dateOfBirth
                : undefined,
            photoUrl: safePhotoUrl,
            coverUrl:
              (remotePub && typeof remotePub.coverUrl === 'string' && remotePub.coverUrl) || '',
            interests:
              remotePub && Array.isArray(remotePub.interests)
                ? (remotePub.interests as string[])
                : [],
            isPrivate: Boolean(remotePub?.isPrivate),
            isDeactivated: false,
            deactivatedUntil: null,
            followersCount: Number(remotePub?.followersCount || 0),
            followingCount: Number(remotePub?.followingCount || 0),
            postsCount: Number(remotePub?.postsCount || 0),
            onlineStatus: 'online',
            lastSeenAt: nowIso,
            lastNicknameChangedAt: null,
            lastUsernameChangedAt: null,
            onboardingCompleted: true,
            createdAt: acct.createdAt,
            updatedAt: nowIso,
          };
        }

        if (!store.usersPrivate[activeUid]) {
          store.usersPrivate[activeUid] = {
            uid: activeUid,
            email: cleanEmail,
            language:
              remotePriv?.language === 'bn'
                ? 'bn'
                : remotePriv?.language === 'en'
                ? 'en'
                : language === 'bn'
                ? 'bn'
                : 'en',
            themeMode: remotePriv?.themeMode === 'dark' ? 'dark' : 'light',
            biometricLockEnabled: Boolean(remotePriv?.biometricLockEnabled),
            twoFactorEnabled: Boolean(remotePriv?.twoFactorEnabled),
            saveLoginInfo: remotePriv?.saveLoginInfo !== false,
            whoCanMessage:
              (remotePriv?.whoCanMessage as UserPrivate['whoCanMessage']) || 'everyone',
            whoCanViewStories:
              (remotePriv?.whoCanViewStories as UserPrivate['whoCanViewStories']) || 'everyone',
            whoCanFollow:
              (remotePriv?.whoCanFollow as UserPrivate['whoCanFollow']) || 'everyone',
            notificationPrefs: {
              ...DEFAULT_NOTIFICATION_PREFS,
              ...((remotePriv?.notificationPrefs as Partial<UserPrivate['notificationPrefs']>) ||
                {}),
            },
            blockedUserIds: Array.isArray(remotePriv?.blockedUserIds)
              ? (remotePriv.blockedUserIds as string[])
              : [],
            mutedStoryUserIds: Array.isArray(remotePriv?.mutedStoryUserIds)
              ? (remotePriv.mutedStoryUserIds as string[])
              : [],
            closeFriendUids: Array.isArray(remotePriv?.closeFriendUids)
              ? (remotePriv.closeFriendUids as string[])
              : [],
            updatedAt: nowIso,
          };
        }

        createUserDocsInFirestore({
          uid: activeUid,
          userPublic: store.usersPublic[activeUid],
          userPrivate: store.usersPrivate[activeUid],
          canonicalEmail,
          idToken: cleanToken,
        }).catch((err) => {
          console.warn('Firestore sync notice for Firebase Auth user:', err);
        });
      }

      const pub = store.usersPublic[activeUid];
      const priv = store.usersPrivate[activeUid];
      if (!pub || !priv) {
        res.status(500).json({ error: 'Could not initialize user profile.' });
        return;
      }

      pub.isDeactivated = false;
      pub.deactivatedUntil = null;
      pub.onlineStatus = 'online';
      pub.lastSeenAt = nowIso;

      persistStoreImmediate();
      broadcastGlobalSync();

      res.json({
        token: signSessionToken(activeUid),
        user: pub,
        userPrivate: priv,
      });
    } catch (err) {
      console.error('Firebase token exchange error:', err);
      res.status(500).json({ error: 'Could not complete Firebase sign-in.' });
    }
  });

  app.post('/api/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    const acct = store.accounts.find((a) => !a.deleted && a.uid === req.uid);
    if (!acct) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    if (!currentPassword || !(await bcrypt.compare(currentPassword, acct.passwordHash))) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }
    acct.passwordHash = await bcrypt.hash(newPassword, 10);
    if (acct.firebaseRefreshToken) {
      const refreshed = await refreshFirebaseIdToken(acct.firebaseRefreshToken);
      if (refreshed) {
        acct.firebaseRefreshToken = refreshed.refreshToken;
        await firebaseAuthPost('accounts:update', {
          idToken: refreshed.idToken,
          password: newPassword,
          returnSecureToken: true,
        }).catch(() => {});
      }
    }
    persistStoreImmediate();
    res.json({ ok: true });
  });

  app.post('/api/auth/change-email', requireAuth, async (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const { verificationToken, newEmail, currentPassword } = req.body as {
      verificationToken?: string;
      newEmail?: string;
      currentPassword?: string;
    };
    const acct = store.accounts.find((a) => !a.deleted && a.uid === uid);
    const priv = store.usersPrivate[uid];
    if (!acct || !priv) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    if (!currentPassword || !(await bcrypt.compare(currentPassword, acct.passwordHash))) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const emailCheck = validateSignupEmail(newEmail || '', priv.language === 'bn' ? 'bn' : 'en');
    if (!emailCheck.valid) {
      res.status(400).json({ error: emailCheck.reason || 'Please use a valid permanent email address.' });
      return;
    }
    const { cleanEmail, canonicalEmail } = emailCheck;

    const grant = verificationToken ? verificationGrants.get(verificationToken) : undefined;
    if (
      !grant ||
      grant.purpose !== 'change_email' ||
      grant.email !== cleanEmail ||
      grant.expiresAt < Date.now()
    ) {
      res.status(403).json({ error: 'Valid OTP verification required before updating your email.' });
      return;
    }

    const duplicate = store.accounts.find(
      (a) =>
        !a.deleted &&
        a.uid !== uid &&
        (a.email === cleanEmail || (a.canonicalEmail || canonicalizeEmail(a.email)) === canonicalEmail)
    );
    if (duplicate) {
      res.status(409).json({ error: 'This email is already registered to another account.' });
      return;
    }

    const oldCanonical = acct.canonicalEmail || canonicalizeEmail(acct.email);
    const oldHash = sha256Hex(oldCanonical);
    const newHash = sha256Hex(canonicalEmail);

    if (acct.firebaseRefreshToken) {
      const refreshed = await refreshFirebaseIdToken(acct.firebaseRefreshToken);
      if (refreshed) {
        acct.firebaseRefreshToken = refreshed.refreshToken;
        try {
          const fbRes = await firebaseAuthPost<{ idToken?: string; refreshToken?: string }>(
            'accounts:update',
            {
              idToken: refreshed.idToken,
              email: cleanEmail,
              returnSecureToken: true,
            }
          );
          if (fbRes.refreshToken) acct.firebaseRefreshToken = fbRes.refreshToken;
          const activeIdToken = fbRes.idToken || refreshed.idToken;
          const encEmail = encryptLookupEmail(cleanEmail);
          const writes: Array<Record<string, unknown>> = [
            {
              update: {
                name: firestoreDocPathName(`email_claims/${newHash}`),
                fields: toFirestoreFields({ uid, emailHash: newHash, encEmail }),
              },
              updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
            },
            {
              update: {
                name: firestoreDocPathName(`usernames/${acct.username}`),
                fields: toFirestoreFields({ uid, username: acct.username, encEmail }),
              },
              updateMask: { fieldPaths: ['uid', 'username', 'encEmail'] },
            },
          ];
          if (oldHash !== newHash) {
            writes.push({ delete: firestoreDocPathName(`email_claims/${oldHash}`) });
          }
          await firestoreCommitWrites(writes, activeIdToken).catch(() => {});
          await updateUserPrivateInFirestore({
            uid,
            userPrivate: { ...priv, email: cleanEmail },
            idToken: activeIdToken,
          }).catch(() => {});
        } catch {
          try {
            await getAuth().updateUser(uid, { email: cleanEmail });
          } catch {
            // Continue with local update if Admin API unavailable
          }
        }
      }
    } else {
      try {
        await getAuth().updateUser(uid, { email: cleanEmail });
      } catch {
        // Optional Firebase Admin fallback
      }
    }

    acct.email = cleanEmail;
    acct.canonicalEmail = canonicalEmail;
    priv.email = cleanEmail;
    priv.updatedAt = new Date().toISOString();
    verificationGrants.delete(verificationToken!);
    persistStoreImmediate();
    broadcastGlobalSync();
    res.json({ ok: true, userPrivate: priv });
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const { verificationToken, email, newPassword } = req.body as {
      verificationToken?: string;
      email?: string;
      newPassword?: string;
    };
    const cleanEmail = (email || '').trim().toLowerCase();
    const canonical = canonicalizeEmail(cleanEmail);
    const grant = verificationToken ? verificationGrants.get(verificationToken) : undefined;
    if (!grant || grant.email !== cleanEmail || grant.purpose !== 'reset' || grant.expiresAt < Date.now()) {
      res.status(403).json({ error: 'Valid OTP verification required to reset password.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    const acct = store.accounts.find(
      (a) =>
        !a.deleted &&
        (a.email === cleanEmail || (a.canonicalEmail || canonicalizeEmail(a.email)) === canonical)
    );

    if (acct?.firebaseRefreshToken) {
      const refreshed = await refreshFirebaseIdToken(acct.firebaseRefreshToken);
      if (refreshed) {
        acct.firebaseRefreshToken = refreshed.refreshToken;
        try {
          await firebaseAuthPost('accounts:update', {
            idToken: refreshed.idToken,
            password: newPassword,
            returnSecureToken: true,
          });
          acct.passwordHash = await bcrypt.hash(newPassword, 10);
          verificationGrants.delete(verificationToken!);
          persistStoreImmediate();
          res.json({ ok: true, method: 'direct' });
          return;
        } catch {
          // Fall through to Firebase PASSWORD_RESET email link if refresh/update was rejected
        }
      }
    }

    // Post-restart or missing refreshToken fallback: verify claim in Firestore & trigger Firebase reset email
    const remoteClaim = !acct ? await firestoreGetDoc(`email_claims/${sha256Hex(canonical)}`) : null;
    if (!acct && (!remoteClaim || !remoteClaim.uid)) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    const targetEmail =
      acct?.email ||
      (remoteClaim && typeof remoteClaim.encEmail === 'string'
        ? decryptLookupEmail(remoteClaim.encEmail) || cleanEmail
        : cleanEmail);

    try {
      await firebaseAuthPost('accounts:sendOobCode', {
        requestType: 'PASSWORD_RESET',
        email: targetEmail,
      });
      verificationGrants.delete(verificationToken!);
      persistStoreImmediate();
      res.json({
        ok: true,
        method: 'email_link',
        message: `A password reset confirmation link has been sent to ${targetEmail}. Open the link to finalize your new password, then sign in.`,
      });
    } catch {
      res.status(500).json({ error: 'Could not reset password right now. Please try again.' });
    }
  });

  app.post('/api/auth/deactivate', requireAuth, (req: AuthenticatedRequest, res) => {
    const { days = 7 } = req.body as { days?: number };
    const safeDays = Math.min(365, Math.max(1, Number(days) || 7));
    const user = store.usersPublic[req.uid!];
    const acct = store.accounts.find((a) => !a.deleted && a.uid === req.uid);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    user.isDeactivated = true;
    user.deactivatedUntil = new Date(Date.now() + safeDays * 24 * 3_600_000).toISOString();
    user.onlineStatus = 'offline';
    persistStoreImmediate();
    if (acct?.firebaseRefreshToken) {
      refreshFirebaseIdToken(acct.firebaseRefreshToken)
        .then((refreshed) => {
          if (!refreshed) return;
          acct.firebaseRefreshToken = refreshed.refreshToken;
          return updateUserPublicInFirestore({
            uid: acct.uid,
            userPublic: user,
            idToken: refreshed.idToken,
          });
        })
        .catch(() => {});
    }
    broadcastGlobalSync();
    res.json({ ok: true, deactivatedUntil: user.deactivatedUntil });
  });

  app.delete('/api/auth/account', requireAuth, async (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const acct = store.accounts.find((a) => a.uid === uid);
    if (acct) {
      if (acct.firebaseRefreshToken) {
        const refreshed = await refreshFirebaseIdToken(acct.firebaseRefreshToken);
        if (refreshed) {
          const canonical = acct.canonicalEmail || canonicalizeEmail(acct.email);
          // Delete Firestore docs BEFORE deleting Firebase Auth user so idToken remains authorized
          await deleteUserDocsFromFirestore({
            uid,
            username: acct.username,
            canonicalEmail: canonical,
            idToken: refreshed.idToken,
          }).catch(() => {});
          await firebaseAuthPost('accounts:delete', { idToken: refreshed.idToken }).catch(() => {});
        }
      }
      acct.deleted = true;
    }
    delete store.usersPublic[uid];
    delete store.usersPrivate[uid];
    store.posts = store.posts.filter((p) => p.authorId !== uid);
    store.stories = store.stories.filter((s) => s.authorId !== uid);
    store.storyHighlights = (store.storyHighlights || []).filter((h) => h.ownerUid !== uid);
    store.notes = store.notes.filter((n) => n.authorUid !== uid);
    persistStoreImmediate();
    broadcastGlobalSync();
    res.json({ ok: true });
  });

  // State hydration
  app.get('/api/state', async (req, res) => {
    const viewerUid = await resolveUidFromHeader(req);
    res.json(buildStateForUser(viewerUid));
  });

  // Profile updates with 7-day nickname & 14-day username cooldown + 150-char bio
  app.patch('/api/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const user = store.usersPublic[uid];
    const acct = store.accounts.find((a) => !a.deleted && a.uid === uid);
    if (!user || !acct) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }

    const updates = req.body as Partial<UserPublic>;
    const nowIso = new Date().toISOString();

    if (updates.bio !== undefined && !isValidBio(updates.bio)) {
      res.status(400).json({ error: `Bio must be ${MAX_BIO_LENGTH} characters or fewer.` });
      return;
    }

    const nextDisplayName = updates.displayName !== undefined ? updates.displayName.trim() : user.displayName;
    const nextFont = updates.nicknameFont ?? user.nicknameFont ?? 'classic';
    const nicknameChanged =
      nextDisplayName !== user.displayName || nextFont !== (user.nicknameFont ?? 'classic');

    if (nicknameChanged) {
      if (!isValidDisplayName(nextDisplayName)) {
        res.status(400).json({ error: 'Nickname must be 1–50 characters.' });
        return;
      }
      const cooldown = canChangeNickname(user.lastNicknameChangedAt);
      if (!cooldown.allowed) {
        res.status(429).json({
          error: `Nickname can be changed once every 7 days (${cooldown.remainingDays}d remaining).`,
        });
        return;
      }
    }

    const previousUsername = user.username;
    const nextUsername =
      updates.username !== undefined ? normalizeUsername(updates.username) : user.username;
    const usernameChanged = nextUsername !== user.username;

    if (usernameChanged) {
      if (!isValidUsername(nextUsername)) {
        res.status(400).json({ error: 'Username must be 3–24 lowercase letters, numbers, or underscores.' });
        return;
      }
      const cooldown = canChangeUsername(user.lastUsernameChangedAt);
      if (!cooldown.allowed) {
        res.status(429).json({
          error: `Username can be changed once every 14 days (${cooldown.remainingDays}d remaining).`,
        });
        return;
      }
      const localTaken = store.accounts.some(
        (a) => !a.deleted && a.username === nextUsername && a.uid !== uid
      );
      const remoteClaim = !localTaken ? await firestoreGetDoc(`usernames/${nextUsername}`) : null;
      if (localTaken || (remoteClaim && remoteClaim.uid && remoteClaim.uid !== uid)) {
        res.status(409).json({ error: 'Username is already taken.' });
        return;
      }
      acct.username = nextUsername;
    }

    let nextDateOfBirth = user.dateOfBirth;
    if (updates.dateOfBirth !== undefined) {
      const incomingDob = typeof updates.dateOfBirth === 'string' ? updates.dateOfBirth.trim() : '';
      if (user.dateOfBirth) {
        if (incomingDob !== user.dateOfBirth) {
          res.status(403).json({
            error: 'Date of birth can only be set once and cannot be changed.',
            code: 'DOB_IMMUTABLE',
          });
          return;
        }
      } else if (incomingDob) {
        const dobCheck = isValidDateOfBirth(incomingDob);
        if (!dobCheck.valid) {
          res.status(400).json({ error: 'Please provide a valid date of birth (minimum age 13).' });
          return;
        }
        nextDateOfBirth = dobCheck.normalized;
      }
    }

    const updated: UserPublic = {
      ...user,
      displayName: nextDisplayName,
      nicknameFont: nextFont,
      username: nextUsername,
      bio: updates.bio !== undefined ? updates.bio : user.bio,
      pronouns: updates.pronouns !== undefined ? updates.pronouns.slice(0, 32) : user.pronouns,
      website: updates.website !== undefined ? updates.website.slice(0, 200) : user.website,
      dateOfBirth: nextDateOfBirth,
      photoUrl: updates.photoUrl !== undefined ? updates.photoUrl : user.photoUrl,
      coverUrl: updates.coverUrl !== undefined ? updates.coverUrl : user.coverUrl,
      interests: updates.interests !== undefined ? updates.interests.slice(0, 15) : user.interests,
      isPrivate: updates.isPrivate !== undefined ? Boolean(updates.isPrivate) : user.isPrivate,
      lastNicknameChangedAt: nicknameChanged ? nowIso : user.lastNicknameChangedAt,
      lastUsernameChangedAt: usernameChanged ? nowIso : user.lastUsernameChangedAt,
      updatedAt: nowIso,
    };

    store.usersPublic[uid] = updated;
    // Sync author fields on existing posts/stories/notes/comments/chats
    store.posts.forEach((p) => {
      if (p.authorId === uid) {
        p.authorUsername = updated.username;
        p.authorDisplayName = updated.displayName;
        p.authorAvatar = updated.photoUrl;
      }
    });
    store.stories.forEach((s) => {
      if (s.authorId === uid) {
        s.authorUsername = updated.username;
        s.authorDisplayName = updated.displayName;
        s.authorAvatar = updated.photoUrl;
      }
    });
    store.notes.forEach((n) => {
      if (n.authorUid === uid) {
        n.authorUsername = updated.username;
        n.authorDisplayName = updated.displayName;
        n.authorAvatar = updated.photoUrl;
      }
    });
    Object.values(store.commentsByPost).forEach((list) => {
      list.forEach((cm) => {
        if (cm.authorId === uid) {
          cm.authorUsername = updated.username;
          cm.authorAvatar = updated.photoUrl;
        }
      });
    });
    store.chats.forEach((c) => {
      if (c.participantIds.includes(uid)) {
        c.participantNames[uid] = updated.displayName;
        c.participantAvatars[uid] = updated.photoUrl;
      }
    });

    persistStoreImmediate();
    if (updates.bio !== undefined && updates.bio !== user.bio) {
      const oldMentions = new Set(extractMentions(user.bio || ''));
      emitMentionNotifications({
        actorUid: uid,
        text: updated.bio,
        summaryPrefix: `mentioned you in their bio.`,
        targetId: uid,
        skipMentions: oldMentions,
      });
    }
    if (acct.firebaseRefreshToken) {
      refreshFirebaseIdToken(acct.firebaseRefreshToken)
        .then((refreshed) => {
          if (!refreshed) return;
          acct.firebaseRefreshToken = refreshed.refreshToken;
          return updateUserPublicInFirestore({
            uid,
            userPublic: updated,
            previousUsername: usernameChanged ? previousUsername : undefined,
            emailForClaim: acct.email,
            idToken: refreshed.idToken,
          });
        })
        .catch(() => {});
    }
    broadcastGlobalSync();
    res.json({ user: updated });
  });

  app.patch('/api/settings/private', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const current = store.usersPrivate[uid];
    const acct = store.accounts.find((a) => !a.deleted && a.uid === uid);
    if (!current) {
      res.status(404).json({ error: 'Private settings not found.' });
      return;
    }
    const body = (req.body || {}) as Partial<UserPrivate>;
    const mergedNotifPrefs = body.notificationPrefs
      ? {
          ...DEFAULT_NOTIFICATION_PREFS,
          ...(current.notificationPrefs || {}),
          ...body.notificationPrefs,
        }
      : {
          ...DEFAULT_NOTIFICATION_PREFS,
          ...(current.notificationPrefs || {}),
        };
    const nextCloseFriends = Array.isArray(body.closeFriendUids)
      ? Array.from(new Set(body.closeFriendUids.filter((id) => typeof id === 'string' && id !== uid)))
      : current.closeFriendUids || [];

    const next: UserPrivate = {
      ...current,
      ...body,
      notificationPrefs: mergedNotifPrefs,
      closeFriendUids: nextCloseFriends,
      uid,
      email: current.email,
      updatedAt: new Date().toISOString(),
    };
    store.usersPrivate[uid] = next;
    persistStore();
    if (Array.isArray(body.closeFriendUids)) {
      broadcastGlobalSync();
    }
    if (acct?.firebaseRefreshToken) {
      refreshFirebaseIdToken(acct.firebaseRefreshToken)
        .then((refreshed) => {
          if (!refreshed) return;
          acct.firebaseRefreshToken = refreshed.refreshToken;
          return updateUserPrivateInFirestore({
            uid,
            userPrivate: next,
            idToken: refreshed.idToken,
          });
        })
        .catch(() => {});
    }
    res.json({ userPrivate: next });
  });

  // Profile connections (Followers / Following) respecting private accounts
  app.get('/api/users/:targetUid/connections', async (req, res) => {
    const viewerUid = await resolveUidFromHeader(req);
    const targetUid = String(req.params.targetUid);
    const target = store.usersPublic[targetUid];
    if (!target || (target.isDeactivated && viewerUid !== targetUid)) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const viewerFollowing = viewerUid ? store.followingByUser[viewerUid] || [] : [];
    const allowed =
      !target.isPrivate ||
      viewerUid === targetUid ||
      viewerFollowing.includes(targetUid);
    if (!allowed) {
      res.status(403).json({ error: 'This account is private.' });
      return;
    }
    res.json({
      followerIds: store.followersByUser[targetUid] || [],
      followingIds: store.followingByUser[targetUid] || [],
    });
  });

  // Follow / Private Follow Request
  app.post('/api/users/:targetUid/follow', requireAuth, (req: AuthenticatedRequest, res) => {
    const actorUid = req.uid!;
    const targetUid = String(req.params.targetUid);
    if (actorUid === targetUid) {
      res.status(400).json({ error: 'Cannot follow yourself.' });
      return;
    }
    const actor = store.usersPublic[actorUid];
    const target = store.usersPublic[targetUid];
    if (!actor || !target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const actorFollowing = store.followingByUser[actorUid] || [];
    const targetFollowers = store.followersByUser[targetUid] || [];

    if (actorFollowing.includes(targetUid)) {
      store.followingByUser[actorUid] = actorFollowing.filter((id) => id !== targetUid);
      store.followersByUser[targetUid] = targetFollowers.filter((id) => id !== actorUid);
      actor.followingCount = store.followingByUser[actorUid].length;
      target.followersCount = store.followersByUser[targetUid].length;
      persistStore();
      void withUserIdToken(actorUid, (idToken) => syncFollowEdgeInFirestore(actorUid, targetUid, false, idToken));
      broadcastGlobalSync();
      res.json({
        status: 'unfollowed',
        followingIds: store.followingByUser[actorUid],
        targetFollowersCount: target.followersCount,
      });
      return;
    }

    if (requiresFollowApproval(target, store.usersPrivate[targetUid])) {
      const existingReq = store.friendRequests.find(
        (r) => r.fromUid === actorUid && r.toUid === targetUid && r.status === 'pending'
      );
      if (existingReq) {
        store.friendRequests = store.friendRequests.filter((r) => r.id !== existingReq.id);
        persistStore();
        broadcastGlobalSync();
        res.json({
          status: 'cancelled',
          followingIds: store.followingByUser[actorUid] || [],
          targetFollowersCount: target.followersCount,
        });
        return;
      }
      const reqItem: FriendRequest = {
        id: `fr_${Date.now()}`,
        fromUid: actorUid,
        fromUsername: actor.username,
        fromDisplayName: actor.displayName,
        fromAvatar: actor.photoUrl,
        toUid: targetUid,
        status: 'pending',
        mutualCount: 0,
        createdAt: new Date().toISOString(),
      };
      store.friendRequests.unshift(reqItem);
      emitNotification({
        recipientUid: targetUid,
        actorUid,
        type: 'friend_request',
        summary: 'requested to follow you.',
      });
      persistStore();
      broadcastGlobalSync();
      res.json({
        status: 'requested',
        request: reqItem,
        followingIds: store.followingByUser[actorUid] || [],
        targetFollowersCount: target.followersCount,
      });
      return;
    }

    store.followingByUser[actorUid] = Array.from(new Set([...actorFollowing, targetUid]));
    store.followersByUser[targetUid] = Array.from(new Set([...targetFollowers, actorUid]));
    actor.followingCount = store.followingByUser[actorUid].length;
    target.followersCount = store.followersByUser[targetUid].length;

    emitNotification({
      recipientUid: targetUid,
      actorUid,
      type: 'follow',
      summary: 'started following you.',
    });
    persistStore();
    void withUserIdToken(actorUid, (idToken) => syncFollowEdgeInFirestore(actorUid, targetUid, true, idToken));
    broadcastGlobalSync();
    res.json({
      status: 'following',
      followingIds: store.followingByUser[actorUid],
      targetFollowersCount: target.followersCount,
    });
  });

  app.post('/api/friend-requests/:reqId/respond', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const reqId = String(req.params.reqId);
    const { accept } = req.body as { accept?: boolean };
    const found = store.friendRequests.find((r) => r.id === reqId && r.toUid === uid);
    if (!found) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }
    found.status = accept ? 'accepted' : 'rejected';
    if (accept) {
      const fromFollowing = store.followingByUser[found.fromUid] || [];
      const toFollowers = store.followersByUser[uid] || [];
      store.followingByUser[found.fromUid] = Array.from(new Set([...fromFollowing, uid]));
      store.followersByUser[uid] = Array.from(new Set([...toFollowers, found.fromUid]));
      if (store.usersPublic[found.fromUid]) {
        store.usersPublic[found.fromUid].followingCount = store.followingByUser[found.fromUid].length;
      }
      if (store.usersPublic[uid]) {
        store.usersPublic[uid].followersCount = store.followersByUser[uid].length;
        emitNotification({
          recipientUid: found.fromUid,
          actorUid: uid,
          type: 'follow',
          summary: 'accepted your follow request.',
        });
      }
      void withUserIdToken(found.fromUid, (idToken) => syncFollowEdgeInFirestore(found.fromUid, uid, true, idToken));
    }
    persistStore();
    broadcastGlobalSync();
    res.json({
      ok: true,
      followingIds: store.followingByUser[uid] || [],
      followerIds: store.followersByUser[uid] || [],
    });
  });

  app.delete('/api/followers/:followerUid', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const followerUid = String(req.params.followerUid);
    store.followersByUser[uid] = (store.followersByUser[uid] || []).filter((id) => id !== followerUid);
    store.followingByUser[followerUid] = (store.followingByUser[followerUid] || []).filter(
      (id) => id !== uid
    );
    if (store.usersPublic[uid]) {
      store.usersPublic[uid].followersCount = store.followersByUser[uid].length;
    }
    if (store.usersPublic[followerUid]) {
      store.usersPublic[followerUid].followingCount = store.followingByUser[followerUid].length;
    }
    persistStore();
    void withUserIdToken(uid, (idToken) => syncFollowEdgeInFirestore(followerUid, uid, false, idToken));
    broadcastGlobalSync();
    res.json({ ok: true });
  });

  app.post('/api/users/:targetUid/block', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const targetUid = String(req.params.targetUid);
    const priv = store.usersPrivate[uid];
    const acct = store.accounts.find((a) => !a.deleted && a.uid === uid);
    if (priv) {
      priv.blockedUserIds = Array.from(new Set([...priv.blockedUserIds, targetUid]));
      persistStore();
      if (acct?.firebaseRefreshToken) {
        refreshFirebaseIdToken(acct.firebaseRefreshToken)
          .then((refreshed) => {
            if (!refreshed) return;
            acct.firebaseRefreshToken = refreshed.refreshToken;
            return updateUserPrivateInFirestore({ uid, userPrivate: priv, idToken: refreshed.idToken });
          })
          .catch(() => {});
      }
    }
    res.json({ ok: true });
  });

  app.delete('/api/users/:targetUid/block', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const targetUid = String(req.params.targetUid);
    const priv = store.usersPrivate[uid];
    const acct = store.accounts.find((a) => !a.deleted && a.uid === uid);
    if (priv) {
      priv.blockedUserIds = priv.blockedUserIds.filter((id) => id !== targetUid);
      persistStore();
      if (acct?.firebaseRefreshToken) {
        refreshFirebaseIdToken(acct.firebaseRefreshToken)
          .then((refreshed) => {
            if (!refreshed) return;
            acct.firebaseRefreshToken = refreshed.refreshToken;
            return updateUserPrivateInFirestore({ uid, userPrivate: priv, idToken: refreshed.idToken });
          })
          .catch(() => {});
      }
    }
    res.json({ ok: true });
  });

  // Posts & Reels
  app.post('/api/posts', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const author = store.usersPublic[uid];
    if (!author) {
      res.status(404).json({ error: 'Author profile missing.' });
      return;
    }
    const { caption, mediaUrls = [], coverUrl, mediaType, visibility = 'public' } = req.body as {
      caption?: string;
      mediaUrls?: string[];
      coverUrl?: string;
      mediaType?: Post['mediaType'];
      visibility?: PostVisibility;
    };
    if (!caption || !isValidPostCaption(caption)) {
      res.status(400).json({ error: 'Caption must be 1–2200 characters.' });
      return;
    }
    const post: Post = {
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      authorId: uid,
      authorUsername: author.username,
      authorDisplayName: author.displayName,
      authorAvatar: author.photoUrl,
      caption: caption.trim(),
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
      coverUrl: coverUrl || undefined,
      mediaType: mediaType || 'image',
      hashtags: extractHashtags(caption),
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      visibility,
      createdAt: new Date().toISOString(),
    };
    store.posts.unshift(post);
    author.postsCount = store.posts.filter((p) => p.authorId === uid).length;
    emitMentionNotifications({
      actorUid: uid,
      text: post.caption,
      summaryPrefix: `mentioned you in a ${post.mediaType === 'reel' ? 'reel' : 'post'}.`,
      targetId: post.id,
    });
    persistStore();
    void withUserIdToken(uid, async (idToken) => {
      await syncPostToFirestore(post, idToken);
    });
    broadcastGlobalSync();
    res.json({ post });
  });

  app.patch('/api/posts/:postId', requireAuth, (req: AuthenticatedRequest, res) => {
    const postId = String(req.params.postId);
    const post = store.posts.find((p) => p.id === postId && p.authorId === req.uid);
    if (!post) {
      res.status(404).json({ error: 'Post not found or unauthorized.' });
      return;
    }
    const { caption, visibility } = req.body as { caption?: string; visibility?: PostVisibility };
    if (caption !== undefined && isValidPostCaption(caption)) {
      const oldMentions = new Set(extractMentions(post.caption || ''));
      post.caption = caption.trim();
      post.hashtags = extractHashtags(caption);
      emitMentionNotifications({
        actorUid: req.uid!,
        text: post.caption,
        summaryPrefix: `mentioned you in a ${post.mediaType === 'reel' ? 'reel' : 'post'}.`,
        targetId: post.id,
        skipMentions: oldMentions,
      });
    }
    if (visibility) post.visibility = visibility;
    persistStore();
    void withUserIdToken(req.uid!, async (idToken) => {
      await updatePostMetaInFirestore(post, idToken);
    });
    broadcastGlobalSync();
    res.json({ post });
  });

  app.delete('/api/posts/:postId', requireAuth, (req: AuthenticatedRequest, res) => {
    const postId = String(req.params.postId);
    const idx = store.posts.findIndex((p) => p.id === postId && p.authorId === req.uid);
    if (idx === -1) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    store.posts.splice(idx, 1);
    const author = store.usersPublic[req.uid!];
    if (author) author.postsCount = store.posts.filter((p) => p.authorId === req.uid).length;
    persistStore();
    void withUserIdToken(req.uid!, async (idToken) => {
      await firestoreCommitWrites([{ delete: firestoreDocPathName(`posts/${postId}`) }], idToken);
    });
    broadcastGlobalSync();
    res.json({ ok: true });
  });

  app.post('/api/posts/:postId/like', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const postId = String(req.params.postId);
    const post = store.posts.find((p) => p.id === postId);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    if (!canViewerAccessAuthorContent(post.authorId, uid)) {
      res.status(403).json({ error: 'This account is private.' });
      return;
    }
    const list = store.likedPostIdsByUser[uid] || [];
    const liked = list.includes(postId);
    store.likedPostIdsByUser[uid] = liked ? list.filter((id) => id !== postId) : [...list, postId];
    post.likesCount = Math.max(0, post.likesCount + (liked ? -1 : 1));
    if (!liked) {
      emitNotification({
        recipientUid: post.authorId,
        actorUid: uid,
        type: 'like',
        summary: `liked your ${post.mediaType === 'reel' ? 'reel' : 'post'}.`,
        targetId: post.id,
      });
    }
    persistStore();
    void withUserIdToken(uid, async (idToken) => {
      await updatePostCountersInFirestore(post, idToken);
    });
    broadcastGlobalSync();
    res.json({ liked: !liked, likesCount: post.likesCount });
  });

  app.post('/api/posts/:postId/save', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const postId = String(req.params.postId);
    const list = store.savedPostIdsByUser[uid] || [];
    const saved = list.includes(postId);
    store.savedPostIdsByUser[uid] = saved ? list.filter((id) => id !== postId) : [...list, postId];
    persistStore();
    void withUserIdToken(uid, async (idToken) => {
      await syncSavedPostInFirestore(uid, postId, !saved, idToken);
    });
    res.json({ saved: !saved });
  });

  app.post('/api/posts/:postId/share', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const post = store.posts.find((p) => p.id === String(req.params.postId));
    if (post) {
      if (!canViewerAccessAuthorContent(post.authorId, uid)) {
        res.status(403).json({ error: 'This account is private.' });
        return;
      }
      post.sharesCount += 1;
      persistStore();
      void withUserIdToken(uid, async (idToken) => {
        await updatePostCountersInFirestore(post, idToken);
      });
      broadcastGlobalSync();
    }
    res.json({ ok: true });
  });

  app.post('/api/posts/:postId/comments', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const postId = String(req.params.postId);
    const author = store.usersPublic[uid];
    const post = store.posts.find((p) => p.id === postId);
    if (!author || !post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    if (!canViewerAccessAuthorContent(post.authorId, uid)) {
      res.status(403).json({ error: 'This account is private.' });
      return;
    }
    const { text, stickerUrl, gifUrl, parentCommentId } = req.body as {
      text?: string;
      stickerUrl?: string;
      gifUrl?: string;
      parentCommentId?: string;
    };
    const finalText = (text || '').trim() || (stickerUrl ? '[Sticker]' : gifUrl ? '[GIF]' : '');
    if (!isValidCommentText(finalText)) {
      res.status(400).json({ error: 'Invalid comment.' });
      return;
    }
    const comment: PostComment = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      postId,
      authorId: uid,
      authorUsername: author.username,
      authorAvatar: author.photoUrl,
      text: finalText,
      stickerUrl,
      gifUrl,
      parentCommentId,
      createdAt: new Date().toISOString(),
    };
    store.commentsByPost[postId] = [...(store.commentsByPost[postId] || []), comment];
    post.commentsCount = store.commentsByPost[postId].length;
    emitNotification({
      recipientUid: post.authorId,
      actorUid: uid,
      type: parentCommentId ? 'reply' : 'comment',
      summary: `commented: "${finalText.slice(0, 60)}"`,
      targetId: post.id,
    });
    emitMentionNotifications({
      actorUid: uid,
      text: finalText,
      summaryPrefix: `mentioned you in a comment: "${finalText.slice(0, 50)}"`,
      targetId: post.id,
    });
    persistStore();
    void withUserIdToken(uid, async (idToken) => {
      await syncCommentToFirestore(comment, idToken);
      await updatePostCountersInFirestore(post, idToken);
    });
    broadcastGlobalSync();
    res.json({ comment });
  });

  // Stories
  app.post('/api/stories', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const author = store.usersPublic[uid];
    if (!author) {
      res.status(404).json({ error: 'Profile missing.' });
      return;
    }
    const { mediaType, mediaUrl, textContent, privacy = 'everyone' } = req.body as {
      mediaType: 'photo' | 'video' | 'text';
      mediaUrl?: string;
      textContent?: string;
      privacy?: 'everyone' | 'followers' | 'close_friends';
    };
    const story: Story = {
      id: `story_${Date.now()}`,
      authorId: uid,
      authorUsername: author.username,
      authorDisplayName: author.displayName,
      authorAvatar: author.photoUrl,
      mediaType,
      mediaUrl,
      textContent,
      backgroundGradient: 'from-sky-600 via-indigo-700 to-slate-900',
      privacy,
      viewersCount: 0,
      viewerUsernames: [],
      reactions: [],
      expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    store.stories.unshift(story);
    persistStore();
    void withUserIdToken(uid, async (idToken) => {
      await syncStoryToFirestore(story, idToken);
    });
    broadcastGlobalSync();
    res.json({ story });
  });

  app.delete('/api/stories/:storyId', requireAuth, (req: AuthenticatedRequest, res) => {
    const storyId = String(req.params.storyId);
    store.stories = store.stories.filter(
      (s) => !(s.id === storyId && s.authorId === req.uid)
    );
    persistStore();
    void withUserIdToken(req.uid!, async (idToken) => {
      await firestoreCommitWrites([{ delete: firestoreDocPathName(`stories/${storyId}`) }], idToken);
    });
    broadcastGlobalSync();
    res.json({ ok: true });
  });

  app.post('/api/stories/:storyId/react', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const author = store.usersPublic[uid];
    const story = store.stories.find((s) => s.id === String(req.params.storyId));
    if (story && author) {
      if (!canViewerAccessAuthorContent(story.authorId, uid)) {
        res.status(403).json({ error: 'This account is private.' });
        return;
      }
      const emoji = String(req.body.emoji || '❤️');
      story.reactions.push({ username: author.username, emoji });
      emitNotification({
        recipientUid: story.authorId,
        actorUid: uid,
        type: 'story_reaction',
        summary: `reacted ${emoji} to your story.`,
        targetId: story.id,
      });
      persistStore();
      broadcastGlobalSync();
    }
    res.json({ ok: true });
  });

  // Story Highlights CRUD
  app.post('/api/highlights', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const { title = '', coverUrl = '', storyIds = [], items = [] } = req.body as {
      title?: string;
      coverUrl?: string;
      storyIds?: string[];
      items?: StoryHighlightItem[];
    };
    if (!isValidHighlightTitle(title)) {
      res.status(400).json({ error: 'Highlight title must be 1–36 characters.' });
      return;
    }
    const fromStories: StoryHighlightItem[] = (storyIds || [])
      .map((sid) => store.stories.find((s) => s.id === sid && s.authorId === uid))
      .filter((s): s is Story => Boolean(s))
      .map((s) => ({
        id: `hi_${s.id}_${Math.random().toString(36).slice(2, 5)}`,
        mediaType: s.mediaType,
        mediaUrl: s.mediaUrl,
        textContent: s.textContent,
        backgroundGradient: s.backgroundGradient,
        createdAt: s.createdAt,
      }));
    const customItems: StoryHighlightItem[] = Array.isArray(items)
      ? items
          .filter((it) => it && (it.mediaUrl || it.textContent))
          .map((it) => ({
            id: it.id || `hi_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            mediaType: it.mediaType || 'photo',
            mediaUrl: it.mediaUrl,
            textContent: it.textContent,
            backgroundGradient: it.backgroundGradient || 'from-sky-600 via-indigo-700 to-slate-900',
            createdAt: it.createdAt || new Date().toISOString(),
          }))
      : [];
    const finalItems = [...fromStories, ...customItems];
    if (finalItems.length === 0) {
      res.status(400).json({ error: 'Select at least one story or media item for the highlight.' });
      return;
    }
    const resolvedCover =
      (coverUrl || '').trim() ||
      finalItems.find((it) => it.mediaUrl)?.mediaUrl ||
      '';
    const highlight: StoryHighlight = {
      id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      ownerUid: uid,
      title: title.trim().slice(0, 36),
      coverUrl: resolvedCover,
      items: finalItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.storyHighlights = [highlight, ...(store.storyHighlights || [])];
    persistStore();
    broadcastGlobalSync();
    res.json({ highlight });
  });

  app.patch('/api/highlights/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const id = String(req.params.id);
    const hl = (store.storyHighlights || []).find((h) => h.id === id && h.ownerUid === uid);
    if (!hl) {
      res.status(404).json({ error: 'Highlight not found.' });
      return;
    }
    const { title, coverUrl, items } = req.body as {
      title?: string;
      coverUrl?: string;
      items?: StoryHighlightItem[];
    };
    if (title !== undefined) {
      if (!isValidHighlightTitle(title)) {
        res.status(400).json({ error: 'Highlight title must be 1–36 characters.' });
        return;
      }
      hl.title = title.trim().slice(0, 36);
    }
    if (coverUrl !== undefined) {
      hl.coverUrl = coverUrl;
    }
    if (Array.isArray(items) && items.length > 0) {
      hl.items = items;
    }
    hl.updatedAt = new Date().toISOString();
    persistStore();
    broadcastGlobalSync();
    res.json({ highlight: hl });
  });

  app.delete('/api/highlights/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const id = String(req.params.id);
    const before = (store.storyHighlights || []).length;
    store.storyHighlights = (store.storyHighlights || []).filter(
      (h) => !(h.id === id && h.ownerUid === uid)
    );
    if (store.storyHighlights.length === before) {
      res.status(404).json({ error: 'Highlight not found.' });
      return;
    }
    persistStore();
    broadcastGlobalSync();
    res.json({ ok: true });
  });

  // Notes (above Inbox)
  app.post('/api/notes', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const author = store.usersPublic[uid];
    if (!author) {
      res.status(404).json({ error: 'Profile missing.' });
      return;
    }
    const text = String(req.body.text || '').trim().slice(0, 80);
    const audience: 'followers' | 'close_friends' =
      req.body.audience === 'close_friends' ? 'close_friends' : 'followers';
    if (!text) {
      res.status(400).json({ error: 'Note cannot be empty.' });
      return;
    }
    store.notes = store.notes.filter((n) => n.authorUid !== uid);
    const note: NoteItem = {
      id: `note_${Date.now()}`,
      authorUid: uid,
      authorUsername: author.username,
      authorDisplayName: author.displayName,
      authorAvatar: author.photoUrl,
      text,
      audience,
      likedByUids: [],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
    };
    store.notes.unshift(note);
    author.noteText = text;
    persistStore();
    broadcastGlobalSync();
    res.json({ note });
  });

  app.delete('/api/notes/mine', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    store.notes = store.notes.filter((n) => n.authorUid !== uid);
    if (store.usersPublic[uid]) {
      store.usersPublic[uid].noteText = '';
    }
    persistStore();
    broadcastGlobalSync();
    res.json({ ok: true });
  });

  app.post('/api/notes/:noteId/like', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const note = store.notes.find((n) => n.id === String(req.params.noteId));
    if (!note) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }
    const liked = note.likedByUids.includes(uid);
    note.likedByUids = liked
      ? note.likedByUids.filter((id) => id !== uid)
      : [...note.likedByUids, uid];
    persistStore();
    broadcastGlobalSync();
    res.json({ liked: !liked });
  });

  // Stickers & GIFs
  app.post('/api/stickers', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const { label, imageUrl, kind = 'sticker' } = req.body as {
      label?: string;
      imageUrl?: string;
      kind?: 'sticker' | 'gif';
    };
    if (!imageUrl) {
      res.status(400).json({ error: 'Sticker image is required.' });
      return;
    }
    const sticker: StickerItem = {
      id: `stk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      creatorUid: uid,
      label: (label || 'Custom Sticker').trim().slice(0, 50),
      imageUrl,
      kind,
      createdAt: new Date().toISOString(),
    };
    store.stickers.unshift(sticker);
    const favs = store.favoriteStickersByUser[uid] || [];
    store.favoriteStickersByUser[uid] = Array.from(new Set([sticker.id, ...favs]));
    persistStore();
    broadcastGlobalSync();
    res.json({ sticker });
  });

  app.post('/api/stickers/:stickerId/favorite', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const stickerId = String(req.params.stickerId);
    const { imageUrl, label } = req.body as { imageUrl?: string; label?: string };

    // Allow saving an inline received sticker URL directly into Favorites
    let targetId = stickerId;
    if (!store.stickers.some((s) => s.id === stickerId) && imageUrl) {
      const existingByUrl = store.stickers.find((s) => s.imageUrl === imageUrl);
      if (existingByUrl) {
        targetId = existingByUrl.id;
      } else {
        const created: StickerItem = {
          id: `stk_${Date.now()}`,
          creatorUid: uid,
          label: (label || 'Saved Sticker').slice(0, 50),
          imageUrl,
          kind: 'sticker',
          createdAt: new Date().toISOString(),
        };
        store.stickers.unshift(created);
        targetId = created.id;
      }
    }

    const favs = store.favoriteStickersByUser[uid] || [];
    const exists = favs.includes(targetId);
    store.favoriteStickersByUser[uid] = exists
      ? favs.filter((id) => id !== targetId)
      : [targetId, ...favs];
    persistStore();
    res.json({ favorited: !exists, stickerId: targetId });
  });

  // Chats & Groups (max 250 members)
  app.post('/api/chats', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const {
      title,
      participantUids,
      type = 'direct',
      avatarUrl = '',
      bio = '',
      restrictions,
    } = req.body as {
      title?: string;
      participantUids?: string[];
      type?: 'direct' | 'group';
      avatarUrl?: string;
      bio?: string;
      restrictions?: GroupRestrictions;
    };
    const uniqueParticipants = Array.from(new Set([uid, ...(participantUids || [])]));
    if (uniqueParticipants.length < 2) {
      res.status(400).json({ error: 'At least 2 participants required.' });
      return;
    }
    if (uniqueParticipants.length > MAX_GROUP_MEMBERS) {
      res.status(400).json({ error: `Group limit is ${MAX_GROUP_MEMBERS} members.` });
      return;
    }

    if (type === 'direct' && uniqueParticipants.length === 2) {
      const existing = store.chats.find(
        (c) =>
          c.type === 'direct' &&
          c.participantIds.length === 2 &&
          uniqueParticipants.every((id) => c.participantIds.includes(id))
      );
      if (existing) {
        res.json({ chat: existing });
        return;
      }
    }

    const participantNames: Record<string, string> = {};
    const participantAvatars: Record<string, string> = {};
    uniqueParticipants.forEach((pUid) => {
      const u = store.usersPublic[pUid];
      participantNames[pUid] = u?.displayName || 'User';
      participantAvatars[pUid] = u?.photoUrl || '';
    });

    const chat: Chat = {
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      type,
      title: (title || '').trim() || (type === 'group' ? 'New Group' : 'Direct Chat'),
      avatarUrl: type === 'group' ? avatarUrl : undefined,
      bio: type === 'group' ? bio.trim().slice(0, 160) : undefined,
      participantIds: uniqueParticipants,
      participantNames,
      participantAvatars,
      chatNicknames: {},
      ownerUid: type === 'group' ? uid : undefined,
      adminUids: type === 'group' ? [uid] : undefined,
      requireAddApproval: false,
      restrictions:
        type === 'group'
          ? {
              adminsOnlyMessages: Boolean(restrictions?.adminsOnlyMessages),
              onlyAdminsEditInfo: restrictions?.onlyAdminsEditInfo ?? true,
              blockMediaAttachments: Boolean(restrictions?.blockMediaAttachments),
            }
          : undefined,
      pendingMemberIds: [],
      maxMembers: MAX_GROUP_MEMBERS,
      theme: { presetId: 'default' },
      lastMessageText: type === 'group' ? 'Group created' : 'Conversation started',
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
      createdBy: uid,
      createdAt: new Date().toISOString(),
    };
    store.chats.unshift(chat);
    store.messagesByChat[chat.id] = [];
    persistStore();
    void withUserIdToken(uid, (idToken) => syncChatToFirestore(chat, idToken));
    broadcastWsEvent(chat.participantIds, { type: 'state:sync', state: null });
    broadcastGlobalSync();
    res.json({ chat });
  });

  app.post('/api/chats/:chatId/messages', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chatId = String(req.params.chatId);
    const chat = store.chats.find((c) => c.id === chatId && c.participantIds.includes(uid));
    const sender = store.usersPublic[uid];
    if (!chat || !sender) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }

    const payload = req.body as Partial<ChatMessage>;
    const sendCheck = canSendInGroupChat(chat, uid, payload.type || 'text');
    if (!sendCheck.allowed) {
      res.status(403).json({ error: sendCheck.reason || 'Messaging is restricted in this group.' });
      return;
    }

    let sanitizedPoll: ChatPoll | undefined;
    if (payload.type === 'poll') {
      const q = (payload.poll?.question || '').trim().slice(0, 200);
      const opts = (payload.poll?.options || [])
        .map((o, idx) => ({
          id: o.id || `opt_${idx + 1}`,
          text: (o.text || '').trim().slice(0, 100),
          voterUids: [],
        }))
        .filter((o) => o.text.length > 0)
        .slice(0, 6);
      if (!q || opts.length < 2) {
        res.status(400).json({ error: 'Poll requires a question and at least 2 options.' });
        return;
      }
      sanitizedPoll = {
        question: q,
        options: opts,
        allowMultiple: Boolean(payload.poll?.allowMultiple),
      };
    }

    const msg: ChatMessage = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      chatId,
      senderId: uid,
      senderName: chat.chatNicknames?.[uid] || sender.displayName,
      type: payload.type || 'text',
      text: payload.text,
      mediaUrl: payload.mediaUrl,
      stickerUrl: payload.stickerUrl,
      sharedPostId: payload.sharedPostId,
      sharedPostCaption: payload.sharedPostCaption,
      sharedPostThumb: payload.sharedPostThumb,
      sharedPostAuthor: payload.sharedPostAuthor,
      sharedPostMediaType: payload.sharedPostMediaType,
      poll: sanitizedPoll,
      fileName: payload.fileName,
      durationMs: payload.durationMs,
      replyToId: payload.replyToId,
      replyPreview: payload.replyPreview,
      forwarded: Boolean(payload.forwarded),
      starredByUids: [],
      status: 'delivered',
      reactions: {},
      createdAt: new Date().toISOString(),
    };

    store.messagesByChat[chatId] = [...(store.messagesByChat[chatId] || []), msg];
    chat.lastMessageText =
      msg.type === 'sticker'
        ? 'Sent a sticker'
        : msg.type === 'reel_share'
        ? 'Shared a reel'
        : msg.type === 'post_share'
        ? 'Shared a post'
        : msg.type === 'poll'
        ? `📊 Poll: ${msg.poll?.question || 'Poll'}`
        : msg.type === 'voice'
        ? 'Voice message'
        : msg.text || msg.fileName || 'Attachment';
    chat.lastMessageAt = msg.createdAt;
    // Mark unread for other participants, clear for sender
    chat.unreadByUids = chat.participantIds.filter((id) => id !== uid);
    // Unarchive and restore deleted DM visibility for new messages while preserving clearedBeforeByUid timestamps
    chat.archivedByUids = [];
    chat.deletedByUids = [];

    const notifSummary =
      chat.type === 'group'
        ? `${chat.title}: ${chat.lastMessageText}`
        : chat.lastMessageText;
    chat.participantIds.forEach((recipientUid) => {
      if (recipientUid === uid) return;
      emitNotification({
        recipientUid,
        actorUid: uid,
        type: chat.type === 'group' ? 'group_message' : 'message',
        summary: notifSummary,
        targetId: chat.id,
        isMutedChat: Boolean(chat.mutedByUids?.includes(recipientUid)),
      });
    });

    persistStore();
    void withUserIdToken(uid, async (idToken) => {
      await syncChatMessageToFirestore(chatId, msg, idToken);
      await syncChatToFirestore(chat, idToken);
    });
    broadcastGlobalSync();
    res.json({ message: msg });
  });

  app.post('/api/chats/:chatId/messages/:msgId/vote', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chatId = String(req.params.chatId);
    const msgId = String(req.params.msgId);
    const optionId = String(req.body.optionId || '');
    const chat = store.chats.find((c) => c.id === chatId && c.participantIds.includes(uid));
    if (!chat) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    const msg = (store.messagesByChat[chatId] || []).find((m) => m.id === msgId);
    if (!msg || msg.type !== 'poll' || !msg.poll) {
      res.status(404).json({ error: 'Poll message not found.' });
      return;
    }
    msg.poll = togglePollVote(msg.poll, optionId, uid);
    persistStore();
    broadcastGlobalSync();
    res.json({ message: msg });
  });

  app.patch('/api/chats/:chatId/messages/:msgId', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chatId = String(req.params.chatId);
    const msgId = String(req.params.msgId);
    const chat = store.chats.find((c) => c.id === chatId && c.participantIds.includes(uid));
    if (!chat) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    const list = store.messagesByChat[chatId] || [];
    const msg = list.find((m) => m.id === msgId && m.senderId === uid);
    if (!msg) {
      res.status(404).json({ error: 'Editable message not found.' });
      return;
    }
    const nextText = String(req.body.text || '').trim().slice(0, 2000);
    if (!nextText) {
      res.status(400).json({ error: 'Message text cannot be empty.' });
      return;
    }
    msg.text = nextText;
    msg.editedAt = new Date().toISOString();
    if (list[list.length - 1]?.id === msg.id) {
      chat.lastMessageText = nextText;
    }
    persistStore();
    broadcastGlobalSync();
    res.json({ message: msg });
  });

  app.post('/api/chats/:chatId/messages/:msgId/react', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chatId = String(req.params.chatId);
    const msgId = String(req.params.msgId);
    const emoji = String(req.body.emoji || '❤️');
    const chat = store.chats.find((c) => c.id === chatId && c.participantIds.includes(uid));
    if (!chat) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    const msg = (store.messagesByChat[chatId] || []).find((m) => m.id === msgId);
    if (!msg) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }
    const list = msg.reactions[emoji] || [];
    msg.reactions[emoji] = list.includes(uid) ? list.filter((id) => id !== uid) : [...list, uid];
    persistStore();
    broadcastGlobalSync();
    res.json({ reactions: msg.reactions });
  });

  app.post('/api/chats/:chatId/messages/:msgId/star', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chatId = String(req.params.chatId);
    const msgId = String(req.params.msgId);
    const chat = store.chats.find((c) => c.id === chatId && c.participantIds.includes(uid));
    if (!chat) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    const msg = (store.messagesByChat[chatId] || []).find((m) => m.id === msgId);
    if (!msg) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }
    const currentStars = msg.starredByUids || [];
    const exists = currentStars.includes(uid);
    msg.starredByUids = exists
      ? currentStars.filter((id) => id !== uid)
      : [...currentStars, uid];
    persistStore();
    broadcastGlobalSync();
    res.json({ starred: !exists, starredByUids: msg.starredByUids });
  });

  app.post('/api/chats/:chatId/messages/:msgId/forward', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chatId = String(req.params.chatId);
    const msgId = String(req.params.msgId);
    const targetChatId = String(req.body.targetChatId || '');
    const sourceChat = store.chats.find((c) => c.id === chatId && c.participantIds.includes(uid));
    const targetChat = store.chats.find((c) => c.id === targetChatId && c.participantIds.includes(uid));
    const sender = store.usersPublic[uid];
    if (!sourceChat || !targetChat || !sender) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    const orig = (store.messagesByChat[chatId] || []).find((m) => m.id === msgId);
    if (!orig) {
      res.status(404).json({ error: 'Original message not found.' });
      return;
    }
    const forwardedMsg: ChatMessage = {
      ...orig,
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      chatId: targetChatId,
      senderId: uid,
      senderName: targetChat.chatNicknames?.[uid] || sender.displayName,
      replyToId: undefined,
      replyPreview: undefined,
      forwarded: true,
      starredByUids: [],
      reactions: {},
      status: 'delivered',
      createdAt: new Date().toISOString(),
    };
    store.messagesByChat[targetChatId] = [...(store.messagesByChat[targetChatId] || []), forwardedMsg];
    targetChat.lastMessageText =
      forwardedMsg.type === 'sticker'
        ? 'Forwarded a sticker'
        : forwardedMsg.type === 'reel_share'
        ? 'Forwarded a reel'
        : forwardedMsg.text || forwardedMsg.fileName || 'Forwarded media';
    targetChat.lastMessageAt = forwardedMsg.createdAt;
    targetChat.unreadByUids = targetChat.participantIds.filter((id) => id !== uid);
    persistStore();
    broadcastGlobalSync();
    res.json({ message: forwardedMsg });
  });

  app.post('/api/chats/:chatId/pin', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chat = store.chats.find(
      (c) => c.id === String(req.params.chatId) && c.participantIds.includes(uid)
    );
    if (!chat) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    const { messageId } = req.body as { messageId?: string | null };
    chat.pinnedMessageId = messageId || undefined;
    persistStore();
    broadcastGlobalSync();
    res.json({ pinnedMessageId: chat.pinnedMessageId || null });
  });

  app.patch('/api/chats/:chatId/preferences', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chat = store.chats.find(
      (c) => c.id === String(req.params.chatId) && c.participantIds.includes(uid)
    );
    if (!chat) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    const { pinned, muted, archived, unread, disappearingMode } = req.body as {
      pinned?: boolean;
      muted?: boolean;
      archived?: boolean;
      unread?: boolean;
      disappearingMode?: 'off' | '24h' | '7d';
    };

    const toggleUid = (arr: string[] | undefined, val: boolean | undefined) => {
      if (val === undefined) return arr || [];
      const cur = arr || [];
      return val ? Array.from(new Set([...cur, uid])) : cur.filter((id) => id !== uid);
    };

    chat.pinnedByUids = toggleUid(chat.pinnedByUids, pinned);
    chat.mutedByUids = toggleUid(chat.mutedByUids, muted);
    chat.archivedByUids = toggleUid(chat.archivedByUids, archived);
    chat.unreadByUids = toggleUid(chat.unreadByUids, unread);
    if (disappearingMode && ['off', '24h', '7d'].includes(disappearingMode)) {
      chat.disappearingMode = disappearingMode;
    }
    persistStore();
    broadcastGlobalSync();
    res.json({ chat });
  });

  app.delete('/api/chats/:chatId', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chatId = String(req.params.chatId);
    const chatIdx = store.chats.findIndex(
      (c) => c.id === chatId && c.participantIds.includes(uid)
    );
    if (chatIdx === -1) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    const chat = store.chats[chatIdx];

    if (chat.type === 'direct') {
      chat.deletedByUids = Array.from(new Set([...(chat.deletedByUids || []), uid]));
      chat.clearedBeforeByUid = {
        ...(chat.clearedBeforeByUid || {}),
        [uid]: new Date().toISOString(),
      };
      chat.pinnedByUids = (chat.pinnedByUids || []).filter((id) => id !== uid);
      chat.archivedByUids = (chat.archivedByUids || []).filter((id) => id !== uid);
      chat.unreadByUids = (chat.unreadByUids || []).filter((id) => id !== uid);
      if (chat.participantIds.every((id) => chat.deletedByUids!.includes(id))) {
        store.chats.splice(chatIdx, 1);
        delete store.messagesByChat[chatId];
      }
    } else {
      // Group chat removal from Inbox: leave & remove group for this user, or disband if last member
      chat.participantIds = chat.participantIds.filter((id) => id !== uid);
      chat.adminUids = (chat.adminUids || []).filter((id) => id !== uid);
      chat.pinnedByUids = (chat.pinnedByUids || []).filter((id) => id !== uid);
      chat.archivedByUids = (chat.archivedByUids || []).filter((id) => id !== uid);
      chat.unreadByUids = (chat.unreadByUids || []).filter((id) => id !== uid);
      if (chat.participantIds.length === 0) {
        store.chats.splice(chatIdx, 1);
        delete store.messagesByChat[chatId];
      } else if (chat.ownerUid === uid) {
        const nextOwner = chat.adminUids[0] || chat.participantIds[0];
        if (nextOwner) {
          chat.ownerUid = nextOwner;
          chat.adminUids = Array.from(new Set([...(chat.adminUids || []), nextOwner]));
        }
      }
    }

    persistStore();
    broadcastGlobalSync();
    res.json({ ok: true, deletedChatId: chatId });
  });

  app.delete('/api/chats/:chatId/messages/:msgId', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chatId = String(req.params.chatId);
    const msgId = String(req.params.msgId);
    const remaining = (store.messagesByChat[chatId] || []).filter(
      (m) => !(m.id === msgId && m.senderId === uid)
    );
    store.messagesByChat[chatId] = remaining;
    const chat = store.chats.find((c) => c.id === chatId);
    if (chat) {
      if (chat.pinnedMessageId === msgId) chat.pinnedMessageId = undefined;
      const last = remaining[remaining.length - 1];
      chat.lastMessageText = last
        ? last.type === 'sticker'
          ? 'Sent a sticker'
          : last.type === 'voice'
          ? 'Voice message'
          : last.text || last.fileName || 'Attachment'
        : 'No messages yet';
    }
    persistStore();
    broadcastGlobalSync();
    res.json({ ok: true });
  });

  app.patch('/api/chats/:chatId/theme', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chat = store.chats.find(
      (c) => c.id === String(req.params.chatId) && c.participantIds.includes(uid)
    );
    if (!chat) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    chat.theme = req.body as ChatThemeConfig;
    persistStore();
    broadcastGlobalSync();
    res.json({ theme: chat.theme });
  });

  app.patch('/api/chats/:chatId/nicknames', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chat = store.chats.find(
      (c) => c.id === String(req.params.chatId) && c.participantIds.includes(uid)
    );
    if (!chat) {
      res.status(404).json({ error: 'Chat not found.' });
      return;
    }
    const { targetUid, nickname } = req.body as { targetUid?: string; nickname?: string };
    if (!targetUid) {
      res.status(400).json({ error: 'targetUid required.' });
      return;
    }
    chat.chatNicknames = chat.chatNicknames || {};
    const clean = (nickname || '').trim().slice(0, 40);
    if (clean) chat.chatNicknames[targetUid] = clean;
    else delete chat.chatNicknames[targetUid];
    persistStore();
    broadcastGlobalSync();
    res.json({ chatNicknames: chat.chatNicknames });
  });

  // Group Member & Role Management
  app.post('/api/chats/:chatId/members', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chat = store.chats.find(
      (c) => c.id === String(req.params.chatId) && c.type === 'group' && c.participantIds.includes(uid)
    );
    if (!chat) {
      res.status(404).json({ error: 'Group not found.' });
      return;
    }
    const targetUid = String(req.body.targetUid || '');
    const targetUser = store.usersPublic[targetUid];
    if (!targetUser) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (chat.participantIds.includes(targetUid)) {
      res.json({ ok: true, status: 'already_member', chat });
      return;
    }

    const check = canAddGroupMembers(chat, uid);
    if (!check.allowed) {
      res.status(400).json({ error: check.reason || 'Cannot add member.' });
      return;
    }

    if (check.needsApproval) {
      chat.pendingMemberIds = Array.from(new Set([...(chat.pendingMemberIds || []), targetUid]));
      persistStore();
      broadcastGlobalSync();
      res.json({ ok: true, status: 'pending_approval', chat });
      return;
    }

    chat.participantIds.push(targetUid);
    chat.participantNames[targetUid] = targetUser.displayName;
    chat.participantAvatars[targetUid] = targetUser.photoUrl;
    chat.pendingMemberIds = (chat.pendingMemberIds || []).filter((id) => id !== targetUid);
    persistStore();
    broadcastGlobalSync();
    res.json({ ok: true, status: 'added', chat });
  });

  app.post('/api/chats/:chatId/members/approve', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chat = store.chats.find(
      (c) => c.id === String(req.params.chatId) && c.type === 'group' && c.participantIds.includes(uid)
    );
    if (!chat || !isGroupAdmin(chat, uid)) {
      res.status(403).json({ error: 'Admin permission required.' });
      return;
    }
    const { targetUid, accept } = req.body as { targetUid?: string; accept?: boolean };
    if (!targetUid) {
      res.status(400).json({ error: 'targetUid required.' });
      return;
    }
    chat.pendingMemberIds = (chat.pendingMemberIds || []).filter((id) => id !== targetUid);
    if (accept && chat.participantIds.length < (chat.maxMembers || MAX_GROUP_MEMBERS)) {
      const targetUser = store.usersPublic[targetUid];
      if (targetUser && !chat.participantIds.includes(targetUid)) {
        chat.participantIds.push(targetUid);
        chat.participantNames[targetUid] = targetUser.displayName;
        chat.participantAvatars[targetUid] = targetUser.photoUrl;
      }
    }
    persistStore();
    broadcastGlobalSync();
    res.json({ ok: true, chat });
  });

  app.delete('/api/chats/:chatId/members/:targetUid', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const targetUid = String(req.params.targetUid);
    const chat = store.chats.find(
      (c) => c.id === String(req.params.chatId) && c.type === 'group' && c.participantIds.includes(uid)
    );
    if (!chat) {
      res.status(404).json({ error: 'Group not found.' });
      return;
    }
    if (!canRemoveGroupMember(chat, uid, targetUid)) {
      res.status(403).json({ error: 'You cannot remove this member (group owner cannot be removed).' });
      return;
    }
    chat.participantIds = chat.participantIds.filter((id) => id !== targetUid);
    chat.adminUids = (chat.adminUids || []).filter((id) => id !== targetUid);
    persistStore();
    broadcastGlobalSync();
    res.json({ ok: true, chat });
  });

  app.patch('/api/chats/:chatId/roles', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chat = store.chats.find(
      (c) => c.id === String(req.params.chatId) && c.type === 'group' && c.participantIds.includes(uid)
    );
    if (!chat) {
      res.status(404).json({ error: 'Group not found.' });
      return;
    }
    const { targetUid, action } = req.body as {
      targetUid?: string;
      action?: 'promote_admin' | 'demote_admin' | 'transfer_owner';
    };
    if (!targetUid || !chat.participantIds.includes(targetUid)) {
      res.status(400).json({ error: 'Target must be a group member.' });
      return;
    }
    if (action === 'transfer_owner') {
      if (!isGroupOwner(chat, uid)) {
        res.status(403).json({ error: 'Only the group owner can transfer ownership.' });
        return;
      }
      chat.ownerUid = targetUid;
      chat.adminUids = Array.from(new Set([...(chat.adminUids || []), targetUid, uid]));
    } else if (action === 'promote_admin') {
      if (!isGroupAdmin(chat, uid)) {
        res.status(403).json({ error: 'Only owner or admins can promote admins.' });
        return;
      }
      chat.adminUids = Array.from(new Set([...(chat.adminUids || []), targetUid]));
    } else if (action === 'demote_admin') {
      if (!isGroupOwner(chat, uid) || isGroupOwner(chat, targetUid)) {
        res.status(403).json({ error: 'Only the group owner can demote admins.' });
        return;
      }
      chat.adminUids = (chat.adminUids || []).filter((id) => id !== targetUid);
    }
    persistStore();
    broadcastGlobalSync();
    res.json({ chat });
  });

  app.patch('/api/chats/:chatId/settings', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const chat = store.chats.find(
      (c) => c.id === String(req.params.chatId) && c.type === 'group' && c.participantIds.includes(uid)
    );
    if (!chat) {
      res.status(404).json({ error: 'Group not found.' });
      return;
    }
    const { title, bio, avatarUrl, requireAddApproval, restrictions } = req.body as {
      title?: string;
      bio?: string;
      avatarUrl?: string;
      requireAddApproval?: boolean;
      restrictions?: GroupRestrictions;
    };
    const isAdminEditingRestrictions =
      requireAddApproval !== undefined || restrictions !== undefined;
    const isInfoEdit =
      title !== undefined || bio !== undefined || avatarUrl !== undefined;

    if (isAdminEditingRestrictions && !isGroupAdmin(chat, uid)) {
      res.status(403).json({ error: 'Admin permission required to update group restrictions.' });
      return;
    }
    if (isInfoEdit && !canEditGroupInfo(chat, uid)) {
      res.status(403).json({ error: 'Only group admins can edit group info.' });
      return;
    }

    if (title !== undefined && title.trim()) chat.title = title.trim().slice(0, 80);
    if (bio !== undefined) chat.bio = bio.trim().slice(0, 160);
    if (avatarUrl !== undefined) chat.avatarUrl = avatarUrl;
    if (requireAddApproval !== undefined) chat.requireAddApproval = Boolean(requireAddApproval);
    if (restrictions !== undefined) {
      chat.restrictions = {
        ...(chat.restrictions || {}),
        ...restrictions,
      };
    }
    persistStore();
    broadcastGlobalSync();
    res.json({ chat });
  });

  // Broadcast Channels (Unlocks at 500 followers)
  app.post('/api/broadcasts', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const user = store.usersPublic[uid];
    if (!user) {
      res.status(404).json({ error: 'Profile missing.' });
      return;
    }
    if (!canOpenBroadcastChannel(user.followersCount)) {
      res.status(403).json({
        error: `Broadcast Channels unlock at ${BROADCAST_MIN_FOLLOWERS} followers.`,
      });
      return;
    }
    const { title, description = '' } = req.body as { title?: string; description?: string };
    const channel: BroadcastChannel = {
      id: `bc_${Date.now()}`,
      title: (title || `${user.displayName}'s Broadcast`).trim().slice(0, 80),
      description: description.trim().slice(0, 300),
      ownerUid: uid,
      adminUids: [],
      moderatorUids: [],
      collaboratorUids: [],
      followerUids: [uid],
      messages: [],
      createdAt: new Date().toISOString(),
    };
    store.broadcastChannels.unshift(channel);
    persistStore();
    broadcastGlobalSync();
    res.json({ channel });
  });

  app.post('/api/broadcasts/:channelId/follow', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const ch = store.broadcastChannels.find((b) => b.id === String(req.params.channelId));
    if (!ch) {
      res.status(404).json({ error: 'Channel not found.' });
      return;
    }
    const exists = ch.followerUids.includes(uid);
    ch.followerUids = exists
      ? ch.followerUids.filter((id) => id !== uid)
      : [...ch.followerUids, uid];
    persistStore();
    broadcastGlobalSync();
    res.json({ joined: !exists });
  });

  app.post('/api/broadcasts/:channelId/roles', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const ch = store.broadcastChannels.find((b) => b.id === String(req.params.channelId));
    if (!ch || ch.ownerUid !== uid) {
      res.status(403).json({ error: 'Only the channel owner can manage roles.' });
      return;
    }
    const { targetUid, role } = req.body as {
      targetUid?: string;
      role?: 'admin' | 'moderator' | 'collaborator' | 'follower';
    };
    if (!targetUid || targetUid === uid) {
      res.status(400).json({ error: 'Invalid target user.' });
      return;
    }
    ch.adminUids = ch.adminUids.filter((id) => id !== targetUid);
    ch.moderatorUids = ch.moderatorUids.filter((id) => id !== targetUid);
    ch.collaboratorUids = ch.collaboratorUids.filter((id) => id !== targetUid);
    if (role === 'admin') ch.adminUids.push(targetUid);
    if (role === 'moderator') ch.moderatorUids.push(targetUid);
    if (role === 'collaborator') ch.collaboratorUids.push(targetUid);
    persistStore();
    broadcastGlobalSync();
    res.json({ channel: ch });
  });

  app.post('/api/broadcasts/:channelId/messages', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const ch = store.broadcastChannels.find((b) => b.id === String(req.params.channelId));
    const user = store.usersPublic[uid];
    if (!ch || !user) {
      res.status(404).json({ error: 'Channel not found.' });
      return;
    }
    if (!canPostInBroadcast(ch, uid)) {
      res.status(403).json({ error: 'Only Owner, Admins, or Collaborators can send messages here.' });
      return;
    }
    const { text, mediaUrl } = req.body as { text?: string; mediaUrl?: string };
    const msg: BroadcastMessage = {
      id: `bm_${Date.now()}`,
      channelId: ch.id,
      senderUid: uid,
      senderName: user.displayName,
      text: (text || '').trim(),
      mediaUrl,
      likesCount: 0,
      likedByUids: [],
      reactions: {},
      createdAt: new Date().toISOString(),
    };
    ch.messages.push(msg);
    persistStore();
    broadcastGlobalSync();
    res.json({ message: msg });
  });

  app.post(
    '/api/broadcasts/:channelId/messages/:msgId/react',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const uid = req.uid!;
      const ch = store.broadcastChannels.find((b) => b.id === String(req.params.channelId));
      const msg = ch?.messages.find((m) => m.id === String(req.params.msgId));
      if (!msg) {
        res.status(404).json({ error: 'Message not found.' });
        return;
      }
      const { emoji, like } = req.body as { emoji?: string; like?: boolean };
      if (like) {
        const hasLiked = msg.likedByUids.includes(uid);
        msg.likedByUids = hasLiked
          ? msg.likedByUids.filter((id) => id !== uid)
          : [...msg.likedByUids, uid];
        msg.likesCount = msg.likedByUids.length;
      }
      if (emoji) {
        const list = msg.reactions[emoji] || [];
        msg.reactions[emoji] = list.includes(uid)
          ? list.filter((id) => id !== uid)
          : [...list, uid];
      }
      persistStore();
      broadcastGlobalSync();
      res.json({ message: msg });
    }
  );

  // Reports (for future Admin Panel review)
  app.post('/api/reports', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const { targetType, targetId, reason } = req.body as {
      targetType?: ReportItem['targetType'];
      targetId?: string;
      reason?: string;
    };
    if (!targetType || !targetId || !reason || reason.trim().length < 3) {
      res.status(400).json({ error: 'Report reason must be at least 3 characters.' });
      return;
    }
    const report: ReportItem = {
      id: `rep_${Date.now()}`,
      reporterUid: uid,
      targetType,
      targetId,
      reason: reason.trim().slice(0, 500),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    store.reports.unshift(report);
    persistStore();
    res.json({ report });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
    store.notifications.forEach((n) => {
      if (n.recipientUid === req.uid) n.read = true;
    });
    persistStore();
    res.json({ ok: true });
  });

  // AI Profile Assistant
  app.post('/api/ai/profile-assist', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
        return;
      }

      const { task, contextText, currentBio, language } = req.body as {
        task?: string;
        contextText?: string;
        currentBio?: string;
        language?: 'en' | 'bn';
      };

      const validTasks = ['bio', 'usernames', 'caption', 'improve_bio', 'smart_replies', 'profile_tips'];
      if (!task || !validTasks.includes(task)) {
        res.status(400).json({ error: 'Invalid AI assistant task requested.' });
        return;
      }

      const langLabel = language === 'bn' ? 'Bengali (বাংলা)' : 'English';
      const prompt = [
        `You are the SocialVerse AI Profile Assistant. Respond strictly in ${langLabel}.`,
        `Task: ${task}`,
        contextText ? `User context/topic: ${contextText.slice(0, 500)}` : '',
        currentBio ? `Current bio: ${currentBio.slice(0, 150)}` : '',
        'Provide 3 concise, creative, ready-to-use suggestions without clichés or hashtag spam.',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Three ready-to-use suggestions tailored to the user request.',
              },
              tip: {
                type: Type.STRING,
                description: 'One concise tip for improving profile engagement.',
              },
            },
            required: ['suggestions', 'tip'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim() || '{"suggestions":[],"tip":""}');
      res.json({
        uid: req.uid,
        task,
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        tip: typeof parsed.tip === 'string' ? parsed.tip : '',
      });
    } catch (error) {
      console.error('Gemini API error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to generate AI suggestions.',
      });
    }
  });

  // Structured JSON error handler for 413 PayloadTooLargeError / malformed bodies
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const e = err as { type?: string; status?: number; statusCode?: number; message?: string };
    if (e && (e.type === 'entity.too.large' || e.status === 413 || e.statusCode === 413)) {
      res.status(413).json({
        error:
          'Uploaded payload exceeds the single-request size limit. Please select the file again so it uploads via chunked media streaming, or use a smaller file.',
      });
      return;
    }
    if (e && e.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON request payload.' });
      return;
    }
    next(err);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (req.url?.startsWith('/ws')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (ws) => {
    let authedUid: string | null = null;

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(String(raw)) as {
          type?: string;
          token?: string;
          targetUid?: string;
          callId?: string;
          chatId?: string;
          mode?: 'voice' | 'video';
          sdp?: unknown;
          candidate?: unknown;
        };

        if (data.type === 'auth' && data.token) {
          const uid = verifySessionToken(data.token);
          if (uid) {
            authedUid = uid;
            if (!wsClientsByUid.has(uid)) wsClientsByUid.set(uid, new Set());
            wsClientsByUid.get(uid)!.add(ws);
            if (store.usersPublic[uid]) {
              store.usersPublic[uid].onlineStatus = 'online';
              store.usersPublic[uid].lastSeenAt = new Date().toISOString();
            }
            ws.send(JSON.stringify({ type: 'state:sync', state: buildStateForUser(uid) }));
          }
          return;
        }

        // Relay typing indicator
        if (authedUid && data.type === 'chat:typing' && data.chatId) {
          const chat = store.chats.find((c) => c.id === data.chatId && c.participantIds.includes(authedUid!));
          if (chat) {
            const targets = chat.participantIds.filter((id) => id !== authedUid);
            broadcastWsEvent(targets, {
              type: 'chat:typing',
              chatId: chat.id,
              fromUid: authedUid,
            });
          }
          return;
        }

        // Relay WebRTC Call Signaling (offer, answer, ice, decline, end)
        if (
          authedUid &&
          data.targetUid &&
          data.type &&
          ['call:offer', 'call:answer', 'call:ice', 'call:decline', 'call:end'].includes(data.type)
        ) {
          const caller = store.usersPublic[authedUid];
          sendWsToUser(data.targetUid, {
            ...data,
            fromUid: authedUid,
            fromName: caller?.displayName || 'User',
            fromAvatar: caller?.photoUrl || '',
          });
        }
      } catch {
        // Ignore malformed WS packets
      }
    });

    ws.on('close', () => {
      if (authedUid) {
        const set = wsClientsByUid.get(authedUid);
        if (set) {
          set.delete(ws);
          if (set.size === 0) {
            wsClientsByUid.delete(authedUid);
            if (store.usersPublic[authedUid]) {
              store.usersPublic[authedUid].onlineStatus = 'offline';
              store.usersPublic[authedUid].lastSeenAt = new Date().toISOString();
            }
          }
        }
      }
    });
  });

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SocialVerse server listening on http://0.0.0.0:${PORT}`);
    void backfillStoreToFirestore();
  });
}

startServer();
