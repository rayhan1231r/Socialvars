import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  AtSign,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  User as UserIcon,
  X,
  XCircle,
} from 'lucide-react';
import { ApiError, useSocialVerse } from '../context/SocialVerseContext';
import type { NicknameFontStyle, SavedLoginEntry } from '../types/social';
import {
  NICKNAME_FONT_CLASSES,
  isDisposableEmail,
  isValidUsername,
  normalizeUsername,
  validateSignupEmail,
} from '../utils/validation';
import { Avatar } from './Avatar';

type AuthViewMode =
  | 'signin'
  | 'signin_2fa'
  | 'signup_loading'
  | 'signup_email'
  | 'signup_otp'
  | 'signup_nickname'
  | 'signup_username'
  | 'signup_photo'
  | 'forgot_email'
  | 'forgot_otp'
  | 'forgot_newpass';

const FONT_OPTIONS: { id: NicknameFontStyle; label: string; sample: string }[] = [
  { id: 'classic', label: 'Classic', sample: 'Aria' },
  { id: 'serif', label: 'Serif', sample: 'Aria' },
  { id: 'mono', label: 'Mono', sample: 'Aria' },
  { id: 'display', label: 'Bold', sample: 'ARIA' },
  { id: 'italic', label: 'Italic', sample: 'Aria' },
];

const SIGNUP_MODE_TO_STEP: Partial<Record<AuthViewMode, number>> = {
  signup_email: 1,
  signup_otp: 2,
  signup_nickname: 3,
  signup_username: 4,
  signup_photo: 5,
};

function SignupProgressHeader({
  step,
  title,
  subtitle,
  language,
  onBack,
}: {
  step: number;
  title: string;
  subtitle: string;
  language: 'en' | 'bn';
  onBack?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={language === 'bn' ? 'পেছনে যান' : 'Go back'}
            className="min-h-[38px] min-w-[38px] rounded-full liquid-glass-subtle flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-[38px]" />
        )}

        <span className="text-[11px] font-semibold tracking-wider uppercase text-sky-600 dark:text-sky-400 font-mono-num">
          {language === 'bn' ? `ধাপ ${step} / ৫` : `Step ${step} of 5`}
        </span>

        <div className="w-[38px]" />
      </div>

      {/* 5-segment progress track */}
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={step}
        aria-label={`Step ${step} of 5`}
        className="grid grid-cols-5 gap-1.5"
      >
        {[1, 2, 3, 4, 5].map((idx) => {
          const completed = idx < step;
          const active = idx === step;
          return (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                completed
                  ? 'bg-sky-600'
                  : active
                  ? 'bg-gradient-to-r from-sky-500 to-cyan-500 shadow-sm shadow-sky-500/40'
                  : 'bg-slate-200/90 dark:bg-slate-800'
              }`}
            />
          );
        })}
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-display font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
}

function OtpDigitBoxes({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (val: string) => void;
  ariaLabel: string;
}) {
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');
  const activeIndex = Math.min(value.length, 5);

  return (
    <div className="relative">
      <div className="grid grid-cols-6 gap-2 sm:gap-2.5" aria-hidden="true">
        {digits.map((digit, i) => {
          const isFocused = i === activeIndex;
          return (
            <div
              key={i}
              className={`h-13 sm:h-14 rounded-2xl flex items-center justify-center font-mono text-xl font-bold transition-all border ${
                digit
                  ? 'bg-white/95 dark:bg-slate-900/90 border-sky-500 text-slate-900 dark:text-white shadow-sm shadow-sky-500/15'
                  : isFocused
                  ? 'bg-white/85 dark:bg-slate-900/75 border-sky-400/80 text-slate-400 ring-2 ring-sky-500/20'
                  : 'bg-white/65 dark:bg-slate-900/55 border-slate-200/90 dark:border-slate-700/80 text-slate-400'
              }`}
            >
              {digit || '•'}
            </div>
          );
        })}
      </div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-label={ariaLabel}
        className="absolute inset-0 w-full h-full opacity-0 cursor-text"
      />
    </div>
  );
}

function getPasswordStrength(password: string, language: 'en' | 'bn') {
  if (!password) return { level: 0, label: '' };
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 9 && /[A-Z0-9!@#$%^&*]/.test(password)) score += 1;
  if (password.length >= 12 && /[a-z]/.test(password) && /[0-9]/.test(password)) score += 1;
  if (score <= 1) {
    return {
      level: password.length < 6 ? 1 : 2,
      label:
        password.length < 6
          ? language === 'bn'
            ? 'কমপক্ষে ৬ অক্ষর দিন'
            : 'Use at least 6 characters'
          : language === 'bn'
          ? 'ভালো পাসওয়ার্ড'
          : 'Good password',
    };
  }
  return {
    level: 3,
    label: language === 'bn' ? 'শক্তিশালী পাসওয়ার্ড' : 'Strong password',
  };
}

export function AuthPanel({
  onDismiss,
  reason,
  initialMode = 'signin',
}: {
  onDismiss?: () => void;
  reason?: string | null;
  initialMode?: 'signin' | 'signup';
}) {
  const {
    t,
    language,
    savedLogins,
    removeSavedLogin,
    sendOtp,
    verifyOtp,
    checkUsernameAvailability,
    completeSignupRegistration,
    loginWithIdentifier,
    verifyTwoFactorLogin,
    loginWithSavedAccount,
    resetPasswordWithOtp,
    uploadProfileImage,
    updateProfile,
    setActiveTab,
    closeAuthModal,
  } = useSocialVerse();

  const [mode, setMode] = useState<AuthViewMode>(initialMode === 'signup' ? 'signup_email' : 'signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Sign In state
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [saveLogin, setSaveLogin] = useState(true);
  const [twoFaEmail, setTwoFaEmail] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');

  // Multi-step Sign Up state
  const [signupEmail, setSignupEmail] = useState('');
  const [existingAccountEmail, setExistingAccountEmail] = useState<string | null>(null);
  const [signupOtp, setSignupOtp] = useState('');
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [verificationToken, setVerificationToken] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [nickname, setNickname] = useState('');
  const [nicknameFont, setNicknameFont] = useState<NicknameFontStyle>('classic');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [photoUrl, setPhotoUrl] = useState('');

  // Forgot Password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');

  const signupStep = SIGNUP_MODE_TO_STEP[mode];
  const isSignupFlow = mode === 'signup_loading' || Boolean(signupStep);

  const inlineEmailCheck = useMemo(() => {
    if (!signupEmail.trim()) return null;
    const isDisposable = isDisposableEmail(signupEmail);
    const hasDomain = signupEmail.includes('@') && signupEmail.split('@')[1]?.includes('.');
    if (isDisposable) {
      return validateSignupEmail(signupEmail, language);
    }
    if (hasDomain) {
      return validateSignupEmail(signupEmail, language);
    }
    return null;
  }, [signupEmail, language]);

  // Resend cooldown timer
  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const id = setTimeout(() => setOtpResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [otpResendCooldown]);

  const usernameSuggestions = useMemo(() => {
    const base = normalizeUsername(nickname || signupEmail.split('@')[0] || 'creator').slice(0, 16);
    const cleanBase = base.length >= 3 ? base : `sv_${base || 'user'}`;
    return Array.from(
      new Set([
        cleanBase,
        `${cleanBase.slice(0, 18)}_sv`,
        `${cleanBase.slice(0, 18)}_${String((signupEmail.length * 7 + 13) % 90 + 10)}`,
      ])
    ).filter((s) => isValidUsername(s));
  }, [nickname, signupEmail]);

  const startSignupFlow = () => {
    setError(null);
    setInfo(null);
    setMode('signup_loading');
    setTimeout(() => {
      setMode('signup_email');
    }, 520);
  };

  // Real-time live username uniqueness check
  useEffect(() => {
    if (mode !== 'signup_username') return;
    const clean = normalizeUsername(username);
    if (!clean) {
      setUsernameStatus('idle');
      return;
    }
    if (!isValidUsername(clean)) {
      setUsernameStatus('invalid');
      return;
    }
    let cancelled = false;
    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(clean);
        if (!cancelled) {
          setUsernameStatus(res.available ? 'available' : 'taken');
        }
      } catch {
        if (!cancelled) setUsernameStatus('idle');
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, mode, checkUsernameAvailability]);

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await loginWithIdentifier(identifier, loginPassword, saveLogin);
      if (res.requires2fa && res.email) {
        setTwoFaEmail(res.email);
        setMode('signin_2fa');
        if (!res.sentViaSmtp && res.devOtpCode) {
          setInfo(
            language === 'bn'
              ? `স্যান্ডবক্স মোড 2FA কোড: ${res.devOtpCode}`
              : `Sandbox 2FA code: ${res.devOtpCode}`
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyTwoFactorLogin(twoFaEmail, twoFaCode, saveLogin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid 2FA code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavedLoginClick = async (entry: SavedLoginEntry) => {
    setError(null);
    setLoading(true);
    try {
      await loginWithSavedAccount(entry);
    } catch (err) {
      setIdentifier(entry.username || entry.email);
      setInfo(
        language === 'bn'
          ? `@${entry.username} অ্যাকাউন্টটি সচল আছে — শুধু পাসওয়ার্ড দিয়ে সাইন ইন করুন।`
          : `Found @${entry.username} — enter your password to sign back in.`
      );
      if (err instanceof ApiError && err.status !== 401) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const dispatchSignupOtp = async () => {
    setError(null);
    setInfo(null);
    setExistingAccountEmail(null);

    const check = validateSignupEmail(signupEmail, language);
    if (!check.valid) {
      setError(check.reason || 'Please enter a valid permanent email.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendOtp(check.cleanEmail, 'signup');
      setSignupEmail(check.cleanEmail);
      setMode('signup_otp');
      setOtpResendCooldown(30);
      if (!res.sentViaSmtp && res.devOtpCode) {
        setInfo(
          language === 'bn'
            ? `Gmail SMTP সেট না থাকায় প্রিভিউ কোড: ${res.devOtpCode}`
            : `Gmail SMTP not configured in env — verification code: ${res.devOtpCode}`
        );
      } else {
        setInfo(
          language === 'bn'
            ? `${check.cleanEmail}-এ ৬-ডিজিটের কোড পাঠানো হয়েছে।`
            : `6-digit verification code sent to ${check.cleanEmail}.`
        );
      }
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'EMAIL_ALREADY_EXISTS' || err.status === 409)) {
        setExistingAccountEmail(err.existingEmail || check.cleanEmail);
      }
      setError(err instanceof Error ? err.message : 'Could not send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatchSignupOtp();
  };

  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = await verifyOtp(signupEmail, signupOtp, 'signup');
      setVerificationToken(token);
      setInfo(null);
      setMode('signup_nickname');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleNicknameStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nickname.trim()) {
      setError(language === 'bn' ? 'আপনার নিকনেম লিখুন।' : 'Please enter a nickname.');
      return;
    }
    if (signupPassword.length < 6) {
      setError(language === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters.');
      return;
    }
    setMode('signup_username');
  };

  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = normalizeUsername(username);
    if (!isValidUsername(clean)) {
      setUsernameStatus('invalid');
      setError(t.auth.usernameInvalid);
      return;
    }
    if (usernameStatus === 'taken') {
      setError(t.auth.usernameTaken);
      return;
    }

    setLoading(true);
    try {
      if (usernameStatus !== 'available') {
        const checkRes = await checkUsernameAvailability(clean);
        if (!checkRes.available) {
          setUsernameStatus('taken');
          setError(t.auth.usernameTaken);
          setLoading(false);
          return;
        }
        setUsernameStatus('available');
      }

      await completeSignupRegistration({
        verificationToken,
        email: signupEmail,
        password: signupPassword,
        displayName: nickname.trim(),
        nicknameFont,
        username: clean,
        photoUrl: '',
        saveLogin,
      });
      setMode('signup_photo');
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'EMAIL_ALREADY_EXISTS' || err.status === 409)) {
        if (err.message.toLowerCase().includes('username')) {
          setUsernameStatus('taken');
        } else {
          setExistingAccountEmail(err.existingEmail || signupEmail);
        }
      }
      setError(err instanceof Error ? err.message : 'Could not complete sign up.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const url = await uploadProfileImage(file, 'avatar');
      setPhotoUrl(url);
      await updateProfile({ photoUrl: url });
    } catch {
      setError(language === 'bn' ? 'ছবিটি লোড করা যায়নি।' : 'Could not process selected photo.');
    } finally {
      setLoading(false);
    }
  };

  const finishPhotoStep = () => {
    closeAuthModal();
    setActiveTab('profile');
    onDismiss?.();
  };

  const handleForgotSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await sendOtp(resetEmail, 'reset');
      setMode('forgot_otp');
      if (!res.sentViaSmtp && res.devOtpCode) {
        setInfo(`Verification code: ${res.devOtpCode}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = await verifyOtp(resetEmail, resetOtp, 'reset');
      setResetToken(token);
      setInfo(null);
      setMode('forgot_newpass');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotResetPass = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetPasswordWithOtp(resetToken, resetEmail, resetNewPass);
      setMode('signin');
      setInfo(language === 'bn' ? 'নতুন পাসওয়ার্ড সেট হয়েছে। এখন সাইন ইন করুন।' : 'Password updated. Sign in now.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(signupPassword, language);

  return (
    <div className="space-y-5">
      {/* Generic brand header only outside the 5-step Sign Up pages */}
      {!isSignupFlow && (
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-cyan-500 text-white flex items-center justify-center font-display font-bold text-lg shadow-lg shadow-sky-600/25">
            SV
          </div>
          <h2 className="text-xl font-display font-bold tracking-tight text-slate-900 dark:text-white pt-1">
            {t.appName}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-xs mx-auto">
            {reason || t.auth.authGateDesc}
          </p>
        </div>
      )}

      {/* Loading screen transition when starting Sign Up */}
      {mode === 'signup_loading' && (
        <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-cyan-500 text-white flex items-center justify-center font-display font-bold text-xl shadow-lg shadow-sky-600/25">
              SV
            </div>
            <div className="absolute -inset-2 rounded-3xl border-2 border-sky-500/40 border-t-sky-600 animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {language === 'bn' ? 'সাইন আপ পেজ প্রস্তুত হচ্ছে...' : 'Preparing your Sign Up...'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.auth.splashLoading}</p>
          </div>
        </div>
      )}

      {/* SIGN IN VIEW */}
      {mode === 'signin' && (
        <div className="space-y-4">
          {savedLogins.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t.auth.savedLoginsTitle}
              </p>
              <div className="space-y-1.5">
                {savedLogins.map((entry) => (
                  <div
                    key={entry.uid}
                    className="flex items-center justify-between gap-2 p-2 rounded-2xl liquid-glass-subtle"
                  >
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleSavedLoginClick(entry)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                    >
                      <Avatar src={entry.photoUrl} name={entry.displayName} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {entry.displayName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">@{entry.username}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove saved account @${entry.username}`}
                      onClick={() => removeSavedLogin(entry.uid)}
                      className="min-h-[34px] min-w-[34px] rounded-xl text-slate-400 hover:text-rose-600 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSignInSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {t.auth.identifierLabel}
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="username or email@example.com"
                  className="w-full min-h-[46px] pl-10 pr-3.5 rounded-2xl bg-white/85 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {t.auth.passwordLabel}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[46px] pl-10 pr-11 rounded-2xl bg-white/85 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((s) => !s)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveLogin}
                  onChange={(e) => setSaveLogin(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600"
                />
                <span>{t.auth.saveLoginInfo}</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setMode('forgot_email');
                }}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline shrink-0"
              >
                {t.auth.forgotPassword}
              </button>
            </div>

            {error && (
              <div role="alert" className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}
            {info && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[46px] rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white text-sm font-semibold shadow-md shadow-sky-600/20 transition-all disabled:opacity-60"
            >
              {loading ? '...' : t.auth.signIn}
            </button>
          </form>

          <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800/70 text-center space-y-2">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'bn' ? 'নতুন ব্যবহারকারী?' : 'New to SocialVerse?'}
            </p>
            <button
              type="button"
              onClick={startSignupFlow}
              className="w-full min-h-[46px] rounded-2xl liquid-glass-subtle text-sm font-semibold text-sky-700 dark:text-sky-300 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors"
            >
              {t.auth.register}
            </button>
          </div>
        </div>
      )}

      {/* 2FA VERIFICATION VIEW */}
      {mode === 'signin_2fa' && (
        <form onSubmit={handleVerify2fa} className="space-y-4">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.auth.otpTitle}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{twoFaEmail}</p>
          </div>
          <OtpDigitBoxes value={twoFaCode} onChange={setTwoFaCode} ariaLabel={t.auth.otpPlaceholder} />
          {info && (
            <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-xs font-medium text-sky-700 dark:text-sky-300">
              {info}
            </div>
          )}
          {error && (
            <div role="alert" className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || twoFaCode.length < 6}
            className="w-full min-h-[46px] rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold disabled:opacity-50"
          >
            {loading ? '...' : t.auth.verifyCode}
          </button>
        </form>
      )}

      {/* SIGN UP STEP 1/5: EMAIL ADDRESS */}
      {mode === 'signup_email' && (
        <form onSubmit={handleSendSignupOtp} className="space-y-5">
          <SignupProgressHeader
            step={1}
            language={language}
            title={language === 'bn' ? 'আপনার ইমেইল দিন' : 'Enter your email address'}
            subtitle={
              language === 'bn'
                ? 'অ্যাকাউন্ট ভেরিফাই করতে আপনার ইমেইলে ৬-ডিজিটের একটি কোড পাঠানো হবে।'
                : "We'll send a 6-digit confirmation code to verify your email."
            }
            onBack={() => {
              setError(null);
              setMode('signin');
            }}
          />

          <div className="p-4 rounded-2xl liquid-glass-subtle space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  {t.auth.emailLabel}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === 'bn' ? 'একটি সক্রিয় ইমেইল ব্যবহার করুন' : 'Use an active Gmail or email inbox'}
                </p>
              </div>
            </div>

            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                autoFocus
                value={signupEmail}
                onChange={(e) => {
                  setSignupEmail(e.target.value);
                  setError(null);
                  setExistingAccountEmail(null);
                }}
                placeholder="you@gmail.com"
                aria-label={t.auth.emailLabel}
                className={`w-full min-h-[48px] pl-10 pr-3.5 rounded-xl bg-white/90 dark:bg-slate-900/80 border text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                  inlineEmailCheck && !inlineEmailCheck.valid
                    ? 'border-rose-500 focus:ring-rose-500/40'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-sky-500'
                }`}
              />
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'bn'
                ? 'একটি Gmail / ইমেইল দিয়ে একটি অ্যাকাউন্ট খোলা যাবে (টেম্পোরারি মেইল অনুমোদিত নয়)।'
                : 'One account per Gmail/email · Temporary or disposable emails are blocked.'}
            </p>
          </div>

          {inlineEmailCheck && !inlineEmailCheck.valid && (
            <div
              role="alert"
              className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2"
            >
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{inlineEmailCheck.reason}</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-300 space-y-2.5"
            >
              <p>{error}</p>
              {existingAccountEmail && (
                <button
                  type="button"
                  onClick={() => {
                    setIdentifier(existingAccountEmail);
                    setError(null);
                    setInfo(
                      language === 'bn'
                        ? `${existingAccountEmail}-এর পাসওয়ার্ড দিয়ে সাইন ইন করুন।`
                        : `Sign in using your password for ${existingAccountEmail}.`
                    );
                    setExistingAccountEmail(null);
                    setMode('signin');
                  }}
                  className="w-full min-h-[38px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors"
                >
                  {language === 'bn'
                    ? 'এই ইমেইল দিয়ে সাইন ইন করুন →'
                    : 'Sign In with this email →'}
                </button>
              )}
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="submit"
              disabled={loading || Boolean(inlineEmailCheck && !inlineEmailCheck.valid)}
              className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white text-sm font-semibold shadow-md shadow-sky-600/20 inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? (language === 'bn' ? 'কোড পাঠানো হচ্ছে...' : 'Sending code...') : t.auth.sendCode}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setExistingAccountEmail(null);
                setMode('signin');
              }}
              className="w-full min-h-[38px] text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"
            >
              {language === 'bn' ? 'আগে থেকেই অ্যাকাউন্ট আছে? সাইন ইন করুন' : 'Already have an account? Sign In'}
            </button>
          </div>
        </form>
      )}

      {/* SIGN UP STEP 2/5: DEDICATED 6-DIGIT OTP VERIFICATION */}
      {mode === 'signup_otp' && (
        <form onSubmit={handleVerifySignupOtp} className="space-y-5">
          <SignupProgressHeader
            step={2}
            language={language}
            title={t.auth.otpTitle}
            subtitle={t.auth.otpDesc}
            onBack={() => {
              setError(null);
              setMode('signup_email');
            }}
          />

          <div className="p-3.5 rounded-2xl liquid-glass-subtle flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === 'bn' ? 'কোড পাঠানো হয়েছে' : 'Sent to'}
                </p>
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {signupEmail}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSignupOtp('');
                setMode('signup_email');
              }}
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline shrink-0"
            >
              {language === 'bn' ? 'পরিবর্তন' : 'Change'}
            </button>
          </div>

          <div className="space-y-3">
            <OtpDigitBoxes
              value={signupOtp}
              onChange={setSignupOtp}
              ariaLabel={t.auth.otpPlaceholder}
            />

            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-slate-500 dark:text-slate-400">
                {language === 'bn' ? 'কোড পাননি?' : "Didn't receive the code?"}
              </span>
              <button
                type="button"
                disabled={loading || otpResendCooldown > 0}
                onClick={dispatchSignupOtp}
                className="inline-flex items-center gap-1 font-semibold text-sky-600 dark:text-sky-400 disabled:text-slate-400"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {otpResendCooldown > 0
                    ? language === 'bn'
                      ? `${otpResendCooldown} সে.`
                      : `Resend in ${otpResendCooldown}s`
                    : language === 'bn'
                    ? 'পুনরায় পাঠান'
                    : 'Resend code'}
                </span>
              </button>
            </div>
          </div>

          {info && (
            <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-xs font-medium text-sky-700 dark:text-sky-300">
              {info}
            </div>
          )}
          {error && (
            <div role="alert" className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || signupOtp.length < 6}
            className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white text-sm font-semibold shadow-md shadow-sky-600/20 inline-flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{loading ? '...' : t.auth.verifyCode}</span>
          </button>
        </form>
      )}

      {/* SIGN UP STEP 3/5: STYLED NICKNAME + FONT + PASSWORD */}
      {mode === 'signup_nickname' && (
        <form onSubmit={handleNicknameStep} className="space-y-4">
          <SignupProgressHeader
            step={3}
            language={language}
            title={t.auth.nicknameTitle}
            subtitle={
              language === 'bn'
                ? 'আপনার পছন্দমতো ফন্টে নিকনেম সাজান এবং একটি নিরাপদ পাসওয়ার্ড দিন।'
                : 'Personalize how your nickname looks and create your password.'
            }
            onBack={() => {
              setError(null);
              setMode('signup_otp');
            }}
          />

          {/* Live Styled Profile Preview */}
          <div className="p-3.5 rounded-2xl liquid-glass-subtle flex items-center gap-3">
            <Avatar src="" name={nickname || 'SV'} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {language === 'bn' ? 'প্রোফাইল প্রিভিউ' : 'Live profile preview'}
              </p>
              <p
                className={`text-lg text-slate-900 dark:text-white truncate ${NICKNAME_FONT_CLASSES[nicknameFont]}`}
              >
                {nickname.trim() || (language === 'bn' ? 'আপনার নিকনেম' : 'Your Nickname')}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="signup-nickname"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {t.auth.nicknameLabel}
              </label>
              <span className="text-[11px] font-mono-num text-slate-400">
                {nickname.length}/50
              </span>
            </div>
            <input
              id="signup-nickname"
              type="text"
              required
              maxLength={50}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={language === 'bn' ? 'যেমন: রাফি আহমেদ' : 'e.g. Aria Rahman'}
              className={`w-full min-h-[46px] px-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 ${NICKNAME_FONT_CLASSES[nicknameFont]}`}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.auth.fontStyleLabel}
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {FONT_OPTIONS.map((opt) => {
                const selected = nicknameFont === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setNicknameFont(opt.id)}
                    className={`min-h-[54px] px-1.5 py-2 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${
                      selected
                        ? 'bg-sky-600 text-white border-sky-600 shadow-sm shadow-sky-600/25'
                        : 'liquid-glass-subtle text-slate-800 dark:text-slate-200 border-transparent hover:border-sky-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className={`text-xs leading-tight ${NICKNAME_FONT_CLASSES[opt.id]}`}>
                      {nickname.trim().slice(0, 5) || opt.sample}
                    </span>
                    <span
                      className={`text-[9px] font-sans ${
                        selected ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="signup-password"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {t.auth.passwordLabel}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="signup-password"
                type={showSignupPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder={language === 'bn' ? 'কমপক্ষে ৬ অক্ষর' : 'Minimum 6 characters'}
                className="w-full min-h-[46px] pl-10 pr-11 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={() => setShowSignupPassword((s) => !s)}
                aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {signupPassword.length > 0 && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="grid grid-cols-3 gap-1 flex-1">
                  {[1, 2, 3].map((bar) => (
                    <div
                      key={bar}
                      className={`h-1 rounded-full ${
                        passwordStrength.level >= bar
                          ? passwordStrength.level === 1
                            ? 'bg-rose-500'
                            : passwordStrength.level === 2
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                          : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                  {passwordStrength.label}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white text-sm font-semibold shadow-md shadow-sky-600/20 transition-all"
          >
            {language === 'bn' ? 'পরবর্তী ধাপে যান' : 'Continue'}
          </button>
        </form>
      )}

      {/* SIGN UP STEP 4/5: LIVE UNIQUE USERNAME CHECK */}
      {mode === 'signup_username' && (
        <form onSubmit={handleCompleteSignup} className="space-y-4">
          <SignupProgressHeader
            step={4}
            language={language}
            title={t.auth.usernameStepTitle}
            subtitle={
              language === 'bn'
                ? 'প্রতিটি ইউজারনেম সম্পূর্ণ ইউনিক — অন্য কেউ এই ইউজারনেম ব্যবহার করতে পারবে না।'
                : 'Your @username is uniquely yours and checked in real time.'
            }
            onBack={() => {
              setError(null);
              setMode('signup_nickname');
            }}
          />

          <div className="p-3 rounded-2xl liquid-glass-subtle flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'bn' ? 'নিকনেম' : 'Nickname'}
            </span>
            <span className={`text-sm text-slate-900 dark:text-white ${NICKNAME_FONT_CLASSES[nicknameFont]}`}>
              {nickname.trim()}
            </span>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="signup-username"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {t.auth.usernameLabel}
            </label>
            <div className="relative">
              <AtSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="signup-username"
                type="text"
                required
                autoFocus
                maxLength={24}
                value={username}
                onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                placeholder="unique_username"
                className={`w-full min-h-[48px] pl-10 pr-10 rounded-2xl bg-white/90 dark:bg-slate-900/80 border text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                  usernameStatus === 'available'
                    ? 'border-emerald-500 focus:ring-emerald-500/30'
                    : usernameStatus === 'taken'
                    ? 'border-rose-500 focus:ring-rose-500/30'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-sky-500'
                }`}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && (
                  <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
                )}
                {usernameStatus === 'available' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                )}
                {usernameStatus === 'taken' && (
                  <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                )}
              </div>
            </div>

            <div className="min-h-[38px]">
              {usernameStatus === 'checking' && (
                <div className="px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                  <span>{language === 'bn' ? 'ইউজারনেম যাচাই করা হচ্ছে...' : 'Checking availability...'}</span>
                </div>
              )}
              {usernameStatus === 'available' && (
                <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>@{normalizeUsername(username)} — {t.auth.usernameAvailable}</span>
                </div>
              )}
              {usernameStatus === 'taken' && (
                <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>@{normalizeUsername(username)} — {t.auth.usernameTaken}</span>
                </div>
              )}
              {usernameStatus === 'invalid' && (
                <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-700 dark:text-amber-300">
                  {t.auth.usernameInvalid}
                </div>
              )}
              {usernameStatus === 'idle' && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  {t.auth.usernameInvalid}
                </p>
              )}
            </div>

            {usernameSuggestions.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-sky-500" />
                  <span>{language === 'bn' ? 'দ্রুত পছন্দ' : 'Quick ideas'}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {usernameSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setUsername(suggestion)}
                      className="min-h-[30px] px-2.5 rounded-xl liquid-glass-subtle text-xs font-mono text-slate-700 dark:text-slate-200 hover:border-sky-400 transition-colors"
                    >
                      @{suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !isValidUsername(normalizeUsername(username)) || usernameStatus === 'taken'}
            className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white text-sm font-semibold shadow-md shadow-sky-600/20 inline-flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{loading ? '...' : t.auth.completeSetup}</span>
          </button>
        </form>
      )}

      {/* SIGN UP STEP 5/5: PROFILE PHOTO OR SKIP */}
      {mode === 'signup_photo' && (
        <div className="space-y-5">
          <SignupProgressHeader
            step={5}
            language={language}
            title={t.auth.photoStepTitle}
            subtitle={
              language === 'bn'
                ? 'আপনার প্রোফাইল ছবি সেট করুন অথবা এখনই স্কিপ করে প্রোফাইলে যান।'
                : 'Add a profile picture so friends recognize you, or skip for now.'
            }
          />

          <div className="p-5 rounded-3xl liquid-glass-subtle flex flex-col items-center text-center space-y-3">
            <div className="relative p-1.5 rounded-full bg-gradient-to-br from-sky-500/30 via-blue-500/20 to-cyan-500/30">
              <Avatar src={photoUrl} name={nickname || username || 'S'} size="xl" />
              <label
                aria-label={t.profile.changePhoto}
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center cursor-pointer shadow-lg ring-2 ring-white dark:ring-slate-900"
              >
                <Camera className="w-4 h-4" />
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="sr-only" />
              </label>
            </div>

            <div>
              <p className={`text-lg text-slate-900 dark:text-white ${NICKNAME_FONT_CLASSES[nicknameFont]}`}>
                {nickname.trim() || username}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                @{normalizeUsername(username)}
              </p>
            </div>
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="space-y-2.5">
            <label className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white text-sm font-semibold shadow-md shadow-sky-600/20 inline-flex items-center justify-center gap-2 cursor-pointer">
              <Camera className="w-4 h-4" />
              <span>{loading ? '...' : t.profile.changePhoto}</span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="sr-only" />
            </label>

            <button
              type="button"
              onClick={finishPhotoStep}
              className="w-full min-h-[44px] rounded-2xl liquid-glass-subtle text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors"
            >
              {photoUrl
                ? language === 'bn'
                  ? 'সম্পন্ন · প্রোফাইল দেখুন'
                  : 'Done · View Profile'
                : t.auth.skipForNow}
            </button>
          </div>
        </div>
      )}

      {/* FORGOT PASSWORD FLOW */}
      {mode === 'forgot_email' && (
        <form onSubmit={handleForgotSendOtp} className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('signin')}
              aria-label="Back to sign in"
              className="min-h-[36px] min-w-[36px] rounded-full liquid-glass-subtle flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t.auth.sendReset}</h3>
          </div>
          <input
            type="email"
            required
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder={t.auth.emailLabel}
            className="w-full min-h-[46px] px-3.5 rounded-2xl bg-white/85 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
          />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] rounded-2xl bg-sky-600 text-white text-sm font-semibold"
          >
            {loading ? '...' : t.auth.sendCode}
          </button>
        </form>
      )}

      {mode === 'forgot_otp' && (
        <form onSubmit={handleForgotVerifyOtp} className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white text-center">{t.auth.otpTitle}</h3>
          <OtpDigitBoxes value={resetOtp} onChange={setResetOtp} ariaLabel={t.auth.otpPlaceholder} />
          {info && <p className="text-xs text-sky-600 text-center">{info}</p>}
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || resetOtp.length < 6}
            className="w-full min-h-[46px] rounded-2xl bg-sky-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {loading ? '...' : t.auth.verifyCode}
          </button>
        </form>
      )}

      {mode === 'forgot_newpass' && (
        <form onSubmit={handleForgotResetPass} className="space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Set New Password</h3>
          </div>
          <input
            type="password"
            required
            minLength={6}
            value={resetNewPass}
            onChange={(e) => setResetNewPass(e.target.value)}
            placeholder="New password (min 6 chars)"
            className="w-full min-h-[46px] px-3.5 rounded-2xl bg-white/85 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
          />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] rounded-2xl bg-sky-600 text-white text-sm font-semibold"
          >
            {loading ? '...' : t.auth.sendReset}
          </button>
        </form>
      )}

      {onDismiss && mode !== 'signup_photo' && (
        <button
          type="button"
          onClick={onDismiss}
          className="w-full min-h-[38px] text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
        <AuthPanel onDismiss={closeAuthModal} reason={authModalReason} />
      </div>
    </div>
  );
}

export function ProfilePhotoSetupModal() {
  const {
    isAuthenticated,
    pendingPhotoSetup,
    setPendingPhotoSetup,
    currentUser,
    uploadProfileImage,
    updateProfile,
    setActiveTab,
    language,
    t,
  } = useSocialVerse();

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated || !pendingPhotoSetup) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadProfileImage(file, 'avatar');
      await updateProfile({ photoUrl: url });
    } catch {
      setError(language === 'bn' ? 'ছবিটি লোড করা যায়নি।' : 'Could not process selected photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setError(null);
    await updateProfile({ photoUrl: '' });
  };

  const finish = () => {
    setPendingPhotoSetup(false);
    setActiveTab('profile');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.auth.photoStepTitle}
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="liquid-glass rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-5 shadow-2xl">
        <SignupProgressHeader
          step={5}
          language={language}
          title={t.auth.photoStepTitle}
          subtitle={
            language === 'bn'
              ? 'আপনার অ্যাকাউন্ট তৈরি হয়েছে! এখন প্রোফাইল ছবি দিন অথবা স্কিপ করুন।'
              : 'Your account is ready! Add a profile photo or skip for now.'
          }
        />

        <div className="p-5 rounded-3xl liquid-glass-subtle flex flex-col items-center text-center space-y-3">
          <div className="relative p-1.5 rounded-full bg-gradient-to-br from-sky-500/30 via-blue-500/20 to-cyan-500/30">
            <Avatar
              src={currentUser.photoUrl}
              name={currentUser.displayName || currentUser.username}
              size="xl"
            />
            <label
              aria-label={t.profile.changePhoto}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center cursor-pointer shadow-lg ring-2 ring-white dark:ring-slate-900"
            >
              <Camera className="w-4 h-4" />
              <input type="file" accept="image/*" onChange={handleUpload} className="sr-only" />
            </label>
          </div>

          <div>
            <p
              className={`text-lg text-slate-900 dark:text-white ${
                NICKNAME_FONT_CLASSES[currentUser.nicknameFont || 'classic']
              }`}
            >
              {currentUser.displayName || currentUser.username}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">@{currentUser.username}</p>
          </div>

          {currentUser.photoUrl && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.profile.deletePhoto}</span>
            </button>
          )}
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs font-medium text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="space-y-2.5">
          <label className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white text-sm font-semibold shadow-md shadow-sky-600/20 inline-flex items-center justify-center gap-2 cursor-pointer">
            <Camera className="w-4 h-4" />
            <span>{uploading ? '...' : t.profile.changePhoto}</span>
            <input type="file" accept="image/*" onChange={handleUpload} className="sr-only" />
          </label>

          <button
            type="button"
            onClick={finish}
            className="w-full min-h-[44px] rounded-2xl liquid-glass-subtle text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors"
          >
            {currentUser.photoUrl
              ? language === 'bn'
                ? 'সম্পন্ন · প্রোফাইল দেখুন'
                : 'Done · View Profile'
              : t.auth.skipForNow}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AuthFlow() {
  const { stage, setStage, t } = useSocialVerse();

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
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{t.auth.splashLoading}</p>
        </div>
        <button
          type="button"
          onClick={() => setStage('app')}
          className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline min-h-[36px] px-3"
        >
          {t.feed.recommended} →
        </button>
      </div>
    );
  }

  return null;
}
