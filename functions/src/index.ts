import * as admin from 'firebase-admin';
import express, { type NextFunction, type Request, type Response } from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenAI, Type } from '@google/genai';

admin.initializeApp();
const db = admin.firestore();
const geminiApiKey = defineSecret('GEMINI_API_KEY');

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
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: invalid Firebase ID token' });
  }
}

const api = express();
api.use(express.json({ limit: '1mb' }));

api.post('/ai/profile-assist', verifyFirebaseAuth, async (req: AuthRequest, res: Response) => {
  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
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

export const socialverseApi = onRequest({ secrets: [geminiApiKey], cors: true }, api);

export const onNotificationCreated = onDocumentCreated(
  'notifications/{notificationId}',
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
