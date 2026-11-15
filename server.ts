import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8')) as {
  projectId: string;
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

interface AuthenticatedRequest extends Request {
  uid?: string;
}

async function requireFirebaseAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Firebase Authorization Bearer token.' });
    return;
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Empty Firebase ID token.' });
    return;
  }
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    console.error('Firebase token verification failed:', err);
    res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'socialverse-api', projectId: firebaseConfig.projectId });
  });

  app.post('/api/ai/profile-assist', requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
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
        currentBio ? `Current bio: ${currentBio.slice(0, 240)}` : '',
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

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SocialVerse server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
