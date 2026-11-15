import {
  Bell,
  Clapperboard,
  Compass,
  Globe,
  Home,
  LogIn,
  MessageCircle,
  Moon,
  PlusSquare,
  Settings,
  Sparkles,
  Sun,
  User,
} from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import type { MainTab } from '../types/social';
import { formatCompactCount } from '../utils/validation';
import { AiAssistantModal } from './AiAssistantModal';
import { AuthFlow, AuthModal, ProfilePhotoSetupModal } from './AuthFlow';
import { Avatar } from './Avatar';
import { CallOverlay } from './CallOverlay';
import { CreateView } from './CreateView';
import { ExploreView } from './ExploreView';
import { HomeFeed } from './HomeFeed';
import { MessagesView } from './MessagesView';
import { ProfileView } from './ProfileView';
import { ReelsView } from './ReelsView';
import { SettingsAndModals } from './SettingsAndModals';

export function AppShell() {
  const {
    stage,
    isAuthenticated,
    openAuthModal,
    activeTab,
    setActiveTab,
    subscreen,
    setSubscreen,
    currentUser,
    creators,
    followingIds,
    toggleFollow,
    openUserProfile,
    notifications,
    language,
    setLanguage,
    theme,
    setTheme,
    toastMessage,
    t,
  } = useSocialVerse();

  if (stage !== 'app') {
    return <AuthFlow />;
  }

  const unreadNotifs = notifications.filter((n) => !n.read).length;

  // Exact 5 bottom tabs: Home, Reels, Inbox (middle), Explore, Profile
  const navItems: { id: MainTab; label: string; icon: typeof Home }[] = [
    { id: 'home', label: t.nav.home, icon: Home },
    { id: 'reels', label: t.nav.reels, icon: Clapperboard },
    { id: 'messages', label: t.nav.messages, icon: MessageCircle },
    { id: 'explore', label: t.nav.explore, icon: Compass },
    { id: 'profile', label: t.nav.profile, icon: User },
  ];

  const handleNavClick = (id: MainTab) => {
    if (id === 'profile') {
      if (isAuthenticated) {
        openUserProfile(currentUser.uid);
      } else {
        setActiveTab('profile');
      }
      return;
    }
    setActiveTab(id);
  };

  const suggestedCreators = creators
    .filter((c) => c.uid !== currentUser.uid && !c.isDeactivated)
    .slice(0, 4);

  const isFullScreenInbox = activeTab === 'messages';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-sky-50/70 to-cyan-50/70 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950 text-slate-900 dark:text-slate-100 transition-colors">
      {isFullScreenInbox ? (
        <main className="h-[100dvh] w-full overflow-hidden">
          <MessagesView />
        </main>
      ) : (
        <>
          {/* Compact Mobile Top App Bar (56px) */}
          <header className="lg:hidden sticky top-0 z-30 h-14 px-2.5 liquid-glass border-x-0 border-t-0 flex items-center justify-between gap-1.5">
            <span className="font-display font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
              {t.appName}
            </span>

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                aria-label={t.nav.create}
                onClick={() => setSubscreen('create_sheet')}
                className="min-h-[40px] min-w-[34px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200"
              >
                <PlusSquare className="w-4.5 h-4.5" />
              </button>
              <button
                type="button"
                aria-label={t.settings.notifications}
                onClick={() => setSubscreen('notifications')}
                className="relative min-h-[40px] min-w-[34px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadNotifs > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-sky-600" />
                )}
              </button>
              <button
                type="button"
                aria-label="Toggle language"
                onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                className="min-h-[40px] px-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap"
              >
                {language === 'en' ? 'বাংলা' : 'EN'}
              </button>
              <button
                type="button"
                aria-label="Toggle theme"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="min-h-[40px] min-w-[34px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
              <button
                type="button"
                aria-label={t.settings.title}
                onClick={() => setSubscreen('settings_home')}
                className="min-h-[40px] min-w-[34px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200"
              >
                <Settings className="w-4.5 h-4.5" />
              </button>
              {!isAuthenticated && activeTab !== 'profile' && (
                <button
                  type="button"
                  onClick={() => openAuthModal()}
                  className="min-h-[34px] px-2.5 rounded-xl bg-sky-600 text-white text-xs font-semibold whitespace-nowrap ml-0.5"
                >
                  {t.auth.signIn}
                </button>
              )}
            </div>
          </header>

          {/* Main 3-Column Desktop / Single-Column Mobile Workspace */}
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 lg:pt-7 pb-24 lg:pb-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Navigation Rail (Desktop) */}
            <aside className="hidden lg:flex lg:col-span-3 flex-col gap-4 sticky top-6">
              <div className="liquid-glass rounded-3xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-xl tracking-tight text-slate-900 dark:text-white">
                    {t.appName}
                  </span>
                  <button
                    type="button"
                    aria-label="Toggle theme"
                    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    className="min-h-[40px] min-w-[40px] rounded-xl liquid-glass-subtle flex items-center justify-center text-slate-700 dark:text-slate-200"
                  >
                    {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </button>
                </div>

                <nav aria-label="Main navigation" className="space-y-1">
                  {navItems.map(({ id, label, icon: Icon }) => {
                    const active = activeTab === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleNavClick(id)}
                        className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span>{label}</span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setSubscreen('create_sheet')}
                    className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 transition-colors whitespace-nowrap"
                  >
                    <PlusSquare className="w-5 h-5 shrink-0" />
                    <span>{t.nav.create}</span>
                  </button>
                </nav>

                <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800/70 space-y-1">
                  <button
                    type="button"
                    onClick={() => setSubscreen('notifications')}
                    className="w-full min-h-[42px] px-3.5 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Bell className="w-4 h-4" />
                      <span>{t.settings.notifications}</span>
                    </span>
                    {unreadNotifs > 0 && (
                      <span className="font-mono-num text-sky-600 dark:text-sky-400">
                        {unreadNotifs}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                    className="w-full min-h-[42px] px-3.5 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Globe className="w-4 h-4" />
                      <span>{t.settings.language}</span>
                    </span>
                    <span className="text-sky-600 dark:text-sky-400">
                      {language === 'en' ? 'English' : 'বাংলা'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubscreen('settings_home')}
                    className="w-full min-h-[42px] px-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60"
                  >
                    <Settings className="w-4 h-4" />
                    <span>{t.settings.title}</span>
                  </button>
                </div>
              </div>

              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => openUserProfile(currentUser.uid)}
                  className="liquid-glass rounded-2xl p-3.5 flex items-center gap-3 text-left hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors"
                >
                  <Avatar src={currentUser.photoUrl} name={currentUser.displayName} size="md" online />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {currentUser.displayName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      @{currentUser.username}
                    </p>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuthModal()}
                  className="liquid-glass rounded-2xl p-3.5 flex items-center justify-between gap-3 text-left hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors border border-sky-500/25"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {t.auth.signIn} / {t.auth.register}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {t.auth.guestBannerTitle}
                    </p>
                  </div>
                  <span className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                    <LogIn className="w-4 h-4" />
                  </span>
                </button>
              )}
            </aside>

            {/* Main Center Workspace */}
            <main className="lg:col-span-6">
              {activeTab === 'home' && <HomeFeed />}
              {activeTab === 'reels' && <ReelsView embedded />}
              {activeTab === 'explore' && <ExploreView />}
              {activeTab === 'profile' && <ProfileView />}
            </main>

            {/* Right Discovery & AI Assistant Rail (Desktop) */}
            <aside className="hidden lg:flex lg:col-span-3 flex-col gap-4 sticky top-6">
              <div className="liquid-glass rounded-3xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t.profile.aiAssistant}
                  </h2>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t.ai.subtitle}
                </p>
                <button
                  type="button"
                  onClick={() => setSubscreen('ai_assistant')}
                  className="w-full min-h-[42px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors"
                >
                  {t.ai.openAssistant}
                </button>
              </div>

              <div className="liquid-glass rounded-3xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t.explore.suggestedAccounts}
                </h2>
                {suggestedCreators.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.feed.emptyHomeDesc}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                    {suggestedCreators.map((creator) => {
                      const isFollowing = followingIds.includes(creator.uid);
                      return (
                        <div key={creator.uid} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => openUserProfile(creator.uid)}
                            className="flex items-center gap-2.5 min-w-0 text-left"
                          >
                            <Avatar src={creator.photoUrl} name={creator.displayName} size="sm" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {creator.displayName}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                @{creator.username} · {formatCompactCount(creator.followersCount)}
                              </p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFollow(creator.uid)}
                            className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-semibold shrink-0 ${
                              isFollowing
                                ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                : 'bg-sky-600 text-white'
                            }`}
                          >
                            {isFollowing ? t.explore.following : t.explore.follow}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          </div>

          {/* Mobile Fixed 5-Tab Bottom Navigation Bar (Home, Reels, Inbox middle, Explore, Profile) */}
          <nav
            aria-label="Mobile bottom navigation"
            className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 liquid-glass border-x-0 border-b-0 grid grid-cols-5 items-center"
          >
            {navItems.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavClick(id)}
                  className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    active
                      ? 'text-sky-600 dark:text-sky-400'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>
        </>
      )}

      {/* Modals & Overlays */}
      {subscreen === 'create_sheet' && <CreateView />}
      {subscreen === 'reels' && <ReelsView />}
      <CallOverlay />
      <AiAssistantModal />
      <SettingsAndModals />
      <AuthModal />
      <ProfilePhotoSetupModal />

      {/* Transient Toast */}
      {toastMessage && (
        <div
          role="status"
          className={`fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-xl ${
            isFullScreenInbox ? 'top-4' : 'bottom-20 lg:bottom-6'
          }`}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
