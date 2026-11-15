import { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Code2,
  Fingerprint,
  Globe,
  Info,
  KeyRound,
  Lock,
  LogOut,
  Megaphone,
  Moon,
  PauseCircle,
  Plus,
  Shield,
  Sun,
  Trash2,
  UserCheck,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import {
  BROADCAST_MIN_FOLLOWERS,
  REPORT_SUGGESTED_REASONS,
  canOpenBroadcastChannel,
  formatRelativeTime,
  getMaskedUserDisplay,
} from '../utils/validation';
import { Avatar } from './Avatar';

export function SettingsAndModals() {
  const {
    subscreen,
    setSubscreen,
    setActiveTab,
    isAuthenticated,
    currentUser,
    openAuthModal,
    savedLogins,
    removeSavedLogin,
    loginWithSavedAccount,
    userPrivate,
    updatePrivateSettings,
    updateProfile,
    language,
    setLanguage,
    theme,
    setTheme,
    notifications,
    markAllNotificationsRead,
    creators,
    unblockUser,
    changePassword,
    deactivateAccount,
    logout,
    deleteAccount,
    reportTarget,
    submitReport,
    createBroadcastChannel,
    isLocked,
    unlockBiometric,
    showToast,
    t,
  } = useSocialVerse();

  const [reportReason, setReportReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Change Password local state
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [passErr, setPassErr] = useState<string | null>(null);

  // Deactivate Account local state
  const [deactivateMode, setDeactivateMode] = useState<'7' | 'custom'>('7');
  const [customDeactivateDays, setCustomDeactivateDays] = useState('14');
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  // Broadcast Channel creator modal local state
  const [bcTitle, setBcTitle] = useState('');
  const [bcDesc, setBcDesc] = useState('');

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
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
                {language === 'bn' ? 'এখনো কোনো নোটিফিকেশন নেই।' : 'No notifications yet.'}
              </p>
            ) : (
              notifications.map((n) => (
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
              ))
            )}
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

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {language === 'bn' ? 'সাজেস্টেড কারণ বাছাই করুন:' : 'Suggested reasons:'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {REPORT_SUGGESTED_REASONS.map((item) => {
                const label = language === 'bn' ? item.bn : item.en;
                const active = reportReason === label;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setReportReason(label)}
                    className={`min-h-[34px] px-3 rounded-xl text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'liquid-glass-subtle border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await submitReport(reportReason);
              setReportReason('');
            }}
            className="space-y-4"
          >
            <textarea
              rows={3}
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

  if (subscreen === 'broadcast_channel') {
    const unlocked = canOpenBroadcastChannel(currentUser.followersCount);
    const remaining = Math.max(0, BROADCAST_MIN_FOLLOWERS - currentUser.followersCount);
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.profile.broadcastChannel}
        className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div className="liquid-glass rounded-3xl p-6 max-w-md w-full space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-sky-600" />
              <span>{t.profile.broadcastChannel}</span>
            </h2>
            <button
              type="button"
              aria-label="Close broadcast dialog"
              onClick={() => setSubscreen(null)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!unlocked ? (
            <div className="p-4 rounded-2xl liquid-glass-subtle space-y-2.5 text-center">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'bn'
                  ? `ব্রডকাস্ট চ্যানেল খুলতে কমপক্ষে ${BROADCAST_MIN_FOLLOWERS} ফলোয়ার প্রয়োজন`
                  : `Reach ${BROADCAST_MIN_FOLLOWERS} followers to unlock Broadcast Channels`}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {language === 'bn'
                  ? `আপনার বর্তমান ফলোয়ার: ${currentUser.followersCount} (আরও ${remaining} জন প্রয়োজন)`
                  : `Current followers: ${currentUser.followersCount} (${remaining} more needed)`}
              </p>
              <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-sky-600 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((currentUser.followersCount / BROADCAST_MIN_FOLLOWERS) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!bcTitle.trim()) return;
                await createBroadcastChannel(bcTitle.trim(), bcDesc.trim());
                setBcTitle('');
                setBcDesc('');
                setSubscreen(null);
                setActiveTab('messages');
              }}
              className="space-y-3"
            >
              <input
                type="text"
                required
                maxLength={60}
                value={bcTitle}
                onChange={(e) => setBcTitle(e.target.value)}
                placeholder={language === 'bn' ? 'চ্যানেলের নাম' : 'Channel title'}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
              <textarea
                rows={3}
                maxLength={200}
                value={bcDesc}
                onChange={(e) => setBcDesc(e.target.value)}
                placeholder={language === 'bn' ? 'চ্যানেলের বিবরণ...' : 'Channel description...'}
                className="w-full p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                className="w-full min-h-[44px] rounded-xl bg-sky-600 text-white text-sm font-semibold"
              >
                {language === 'bn' ? 'ব্রডকাস্ট চ্যানেল চালু করুন' : 'Create Broadcast Channel'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const isSettingsModal =
    subscreen === 'settings_home' ||
    subscreen === 'settings_privacy' ||
    subscreen === 'settings_security' ||
    subscreen === 'settings_account' ||
    subscreen === 'settings_blocked' ||
    subscreen === 'settings_language' ||
    subscreen === 'settings_about' ||
    subscreen === 'android_project';

  if (!isSettingsModal) return null;

  const settingsTabs = [
    { id: 'settings_home', label: t.settings.title, icon: Users },
    { id: 'settings_privacy', label: t.settings.privacy, icon: Shield },
    { id: 'settings_security', label: t.settings.security, icon: Lock },
    { id: 'settings_account', label: t.settings.account, icon: PauseCircle },
    { id: 'settings_blocked', label: t.settings.blockedUsers, icon: UserX },
    { id: 'settings_language', label: `${t.settings.language} & ${t.settings.theme}`, icon: Globe },
    { id: 'settings_about', label: t.settings.aboutLegal, icon: Info },
    { id: 'android_project', label: t.settings.androidProject, icon: Code2 },
  ] as const;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);
    setPassErr(null);
    try {
      await changePassword(curPass, newPass);
      setCurPass('');
      setNewPass('');
      setPassMsg(language === 'bn' ? 'পাসওয়ার্ড আপডেট হয়েছে।' : 'Password changed successfully.');
    } catch (err) {
      setPassErr(err instanceof Error ? err.message : 'Could not update password.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.settings.title}
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="liquid-glass rounded-3xl max-w-3xl w-full max-h-[88vh] overflow-hidden grid grid-cols-1 md:grid-cols-12">
        <nav className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200/70 dark:border-slate-800/70 p-4 space-y-1 overflow-y-auto">
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
              className={`w-full min-h-[40px] px-3 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-colors ${
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

          {subscreen === 'settings_home' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.settings.title}</h3>
              {isAuthenticated && (
                <div className="p-4 rounded-2xl liquid-glass-subtle flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={currentUser.photoUrl} name={currentUser.displayName} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {currentUser.displayName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        @{currentUser.username} · {userPrivate.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubscreen('settings_account')}
                    className="min-h-[36px] px-3 rounded-xl bg-sky-600 text-white text-xs font-semibold shrink-0"
                  >
                    {t.profile.switchAccount}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {settingsTabs
                  .filter((tab) => tab.id !== 'settings_home')
                  .map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSubscreen(id)}
                      className="p-3.5 rounded-2xl liquid-glass-subtle text-left hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors flex items-center gap-3"
                    >
                      <Icon className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">
                        {label}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {subscreen === 'settings_privacy' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.settings.privacy}</h3>
              {isAuthenticated && (
                <label className="flex items-center justify-between gap-4 p-4 rounded-2xl liquid-glass-subtle cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t.auth.privateAccountLabel}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {language === 'bn'
                        ? 'শুধু অনুমোদিত ফলোয়াররা আপনার পোস্ট ও রিল দেখতে পারবে।'
                        : 'Only approved followers can view your posts, reels, and lists.'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={currentUser.isPrivate}
                    onChange={(e) => updateProfile({ isPrivate: e.target.checked })}
                    className="w-5 h-5 text-sky-600 rounded"
                  />
                </label>
              )}

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
                    {t.settings.twoFactor}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'bn'
                      ? 'লগইনের সময় ইমেইল ওটিপি কোড বাধ্যতামূলক করবে।'
                      : 'Require a 6-digit email verification code on login.'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(userPrivate.twoFactorEnabled)}
                  onChange={(e) => updatePrivateSettings({ twoFactorEnabled: e.target.checked })}
                  className="w-5 h-5 text-sky-600 rounded"
                />
              </label>

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

              {isAuthenticated && (
                <form
                  onSubmit={handlePasswordSubmit}
                  className="p-4 rounded-2xl liquid-glass-subtle space-y-3"
                >
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-sky-600" />
                    <span>{t.settings.changePassword}</span>
                  </h4>
                  <input
                    type="password"
                    required
                    value={curPass}
                    onChange={(e) => setCurPass(e.target.value)}
                    placeholder={language === 'bn' ? 'বর্তমান পাসওয়ার্ড' : 'Current password'}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder={language === 'bn' ? 'নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)' : 'New password (min 6 chars)'}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                  {passErr && <p className="text-xs text-rose-600 font-medium">{passErr}</p>}
                  {passMsg && <p className="text-xs text-emerald-600 font-medium">{passMsg}</p>}
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 rounded-xl bg-sky-600 text-white text-xs font-semibold"
                  >
                    {t.settings.changePassword}
                  </button>
                </form>
              )}
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
                    const masked = u ? getMaskedUserDisplay(u, currentUser.uid, u.uid) : null;
                    return (
                      <div key={uid} className="py-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {masked ? `${masked.displayName} (@${masked.username})` : uid}
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

              {/* Saved Logins / Account Switcher */}
              <div className="p-4 rounded-2xl liquid-glass-subtle space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {t.settings.accountSwitch}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubscreen(null);
                      openAuthModal();
                    }}
                    className="text-xs font-semibold text-sky-600 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.profile.addAccount}</span>
                  </button>
                </div>

                {savedLogins.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    {language === 'bn' ? 'কোনো সেভড অ্যাকাউন্ট নেই।' : 'No saved accounts yet.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {savedLogins.map((entry) => {
                      const active = entry.uid === currentUser.uid && isAuthenticated;
                      return (
                        <div
                          key={entry.uid}
                          className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-900/50 flex items-center justify-between gap-2"
                        >
                          <button
                            type="button"
                            onClick={async () => {
                              if (active) return;
                              try {
                                await loginWithSavedAccount(entry);
                                setSubscreen(null);
                              } catch (err) {
                                showToast(err instanceof Error ? err.message : 'Sign in required');
                              }
                            }}
                            className="flex items-center gap-2.5 min-w-0 text-left flex-1"
                          >
                            <Avatar src={entry.photoUrl} name={entry.displayName} size="sm" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {entry.displayName}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">@{entry.username}</p>
                            </div>
                          </button>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {active ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                                <UserCheck className="w-3.5 h-3.5" />
                                Active
                              </span>
                            ) : (
                              <button
                                type="button"
                                aria-label={`Remove ${entry.username}`}
                                onClick={() => removeSavedLogin(entry.uid)}
                                className="p-1.5 text-slate-400 hover:text-rose-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

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
                    Email: {userPrivate.email} · UID: <code className="font-mono">{currentUser.uid}</code>
                  </p>

                  {/* Deactivate Account (7 days or custom days) */}
                  <div className="p-4 rounded-2xl liquid-glass-subtle space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <PauseCircle className="w-4 h-4 text-amber-500" />
                      <span>{t.settings.deactivateAccount}</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {language === 'bn'
                        ? 'ডিঅ্যাক্টিভেট করলে অন্যরা আপনাকে "SocialVerse User" হিসেবে দেখবে। পুনরায় লগইন করলেই অ্যাকাউন্ট সক্রিয় হয়ে যাবে।'
                        : 'Your profile appears as "SocialVerse User" while deactivated. Logging back in reactivates it immediately.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDeactivateMode('7')}
                        className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold ${
                          deactivateMode === '7'
                            ? 'bg-amber-600 text-white'
                            : 'bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {language === 'bn' ? '৭ দিন (ডিফল্ট)' : '7 Days'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeactivateMode('custom')}
                        className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold ${
                          deactivateMode === 'custom'
                            ? 'bg-amber-600 text-white'
                            : 'bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {language === 'bn' ? 'কাস্টম দিন' : 'Custom Days'}
                      </button>
                      {deactivateMode === 'custom' && (
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={customDeactivateDays}
                          onChange={(e) => setCustomDeactivateDays(e.target.value)}
                          aria-label="Custom deactivation days"
                          className="w-24 min-h-[36px] px-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                        />
                      )}
                    </div>

                    {!confirmDeactivate ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeactivate(true)}
                        className="min-h-[40px] px-4 rounded-xl border border-amber-500/50 text-amber-600 dark:text-amber-400 text-xs font-semibold"
                      >
                        {t.settings.deactivateAccount}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeactivate(false)}
                          className="min-h-[38px] px-3 rounded-xl liquid-glass-subtle text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            deactivateAccount(
                              deactivateMode === '7'
                                ? 7
                                : Math.max(1, Number(customDeactivateDays) || 7)
                            )
                          }
                          className="min-h-[38px] px-4 rounded-xl bg-amber-600 text-white text-xs font-semibold"
                        >
                          {language === 'bn'
                            ? `নিশ্চিত করুন (${deactivateMode === '7' ? 7 : customDeactivateDays} দিন)`
                            : `Confirm (${deactivateMode === '7' ? 7 : customDeactivateDays}d)`}
                        </button>
                      </div>
                    )}
                  </div>

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
                        {language === 'bn'
                          ? 'এটি আপনার প্রোফাইল, পোস্ট এবং অ্যাকাউন্ট স্থায়ীভাবে মুছে ফেলবে।'
                          : 'This permanently deletes your account, posts, and private data.'}
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
                          className="flex-1 min-h-[40px] rounded-xl bg-rose-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Confirm Delete</span>
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
                SocialVerse (com.socialverse.app) features real-time messaging, voice & video calling, broadcast channels, reels, stories, and bilingual English & বাংলা support.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Privacy Policy: Private user settings (email, 2FA, blocklists) are stored separately from public profiles. Nickname style changes are rate-limited to once per 7 days and username changes to once per 14 days.
              </p>
            </div>
          )}

          {subscreen === 'android_project' && (
            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Android Studio & Firebase Architecture
              </h3>
              <p>
                Kotlin + Jetpack Compose project included in <code className="font-mono">android/</code> alongside <code className="font-mono">firestore.rules</code>, <code className="font-mono">storage.rules</code>, and WebRTC signaling.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Package ID: com.socialverse.app (Min SDK 26, Target SDK 35)</li>
                <li>Auth: Gmail SMTP OTP + Unique Username + Password + 2FA</li>
                <li>Real-Time: WebSocket Sync + WebRTC Voice/Video Calls</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
