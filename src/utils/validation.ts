import type { Story, UserPrivate } from '../types/social';

export const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;
export const DOC_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}

export function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 50;
}

export function isValidBio(bio: string): boolean {
  return bio.length <= 240;
}

export function isValidPostCaption(caption: string): boolean {
  return caption.trim().length >= 1 && caption.length <= 2200;
}

export function isValidCommentText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length >= 1 && trimmed.length <= 1000;
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_\u0980-\u09FF]{1,40}/g);
  if (!matches) return [];
  const unique = new Set(matches.map((tag) => tag.slice(1).toLowerCase()));
  return Array.from(unique).slice(0, 20);
}

export function isStoryActive(story: Pick<Story, 'expiresAt'>, nowMs: number = Date.now()): boolean {
  const exp = Date.parse(story.expiresAt);
  if (Number.isNaN(exp)) return false;
  return exp > nowMs;
}

export function canMessageUser(
  recipientPrivacy: Pick<UserPrivate, 'whoCanMessage' | 'blockedUserIds'>,
  senderUid: string,
  isFollower: boolean
): boolean {
  if (recipientPrivacy.blockedUserIds.includes(senderUid)) return false;
  if (recipientPrivacy.whoCanMessage === 'nobody') return false;
  if (recipientPrivacy.whoCanMessage === 'followers') return isFollower;
  return true;
}

export function formatCompactCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.max(0, Math.floor(count)));
}

export function formatRelativeTime(isoDate: string, lang: 'en' | 'bn' = 'en'): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - Date.parse(isoDate)) / 1000));
  if (Number.isNaN(diffSec)) return '';
  if (diffSec < 60) return lang === 'bn' ? 'এইমাত্র' : 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return lang === 'bn' ? `${mins} মি.` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === 'bn' ? `${hrs} ঘ.` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return lang === 'bn' ? `${days} দিন` : `${days}d`;
}

export function isValidWebsiteUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (trimmed.length > 200) return false;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    return Boolean(parsed.hostname && parsed.hostname.includes('.'));
  } catch {
    return false;
  }
}

export function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function mapFirebaseAuthError(error: unknown, lang: 'en' | 'bn' = 'en'): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const msg = error instanceof Error ? error.message : String(error || '');
  const full = `${code} ${msg}`;

  if (full.includes('auth/operation-not-allowed')) {
    return lang === 'bn'
      ? 'Firebase Console-এ Email/Password চালু করা নেই (Authentication → Sign-in method)। অনুগ্রহ করে "Google দিয়ে চালিয়ে যান" ব্যবহার করুন অথবা Console থেকে Email/Password চালু করুন।'
      : 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method). Use "Continue with Google" below, or enable Email/Password for project ai-studio-applet-webapp-7613c.';
  }
  if (full.includes('auth/email-already-in-use')) {
    return lang === 'bn'
      ? 'এই ইমেইল দিয়ে ইতিমধ্যেই অ্যাকাউন্ট তৈরি করা আছে। অনুগ্রহ করে সাইন ইন করুন।'
      : 'An account with this email already exists. Try signing in instead.';
  }
  if (
    full.includes('auth/invalid-credential') ||
    full.includes('auth/wrong-password') ||
    full.includes('auth/user-not-found')
  ) {
    return lang === 'bn'
      ? 'ইমেইল বা পাসওয়ার্ড সঠিক নয়। আবার চেষ্টা করুন।'
      : 'Incorrect email or password. Please check and try again.';
  }
  if (full.includes('auth/weak-password')) {
    return lang === 'bn'
      ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'
      : 'Password must be at least 6 characters.';
  }
  if (full.includes('auth/invalid-email')) {
    return lang === 'bn'
      ? 'সঠিক ইমেইল ঠিকানা লিখুন।'
      : 'Please enter a valid email address.';
  }
  if (full.includes('auth/popup-blocked')) {
    return lang === 'bn'
      ? 'ব্রাউজার পপআপ ব্লক করেছে। পপআপ অনুমতি দিন অথবা ইমেইল দিয়ে সাইন ইন করুন।'
      : 'Sign-in popup was blocked by your browser. Allow popups for this site and try again.';
  }
  if (full.includes('auth/popup-closed-by-user')) {
    return lang === 'bn'
      ? 'সাইন-ইন উইন্ডো বন্ধ করা হয়েছে।'
      : 'Google sign-in window was closed before completing.';
  }
  if (full.includes('auth/unauthorized-domain')) {
    return lang === 'bn'
      ? 'এই ডোমেইনটি Firebase Auth-এ অনুমোদিত নয়। Firebase Console → Authentication → Settings → Authorized domains-এ ডোমেইন যোগ করুন।'
      : 'This domain is not authorized in Firebase Auth. Add it in Firebase Console → Authentication → Settings → Authorized domains.';
  }
  if (full.includes('auth/too-many-requests')) {
    return lang === 'bn'
      ? 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'
      : 'Too many attempts. Please wait a moment and try again.';
  }
  if (full.includes('auth/network-request-failed')) {
    return lang === 'bn'
      ? 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে। ইন্টারনেট যাচাই করুন।'
      : 'Network error connecting to Firebase. Check your connection and retry.';
  }
  return msg || (lang === 'bn' ? 'সাইন ইন সম্পন্ন করা যায়নি।' : 'Authentication failed. Please try again.');
}

