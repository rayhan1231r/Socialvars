import { useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  ChevronRight,
  Code2,
  Fingerprint,
  Globe,
  Info,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Megaphone,
  Moon,
  PauseCircle,
  Plus,
  Search,
  Shield,
  Star,
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
  DEFAULT_NOTIFICATION_PREFS,
  REPORT_SUGGESTED_REASONS,
  canOpenBroadcastChannel,
  getMaskedUserDisplay,
} from '../utils/validation';
import { Avatar } from './Avatar';

export function SettingsAndModals() {
  const {
    subscreen,
    setSubscreen,
    setActiveTab,
    currentUser,
    language,
    reportTarget,
    submitReport,
    createBroadcastChannel,
    isLocked,
    unlockBiometric,
    closeFriendsModalOpen,
    setCloseFriendsModalOpen,
    toggleCloseFriend,
    creators,
    followingIds,
    userPrivate,
    t,
  } = useSocialVerse();

  const [reportReason, setReportReason] = useState('');
  const [bcTitle, setBcTitle] = useState('');
  const [bcDesc, setBcDesc] = useState('');
  const [cfSearch, setCfSearch] = useState('');

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

  if (closeFriendsModalOpen) {
    const selectedCfUids = userPrivate.closeFriendUids || [];
    const q = cfSearch.trim().toLowerCase();
    const eligibleUsers = creators
      .filter((u) => u.uid !== currentUser.uid && !u.isDeactivated)
      .filter(
        (u) =>
          !q ||
          u.displayName.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const aSelected = selectedCfUids.includes(a.uid) ? 0 : 1;
        const bSelected = selectedCfUids.includes(b.uid) ? 0 : 1;
        if (aSelected !== bSelected) return aSelected - bSelected;
        const aFollow = followingIds.includes(a.uid) ? 0 : 1;
        const bFollow = followingIds.includes(b.uid) ? 0 : 1;
        return aFollow - bFollow;
      });

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.settings.closeFriendsList}
        className="fixed inset-0 z-[55] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div className="liquid-glass rounded-3xl p-5 sm:p-6 max-w-md w-full max-h-[85vh] flex flex-col gap-4 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Star className="w-4.5 h-4.5 fill-current" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {t.settings.closeFriendsList}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedCfUids.length}{' '}
                  {language === 'bn' ? 'জন নির্বাচিত' : 'selected'}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close Close Friends modal"
              onClick={() => setCloseFriendsModalOpen(false)}
              className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={cfSearch}
              onChange={(e) => setCfSearch(e.target.value)}
              placeholder={language === 'bn' ? 'ব্যবহারকারী খুঁজুন...' : 'Search people...'}
              className="w-full min-h-[42px] pl-10 pr-3.5 rounded-xl bg-white/80 dark:bg-slate-900/75 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200/60 dark:divide-white/10 pr-1">
            {eligibleUsers.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                {language === 'bn' ? 'কোনো অ্যাকাউন্ট পাওয়া যায়নি।' : 'No matching accounts.'}
              </p>
            ) : (
              eligibleUsers.map((person) => {
                const isCf = selectedCfUids.includes(person.uid);
                return (
                  <div
                    key={person.uid}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar src={person.photoUrl} name={person.displayName} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {person.displayName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          @{person.username}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCloseFriend(person.uid)}
                      className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0 ${
                        isCf
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'liquid-glass-btn text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {isCf ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? 'যুক্ত আছে' : 'Added'}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? 'যোগ করুন' : 'Add'}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={() => setCloseFriendsModalOpen(false)}
            className="w-full min-h-[44px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold"
          >
            {language === 'bn' ? 'সম্পন্ন' : 'Done'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export function SettingsPage() {
  const {
    subscreen,
    setSubscreen,
    goBack,
    isAuthenticated,
    currentUser,
    openAuthModal,
    savedLogins,
    removeSavedLogin,
    loginWithSavedAccount,
    userPrivate,
    updatePrivateSettings,
    updateProfile,
    friendRequests,
    language,
    setLanguage,
    theme,
    setTheme,
    creators,
    unblockUser,
    changePassword,
    sendOtp,
    verifyOtp,
    changeEmail,
    deactivateAccount,
    logout,
    deleteAccount,
    showToast,
    browserNotifPermission,
    requestBrowserNotificationPermission,
    sendTestNotification,
    setCloseFriendsModalOpen,
    t,
  } = useSocialVerse();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [passErr, setPassErr] = useState<string | null>(null);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailCurPass, setEmailCurPass] = useState('');
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [deactivateMode, setDeactivateMode] = useState<'7' | 'custom'>('7');
  const [customDeactivateDays, setCustomDeactivateDays] = useState('14');
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const settingsTabs = [
    { id: 'settings_home', label: t.settings.title, icon: Users },
    { id: 'settings_notifications', label: t.settings.notificationSettings, icon: Bell },
    { id: 'settings_privacy', label: t.settings.privacy, icon: Shield },
    { id: 'settings_security', label: t.settings.security, icon: Lock },
    { id: 'settings_account', label: t.settings.account, icon: PauseCircle },
    { id: 'settings_blocked', label: t.settings.blockedUsers, icon: UserX },
    { id: 'settings_language', label: `${t.settings.language} & ${t.settings.theme}`, icon: Globe },
    { id: 'settings_about', label: t.settings.aboutLegal, icon: Info },
    { id: 'android_project', label: t.settings.androidProject, icon: Code2 },
  ] as const;

  const pendingFollowCount = friendRequests.filter(
    (r) => r.toUid === currentUser.uid && r.status === 'pending'
  ).length;

  const currentTabMeta =
    settingsTabs.find((item) => item.id === subscreen) || settingsTabs[0];

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

  const handleSendChangeEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(null);
    setEmailErr(null);
    const clean = newEmailInput.trim().toLowerCase();
    if (!clean) return;
    setEmailLoading(true);
    try {
      const res = await sendOtp(clean, 'change_email');
      setEmailOtpSent(true);
      if (!res.sentViaSmtp && res.devOtpCode) {
        setEmailMsg(
          language === 'bn'
            ? `স্যান্ডবক্স কোড: ${res.devOtpCode}`
            : `Sandbox preview OTP: ${res.devOtpCode}`
        );
      } else {
        setEmailMsg(
          language === 'bn'
            ? `${clean}-এ ৬-ডিজিটের ওটিপি পাঠানো হয়েছে।`
            : `6-digit verification code sent to ${clean}.`
        );
      }
    } catch (err) {
      setEmailErr(err instanceof Error ? err.message : 'Could not send verification code.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyAndChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(null);
    setEmailErr(null);
    const clean = newEmailInput.trim().toLowerCase();
    setEmailLoading(true);
    try {
      const token = await verifyOtp(clean, emailOtpCode.trim(), 'change_email');
      await changeEmail(token, clean, emailCurPass);
      setNewEmailInput('');
      setEmailCurPass('');
      setEmailOtpCode('');
      setEmailOtpSent(false);
      setEmailMsg(t.settings.emailUpdated);
    } catch (err) {
      setEmailErr(err instanceof Error ? err.message : 'Could not update email address.');
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div data-testid="dedicated-settings-page" className="space-y-4">
      {/* Dedicated Top Header with Back Button */}
      <div className="liquid-glass rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (subscreen !== 'settings_home' && typeof window !== 'undefined' && window.innerWidth < 768) {
                setSubscreen('settings_home');
                return;
              }
              goBack();
            }}
            aria-label={t.profile.back}
            className="min-h-[44px] min-w-[44px] px-3.5 rounded-2xl liquid-glass-btn inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.profile.back}</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-display font-bold text-slate-900 dark:text-white truncate">
              {subscreen === 'settings_home' ? t.settings.title : currentTabMeta.label}
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {isAuthenticated ? `@${currentUser.username}` : t.appName}
            </p>
          </div>
        </div>
        {subscreen !== 'settings_home' && (
          <button
            type="button"
            onClick={goBack}
            className="hidden md:inline-flex items-center justify-center min-h-[38px] px-3.5 rounded-xl liquid-glass-btn text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0"
          >
            {language === 'bn' ? 'বন্ধ করুন' : 'Done'}
          </button>
        )}
      </div>

      {/* Dedicated Page Split Container */}
      <div className="liquid-glass rounded-3xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
        <nav
          aria-label="Settings sections"
          className={`${
            subscreen === 'settings_home' ? 'block' : 'hidden md:block'
          } md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200/70 dark:border-white/10 p-3.5 space-y-1`}
        >
          {settingsTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubscreen(id)}
              className={`w-full min-h-[44px] px-3.5 rounded-2xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-all duration-150 ${
                subscreen === id
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/25'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/10'
              }`}
            >
              <span className="inline-flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{label}</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60 md:hidden shrink-0" />
            </button>
          ))}
        </nav>

        <div
          className={`${
            subscreen === 'settings_home' ? 'hidden md:block' : 'block'
          } md:col-span-8 p-4 sm:p-6 space-y-5`}
        >
          {subscreen === 'settings_home' && (
            <div className="space-y-4">
              {isAuthenticated && (
                <div className="p-4 rounded-2xl liquid-glass-subtle flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={currentUser.photoUrl} name={currentUser.displayName} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {currentUser.displayName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        @{currentUser.username} · {userPrivate.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubscreen('settings_account')}
                    className="min-h-[38px] px-3.5 rounded-xl bg-sky-600 text-white text-xs font-semibold shrink-0"
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
                      className="p-3.5 rounded-2xl liquid-glass-btn text-left flex items-center justify-between gap-3"
                    >
                      <span className="inline-flex items-center gap-3 min-w-0">
                        <Icon className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {label}
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  ))}
              </div>
            </div>
          )}

          {subscreen === 'settings_notifications' && (() => {
            const prefs = {
              ...DEFAULT_NOTIFICATION_PREFS,
              ...(userPrivate.notificationPrefs || {}),
            };
            const updatePref = (key: keyof typeof DEFAULT_NOTIFICATION_PREFS, value: boolean) => {
              updatePrivateSettings({
                notificationPrefs: {
                  ...prefs,
                  [key]: value,
                },
              });
            };
            const prefItems: { key: keyof typeof DEFAULT_NOTIFICATION_PREFS; label: string; desc: string }[] = [
              {
                key: 'messages',
                label: t.settings.notifyMessages,
                desc: language === 'bn' ? 'ব্যক্তিগত চ্যাটের প্রতিটি নতুন মেসেজ' : 'New 1:1 direct messages',
              },
              {
                key: 'groupMessages',
                label: t.settings.notifyGroupMessages,
                desc: language === 'bn' ? 'গ্রুপ চ্যাটের নতুন মেসেজ ও মেনশন' : 'Messages inside your group chats',
              },
              {
                key: 'uploadProgress',
                label: t.settings.notifyUploadProgress,
                desc: language === 'bn' ? 'পোস্ট/রিল আপলোড ১% থেকে ১০০% স্ট্যাটাস' : 'Live 1%–100% progress in app & device tray',
              },
              {
                key: 'likes',
                label: t.settings.notifyLikes,
                desc: language === 'bn' ? 'পোস্ট বা রিলে কেউ লাইক দিলে' : 'Likes on your posts and reels',
              },
              {
                key: 'comments',
                label: t.settings.notifyComments,
                desc: language === 'bn' ? 'কমেন্ট ও রিপ্লাই নোটিফিকেশন' : 'Comments and replies on your posts',
              },
              {
                key: 'follows',
                label: t.settings.notifyFollows,
                desc: language === 'bn' ? 'নতুন ফলোয়ার যুক্ত হলে' : 'When someone follows you',
              },
              {
                key: 'friendRequests',
                label: t.settings.notifyFriendRequests,
                desc: language === 'bn' ? 'ফলো রিকোয়েস্ট এলে বা অনুমোদিত হলে' : 'Follow requests and approvals',
              },
              {
                key: 'stories',
                label: t.settings.notifyStories,
                desc: language === 'bn' ? 'স্টোরিতে রিয়েকশন ও রিপ্লাই' : 'Reactions and replies on your stories',
              },
              {
                key: 'mentions',
                label: t.settings.notifyMentions,
                desc: language === 'bn' ? '@ইউজারনেম মেনশন হলে' : 'When someone @mentions you',
              },
              {
                key: 'announcements',
                label: t.settings.notifyAnnouncements,
                desc: language === 'bn' ? 'ব্রডকাস্ট চ্যানেল ও গুরুত্বপূর্ণ আপডেট' : 'Broadcast channel posts & updates',
              },
            ];

            return (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {t.settings.notificationSettings}
                </h2>

                {/* Device / Browser Notification Permission Box */}
                <div className="p-4 rounded-2xl liquid-glass-subtle space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Bell className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        <span>{t.settings.deviceNotifications}</span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {browserNotifPermission === 'granted'
                          ? language === 'bn'
                            ? 'অনুমতি চালু আছে — ফোনে ও ব্রাউজারে নোটিফিকেশন যাবে।'
                            : 'Enabled — alerts appear on your phone/device notification bar.'
                          : browserNotifPermission === 'denied'
                          ? language === 'bn'
                            ? 'ব্রাউজার সেটিংস থেকে নোটিফিকেশন ব্লক করা আছে।'
                            : 'Blocked in browser settings. Enable site notifications to receive phone alerts.'
                          : language === 'bn'
                          ? 'পোস্ট আপলোড, মেসেজ ও গ্রুপ নোটিফিকেশন ফোনে পেতে অনুমতি দিন।'
                          : 'Allow notifications to receive alerts on your device status bar.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {browserNotifPermission !== 'granted' && browserNotifPermission !== 'unsupported' && (
                      <button
                        type="button"
                        onClick={() => requestBrowserNotificationPermission()}
                        className="min-h-[40px] px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold"
                      >
                        {t.settings.enablePushNotifications}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => sendTestNotification()}
                      className="min-h-[40px] px-4 rounded-xl liquid-glass-btn text-xs font-semibold text-slate-800 dark:text-slate-100"
                    >
                      {t.settings.testNotification}
                    </button>
                  </div>
                </div>

                {/* Master Pause All Toggle */}
                <label className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 cursor-pointer">
                  <div className="flex items-center gap-3 min-w-0">
                    <BellOff className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {t.settings.pauseAllNotifications}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {language === 'bn'
                          ? 'সাময়িকভাবে সব পুশ ও ইন-অ্যাপ অ্যালার্ট বন্ধ রাখুন'
                          : 'Temporarily silence all device & in-app push alerts'}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(prefs.pausedAll)}
                    onChange={(e) => updatePref('pausedAll', e.target.checked)}
                    className="w-5 h-5 text-amber-600 rounded shrink-0"
                  />
                </label>

                {/* Granular Toggles */}
                <div className="divide-y divide-slate-200/70 dark:divide-white/10 rounded-2xl liquid-glass-subtle px-4">
                  {prefItems.map(({ key, label, desc }) => (
                    <label
                      key={key}
                      className="py-3.5 flex items-center justify-between gap-4 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {label}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {desc}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(prefs[key])}
                        disabled={Boolean(prefs.pausedAll)}
                        onChange={(e) => updatePref(key, e.target.checked)}
                        className="w-5 h-5 text-sky-600 rounded shrink-0 disabled:opacity-45"
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          })()}

          {subscreen === 'settings_privacy' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{t.settings.privacy}</h2>

              {isAuthenticated && (
                <label className="flex items-center justify-between gap-4 p-4 rounded-2xl liquid-glass-subtle cursor-pointer">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t.auth.privateAccountLabel}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t.settings.privacyLockSummary}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={currentUser.isPrivate}
                    onChange={(e) => updateProfile({ isPrivate: e.target.checked })}
                    className="w-5 h-5 text-sky-600 rounded shrink-0"
                  />
                </label>
              )}

              {isAuthenticated && pendingFollowCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {t.settings.pendingFollowRequests} ({pendingFollowCount})
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      {language === 'bn'
                        ? 'নোটিফিকেশন থেকে ফলো রিকোয়েস্ট অনুমোদন বা বাতিল করুন।'
                        : 'Approve or decline follow requests in Notifications.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubscreen('notifications')}
                    className="min-h-[38px] px-3.5 rounded-xl bg-sky-600 text-white text-xs font-semibold shrink-0"
                  >
                    {t.settings.notifications}
                  </button>
                </div>
              )}

              <div>
                <label
                  htmlFor="who-can-follow"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t.settings.whoCanFollow}
                </label>
                <select
                  id="who-can-follow"
                  value={userPrivate.whoCanFollow}
                  onChange={(e) =>
                    updatePrivateSettings({
                      whoCanFollow: e.target.value as 'everyone' | 'approval',
                    })
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white"
                >
                  <option value="everyone">{t.settings.followEveryone}</option>
                  <option value="approval">{t.settings.followApprovalRequired}</option>
                </select>
              </div>

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
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white"
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
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white"
                >
                  <option value="everyone">Everyone</option>
                  <option value="followers">Followers</option>
                  <option value="close_friends">Close Friends</option>
                </select>
              </div>

              {isAuthenticated && (
                <div className="p-4 rounded-2xl liquid-glass-subtle flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Star className="w-4.5 h-4.5 fill-current" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {t.settings.closeFriendsList}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {(userPrivate.closeFriendUids || []).length}{' '}
                        {language === 'bn' ? 'জন তালিকায় আছেন' : 'people in your list'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCloseFriendsModalOpen(true)}
                    className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0"
                  >
                    {t.messages.manageCloseFriends}
                  </button>
                </div>
              )}
            </div>
          )}

          {subscreen === 'settings_security' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{t.settings.security}</h2>

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
                <>
                  <div className="p-4 rounded-2xl liquid-glass-subtle space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-sky-600" />
                        <span>{t.settings.changeEmail}</span>
                      </h3>
                    </div>
                    <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/70 dark:border-white/10">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {t.settings.currentVerifiedEmail}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                        {userPrivate.email || '—'}
                      </p>
                    </div>

                    {!emailOtpSent ? (
                      <form onSubmit={handleSendChangeEmailOtp} className="space-y-2.5">
                        <input
                          type="email"
                          required
                          value={newEmailInput}
                          onChange={(e) => setNewEmailInput(e.target.value)}
                          placeholder={t.settings.newEmailPlaceholder}
                          aria-label={t.settings.newEmailPlaceholder}
                          className="w-full min-h-[42px] px-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white"
                        />
                        {emailErr && <p className="text-xs text-rose-600 font-medium">{emailErr}</p>}
                        {emailMsg && <p className="text-xs text-emerald-600 font-medium">{emailMsg}</p>}
                        <button
                          type="submit"
                          disabled={emailLoading || !newEmailInput.trim()}
                          className="min-h-[40px] px-4 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold"
                        >
                          {emailLoading ? '...' : t.auth.sendCode}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyAndChangeEmail} className="space-y-2.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          maxLength={6}
                          value={emailOtpCode}
                          onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder={t.auth.otpPlaceholder}
                          aria-label={t.auth.otpPlaceholder}
                          className="w-full min-h-[42px] px-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 text-sm font-mono-num tracking-widest text-slate-900 dark:text-white"
                        />
                        <input
                          type="password"
                          required
                          value={emailCurPass}
                          onChange={(e) => setEmailCurPass(e.target.value)}
                          placeholder={t.settings.confirmWithPassword}
                          aria-label={t.settings.confirmWithPassword}
                          className="w-full min-h-[42px] px-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white"
                        />
                        {emailErr && <p className="text-xs text-rose-600 font-medium">{emailErr}</p>}
                        {emailMsg && <p className="text-xs text-emerald-600 font-medium">{emailMsg}</p>}
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            disabled={emailLoading || emailOtpCode.length < 6 || !emailCurPass}
                            className="min-h-[40px] px-4 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold"
                          >
                            {emailLoading ? '...' : t.auth.verifyCode}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEmailOtpSent(false);
                              setEmailOtpCode('');
                              setEmailErr(null);
                            }}
                            className="min-h-[40px] px-3 rounded-xl liquid-glass-btn text-xs font-semibold text-slate-700 dark:text-slate-200"
                          >
                            {language === 'bn' ? 'বাতিল' : 'Cancel'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  <form
                    onSubmit={handlePasswordSubmit}
                    className="p-4 rounded-2xl liquid-glass-subtle space-y-3"
                  >
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-sky-600" />
                      <span>{t.settings.changePassword}</span>
                    </h3>
                    <input
                      type="password"
                      required
                      value={curPass}
                      onChange={(e) => setCurPass(e.target.value)}
                      placeholder={language === 'bn' ? 'বর্তমান পাসওয়ার্ড' : 'Current password'}
                      className="w-full min-h-[42px] px-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white"
                    />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder={language === 'bn' ? 'নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)' : 'New password (min 6 chars)'}
                      className="w-full min-h-[42px] px-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white"
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
                </>
              )}
            </div>
          )}

          {subscreen === 'settings_blocked' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t.settings.blockedUsers}
              </h2>
              {userPrivate.blockedUserIds.length === 0 ? (
                <p className="text-sm text-slate-500">No blocked accounts.</p>
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-white/10">
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
                          className="min-h-[36px] px-3 rounded-xl liquid-glass-btn text-xs font-semibold text-sky-600 dark:text-sky-400"
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
                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  {t.settings.language}
                </h2>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`min-h-[44px] rounded-xl text-sm font-semibold ${
                      language === 'en'
                        ? 'bg-sky-600 text-white'
                        : 'liquid-glass-btn text-slate-800 dark:text-slate-200'
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
                        : 'liquid-glass-btn text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    বাংলা (Bengali)
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  {t.settings.theme}
                </h2>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`min-h-[44px] rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 ${
                      theme === 'light'
                        ? 'bg-sky-600 text-white'
                        : 'liquid-glass-btn text-slate-800 dark:text-slate-200'
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
                        : 'liquid-glass-btn text-slate-800 dark:text-slate-200'
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
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{t.settings.account}</h2>

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
                                const msg = err instanceof Error ? err.message : 'Sign in required';
                                showToast(msg);
                                setSubscreen(null);
                                openAuthModal(msg, entry.username || entry.email);
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

                  <div className="p-4 rounded-2xl liquid-glass-subtle space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <PauseCircle className="w-4 h-4 text-amber-500" />
                      <span>{t.settings.deactivateAccount}</span>
                    </h3>
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
                            : 'liquid-glass-btn text-slate-700 dark:text-slate-200'
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
                            : 'liquid-glass-btn text-slate-700 dark:text-slate-200'
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
                          className="w-24 min-h-[36px] px-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
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
                          className="min-h-[38px] px-3 rounded-xl liquid-glass-btn text-xs font-semibold"
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
                    className="w-full min-h-[44px] rounded-xl liquid-glass-btn text-sm font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center justify-center gap-2"
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
                          className="flex-1 min-h-[40px] rounded-xl liquid-glass-btn text-xs font-semibold"
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
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t.settings.aboutLegal}
              </h2>
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
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Android Studio & Firebase Architecture
              </h2>
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
