import { useState } from 'react';
import {
  Bell,
  Code2,
  Fingerprint,
  Globe,
  Info,
  Lock,
  LogOut,
  Moon,
  Shield,
  Sun,
  Trash2,
  UserX,
  X,
} from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { formatRelativeTime } from '../utils/validation';
import { Avatar } from './Avatar';

export function SettingsAndModals() {
  const {
    subscreen,
    setSubscreen,
    isAuthenticated,
    firebaseUser,
    openAuthModal,
    resendVerificationEmail,
    userPrivate,
    updatePrivateSettings,
    language,
    setLanguage,
    theme,
    setTheme,
    notifications,
    markAllNotificationsRead,
    creators,
    unblockUser,
    logout,
    deleteAccount,
    reportTarget,
    submitReport,
    isLocked,
    unlockBiometric,
    t,
  } = useSocialVerse();

  const [reportReason, setReportReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLocked) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.auth.biometricTitle}
        className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6"
      >
        <div className="liquid-glass rounded-3xl p-8 max-w-sm w-full text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-600/20 text-sky-500 flex items-center justify-center">
            <Fingerprint className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">{t.auth.biometricTitle}</h2>
          <button
            type="button"
            onClick={unlockBiometric}
            className="w-full min-h-[48px] rounded-xl bg-sky-600 text-white text-sm font-semibold"
          >
            {t.auth.biometricUnlock}
          </button>
        </div>
      </div>
    );
  }

  if (subscreen === 'notifications') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.settings.notifications}
        className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div className="liquid-glass rounded-3xl p-6 max-w-lg w-full max-h-[85vh] flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-sky-600" />
              <span>{t.settings.notifications}</span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400"
              >
                Mark all read
              </button>
              <button
                type="button"
                aria-label="Close notifications"
                onClick={() => setSubscreen(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {notifications.map((n) => (
              <div key={n.id} className="py-3 flex items-start gap-3">
                <Avatar src={n.actorAvatar} name={n.actorUsername} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    <span className="font-semibold">@{n.actorUsername}</span> {n.summary}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatRelativeTime(n.createdAt, language)} {!n.read ? '· Unread' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (subscreen === 'report' && reportTarget) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.settings.submitReport}
        className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div className="liquid-glass rounded-3xl p-6 max-w-md w-full space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Report {reportTarget.label}
            </h2>
            <button
              type="button"
              aria-label="Close report dialog"
              onClick={() => setSubscreen(null)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitReport(reportReason);
              setReportReason('');
            }}
            className="space-y-4"
          >
            <textarea
              rows={4}
              required
              minLength={3}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder={t.settings.reportReason}
              className="w-full p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-rose-600 text-white text-sm font-semibold"
            >
              {t.settings.submitReport}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isSettingsModal =
    subscreen === 'settings_privacy' ||
    subscreen === 'settings_security' ||
    subscreen === 'settings_account' ||
    subscreen === 'settings_blocked' ||
    subscreen === 'settings_language' ||
    subscreen === 'settings_about' ||
    subscreen === 'android_project';

  if (!isSettingsModal) return null;

  const settingsTabs = [
    { id: 'settings_privacy', label: t.settings.privacy, icon: Shield },
    { id: 'settings_security', label: t.settings.security, icon: Lock },
    { id: 'settings_blocked', label: t.settings.blockedUsers, icon: UserX },
    { id: 'settings_language', label: `${t.settings.language} & ${t.settings.theme}`, icon: Globe },
    { id: 'settings_account', label: t.settings.account, icon: Trash2 },
    { id: 'settings_about', label: t.settings.aboutLegal, icon: Info },
    { id: 'android_project', label: t.settings.androidProject, icon: Code2 },
  ] as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.settings.title}
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="liquid-glass rounded-3xl max-w-3xl w-full max-h-[86vh] overflow-hidden grid grid-cols-1 md:grid-cols-12">
        <nav className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200/70 dark:border-slate-800/70 p-4 space-y-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{t.settings.title}</h2>
            <button
              type="button"
              aria-label="Close settings"
              onClick={() => setSubscreen(null)}
              className="md:hidden min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {settingsTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubscreen(id)}
              className={`w-full min-h-[42px] px-3 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                subscreen === id
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        <div className="md:col-span-8 p-5 sm:p-6 overflow-y-auto space-y-5">
          <div className="hidden md:flex justify-end">
            <button
              type="button"
              aria-label="Close settings"
              onClick={() => setSubscreen(null)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {subscreen === 'settings_privacy' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.settings.privacy}</h3>
              <div>
                <label
                  htmlFor="who-can-message"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t.settings.whoCanMessage}
                </label>
                <select
                  id="who-can-message"
                  value={userPrivate.whoCanMessage}
                  onChange={(e) =>
                    updatePrivateSettings({
                      whoCanMessage: e.target.value as 'everyone' | 'followers' | 'nobody',
                    })
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  <option value="everyone">Everyone</option>
                  <option value="followers">Followers only</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="who-can-view-stories"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t.settings.whoCanViewStories}
                </label>
                <select
                  id="who-can-view-stories"
                  value={userPrivate.whoCanViewStories}
                  onChange={(e) =>
                    updatePrivateSettings({
                      whoCanViewStories: e.target.value as 'everyone' | 'followers' | 'close_friends',
                    })
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  <option value="everyone">Everyone</option>
                  <option value="followers">Followers</option>
                  <option value="close_friends">Close Friends</option>
                </select>
              </div>
            </div>
          )}

          {subscreen === 'settings_security' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.settings.security}</h3>
              <label className="flex items-center justify-between gap-4 p-4 rounded-2xl liquid-glass-subtle cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t.settings.biometricLock}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Protects SocialVerse sessions with BiometricPrompt / device lock.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={userPrivate.biometricLockEnabled}
                  onChange={(e) =>
                    updatePrivateSettings({ biometricLockEnabled: e.target.checked })
                  }
                  className="w-5 h-5 text-sky-600 rounded"
                />
              </label>
              <div className="p-4 rounded-2xl liquid-glass-subtle text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">Active Session</p>
                <p>Firebase App Check & Transport TLS active. All API endpoints enforce Firebase ID token verification.</p>
              </div>
            </div>
          )}

          {subscreen === 'settings_blocked' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.settings.blockedUsers}
              </h3>
              {userPrivate.blockedUserIds.length === 0 ? (
                <p className="text-sm text-slate-500">No blocked accounts.</p>
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                  {userPrivate.blockedUserIds.map((uid) => {
                    const u = creators.find((c) => c.uid === uid);
                    return (
                      <div key={uid} className="py-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {u ? `${u.displayName} (@${u.username})` : uid}
                        </span>
                        <button
                          type="button"
                          onClick={() => unblockUser(uid)}
                          className="min-h-[36px] px-3 rounded-xl liquid-glass-subtle text-xs font-semibold text-sky-600"
                        >
                          {t.messages.unblockUser}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {subscreen === 'settings_language' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  {t.settings.language}
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`min-h-[44px] rounded-xl text-sm font-semibold ${
                      language === 'en'
                        ? 'bg-sky-600 text-white'
                        : 'liquid-glass-subtle text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('bn')}
                    className={`min-h-[44px] rounded-xl text-sm font-semibold ${
                      language === 'bn'
                        ? 'bg-sky-600 text-white'
                        : 'liquid-glass-subtle text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    বাংলা (Bengali)
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  {t.settings.theme}
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`min-h-[44px] rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 ${
                      theme === 'light'
                        ? 'bg-sky-600 text-white'
                        : 'liquid-glass-subtle text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>{t.settings.lightMode}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`min-h-[44px] rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 ${
                      theme === 'dark'
                        ? 'bg-sky-600 text-white'
                        : 'liquid-glass-subtle text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    <span>{t.settings.darkMode}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {subscreen === 'settings_account' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.settings.account}</h3>
              {!isAuthenticated ? (
                <div className="p-4 rounded-2xl liquid-glass-subtle space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {t.auth.guestBannerDesc}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubscreen(null);
                      openAuthModal();
                    }}
                    className="w-full min-h-[44px] rounded-xl bg-sky-600 text-white text-sm font-semibold"
                  >
                    {t.auth.signIn} / {t.auth.register}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Email: {firebaseUser?.email || userPrivate.email}
                  </p>
                  {firebaseUser && !firebaseUser.emailVerified && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                      <span className="text-xs text-amber-800 dark:text-amber-200">
                        Email not verified yet.
                      </span>
                      <button
                        type="button"
                        onClick={resendVerificationEmail}
                        className="min-h-[34px] px-3 rounded-lg bg-amber-600 text-white text-xs font-semibold shrink-0"
                      >
                        {t.auth.resendVerification}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full min-h-[44px] rounded-xl liquid-glass-subtle text-sm font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t.auth.logout}</span>
                  </button>
                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="w-full min-h-[44px] rounded-xl border border-rose-500/40 text-rose-600 text-sm font-semibold"
                    >
                      {t.settings.deleteAccount}
                    </button>
                  ) : (
                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3">
                      <p className="text-xs text-rose-700 dark:text-rose-300">
                        This removes your profile, private settings, and session permanently.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 min-h-[40px] rounded-xl liquid-glass-subtle text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={deleteAccount}
                          className="flex-1 min-h-[40px] rounded-xl bg-rose-600 text-white text-xs font-semibold"
                        >
                          Confirm Delete
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {subscreen === 'settings_about' && (
            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.settings.aboutLegal}
              </h3>
              <p>
                SocialVerse (com.socialverse.app) is a user-facing social media application built with Clean Architecture, Firebase Zero-Trust Rules, and bilingual English & বাংলা support.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Privacy Policy: Private user data (email, blocklists, notification controls) is isolated in owner-only subcollections. Standard TLS encryption in transit protects all Firebase traffic; end-to-end encryption is not claimed for standard cloud-synced messages.
              </p>
            </div>
          )}

          {subscreen === 'android_project' && (
            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Android Studio & Firebase Architecture
              </h3>
              <p>
                Complete Kotlin + Jetpack Compose Clean Architecture MVVM project included in <code className="font-mono">android/</code> along with <code className="font-mono">functions/</code>, <code className="font-mono">firestore.rules</code>, <code className="font-mono">storage.rules</code>, and <code className="font-mono">FIREBASE_SETUP_AND_BUILD.md</code>.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Package ID: com.socialverse.app (Min SDK 26, Target SDK 35)</li>
                <li>UI: Jetpack Compose + Liquid Glass SurfaceModifiers + Material 3</li>
                <li>DI & Media: Hilt, Coil 3, Media3 ExoPlayer, BiometricPrompt</li>
                <li>Firebase: Auth, Firestore, Storage, FCM, App Check, Crashlytics, Analytics</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
