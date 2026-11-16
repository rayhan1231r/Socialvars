import crypto from 'node:crypto';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import express, { type NextFunction, type Request, type Response } from 'express';
import nodemailer from 'nodemailer';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenAI, Type } from '@google/genai';

admin.initializeApp();
const FIRESTORE_DATABASE_ID = 'ai-studio-socialvars-97ff1f90-9f9c-4f3f-9c56-da1a6eacb55e';
const db = getFirestore(FIRESTORE_DATABASE_ID);

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const gmailUser = defineSecret('GMAIL_USER');
const gmailAppPassword = defineSecret('GMAIL_APP_PASSWORD');
const appSecret = defineSecret('APP_SECRET');

function readSecretSafe(secret: ReturnType<typeof defineSecret>, envFallbackKey: string): string {
  try {
    const val = secret.value();
    if (val) return val;
  } catch {
    // Fallback to process.env if running in emulator/local
  }
  return process.env[envFallbackKey] || '';
}

function hashWithSecret(value: string): string {
  const secret = readSecretSafe(appSecret, 'APP_SECRET') || 'socialverse-cloud-otp';
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function canonicalizeEmail(raw: string): string {
  const clean = raw.trim().toLowerCase();
  const [localPart, domainPart] = clean.split('@');
  if (!localPart || !domainPart) return clean;
  const normalizedDomain = domainPart === 'googlemail.com' ? 'gmail.com' : domainPart;
  const plusIdx = localPart.indexOf('+');
  let baseLocal = plusIdx >= 0 ? localPart.slice(0, plusIdx) : localPart;
  if (normalizedDomain === 'gmail.com') {
    baseLocal = baseLocal.replace(/\./g, '');
  }
  return `${baseLocal}@${normalizedDomain}`;
}

function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '');
}

interface AuthRequest extends Request {
  uid?: string;
}

async function verifyFirebaseAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization Bearer token' });
    return;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(header.slice(7).trim());
    req.uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: invalid Firebase ID token' });
  }
}

const api = express();
api.use(express.json({ limit: '1mb' }));

api.post('/auth/resolve-login', async (req: Request, res: Response) => {
  try {
    const rawIdentifier = String((req.body as { identifier?: string }).identifier || '')
      .trim()
      .toLowerCase();
    if (!rawIdentifier) {
      res.status(400).json({ error: 'Identifier is required.' });
      return;
    }
    if (rawIdentifier.includes('@') && !rawIdentifier.startsWith('@')) {
      res.json({ ok: true, email: rawIdentifier });
      return;
    }
    const username = normalizeUsername(rawIdentifier);
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    const claimSnap = await db.doc(`usernames/${username}`).get();
    const uid = claimSnap.data()?.uid as string | undefined;
    if (!uid) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    const userRecord = await admin.auth().getUser(uid);
    if (!userRecord.email) {
      res.status(404).json({ error: 'No email linked to this account.' });
      return;
    }
    res.json({ ok: true, email: userRecord.email.toLowerCase() });
  } catch {
    res.status(404).json({ error: 'Account not found.' });
  }
});

api.post('/auth/send-otp', async (req: Request, res: Response) => {
  try {
    const { email, purpose = 'signup', language = 'en' } = req.body as {
      email?: string;
      purpose?: 'signup' | 'reset' | '2fa';
      language?: 'en' | 'bn';
    };
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const canonical = canonicalizeEmail(cleanEmail);
    const emailHash = crypto.createHash('sha256').update(canonical).digest('hex');

    if (purpose === 'signup') {
      const claimSnap = await db.doc(`email_claims/${emailHash}`).get();
      let authExists = false;
      try {
        await admin.auth().getUserByEmail(cleanEmail);
        authExists = true;
      } catch {
        authExists = false;
      }
      if (claimSnap.exists || authExists) {
        res.status(409).json({
          error:
            language === 'bn'
              ? 'এই ইমেইলটি ইতিমধ্যেই ভেরিফাই করা এবং এটি দিয়ে একটি অ্যাকাউন্ট খোলা আছে — অনুগ্রহ করে সাইন ইন করুন।'
              : 'This email is already verified and registered to an account — please sign in.',
          code: 'EMAIL_ALREADY_EXISTS',
          alreadyVerified: true,
        });
        return;
      }
    }

    const smtpUser = readSecretSafe(gmailUser, 'GMAIL_USER');
    const smtpPass = readSecretSafe(gmailAppPassword, 'GMAIL_APP_PASSWORD');
    const code = String(crypto.randomInt(100000, 1000000));
    const docId = crypto.createHash('sha256').update(`${purpose}:${cleanEmail}`).digest('hex');

    await db.doc(`auth_otps/${docId}`).set({
      email: cleanEmail,
      purpose,
      codeHash: hashWithSecret(`${purpose}:${cleanEmail}:${code}`),
      expiresAt: Date.now() + 10 * 60_000,
    });

    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: `"SocialVerse" <${smtpUser}>`,
        to: cleanEmail,
        subject:
          purpose === 'reset'
            ? 'SocialVerse Password Reset Code'
            : purpose === '2fa'
            ? 'SocialVerse Two-Factor Security Code'
            : 'SocialVerse Verification Code',
        html: `
          <div style="font-family:Inter,system-ui,sans-serif;padding:24px;background:#f8fafc;border-radius:16px;max-width:460px;margin:auto;">
            <h2 style="margin:0 0 8px;color:#0f172a;">SocialVerse</h2>
            <p style="margin:0 0 18px;color:#475569;font-size:14px;">Your 6-digit verification code:</p>
            <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0284c7;background:#ffffff;padding:16px 20px;border-radius:12px;text-align:center;border:1px solid #e2e8f0;">
              ${code}
            </div>
            <p style="margin:18px 0 0;color:#64748b;font-size:12px;">Expires in 10 minutes.</p>
          </div>
        `,
      });
      res.json({ ok: true, sentViaSmtp: true });
      return;
    }

    res.json({ ok: true, sentViaSmtp: false });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'OTP send failure' });
  }
});

api.post('/auth/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, code, purpose = 'signup' } = req.body as {
      email?: string;
      code?: string;
      purpose?: 'signup' | 'reset' | '2fa';
    };
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();
    const docId = crypto.createHash('sha256').update(`${purpose}:${cleanEmail}`).digest('hex');
    const snap = await db.doc(`auth_otps/${docId}`).get();
    const data = snap.data();

    if (!data || Number(data.expiresAt) < Date.now()) {
      res.status(400).json({ error: 'Verification code expired or not found.' });
      return;
    }
    if (data.codeHash !== hashWithSecret(`${purpose}:${cleanEmail}:${cleanCode}`)) {
      res.status(400).json({ error: 'Invalid 6-digit verification code.' });
      return;
    }

    await db.doc(`auth_otps/${docId}`).delete();
    const verificationToken = crypto.randomBytes(24).toString('hex');
    await db.doc(`auth_verifications/${verificationToken}`).set({
      email: cleanEmail,
      purpose,
      expiresAt: Date.now() + 20 * 60_000,
    });
    res.json({ ok: true, verificationToken });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'OTP verify failure' });
  }
});

api.post('/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { verificationToken, email, newPassword } = req.body as {
      verificationToken?: string;
      email?: string;
      newPassword?: string;
    };
    const cleanEmail = String(email || '').trim().toLowerCase();
    const tok = String(verificationToken || '');
    if (!tok || !newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'Valid token and 6+ character password required.' });
      return;
    }
    const verSnap = await db.doc(`auth_verifications/${tok}`).get();
    const ver = verSnap.data();
    if (!ver || ver.email !== cleanEmail || Number(ver.expiresAt) < Date.now()) {
      res.status(400).json({ error: 'Verification expired. Please verify your code again.' });
      return;
    }
    const user = await admin.auth().getUserByEmail(cleanEmail);
    await admin.auth().updateUser(user.uid, { password: newPassword });
    await db.doc(`auth_verifications/${tok}`).delete();
    res.json({ ok: true, method: 'direct' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Password reset failed' });
  }
});

api.post('/ai/profile-assist', verifyFirebaseAuth, async (req: AuthRequest, res: Response) => {
  try {
    const ai = new GoogleGenAI({ apiKey: readSecretSafe(geminiApiKey, 'GEMINI_API_KEY') });
    const { task, contextText, currentBio, language } = req.body as {
      task?: string;
      contextText?: string;
      currentBio?: string;
      language?: 'en' | 'bn';
    };

    const allowed = ['bio', 'usernames', 'caption', 'improve_bio', 'smart_replies', 'profile_tips'];
    if (!task || !allowed.includes(task)) {
      res.status(400).json({ error: 'Invalid AI task' });
      return;
    }

    const langName = language === 'bn' ? 'Bengali (বাংলা)' : 'English';
    const prompt = [
      `You are the SocialVerse AI Profile Assistant. Respond strictly in ${langName}.`,
      `Task: ${task}`,
      contextText ? `Context: ${contextText.slice(0, 500)}` : '',
      currentBio ? `Current bio: ${currentBio.slice(0, 240)}` : '',
      'Generate 3 concise, creative suggestions and 1 actionable tip.',
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
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            tip: { type: Type.STRING },
          },
          required: ['suggestions', 'tip'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim() || '{"suggestions":[],"tip":""}');
    res.json({ uid: req.uid, task, ...parsed });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'AI error' });
  }
});

api.post('/account/delete', verifyFirebaseAuth, async (req: AuthRequest, res: Response) => {
  const uid = req.uid!;
  const batch = db.batch();
  batch.delete(db.doc(`users/${uid}/private/info`));
  batch.delete(db.doc(`users/${uid}`));
  await batch.commit();
  await admin.auth().deleteUser(uid);
  res.json({ deleted: true, uid });
});

export const socialverseApi = onRequest(
  { secrets: [geminiApiKey, gmailUser, gmailAppPassword, appSecret], cors: true },
  api
);

export const onNotificationCreated = onDocumentCreated(
  {
    document: 'notifications/{notificationId}',
    database: FIRESTORE_DATABASE_ID,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const recipientUid = data.recipientUid as string;
    const tokenSnap = await db.doc(`users/${recipientUid}/private/fcm`).get();
    const fcmToken = tokenSnap.data()?.token as string | undefined;
    if (!fcmToken) return;

    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: 'SocialVerse',
        body: `@${data.actorUsername || 'someone'} ${data.summary || 'interacted with you'}`,
      },
      data: {
        type: String(data.type || ''),
        targetId: String(data.targetId || ''),
      },
    });
  }
);

export const cleanupExpiredStories = onSchedule('every 60 minutes', async () => {
  const now = admin.firestore.Timestamp.now();
  const expired = await db.collection('stories').where('expiresAt', '<=', now).limit(200).get();
  if (expired.empty) return;
  const batch = db.batch();
  expired.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
});
