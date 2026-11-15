import { useState } from 'react';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Fingerprint,
  Globe,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { IMG_ARIA, IMG_COASTAL, IMG_RAFI } from '../data/seed';
import { normalizeUsername } from '../utils/validation';

const INTEREST_OPTIONS = [
  'Architecture',
  'Photography',
  'Design',
  'Technology',
  'Music',
  'Travel',
  'Coffee',
  'Film',
  'Literature',
  'Fitness',
];

const AVATAR_PRESETS = [IMG_ARIA, IMG_RAFI, IMG_COASTAL];

function AuthFormCard({
  onDismiss,
  reason,
}: {
  onDismiss?: () => void;
  reason?: string | null;
}) {
  const {
    t,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
  } = useSocialVerse();

  const [authTab, setAuthTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    setLoading(true);
    try {
      if (authTab === 'login') {
        await signInWithEmail(email, password);
      } else if (authTab === 'register') {
        await registerWithEmail(email, password);
      } else {
        await sendPasswordReset(email);
        setAuthInfo('Password reset link sent to your email.');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthInfo(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In could not complete.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1.5">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-cyan-500 text-white flex items-center justify-center font-display font-bold text-lg shadow-lg shadow-sky-600/25">
          SV
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white pt-1">
          {reason ? t.auth.authGateTitle : t.appName}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xs mx-auto">
          {reason || t.auth.authGateDesc}
        </p>
      </div>

      {/* Primary instant Google Sign-In */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full min-h-[46px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2.5 shadow-md disabled:opacity-60"
      >
        <span className="w-5 h-5 rounded-full bg-white text-slate-900 flex items-center justify-center text-xs font-bold">
          G
        </span>
        <span>{t.auth.googleSignIn}</span>
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">or</span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/70">
        <button
          type="button"
          onClick={() => {
            setAuthTab('login');
            setAuthError(null);
            setAuthInfo(null);
          }}
          className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
            authTab === 'login'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {t.auth.signIn}
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthTab('register');
            setAuthError(null);
            setAuthInfo(null);
          }}
          className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
            authTab === 'register'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {t.auth.register}
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthTab('forgot');
            setAuthError(null);
            setAuthInfo(null);
          }}
          className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
            authTab === 'forgot'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Reset
        </button>
      </div>

      <form onSubmit={handleAuthSubmit} className="space-y-3.5">
        <div>
          <label
            htmlFor="modal-auth-email"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            {t.auth.emailLabel}
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="modal-auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-white/85 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {authTab !== 'forgot' && (
          <div>
            <label
              htmlFor="modal-auth-password"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              {t.auth.passwordLabel}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="modal-auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-white/85 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        )}

        {authError && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-300 leading-relaxed"
          >
            {authError}
          </div>
        )}
        {authInfo && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {authInfo}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {loading
            ? '...'
            : authTab === 'login'
            ? t.auth.signIn
            : authTab === 'register'
            ? t.auth.register
            : t.auth.sendReset}
        </button>
      </form>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="w-full min-h-[40px] text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          {t.auth.continueBrowsing}
        </button>
      )}
    </div>
  );
}

export function AuthModal() {
  const { authModalOpen, authModalReason, closeAuthModal } = useSocialVerse();
  if (!authModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in or create account"
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="liquid-glass rounded-3xl p-6 sm:p-7 max-w-md w-full relative shadow-2xl max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          aria-label="Close sign in dialog"
          onClick={closeAuthModal}
          className="absolute right-4 top-4 min-h-[40px] min-w-[40px] rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800/60 flex items-center justify-center text-slate-500 dark:text-slate-400"
        >
          <X className="w-5 h-5" />
        </button>
        <AuthFormCard onDismiss={closeAuthModal} reason={authModalReason} />
      </div>
    </div>
  );
}

export function AuthFlow() {
  const {
    stage,
    setStage,
    t,
    language,
    setLanguage,
    theme,
    setTheme,
    enterPreviewMode,
    completeOnboarding,
    uploadProfileImage,
    currentUser,
  } = useSocialVerse();

  const [loading, setLoading] = useState(false);

  // Onboarding state
  const [username, setUsername] = useState(currentUser.username || '');
  const [displayName, setDisplayName] = useState(currentUser.displayName || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [photoUrl, setPhotoUrl] = useState(currentUser.photoUrl || IMG_ARIA);
  const [interests, setInterests] = useState<string[]>(['Design', 'Photography']);
  const [isPrivate, setIsPrivate] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  if (stage === 'splash') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-between bg-gradient-to-br from-slate-50 via-sky-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950 p-8">
        <div />
        <div className="flex flex-col items-center text-center max-w-xs w-full">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-500 via-blue-600 to-cyan-500 text-white flex items-center justify-center font-display font-bold text-3xl shadow-2xl shadow-sky-600/30 animate-pulse">
            SV
          </div>
          <h1 className="mt-6 text-2xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
            {t.appName}
          </h1>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {t.auth.splashLoading}
          </p>
          <div className="mt-5 w-40 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 animate-[pulse_1.2s_ease-in-out_infinite]" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
            from SocialVerse
          </p>
          <button
            type="button"
            onClick={() => setStage('app')}
            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline min-h-[36px] px-3"
          >
            {t.feed.recommended} →
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'onboarding') {
    const toggleInterest = (item: string) => {
      setInterests((prev) =>
        prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item].slice(0, 8)
      );
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const url = await uploadProfileImage(file, 'avatar');
        setPhotoUrl(url);
      } catch {
        setOnboardingError('Could not process selected photo.');
      }
    };

    const handleOnboardingSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setOnboardingError(null);
      setLoading(true);
      const err = await completeOnboarding({
        username,
        displayName,
        bio,
        photoUrl,
        interests,
        isPrivate,
      });
      setLoading(false);
      if (err) setOnboardingError(err);
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-sky-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950 p-4 sm:p-8">
        <div className="liquid-glass rounded-3xl p-6 sm:p-8 max-w-xl w-full">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t.auth.onboardingTitle}
          </h1>
          <form onSubmit={handleOnboardingSubmit} className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative">
                <img
                  src={photoUrl}
                  alt="Selected avatar"
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow"
                />
                <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center cursor-pointer shadow">
                  <Camera className="w-3.5 h-3.5" />
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="sr-only" />
                </label>
              </div>
              <div className="flex gap-2">
                {AVATAR_PRESETS.map((preset, idx) => (
                  <button
                    key={preset}
                    type="button"
                    aria-label={`Choose avatar preset ${idx + 1}`}
                    onClick={() => setPhotoUrl(preset)}
                    className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-transform ${
                      photoUrl === preset
                        ? 'border-sky-600 scale-105'
                        : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={preset}
                      alt={`Preset ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="onboard-username"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  {t.auth.usernameLabel}
                </label>
                <input
                  id="onboard-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  placeholder="aria_chowdhury"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label
                  htmlFor="onboard-displayname"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  {t.auth.displayNameLabel}
                </label>
                <input
                  id="onboard-displayname"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Aria Chowdhury"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="onboard-bio"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {t.auth.bioLabel}
              </label>
              <textarea
                id="onboard-bio"
                rows={3}
                maxLength={240}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t.auth.interestsLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((item) => {
                  const active = interests.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleInterest(item)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        active
                          ? 'bg-sky-600 text-white'
                          : 'bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-sm text-slate-800 dark:text-slate-200">
                {t.auth.privateAccountLabel}
              </span>
            </label>

            {onboardingError && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{onboardingError}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {loading ? '...' : t.auth.completeSetup}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Fallback dedicated auth screen if navigated explicitly
  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-slate-100 via-sky-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center font-display font-bold text-sm">
            SV
          </div>
          <span className="font-display font-bold text-lg text-slate-900 dark:text-white">
            {t.appName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Switch language"
            onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
            className="min-h-[44px] px-3 rounded-xl liquid-glass-subtle text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
          >
            <Globe className="w-4 h-4" />
            <span>{language === 'en' ? 'বাংলা' : 'English'}</span>
          </button>
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="min-h-[44px] min-w-[44px] rounded-xl liquid-glass-subtle text-slate-800 dark:text-slate-200 flex items-center justify-center"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto w-full my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <section className="lg:col-span-6 space-y-5">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight [text-wrap:balance]">
            {t.tagline}
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300 max-w-lg leading-relaxed">
            Real-time stories, vertical reels, voice messaging, and Gemini-powered profile craft in a calm Liquid Glass space built in English and বাংলা.
          </p>
          <div className="space-y-2.5 pt-2 text-sm text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
              <span>24-hour expiring stories & vertical short-video reels</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
              <span>Zero-Trust Firebase rules, private PII isolation & biometric app lock</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Fingerprint className="w-4 h-4 text-sky-600 shrink-0" />
              <span>Server-authenticated Gemini AI Profile Assistant</span>
            </div>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={enterPreviewMode}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold inline-flex items-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-slate-900/10"
            >
              <span>{t.auth.previewDemo}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        <section className="lg:col-span-6">
          <div className="liquid-glass rounded-3xl p-6 sm:p-8 max-w-md mx-auto w-full">
            <AuthFormCard />
          </div>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto w-full text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span>SocialVerse · com.socialverse.app</span>
        <span>English / বাংলা</span>
      </footer>
    </div>
  );
}
