import React from 'react';
import { ArrowLeft, Loader2, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { evaluateRouteAccess } from '../utils/validation';
import { AuthFlow, AuthPanel } from './AuthFlow';

function getProtectedRouteLabel(
  activeTab: string,
  subscreen: string | null,
  t: ReturnType<typeof useSocialVerse>['t']
): string {
  if (subscreen === 'notifications') return t.settings.notifications;
  if (subscreen === 'create_sheet') return t.nav.create;
  if (subscreen?.startsWith('settings_')) return t.settings.title;
  if (subscreen === 'ai_assistant') return t.profile.aiAssistant;
  if (subscreen === 'saved') return t.profile.savedPosts;
  if (subscreen === 'friend_requests') return t.profile.friendRequests;
  if (activeTab === 'messages') return t.nav.messages;
  if (activeTab === 'profile') return t.nav.profile;
  return t.appName;
}

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const {
    stage,
    authReady,
    isAuthenticated,
    activeTab,
    setActiveTab,
    subscreen,
    setSubscreen,
    viewedProfileUid,
    currentUser,
    language,
    setLanguage,
    theme,
    setTheme,
    t,
  } = useSocialVerse();

  if (stage !== 'app') {
    return <AuthFlow />;
  }

  const access = evaluateRouteAccess({
    activeTab,
    subscreen,
    viewedProfileUid,
    currentUid: currentUser.uid,
    isAuthenticated,
    authReady,
  });

  if (access.protectedRoute && access.decision === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="auth-verifying"
        className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-100 via-sky-50/70 to-cyan-50/70 dark:from-[#03050c] dark:via-[#070b18] dark:to-[#040a16] text-slate-900 dark:text-slate-100"
      >
        <div className="liquid-glass rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {t.auth.verifyingSession}
          </p>
        </div>
      </div>
    );
  }

  if (access.decision === 'require_auth') {
    const routeLabel = getProtectedRouteLabel(activeTab, subscreen, t);
    const returnToPublicFeed = () => {
      setSubscreen(null);
      setActiveTab('home');
    };

    return (
      <div
        data-testid="protected-route-gate"
        className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 via-sky-50/70 to-cyan-50/70 dark:from-[#03050c] dark:via-[#070b18] dark:to-[#040a16] text-slate-900 dark:text-slate-100 transition-colors"
      >
        {/* Top Bar with Back, Brand, Theme, Language */}
        <header className="sticky top-0 z-30 h-14 px-3 sm:px-6 liquid-glass border-x-0 border-t-0 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              aria-label={t.auth.backToPublicFeed}
              onClick={returnToPublicFeed}
              className="min-h-[40px] min-w-[40px] rounded-xl liquid-glass-btn text-slate-800 dark:text-slate-100 inline-flex items-center justify-center shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="font-display font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white truncate">
              {t.appName}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-label="Toggle language"
              onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
              className="min-h-[40px] px-2.5 rounded-xl liquid-glass-btn text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap"
            >
              {language === 'en' ? 'বাংলা' : 'EN'}
            </button>
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl liquid-glass-btn text-slate-700 dark:text-slate-200"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Protected Auth Gate Card */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="liquid-glass rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-xl px-3 py-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {routeLabel} · {t.auth.protectedRouteTitle}
              </span>
            </div>

            <AuthPanel reason={t.auth.protectedRouteDesc} />

            <button
              type="button"
              onClick={returnToPublicFeed}
              className="w-full min-h-[44px] rounded-2xl liquid-glass-subtle text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/80 inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.auth.backToPublicFeed}</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
