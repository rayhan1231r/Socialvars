import { useEffect, useState } from 'react';
import {
  Bookmark,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Clock,
  ExternalLink,
  Flag,
  Grid,
  Image as ImageIcon,
  Loader2,
  Lock,
  LogOut,
  Megaphone,
  MessageSquare,
  Plus,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { IMG_ARIA, IMG_COASTAL, IMG_DESK, IMG_RAFI, IMG_SKYLINE } from '../data/seed';
import type { NicknameFontStyle } from '../types/social';
import {
  BROADCAST_MIN_FOLLOWERS,
  MAX_BIO_LENGTH,
  NICKNAME_FONT_CLASSES,
  canChangeNickname,
  canChangeUsername,
  canOpenBroadcastChannel,
  canViewPrivateProfileContent,
  formatCompactCount,
  getMaskedUserDisplay,
  isValidUsername,
  normalizeUsername,
} from '../utils/validation';
import { AuthPanel } from './AuthFlow';
import { Avatar } from './Avatar';
import { PostCard } from './PostCard';

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

const FONT_OPTIONS: { id: NicknameFontStyle; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Mono' },
  { id: 'display', label: 'Bold Caps' },
  { id: 'italic', label: 'Italic' },
];

const AVATAR_PRESETS = [IMG_ARIA, IMG_RAFI, IMG_COASTAL];
const COVER_PRESETS = [IMG_SKYLINE, IMG_DESK, IMG_COASTAL];

export function ProfileView() {
  const {
    currentUser,
    isAuthenticated,
    openAuthModal,
    savedLogins,
    loginWithSavedAccount,
    logout,
    creators,
    posts,
    viewedProfileUid,
    openUserProfile,
    followingIds,
    followerIds,
    friendRequests,
    toggleFollow,
    respondToFriendRequest,
    removeFollower,
    createDirectOrGroupChat,
    setActiveTab,
    setSubscreen,
    subscreen,
    updateProfile,
    uploadProfileImage,
    checkUsernameAvailability,
    openReportModal,
    showToast,
    language,
    t,
  } = useSocialVerse();

  const [profileTab, setProfileTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);

  // Edit Profile Modal state
  const [editName, setEditName] = useState(currentUser.displayName);
  const [editNicknameFont, setEditNicknameFont] = useState<NicknameFontStyle>(
    currentUser.nicknameFont || 'classic'
  );
  const [editUsername, setEditUsername] = useState(currentUser.username);
  const [usernameStatus, setUsernameStatus] = useState<
    'same' | 'checking' | 'available' | 'taken' | 'invalid'
  >('same');
  const [editPronouns, setEditPronouns] = useState(currentUser.pronouns || '');
  const [editBio, setEditBio] = useState(currentUser.bio);
  const [editWebsite, setEditWebsite] = useState(currentUser.website || '');
  const [editPhotoUrl, setEditPhotoUrl] = useState(currentUser.photoUrl);
  const [editCoverUrl, setEditCoverUrl] = useState(currentUser.coverUrl);
  const [editInterests, setEditInterests] = useState<string[]>(currentUser.interests);
  const [editIsPrivate, setEditIsPrivate] = useState(currentUser.isPrivate);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<'avatar' | 'cover' | null>(null);
  const [directUploading, setDirectUploading] = useState<'avatar' | 'cover' | null>(null);

  const nicknameCooldown = canChangeNickname(currentUser.lastNicknameChangedAt);
  const usernameCooldown = canChangeUsername(currentUser.lastUsernameChangedAt);

  // Live username availability check inside Edit Profile modal
  useEffect(() => {
    if (subscreen !== 'edit_profile' || !isAuthenticated) return;
    const clean = normalizeUsername(editUsername);
    if (clean === currentUser.username) {
      setUsernameStatus('same');
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
        const res = await checkUsernameAvailability(clean, currentUser.uid);
        if (!cancelled) {
          setUsernameStatus(res.available ? 'available' : 'taken');
        }
      } catch {
        if (!cancelled) setUsernameStatus('same');
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [subscreen, isAuthenticated, editUsername, currentUser.username, currentUser.uid, checkUsernameAvailability]);

  // Strict Profile Auth Gate: until logged in, do NOT render any profile UI — show only Sign In / Sign Up options
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-3 sm:py-5">
        <div className="liquid-glass rounded-3xl p-5 sm:p-7 shadow-xl">
          <AuthPanel reason={t.auth.guestBannerDesc} />
        </div>
      </div>
    );
  }

  const profileUser =
    (viewedProfileUid ? creators.find((u) => u.uid === viewedProfileUid) : null) || currentUser;
  const isOwn = profileUser.uid === currentUser.uid;
  const masked = getMaskedUserDisplay(profileUser, currentUser.uid, profileUser.uid);
  const canViewContent = canViewPrivateProfileContent(profileUser, currentUser.uid, followingIds);

  const isFollowing = followingIds.includes(profileUser.uid);
  const isFollower = followerIds.includes(profileUser.uid);
  const hasPendingRequest = friendRequests.some(
    (r) =>
      r.fromUid === currentUser.uid &&
      r.toUid === profileUser.uid &&
      r.status === 'pending'
  );

  const allUserPosts = posts.filter((p) => p.authorId === profileUser.uid);
  const userStandardPosts = allUserPosts.filter(
    (p) => p.mediaType !== 'reel' && p.mediaType !== 'video'
  );
  const userReels = allUserPosts.filter(
    (p) => p.mediaType === 'reel' || p.mediaType === 'video'
  );
  const savedPosts = posts.filter((p) => p.savedByMe);
  const pendingRequests = friendRequests.filter(
    (r) => r.toUid === currentUser.uid && r.status === 'pending'
  );

  const followLabel = isFollowing
    ? t.explore.following
    : hasPendingRequest
    ? t.explore.requestSent
    : isFollower
    ? t.explore.followBack
    : t.explore.follow;

  const openEditProfileModal = () => {
    setEditName(currentUser.displayName);
    setEditNicknameFont(currentUser.nicknameFont || 'classic');
    setEditUsername(currentUser.username);
    setUsernameStatus('same');
    setEditPronouns(currentUser.pronouns || '');
    setEditBio(currentUser.bio);
    setEditWebsite(currentUser.website || '');
    setEditPhotoUrl(currentUser.photoUrl);
    setEditCoverUrl(currentUser.coverUrl);
    setEditInterests(currentUser.interests);
    setEditIsPrivate(currentUser.isPrivate);
    setEditError(null);
    setSubscreen('edit_profile');
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'avatar' | 'cover'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEditError(null);
    setUploadingKind(kind);
    try {
      const url = await uploadProfileImage(file, kind);
      if (kind === 'avatar') setEditPhotoUrl(url);
      else setEditCoverUrl(url);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Could not load selected image.'
      );
    } finally {
      setUploadingKind(null);
    }
  };

  const handleDirectProfileMediaUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'avatar' | 'cover'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDirectUploading(kind);
    try {
      const url = await uploadProfileImage(file, kind);
      const err = await updateProfile(kind === 'avatar' ? { photoUrl: url } : { coverUrl: url });
      if (err) {
        showToast(err);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not upload selected image.');
    } finally {
      setDirectUploading(null);
    }
  };

  const toggleEditInterest = (item: string) => {
    setEditInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item].slice(0, 8)
    );
  };

  const handleSaveEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    if (editBio.length > MAX_BIO_LENGTH) {
      setEditError(`Bio must be ${MAX_BIO_LENGTH} characters or fewer.`);
      return;
    }
    if (usernameStatus === 'taken') {
      setEditError(t.auth.usernameTaken);
      return;
    }
    if (usernameStatus === 'invalid') {
      setEditError(t.auth.usernameInvalid);
      return;
    }
    setSavingEdit(true);
    const err = await updateProfile({
      displayName: nicknameCooldown.allowed ? editName : currentUser.displayName,
      nicknameFont: nicknameCooldown.allowed
        ? editNicknameFont
        : currentUser.nicknameFont || 'classic',
      username: usernameCooldown.allowed ? editUsername : currentUser.username,
      pronouns: editPronouns,
      bio: editBio,
      website: editWebsite,
      photoUrl: editPhotoUrl,
      coverUrl: editCoverUrl,
      interests: editInterests,
      isPrivate: editIsPrivate,
    });
    setSavingEdit(false);
    if (err) {
      setEditError(err);
    } else {
      setSubscreen(null);
    }
  };

  const handleShareProfile = () => {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(`${window.location.origin}/?u=${masked.username}`)
        .catch(() => {});
    }
    showToast(
      language === 'bn'
        ? `@${masked.username} প্রোফাইল লিংক কপি হয়েছে`
        : `Copied @${masked.username} profile link`
    );
  };

  const handleMessageUser = async () => {
    const id = await createDirectOrGroupChat(
      masked.displayName,
      [currentUser.uid, profileUser.uid],
      'direct'
    );
    if (id) {
      setActiveTab('messages');
    }
  };

  const broadcastUnlocked = canOpenBroadcastChannel(currentUser.followersCount);
  const nicknameClass = NICKNAME_FONT_CLASSES[profileUser.nicknameFont || 'classic'];

  return (
    <div className="space-y-5">
      {/* Top Profile Bar: Own Account Switcher / Other Profile Back */}
      {isOwn ? (
        <div className="flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={() => setAccountSwitcherOpen(true)}
            className="min-h-[40px] px-3 rounded-xl liquid-glass-subtle inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white"
          >
            <span>@{currentUser.username}</span>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubscreen('broadcast_channel')}
              className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${
                broadcastUnlocked
                  ? 'bg-sky-600 text-white'
                  : 'liquid-glass-subtle text-slate-700 dark:text-slate-200'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.profile.broadcastChannel}</span>
              {!broadcastUnlocked && (
                <span className="text-[10px] font-mono-num opacity-75">
                  {currentUser.followersCount}/{BROADCAST_MIN_FOLLOWERS}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-label={t.profile.settings}
              onClick={() => setSubscreen('settings_home')}
              className="min-h-[38px] min-w-[38px] rounded-xl liquid-glass-subtle flex items-center justify-center text-slate-700 dark:text-slate-200"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => openUserProfile(currentUser.uid)}
          className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline px-1"
        >
          ← {language === 'bn' ? 'আমার প্রোফাইলে ফিরুন' : 'Back to my profile'}
        </button>
      )}

      {/* Profile Header Card */}
      <section className="liquid-glass rounded-3xl overflow-hidden">
        <div className="h-36 sm:h-44 bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-cyan-500/20 relative">
          {profileUser.coverUrl && !masked.isDeactivatedView && (
            <img
              src={profileUser.coverUrl}
              alt={`${masked.displayName} cover`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          {isOwn && !masked.isDeactivatedView && (
            <label
              aria-label={t.profile.changeCover}
              className="absolute right-3 bottom-3 z-10 min-h-[34px] px-3 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-lg transition-colors"
            >
              {directUploading === 'cover' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5" />
              )}
              <span>{directUploading === 'cover' ? '...' : t.profile.changeCover}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleDirectProfileMediaUpload(e, 'cover')}
                className="sr-only"
              />
            </label>
          )}
        </div>

        <div className="p-5 sm:p-6 -mt-12 relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="relative w-fit">
              <Avatar
                src={masked.isDeactivatedView ? '' : profileUser.photoUrl}
                name={masked.displayName}
                size="xl"
                online={!masked.isDeactivatedView && profileUser.onlineStatus === 'online'}
                className="ring-4 ring-white dark:ring-slate-900 rounded-full"
              />
              {isOwn && !masked.isDeactivatedView && (
                <label
                  aria-label={t.profile.changePhoto}
                  title={t.profile.changePhoto}
                  className="absolute bottom-0 right-0 z-10 w-8 h-8 rounded-full bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center cursor-pointer shadow-lg ring-2 ring-white dark:ring-slate-900 transition-colors"
                >
                  {directUploading === 'avatar' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleDirectProfileMediaUpload(e, 'avatar')}
                    className="sr-only"
                  />
                </label>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isOwn ? (
                <>
                  <button
                    type="button"
                    onClick={openEditProfileModal}
                    className="min-h-[40px] px-3.5 rounded-xl liquid-glass-subtle text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap"
                  >
                    {t.profile.editProfile}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubscreen('ai_assistant')}
                    className="min-h-[40px] px-3.5 rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-sky-700 whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t.profile.aiAssistant}</span>
                  </button>
                </>
              ) : (
                <>
                  {!masked.isDeactivatedView && (
                    <button
                      type="button"
                      onClick={() => toggleFollow(profileUser.uid)}
                      className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${
                        isFollowing || hasPendingRequest
                          ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                          : 'bg-sky-600 text-white'
                      }`}
                    >
                      {isFollowing ? (
                        <UserCheck className="w-4 h-4" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      <span>{followLabel}</span>
                    </button>
                  )}
                  {!masked.isDeactivatedView && (
                    <button
                      type="button"
                      onClick={handleMessageUser}
                      className="min-h-[40px] px-4 rounded-xl liquid-glass-subtle text-xs font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{t.profile.message}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={t.profile.reportUser}
                    onClick={() =>
                      openReportModal('user', profileUser.uid, `@${masked.username}`)
                    }
                    className="min-h-[40px] min-w-[40px] rounded-xl liquid-glass-subtle flex items-center justify-center text-rose-600"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                aria-label={t.profile.shareProfile}
                onClick={handleShareProfile}
                className="min-h-[40px] min-w-[40px] rounded-xl liquid-glass-subtle flex items-center justify-center text-slate-700 dark:text-slate-200"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <h1 className={`text-xl ${nicknameClass} text-slate-900 dark:text-white`}>
                  {masked.displayName}
                </h1>
                {!masked.isDeactivatedView && profileUser.pronouns && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {profileUser.pronouns}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                @{masked.username} ·{' '}
                {profileUser.isPrivate ? t.profile.privateProfile : t.profile.publicProfile}
              </p>
            </div>

            {!masked.isDeactivatedView && profileUser.bio && (
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {profileUser.bio}
              </p>
            )}

            {!masked.isDeactivatedView && profileUser.website && (
              <a
                href={profileUser.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{profileUser.website.replace(/^https?:\/\//i, '')}</span>
              </a>
            )}

            {!masked.isDeactivatedView && profileUser.interests.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {profileUser.interests.join(' · ')}
              </p>
            )}
          </div>

          {/* Stats Strip */}
          <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-slate-800/70 grid grid-cols-3 gap-2 text-center">
            <div className="p-2">
              <p className="text-lg font-bold font-mono-num text-slate-900 dark:text-white">
                {formatCompactCount(allUserPosts.length)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.profile.posts}</p>
            </div>
            <button
              type="button"
              disabled={!isOwn && !canViewContent}
              onClick={() => isOwn && setSubscreen('followers')}
              className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors disabled:opacity-60"
            >
              <p className="text-lg font-bold font-mono-num text-slate-900 dark:text-white">
                {formatCompactCount(profileUser.followersCount)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.profile.followers}</p>
            </button>
            <button
              type="button"
              disabled={!isOwn && !canViewContent}
              onClick={() => isOwn && setSubscreen('following')}
              className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors disabled:opacity-60"
            >
              <p className="text-lg font-bold font-mono-num text-slate-900 dark:text-white">
                {formatCompactCount(profileUser.followingCount)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.profile.following}</p>
            </button>
          </div>
        </div>
      </section>

      {/* Pending Follow Requests Banner on Own Profile */}
      {isOwn && pendingRequests.length > 0 && (
        <section className="liquid-glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t.profile.friendRequests} ({pendingRequests.length})
            </h2>
            <button
              type="button"
              onClick={() => setSubscreen('friend_requests')}
              className="text-xs font-semibold text-sky-600 dark:text-sky-400"
            >
              {t.profile.viewAll}
            </button>
          </div>
          {pendingRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar src={req.fromAvatar} name={req.fromDisplayName} size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {req.fromDisplayName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    @{req.fromUsername}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => respondToFriendRequest(req.id, true)}
                  className="min-h-[38px] px-3.5 rounded-xl bg-sky-600 text-white text-xs font-semibold"
                >
                  {t.profile.accept}
                </button>
                <button
                  type="button"
                  onClick={() => respondToFriendRequest(req.id, false)}
                  className="min-h-[38px] px-3.5 rounded-xl liquid-glass-subtle text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {t.profile.reject}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Content Gate or Posts / Reels / Saved Tabs */}
      {!canViewContent ? (
        <div className="liquid-glass rounded-3xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-200/80 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Lock className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {masked.isDeactivatedView
              ? language === 'bn'
                ? 'এই অ্যাকাউন্টটি সাময়িকভাবে ডিঅ্যাক্টিভেট করা আছে।'
                : 'This account is currently deactivated.'
              : t.profile.privateAccountLocked}
          </p>
        </div>
      ) : (
        <>
          <div className="inline-flex items-center gap-1 p-1 rounded-xl liquid-glass-subtle">
            <button
              type="button"
              onClick={() => setProfileTab('posts')}
              className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                profileTab === 'posts'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>{t.profile.posts}</span>
            </button>
            <button
              type="button"
              onClick={() => setProfileTab('reels')}
              className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                profileTab === 'reels'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Clapperboard className="w-3.5 h-3.5" />
              <span>{t.profile.reelsTab}</span>
            </button>
            {isOwn && (
              <button
                type="button"
                onClick={() => setProfileTab('saved')}
                className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                  profileTab === 'saved'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{t.profile.savedPosts}</span>
              </button>
            )}
          </div>

          {profileTab === 'reels' ? (
            userReels.length === 0 ? (
              <div className="liquid-glass rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {language === 'bn' ? 'এখনো কোনো রিল নেই।' : 'No reels yet.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {userReels.map((reel) => {
                  const thumb = reel.coverUrl || reel.mediaUrls[0];
                  return (
                    <button
                      key={reel.id}
                      type="button"
                      onClick={() => setActiveTab('reels')}
                      className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-slate-900 border border-white/10 text-left"
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={reel.caption || 'Reel thumbnail'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sky-700 to-indigo-900 text-white/80">
                          <Clapperboard className="w-8 h-8" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                        <p className="text-xs font-semibold line-clamp-2">{reel.caption}</p>
                        <p className="text-[10px] text-white/75 font-mono-num mt-0.5">
                          ♥ {formatCompactCount(reel.likesCount)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="space-y-4">
              {(profileTab === 'saved' && isOwn ? savedPosts : userStandardPosts).length === 0 ? (
                <div className="liquid-glass rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t.feed.noPosts}
                </div>
              ) : (
                (profileTab === 'saved' && isOwn ? savedPosts : userStandardPosts).map((p) => (
                  <PostCard key={p.id} post={p} />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Account Switcher Modal */}
      {accountSwitcherOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.profile.switchAccount}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="liquid-glass rounded-3xl p-5 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t.profile.switchAccount}
              </h2>
              <button
                type="button"
                aria-label="Close account switcher"
                onClick={() => setAccountSwitcherOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {savedLogins.map((entry) => {
                const isCurrent = entry.uid === currentUser.uid;
                return (
                  <button
                    key={entry.uid}
                    type="button"
                    onClick={async () => {
                      if (isCurrent) {
                        setAccountSwitcherOpen(false);
                        return;
                      }
                      try {
                        await loginWithSavedAccount(entry);
                        setAccountSwitcherOpen(false);
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Sign in required');
                        setAccountSwitcherOpen(false);
                        openAuthModal();
                      }
                    }}
                    className={`w-full p-3 rounded-2xl flex items-center justify-between gap-3 text-left ${
                      isCurrent
                        ? 'bg-sky-600/15 border border-sky-500/40'
                        : 'liquid-glass-subtle hover:bg-white/70 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={entry.photoUrl} name={entry.displayName} size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {entry.displayName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">@{entry.username}</p>
                      </div>
                    </div>
                    {isCurrent && <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/70 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setAccountSwitcherOpen(false);
                  openAuthModal();
                }}
                className="w-full min-h-[42px] rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{t.profile.addAccount}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccountSwitcherOpen(false);
                  logout();
                }}
                className="w-full min-h-[42px] rounded-xl liquid-glass-subtle text-rose-600 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.auth.logout}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Instagram-style Edit Profile Modal */}
      {subscreen === 'edit_profile' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.profile.editProfile}
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="liquid-glass rounded-3xl p-5 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {t.profile.editProfile}
              </h2>
              <button
                type="button"
                aria-label="Close edit profile"
                onClick={() => setSubscreen(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditProfile} className="space-y-4">
              {/* Cover & Profile Photo Editor */}
              <div className="space-y-3">
                <div className="relative h-28 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800">
                  {editCoverUrl && (
                    <img
                      src={editCoverUrl}
                      alt="Cover preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
                    {editCoverUrl && (
                      <button
                        type="button"
                        onClick={() => setEditCoverUrl('')}
                        className="min-h-[34px] px-2.5 rounded-xl bg-rose-600/85 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.profile.removeCover}</span>
                      </button>
                    )}
                    <label className="min-h-[34px] px-3 rounded-xl bg-black/65 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-black/80">
                      {uploadingKind === 'cover' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5" />
                      )}
                      <span>{uploadingKind === 'cover' ? '...' : t.profile.changeCover}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, 'cover')}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar src={editPhotoUrl} name={editName || currentUser.username} size="lg" />
                      <label
                        aria-label={t.profile.changePhoto}
                        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center cursor-pointer shadow"
                      >
                        {uploadingKind === 'avatar' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Camera className="w-3.5 h-3.5" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(e, 'avatar')}
                          className="sr-only"
                        />
                      </label>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          {t.profile.changePhoto}
                        </p>
                        {editPhotoUrl && (
                          <button
                            type="button"
                            onClick={() => setEditPhotoUrl('')}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{t.profile.deletePhoto}</span>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {AVATAR_PRESETS.map((preset, idx) => (
                          <button
                            key={preset}
                            type="button"
                            aria-label={`Avatar preset ${idx + 1}`}
                            onClick={() => setEditPhotoUrl(preset)}
                            className={`w-7 h-7 rounded-full overflow-hidden border-2 ${
                              editPhotoUrl === preset
                                ? 'border-sky-600'
                                : 'border-transparent opacity-70'
                            }`}
                          >
                            <img src={preset} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {COVER_PRESETS.map((preset, idx) => (
                      <button
                        key={preset}
                        type="button"
                        aria-label={`Cover preset ${idx + 1}`}
                        onClick={() => setEditCoverUrl(preset)}
                        className={`w-10 h-7 rounded-lg overflow-hidden border-2 ${
                          editCoverUrl === preset
                            ? 'border-sky-600'
                            : 'border-transparent opacity-70'
                        }`}
                      >
                        <img src={preset} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Nickname + Font with 7-day cooldown */}
              <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="edit-display-name"
                    className="text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    {t.auth.displayNameLabel}
                  </label>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    {nicknameCooldown.allowed
                      ? language === 'bn'
                        ? '৭ দিনে ১ বার পরিবর্তনযোগ্য'
                        : 'Editable once every 7 days'
                      : language === 'bn'
                      ? `${nicknameCooldown.remainingDays} দিন পর পরিবর্তন করা যাবে`
                      : `Locked for ${nicknameCooldown.remainingDays}d`}
                  </span>
                </div>
                <input
                  id="edit-display-name"
                  type="text"
                  required
                  maxLength={50}
                  disabled={!nicknameCooldown.allowed}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white disabled:opacity-60 ${NICKNAME_FONT_CLASSES[editNicknameFont]}`}
                />
                <div className="flex flex-wrap gap-1.5">
                  {FONT_OPTIONS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      disabled={!nicknameCooldown.allowed}
                      onClick={() => setEditNicknameFont(f.id)}
                      className={`min-h-[32px] px-2.5 rounded-lg text-xs border disabled:opacity-50 ${
                        editNicknameFont === f.id
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      } ${NICKNAME_FONT_CLASSES[f.id]}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Username with 14-day cooldown + live uniqueness check */}
              <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="edit-username"
                    className="text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    {t.auth.usernameLabel}
                  </label>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    {usernameCooldown.allowed
                      ? language === 'bn'
                        ? '১৪ দিনে ১ বার পরিবর্তনযোগ্য'
                        : 'Editable once every 14 days'
                      : language === 'bn'
                      ? `${usernameCooldown.remainingDays} দিন পর পরিবর্তন করা যাবে`
                      : `Locked for ${usernameCooldown.remainingDays}d`}
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="edit-username"
                    type="text"
                    required
                    maxLength={24}
                    disabled={!usernameCooldown.allowed}
                    value={editUsername}
                    onChange={(e) => setEditUsername(normalizeUsername(e.target.value))}
                    className="w-full min-h-[44px] pl-3.5 pr-28 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white disabled:opacity-60"
                  />
                  {usernameStatus === 'available' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-emerald-600 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t.auth.usernameAvailable}
                    </span>
                  )}
                  {usernameStatus === 'taken' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-rose-600 inline-flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" />
                      {t.auth.usernameTaken}
                    </span>
                  )}
                  {usernameStatus === 'checking' && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      ...
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="edit-pronouns"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {t.profile.pronounsLabel}
                  </label>
                  <input
                    id="edit-pronouns"
                    type="text"
                    maxLength={32}
                    placeholder="she/her, he/him, they/them"
                    value={editPronouns}
                    onChange={(e) => setEditPronouns(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-website"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {t.profile.websiteLabel}
                  </label>
                  <input
                    id="edit-website"
                    type="text"
                    maxLength={200}
                    placeholder="https://yoursite.com"
                    value={editWebsite}
                    onChange={(e) => setEditWebsite(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Bio (unlimited edits, max 150 chars) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="edit-bio"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    {t.auth.bioLabel}
                  </label>
                  <span
                    className={`text-[11px] font-mono-num ${
                      editBio.length >= MAX_BIO_LENGTH ? 'text-rose-500 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {editBio.length} / {MAX_BIO_LENGTH}
                  </span>
                </div>
                <textarea
                  id="edit-bio"
                  rows={3}
                  maxLength={MAX_BIO_LENGTH}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
                  className="w-full p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t.auth.interestsLabel}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {INTEREST_OPTIONS.map((item) => {
                    const active = editInterests.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleEditInterest(item)}
                        className={`min-h-[34px] px-3 rounded-xl text-xs font-medium transition-colors ${
                          active
                            ? 'bg-sky-600 text-white'
                            : 'bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl liquid-glass-subtle cursor-pointer">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {t.auth.privateAccountLabel}
                </span>
                <input
                  type="checkbox"
                  checked={editIsPrivate}
                  onChange={(e) => setEditIsPrivate(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
              </label>

              {editError && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{editError}</p>
              )}

              <button
                type="submit"
                disabled={savingEdit || Boolean(uploadingKind) || usernameStatus === 'taken' || usernameStatus === 'invalid'}
                className="w-full min-h-[46px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold disabled:opacity-60"
              >
                {savingEdit ? '...' : t.profile.saveChanges}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Followers / Following Modal */}
      {(subscreen === 'followers' || subscreen === 'following') && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={subscreen === 'followers' ? t.profile.followers : t.profile.following}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="liquid-glass rounded-3xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {subscreen === 'followers' ? t.profile.followers : t.profile.following}
              </h2>
              <button
                type="button"
                aria-label="Close list"
                onClick={() => setSubscreen(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {(subscreen === 'followers' ? followerIds : followingIds).length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                {subscreen === 'followers'
                  ? language === 'bn'
                    ? 'এখনো কোনো ফলোয়ার নেই।'
                    : 'No followers yet.'
                  : language === 'bn'
                  ? 'এখনো কাউকে ফলো করছেন না।'
                  : 'Not following anyone yet.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70 max-h-80 overflow-y-auto">
                {(subscreen === 'followers' ? followerIds : followingIds).map((uid) => {
                  const u = creators.find((c) => c.uid === uid);
                  if (!u) return null;
                  const m = getMaskedUserDisplay(u, currentUser.uid, u.uid);
                  return (
                    <div key={uid} className="py-3 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => openUserProfile(u.uid)}
                        className="flex items-center gap-3 min-w-0 text-left"
                      >
                        <Avatar src={m.isDeactivatedView ? '' : u.photoUrl} name={m.displayName} size="md" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {m.displayName}
                          </p>
                          <p className="text-xs text-slate-500">@{m.username}</p>
                        </div>
                      </button>
                      {subscreen === 'followers' ? (
                        <button
                          type="button"
                          onClick={() => removeFollower(u.uid)}
                          className="min-h-[36px] px-3 rounded-xl liquid-glass-subtle text-xs font-medium text-rose-600"
                        >
                          {t.profile.removeFollower}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleFollow(u.uid)}
                          className="min-h-[36px] px-3 rounded-xl liquid-glass-subtle text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          Unfollow
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Friend / Follow Requests Modal */}
      {subscreen === 'friend_requests' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.profile.friendRequests}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="liquid-glass rounded-3xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {t.profile.friendRequests}
              </h2>
              <button
                type="button"
                aria-label="Close friend requests"
                onClick={() => setSubscreen(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.profile.noRequests}</p>
            ) : (
              <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={req.fromAvatar} name={req.fromDisplayName} size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {req.fromDisplayName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          @{req.fromUsername}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => respondToFriendRequest(req.id, true)}
                        className="min-h-[38px] px-3 rounded-xl bg-sky-600 text-white text-xs font-semibold"
                      >
                        {t.profile.accept}
                      </button>
                      <button
                        type="button"
                        onClick={() => respondToFriendRequest(req.id, false)}
                        className="min-h-[38px] px-3 rounded-xl liquid-glass-subtle text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        {t.profile.reject}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
