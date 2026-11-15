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
  ChatThemeConfig,
  FriendRequest,
  NicknameFontStyle,
  NoteItem,
  Post,
  PostComment,
  PostVisibility,
  ReportItem,
  StickerItem,
  Story,
  UserPrivate,
  UserPublic,
} from './src/types/social';
import {
  BROADCAST_MIN_FOLLOWERS,
  MAX_BIO_LENGTH,
  MAX_GROUP_MEMBERS,
  canAddGroupMembers,
  canChangeNickname,
  canChangeUsername,
  canOpenBroadcastChannel,
  canPostInBroadcast,
  canRemoveGroupMember,
  canonicalizeEmail,
  extractHashtags,
  isDisposableEmail,
  isGroupAdmin,
  isGroupOwner,
  isValidBio,
  isValidCommentText,
  isValidDisplayName,
  isValidEmailFormat,
  isValidPostCaption,
  isValidUsername,
  normalizeUsername,
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

const SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET ||
  crypto.createHash('sha256').update(`socialverse:${firebaseConfig.projectId}`).digest('hex');

const LOOKUP_AES_KEY = crypto.createHash('sha256').update(SESSION_SECRET).digest();

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'socialverse-store.json');

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
  purpose: 'signup' | 'reset' | '2fa';
  codeHash: string;
  expiresAt: number;
}

interface VerificationGrant {
  token: string;
  email: string;
  purpose: 'signup' | 'reset' | '2fa';
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

function decryptLookupEmail(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, encB64] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      LOOKUP_AES_KEY,
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
): Promise<boolean> {
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
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Firestore commit exception:', err);
    return false;
  }
}

async function persistUserDocsToFirestore(params: {
  uid: string;
  userPublic: UserPublic;
  userPrivate: UserPrivate;
  canonicalEmail: string;
  idToken: string;
}): Promise<void> {
  const { uid, userPublic, userPrivate, canonicalEmail, idToken } = params;
  const emailHash = sha256Hex(canonicalEmail);
  const encEmail = encryptLookupEmail(userPrivate.email);

  // Respect firestore.rules size guards (photoUrl/coverUrl <= 200000)
  const safePhotoUrl = userPublic.photoUrl.length <= 200000 ? userPublic.photoUrl : '';
  const safeCoverUrl = userPublic.coverUrl.length <= 200000 ? userPublic.coverUrl : '';

  const publicFields: Record<string, unknown> = {
    uid: userPublic.uid,
    username: userPublic.username,
    displayName: userPublic.displayName,
    nicknameFont: userPublic.nicknameFont || 'classic',
    bio: userPublic.bio,
    pronouns: userPublic.pronouns || '',
    website: userPublic.website || '',
    noteText: userPublic.noteText || '',
    photoUrl: safePhotoUrl,
    coverUrl: safeCoverUrl,
    interests: userPublic.interests || [],
    isPrivate: userPublic.isPrivate,
    isDeactivated: Boolean(userPublic.isDeactivated),
    followersCount: userPublic.followersCount,
    followingCount: userPublic.followingCount,
    postsCount: userPublic.postsCount,
    onlineStatus: userPublic.onlineStatus || 'online',
    onboardingCompleted: true,
  };

  const privateFields: Record<string, unknown> = {
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

  const writes = [
    {
      update: {
        name: firestoreDocPathName(`users/${uid}`),
        fields: toFirestoreFields(publicFields),
      },
      updateTransforms: [
        { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
        { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
      ],
    },
    {
      update: {
        name: firestoreDocPathName(`users/${uid}/private/info`),
        fields: toFirestoreFields(privateFields),
      },
      updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
    },
    {
      update: {
        name: firestoreDocPathName(`usernames/${userPublic.username}`),
        fields: toFirestoreFields({
          uid,
          username: userPublic.username,
          encEmail,
        }),
      },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
    },
    {
      update: {
        name: firestoreDocPathName(`email_claims/${emailHash}`),
        fields: toFirestoreFields({
          uid,
          emailHash,
          encEmail,
        }),
      },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
    },
  ];

  await firestoreCommitWrites(writes, idToken);
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

async function verifyDomainCanReceiveEmail(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (!domain) return false;
  if (TRUSTED_MAIL_DOMAINS.has(domain)) return true;
  if (isDisposableEmail(email)) return false;
  try {
    const mxPromise = dns.resolveMx(domain);
    const timeoutPromise = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), 2500)
    );
    const result = await Promise.race([mxPromise, timeoutPromise]);
    if (result === 'timeout') return true;
    return Array.isArray(result) && result.length > 0;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'NXDOMAIN') {
      return false;
    }
    return true;
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
  purpose: 'signup' | 'reset' | '2fa'
): Promise<{ sentViaSmtp: boolean }> {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.trim();
  if (!gmailUser || !gmailPass) {
    return { sentViaSmtp: false };
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });

  const subjectMap = {
    signup: 'SocialVerse Verification Code',
    reset: 'SocialVerse Password Reset Code',
    '2fa': 'SocialVerse Two-Factor Login Code',
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
    return null;
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

  const activeStories = store.stories.filter((s) => {
    const exp = Date.parse(s.expiresAt);
    if (Number.isNaN(exp) || exp <= nowMs) return false;
    const author = store.usersPublic[s.authorId];
    if (!author || author.isDeactivated) return false;
    if (s.authorId === viewerUid) return true;
    if (s.privacy !== 'everyone' && !viewerFollowing.includes(s.authorId)) return false;
    return true;
  });

  const activeNotes = store.notes.filter((n) => Date.parse(n.expiresAt) > nowMs);

  const userChats = viewerUid
    ? store.chats.filter((c) => c.participantIds.includes(viewerUid))
    : [];

  const messagesByChat: Record<string, ChatMessage[]> = {};
  userChats.forEach((c) => {
    const rawMsgs = store.messagesByChat[c.id] || [];
    const maxAgeMs =
      c.disappearingMode === '24h'
        ? 24 * 3_600_000
        : c.disappearingMode === '7d'
        ? 7 * 24 * 3_600_000
        : null;
    messagesByChat[c.id] = maxAgeMs
      ? rawMsgs.filter((m) => nowMs - Date.parse(m.createdAt) <= maxAgeMs)
      : rawMsgs;
  });

  const userRequests = viewerUid
    ? store.friendRequests.filter((r) => r.toUid === viewerUid || r.fromUid === viewerUid)
    : [];

  const userNotifications = viewerUid
    ? store.notifications.filter((n) => n.recipientUid === viewerUid)
    : [];

  const favoriteStickerIds = viewerUid ? store.favoriteStickersByUser[viewerUid] || [] : [];

  return {
    currentUser: viewerUid ? store.usersPublic[viewerUid] || null : null,
    userPrivate: viewerUid ? store.usersPrivate[viewerUid] || null : null,
    creators: activeCreators,
    posts: visiblePosts,
    commentsByPost: store.commentsByPost,
    stories: activeStories,
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'socialverse-api',
      projectId: firebaseConfig.projectId,
      smtpConfigured: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    });
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
        purpose?: 'signup' | 'reset' | '2fa';
        language?: 'en' | 'bn';
      };

      const check = validateSignupEmail(email || '', language);
      if (!check.valid) {
        res.status(400).json({
          error: check.reason || 'Please enter a valid permanent email address.',
          code: isDisposableEmail(email || '') ? 'DISPOSABLE_EMAIL' : 'INVALID_EMAIL',
        });
        return;
      }

      const { cleanEmail, canonicalEmail } = check;
      if (purpose === 'signup') {
        const domainValid = await verifyDomainCanReceiveEmail(cleanEmail);
        if (!domainValid) {
          res.status(400).json({
            error:
              language === 'bn'
                ? 'এই ইমেইল ডোমেইনটি কার্যকর নয়। আপনার আসল Gmail বা স্থায়ী ইমেইল ব্যবহার করুন।'
                : 'This email domain cannot receive verification mail. Use a valid Gmail or permanent email.',
            code: 'INVALID_DOMAIN',
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
      const accountExists = Boolean(localMatch || (remoteClaim && remoteClaim.uid));

      if (purpose === 'signup' && accountExists) {
        res.status(409).json({
          error:
            language === 'bn'
              ? 'একটি Gmail / ইমেইল দিয়ে শুধুমাত্র একটি অ্যাকাউন্ট খোলা যাবে। এই ইমেইলে ইতিমধ্যেই অ্যাকাউন্ট আছে — অনুগ্রহ করে সাইন ইন করুন।'
              : 'Only one account is allowed per Gmail/email. An account with this email already exists — please sign in.',
          code: 'EMAIL_ALREADY_EXISTS',
          existingEmail: localMatch?.email || cleanEmail,
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
      purpose?: 'signup' | 'reset' | '2fa';
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
        photoUrl = '',
        language = 'en',
      } = req.body as {
        verificationToken?: string;
        email?: string;
        password?: string;
        displayName?: string;
        nicknameFont?: NicknameFontStyle;
        username?: string;
        photoUrl?: string;
        language?: 'en' | 'bn';
      };

      const emailCheck = validateSignupEmail(email || '', language === 'bn' ? 'bn' : 'en');
      if (!emailCheck.valid) {
        res.status(400).json({
          error: emailCheck.reason || 'Temporary or invalid email is not allowed.',
          code: 'DISPOSABLE_EMAIL',
        });
        return;
      }

      const { cleanEmail, canonicalEmail } = emailCheck;
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

      const emailHash = sha256Hex(canonicalEmail);
      const localEmailTaken = store.accounts.some(
        (a) =>
          !a.deleted &&
          (a.email === cleanEmail || (a.canonicalEmail || canonicalizeEmail(a.email)) === canonicalEmail)
      );
      const remoteEmailClaim = !localEmailTaken ? await firestoreGetDoc(`email_claims/${emailHash}`) : null;
      if (localEmailTaken || (remoteEmailClaim && remoteEmailClaim.uid)) {
        res.status(409).json({
          error: 'Only one account is allowed per Gmail/email. Please sign in instead.',
          code: 'EMAIL_ALREADY_EXISTS',
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

      // Create user in Firebase Auth so account survives container restarts & across deployments
      let uid = `u_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      let firebaseIdToken: string | undefined;
      let firebaseRefreshToken: string | undefined;

      try {
        const fbRes = await firebaseAuthPost<{
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
        uid = fbRes.localId;
        firebaseIdToken = fbRes.idToken;
        firebaseRefreshToken = fbRes.refreshToken;
      } catch (fbErr) {
        const msg = fbErr instanceof Error ? fbErr.message : '';
        if (msg.includes('EMAIL_EXISTS')) {
          res.status(409).json({
            error: 'An account with this email already exists. Please sign in instead.',
            code: 'EMAIL_ALREADY_EXISTS',
          });
          return;
        }
        // Only swallow non-conflict errors if Firebase provider isn't reachable
        console.warn('Firebase signUp fallback to local store:', msg);
      }

      const nowIso = new Date().toISOString();
      const passwordHash = await bcrypt.hash(password, 10);

      store.accounts.push({
        uid,
        email: cleanEmail,
        canonicalEmail,
        username: cleanUsername,
        passwordHash,
        firebaseRefreshToken,
        createdAt: nowIso,
      });

      const userPublic: UserPublic = {
        uid,
        username: cleanUsername,
        displayName: cleanDisplayName,
        nicknameFont,
        bio: '',
        pronouns: '',
        website: '',
        noteText: '',
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
        notificationPrefs: {
          follows: true,
          friendRequests: true,
          likes: true,
          comments: true,
          stories: true,
          messages: true,
          mentions: true,
          announcements: true,
        },
        blockedUserIds: [],
        mutedStoryUserIds: [],
        updatedAt: nowIso,
      };

      store.usersPublic[uid] = userPublic;
      store.usersPrivate[uid] = userPrivate;

      // Consume verification token ONLY after account creation succeeds
      verificationGrants.delete(verificationToken!);
      persistStoreImmediate();

      if (firebaseIdToken) {
        await persistUserDocsToFirestore({
          uid,
          userPublic,
          userPrivate,
          canonicalEmail,
          idToken: firebaseIdToken,
        });
      }

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

      const rawCanonical = rawId.includes('@') ? canonicalizeEmail(rawId) : '';
      const rawUsername = normalizeUsername(rawId.startsWith('@') ? rawId.slice(1) : rawId);

      let acct = store.accounts.find(
        (a) =>
          !a.deleted &&
          (a.email === rawId ||
            (rawCanonical && (a.canonicalEmail || canonicalizeEmail(a.email)) === rawCanonical) ||
            (!rawId.includes('@') && a.username === rawUsername))
      );

      let passwordValid = acct ? await bcrypt.compare(password, acct.passwordHash) : false;

      // Fallback / Cross-container Recovery via Firebase Auth + Cloud Firestore
      if (!acct || !passwordValid) {
        let candidateEmails: string[] = [];
        let fallbackUsername = rawUsername;

        if (acct) {
          candidateEmails.push(acct.email);
        } else if (rawId.includes('@')) {
          candidateEmails.push(rawId);
          const claim = await firestoreGetDoc(`email_claims/${sha256Hex(rawCanonical)}`);
          if (claim && typeof claim.encEmail === 'string') {
            const dec = decryptLookupEmail(claim.encEmail);
            if (dec && dec !== rawId) candidateEmails.unshift(dec);
          }
        } else if (isValidUsername(rawUsername)) {
          const usernameDoc = await firestoreGetDoc(`usernames/${rawUsername}`);
          if (usernameDoc && typeof usernameDoc.encEmail === 'string') {
            const dec = decryptLookupEmail(usernameDoc.encEmail);
            if (dec) candidateEmails.push(dec);
          }
        }

        candidateEmails = Array.from(new Set(candidateEmails.filter((e) => e.includes('@'))));

        let fbLogin: {
          localId: string;
          idToken: string;
          refreshToken: string;
          email: string;
        } | null = null;

        for (const candidateEmail of candidateEmails) {
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
          const recoveredEmail = (fbLogin.email || candidateEmails[0]).trim().toLowerCase();
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
            (isValidUsername(fallbackUsername) ? fallbackUsername : normalizeUsername(recoveredEmail.split('@')[0]) || `user_${recoveredUid.slice(0, 6)}`);

          if (acct) {
            acct.passwordHash = freshHash;
            acct.firebaseRefreshToken = fbLogin.refreshToken;
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
              language: (remotePriv?.language === 'bn' ? 'bn' : 'en'),
              themeMode: (remotePriv?.themeMode === 'dark' ? 'dark' : 'light'),
              biometricLockEnabled: Boolean(remotePriv?.biometricLockEnabled),
              twoFactorEnabled: Boolean(remotePriv?.twoFactorEnabled),
              saveLoginInfo: remotePriv?.saveLoginInfo !== false,
              whoCanMessage:
                (remotePriv?.whoCanMessage as UserPrivate['whoCanMessage']) || 'everyone',
              whoCanViewStories:
                (remotePriv?.whoCanViewStories as UserPrivate['whoCanViewStories']) || 'everyone',
              whoCanFollow: (remotePriv?.whoCanFollow as UserPrivate['whoCanFollow']) || 'everyone',
              notificationPrefs:
                (remotePriv?.notificationPrefs as UserPrivate['notificationPrefs']) || {
                  follows: true,
                  friendRequests: true,
                  likes: true,
                  comments: true,
                  stories: true,
                  messages: true,
                  mentions: true,
                  announcements: true,
                },
              blockedUserIds: Array.isArray(remotePriv?.blockedUserIds)
                ? (remotePriv.blockedUserIds as string[])
                : [],
              mutedStoryUserIds: Array.isArray(remotePriv?.mutedStoryUserIds)
                ? (remotePriv.mutedStoryUserIds as string[])
                : [],
              updatedAt: nowIso,
            };
            store.usersPrivate[recoveredUid] = recPriv;
          }

          // If remote docs didn't exist yet (older auth-only account), backfill them cleanly
          if (!remotePub || !remotePriv) {
            await persistUserDocsToFirestore({
              uid: recoveredUid,
              userPublic: store.usersPublic[recoveredUid],
              userPrivate: store.usersPrivate[recoveredUid],
              canonicalEmail: recoveredCanonical,
              idToken: fbLogin.idToken,
            });
          }
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
      if (pub) {
        pub.isDeactivated = false;
        pub.deactivatedUntil = null;
        pub.onlineStatus = 'online';
        pub.lastSeenAt = new Date().toISOString();
      }
      persistStoreImmediate();
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
    if (!acct) {
      res.status(404).json({ error: 'Account not found.' });
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
    verificationGrants.delete(verificationToken!);
    persistStoreImmediate();
    res.json({ ok: true });
  });

  app.post('/api/auth/deactivate', requireAuth, (req: AuthenticatedRequest, res) => {
    const { days = 7 } = req.body as { days?: number };
    const safeDays = Math.min(365, Math.max(1, Number(days) || 7));
    const user = store.usersPublic[req.uid!];
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    user.isDeactivated = true;
    user.deactivatedUntil = new Date(Date.now() + safeDays * 24 * 3_600_000).toISOString();
    user.onlineStatus = 'offline';
    persistStoreImmediate();
    broadcastGlobalSync();
    res.json({ ok: true, deactivatedUntil: user.deactivatedUntil });
  });

  app.delete('/api/auth/account', requireAuth, async (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const acct = store.accounts.find((a) => a.uid === uid);
    if (acct) {
      acct.deleted = true;
      if (acct.firebaseRefreshToken) {
        const refreshed = await refreshFirebaseIdToken(acct.firebaseRefreshToken);
        if (refreshed) {
          await firebaseAuthPost('accounts:delete', { idToken: refreshed.idToken }).catch(() => {});
        }
      }
    }
    delete store.usersPublic[uid];
    delete store.usersPrivate[uid];
    store.posts = store.posts.filter((p) => p.authorId !== uid);
    store.stories = store.stories.filter((s) => s.authorId !== uid);
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

    const updated: UserPublic = {
      ...user,
      displayName: nextDisplayName,
      nicknameFont: nextFont,
      username: nextUsername,
      bio: updates.bio !== undefined ? updates.bio : user.bio,
      pronouns: updates.pronouns !== undefined ? updates.pronouns.slice(0, 32) : user.pronouns,
      website: updates.website !== undefined ? updates.website.slice(0, 200) : user.website,
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
    if (acct.firebaseRefreshToken) {
      const priv = store.usersPrivate[uid];
      const canonical = acct.canonicalEmail || canonicalizeEmail(acct.email);
      if (priv) {
        refreshFirebaseIdToken(acct.firebaseRefreshToken)
          .then((refreshed) => {
            if (!refreshed) return;
            acct.firebaseRefreshToken = refreshed.refreshToken;
            return persistUserDocsToFirestore({
              uid,
              userPublic: updated,
              userPrivate: priv,
              canonicalEmail: canonical,
              idToken: refreshed.idToken,
            });
          })
          .catch(() => {});
      }
    }
    broadcastGlobalSync();
    res.json({ user: updated });
  });

  app.patch('/api/settings/private', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const current = store.usersPrivate[uid];
    if (!current) {
      res.status(404).json({ error: 'Private settings not found.' });
      return;
    }
    const next: UserPrivate = {
      ...current,
      ...req.body,
      uid,
      email: current.email,
      updatedAt: new Date().toISOString(),
    };
    store.usersPrivate[uid] = next;
    persistStore();
    res.json({ userPrivate: next });
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
      broadcastGlobalSync();
      res.json({ status: 'unfollowed' });
      return;
    }

    if (target.isPrivate) {
      const existingReq = store.friendRequests.find(
        (r) => r.fromUid === actorUid && r.toUid === targetUid && r.status === 'pending'
      );
      if (existingReq) {
        store.friendRequests = store.friendRequests.filter((r) => r.id !== existingReq.id);
        persistStore();
        broadcastGlobalSync();
        res.json({ status: 'cancelled' });
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
      store.notifications.unshift({
        id: `n_${Date.now()}`,
        recipientUid: targetUid,
        actorUid,
        actorUsername: actor.username,
        actorAvatar: actor.photoUrl,
        type: 'friend_request',
        summary: 'requested to follow you.',
        read: false,
        createdAt: new Date().toISOString(),
      });
      persistStore();
      broadcastGlobalSync();
      res.json({ status: 'requested' });
      return;
    }

    store.followingByUser[actorUid] = Array.from(new Set([...actorFollowing, targetUid]));
    store.followersByUser[targetUid] = Array.from(new Set([...targetFollowers, actorUid]));
    actor.followingCount = store.followingByUser[actorUid].length;
    target.followersCount = store.followersByUser[targetUid].length;

    store.notifications.unshift({
      id: `n_${Date.now()}`,
      recipientUid: targetUid,
      actorUid,
      actorUsername: actor.username,
      actorAvatar: actor.photoUrl,
      type: 'follow',
      summary: 'started following you.',
      read: false,
      createdAt: new Date().toISOString(),
    });
    persistStore();
    broadcastGlobalSync();
    res.json({ status: 'following' });
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
      }
    }
    persistStore();
    broadcastGlobalSync();
    res.json({ ok: true });
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
    broadcastGlobalSync();
    res.json({ ok: true });
  });

  app.post('/api/users/:targetUid/block', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const targetUid = String(req.params.targetUid);
    const priv = store.usersPrivate[uid];
    if (priv) {
      priv.blockedUserIds = Array.from(new Set([...priv.blockedUserIds, targetUid]));
      persistStore();
    }
    res.json({ ok: true });
  });

  app.delete('/api/users/:targetUid/block', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.uid!;
    const targetUid = String(req.params.targetUid);
    const priv = store.usersPrivate[uid];
    if (priv) {
      priv.blockedUserIds = priv.blockedUserIds.filter((id) => id !== targetUid);
      persistStore();
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
    persistStore();
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
      post.caption = caption.trim();
      post.hashtags = extractHashtags(caption);
    }
    if (visibility) post.visibility = visibility;
    persistStore();
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
    const list = store.likedPostIdsByUser[uid] || [];
    const liked = list.includes(postId);
    store.likedPostIdsByUser[uid] = liked ? list.filter((id) => id !== postId) : [...list, postId];
    post.likesCount = Math.max(0, post.likesCount + (liked ? -1 : 1));
    persistStore();
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
    res.json({ saved: !saved });
  });

  app.post('/api/posts/:postId/share', requireAuth, (req: AuthenticatedRequest, res) => {
    const post = store.posts.find((p) => p.id === String(req.params.postId));
    if (post) {
      post.sharesCount += 1;
      persistStore();
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
    persistStore();
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
    broadcastGlobalSync();
    res.json({ story });
  });

  app.delete('/api/stories/:storyId', requireAuth, (req: AuthenticatedRequest, res) => {
    store.stories = store.stories.filter(
      (s) => !(s.id === String(req.params.storyId) && s.authorId === req.uid)
    );
    persistStore();
    broadcastGlobalSync();
    res.json({ ok: true });
  });

  app.post('/api/stories/:storyId/react', requireAuth, (req: AuthenticatedRequest, res) => {
    const author = store.usersPublic[req.uid!];
    const story = store.stories.find((s) => s.id === String(req.params.storyId));
    if (story && author) {
      story.reactions.push({ username: author.username, emoji: String(req.body.emoji || '❤️') });
      persistStore();
      broadcastGlobalSync();
    }
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
    const { title, participantUids, type = 'direct' } = req.body as {
      title?: string;
      participantUids?: string[];
      type?: 'direct' | 'group';
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
      participantIds: uniqueParticipants,
      participantNames,
      participantAvatars,
      chatNicknames: {},
      ownerUid: type === 'group' ? uid : undefined,
      adminUids: type === 'group' ? [uid] : undefined,
      requireAddApproval: false,
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
        : msg.type === 'voice'
        ? 'Voice message'
        : msg.text || msg.fileName || 'Attachment';
    chat.lastMessageAt = msg.createdAt;
    // Mark unread for other participants, clear for sender
    chat.unreadByUids = chat.participantIds.filter((id) => id !== uid);
    // Unarchive chat automatically if receiving/sending new message
    chat.archivedByUids = [];
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
      res.json({ ok: true, status: 'already_member' });
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
      res.json({ ok: true, status: 'pending_approval' });
      return;
    }

    chat.participantIds.push(targetUid);
    chat.participantNames[targetUid] = targetUser.displayName;
    chat.participantAvatars[targetUid] = targetUser.photoUrl;
    chat.pendingMemberIds = (chat.pendingMemberIds || []).filter((id) => id !== targetUid);
    persistStore();
    broadcastGlobalSync();
    res.json({ ok: true, status: 'added' });
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
    res.json({ ok: true });
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
    res.json({ ok: true });
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
    if (!chat || !isGroupAdmin(chat, uid)) {
      res.status(403).json({ error: 'Admin permission required.' });
      return;
    }
    const { title, requireAddApproval } = req.body as {
      title?: string;
      requireAddApproval?: boolean;
    };
    if (title !== undefined && title.trim()) chat.title = title.trim().slice(0, 80);
    if (requireAddApproval !== undefined) chat.requireAddApproval = Boolean(requireAddApproval);
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
  });
}

startServer();
