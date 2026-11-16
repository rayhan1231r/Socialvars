import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Cake,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock,
  ExternalLink,
  Flag,
  Grid,
  Image as ImageIcon,
  Info,
  Loader2,
  Lock,
  LogOut,
  Megaphone,
  MessageSquare,
  Pencil,
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
import type { NicknameFontStyle, StoryHighlightItem, UserPublic } from '../types/social';
import {
  BROADCAST_MIN_FOLLOWERS,
  MAX_BIO_LENGTH,
  NICKNAME_FONT_CLASSES,
  canChangeNickname,
  canChangeUsername,
  canOpenBroadcastChannel,
  canViewPrivateProfileContent,
  formatCalendarDate,
  formatCompactCount,
  formatRelativeTime,
  getMaskedUserDisplay,
  isValidDateOfBirth,
  isValidHighlightTitle,
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
    stories,
    storyHighlights,
    activeHighlightId,
    setActiveHighlightId,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    fetchUserConnections,
    viewedProfileUid,
    openUserProfile,
    goBack,
    followingIds,
    followerIds,
    friendRequests,
    notifications,
    toggleFollow,
    respondToFriendRequest,
    removeFollower,
    createDirectOrGroupChat,
    setActiveTab,
    setSubscreen,
    subscreen,
    updateProfile,
    uploadProfileImage,
    uploadImageDataUrl,
    checkUsernameAvailability,
    openReportModal,
    showToast,
    language,
    t,
  } = useSocialVerse();

  const [profileTab, setProfileTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);

  // Story Highlights state
  const [hlTitle, setHlTitle] = useState('');
  const [hlCoverUrl, setHlCoverUrl] = useState('');
  const [hlSelectedStoryIds, setHlSelectedStoryIds] = useState<string[]>([]);
  const [hlCustomItems, setHlCustomItems] = useState<StoryHighlightItem[]>([]);
  const [hlSaving, setHlSaving] = useState(false);
  const [hlSlideIdx, setHlSlideIdx] = useState(0);
  const [hlEditingTitle, setHlEditingTitle] = useState(false);
  const [hlDraftTitle, setHlDraftTitle] = useState('');

  // Connections modal state for other profiles
  const [connectionsModalData, setConnectionsModalData] = useState<{
    uid: string;
    followerIds: string[];
    followingIds: string[];
    loading: boolean;
  }>({ uid: '', followerIds: [], followingIds: [], loading: false });

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
  const [editInterests, setEditInterests] = useState<string[]>(currentUser.interests || []);
  const [editIsPrivate, setEditIsPrivate] = useState(currentUser.isPrivate);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<'avatar' | 'cover' | null>(null);
  const [directUploading, setDirectUploading] = useState<'avatar' | 'cover' | null>(null);
  const [oneTimeDobInput, setOneTimeDobInput] = useState('');
  const [oneTimeDobError, setOneTimeDobError] = useState<string | null>(null);
  const [savingOneTimeDob, setSavingOneTimeDob] = useState(false);

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

  const foundCreator = viewedProfileUid
    ? creators.find((u) => u.uid === viewedProfileUid)
    : undefined;
  const fallbackFromSignal: UserPublic | null = (() => {
    if (!viewedProfileUid || viewedProfileUid === currentUser.uid) return null;
    const notif = notifications.find((n) => n.actorUid === viewedProfileUid);
    const req = friendRequests.find(
      (r) => r.fromUid === viewedProfileUid || r.toUid === viewedProfileUid
    );
    const username = notif?.actorUsername || req?.fromUsername || viewedProfileUid;
    const displayName = req?.fromDisplayName || notif?.actorUsername || 'SocialVerse Member';
    const photoUrl = notif?.actorAvatar || req?.fromAvatar || '';
    return {
      uid: viewedProfileUid,
      username,
      displayName,
      bio: '',
      photoUrl,
      coverUrl: '',
      interests: [],
      isPrivate: false,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      onlineStatus: 'offline',
      lastSeenAt: new Date().toISOString(),
      onboardingCompleted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  })();

  const profileUser: UserPublic =
    viewedProfileUid && viewedProfileUid !== currentUser.uid
      ? foundCreator || fallbackFromSignal!
      : currentUser;
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
    setEditInterests(currentUser.interests || []);
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

  const openConnectionsModal = async (kind: 'followers' | 'following') => {
    setSubscreen(kind);
    if (isOwn) return;
    setConnectionsModalData({
      uid: profileUser.uid,
      followerIds: [],
      followingIds: [],
      loading: true,
    });
    const res = await fetchUserConnections(profileUser.uid);
    setConnectionsModalData({
      uid: profileUser.uid,
      followerIds: res.followerIds,
      followingIds: res.followingIds,
      loading: false,
    });
  };

  const openNewHighlightCreator = () => {
    setHlTitle('');
    setHlCoverUrl('');
    setHlSelectedStoryIds([]);
    setHlCustomItems([]);
    setSubscreen('highlight_creator');
  };

  const handleAddHighlightPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await uploadImageDataUrl(file, 1080);
      const item: StoryHighlightItem = {
        id: `hl_item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        mediaType: file.type.startsWith('video/') ? 'video' : 'photo',
        mediaUrl: url,
        createdAt: new Date().toISOString(),
      };
      setHlCustomItems((prev) => [...prev, item]);
      if (!hlCoverUrl) setHlCoverUrl(url);
    } catch {
      showToast('Could not upload highlight photo.');
    }
  };

  const handleCreateHighlightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidHighlightTitle(hlTitle)) return;
    if (hlSelectedStoryIds.length === 0 && hlCustomItems.length === 0) {
      showToast(
        language === 'bn'
          ? 'হাইলাইটের জন্য অন্তত একটি স্টোরি বা ছবি যোগ করুন।'
          : 'Select a story or add at least one photo.'
      );
      return;
    }
    setHlSaving(true);
    const created = await createHighlight({
      title: hlTitle.trim(),
      coverUrl: hlCoverUrl || undefined,
      storyIds: hlSelectedStoryIds,
      items: hlCustomItems,
    });
    setHlSaving(false);
    if (created) {
      setSubscreen(null);
    }
  };

  const userHighlights = storyHighlights.filter((h) => h.ownerUid === profileUser.uid);
  const myActiveStories = stories.filter((s) => s.authorId === currentUser.uid);
  const activeHighlight =
    storyHighlights.find((h) => h.id === activeHighlightId) || null;

  const broadcastUnlocked = canOpenBroadcastChannel(currentUser.followersCount);
  const nicknameClass = NICKNAME_FONT_CLASSES[profileUser.nicknameFont || 'classic'];

  const handleSaveOneTimeDob = async (e: React.FormEvent) => {
    e.preventDefault();
    setOneTimeDobError(null);
    const check = isValidDateOfBirth(oneTimeDobInput);
    if (!check.valid) {
      setOneTimeDobError(
        check.reason === 'too_young'
          ? t.auth.dobTooYoung
          : check.reason === 'future'
          ? t.auth.dobFutureError
          : t.auth.dobInvalidFormat
      );
      return;
    }
    setSavingOneTimeDob(true);
    const err = await updateProfile({ dateOfBirth: check.normalized });
    setSavingOneTimeDob(false);
    if (err) {
      setOneTimeDobError(err);
    } else {
      setOneTimeDobInput('');
    }
  };

  if (subscreen === 'profile_about') {
    const formattedDob =
      !masked.isDeactivatedView && profileUser.dateOfBirth
        ? formatCalendarDate(profileUser.dateOfBirth, language)
        : '';
    const formattedCreatedAt = formatCalendarDate(profileUser.createdAt, language);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-1">
          <button
            type="button"
            onClick={goBack}
            className="min-h-[40px] px-3.5 rounded-xl liquid-glass-btn inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.profile.back}</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-display font-bold text-slate-900 dark:text-white truncate">
              {t.profile.aboutPageTitle}
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {t.profile.aboutSubtitle}
            </p>
          </div>
        </div>

        <section className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-200/70 dark:border-white/10">
            <Avatar
              src={masked.isDeactivatedView ? '' : profileUser.photoUrl}
              name={masked.displayName}
              size="lg"
            />
            <div className="min-w-0">
              <p className={`text-lg text-slate-900 dark:text-white truncate ${nicknameClass}`}>
                {masked.displayName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                @{masked.username}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Date of Birth Row */}
            <div className="p-4 rounded-2xl liquid-glass-subtle space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <Cake className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t.profile.dateOfBirth}
                    </p>
                    {formattedDob && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        <Lock className="w-3 h-3" />
                        <span>{t.profile.dobLockedNote}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-base font-semibold text-slate-900 dark:text-white">
                    {masked.isDeactivatedView
                      ? t.profile.dobNotProvided
                      : formattedDob || t.profile.dobNotProvided}
                  </p>
                </div>
              </div>

              {isOwn && !profileUser.dateOfBirth && !masked.isDeactivatedView && (
                <form onSubmit={handleSaveOneTimeDob} className="pt-2 border-t border-slate-200/60 dark:border-white/10 space-y-2.5">
                  <label
                    htmlFor="about-onetime-dob"
                    className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    {t.profile.setDobOnce}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="about-onetime-dob"
                      type="date"
                      required
                      min="1900-01-01"
                      max={new Date().toISOString().slice(0, 10)}
                      value={oneTimeDobInput}
                      onChange={(e) => {
                        setOneTimeDobInput(e.target.value);
                        setOneTimeDobError(null);
                      }}
                      className="flex-1 min-h-[42px] px-3 rounded-xl bg-white/85 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={savingOneTimeDob || !oneTimeDobInput}
                      className="min-h-[42px] px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {savingOneTimeDob ? '...' : t.profile.saveDobOnce}
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.auth.dobOneTimeWarning}</span>
                  </p>
                  {oneTimeDobError && (
                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                      {oneTimeDobError}
                    </p>
                  )}
                </form>
              )}
            </div>

            {/* Account Creation Date Row */}
            <div className="p-4 rounded-2xl liquid-glass-subtle flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t.profile.accountCreated}
                </p>
                <p className="text-base font-semibold text-slate-900 dark:text-white">
                  {formattedCreatedAt || t.profile.dobNotProvided}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Profile Bar: Own Account Switcher / Other Profile Back */}
      {isOwn ? (
        <div className="flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={() => setAccountSwitcherOpen(true)}
            className="min-h-[40px] px-3 rounded-xl liquid-glass-btn inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white"
          >
            <span>@{currentUser.username}</span>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubscreen('broadcast_channel')}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${
                broadcastUnlocked
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'liquid-glass-btn text-slate-700 dark:text-slate-200'
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
              className="min-h-[40px] min-w-[40px] rounded-xl liquid-glass-btn flex items-center justify-center text-slate-700 dark:text-slate-200"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={goBack}
            className="min-h-[40px] px-3.5 rounded-xl liquid-glass-btn inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.profile.back}</span>
          </button>
        </div>
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
                    className="min-h-[40px] px-4 rounded-xl liquid-glass-btn text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap"
                  >
                    {t.profile.editProfile}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubscreen('ai_assistant')}
                    className="min-h-[40px] px-4 rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-sky-700 whitespace-nowrap shadow-sm shadow-sky-600/25"
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
                      className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all duration-150 ${
                        isFollowing || hasPendingRequest
                          ? 'liquid-glass-btn text-slate-800 dark:text-slate-100'
                          : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/25'
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
                      className="min-h-[40px] px-4 rounded-xl liquid-glass-btn text-xs font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5"
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
                    className="min-h-[40px] min-w-[40px] rounded-xl liquid-glass-btn flex items-center justify-center text-rose-600"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSubscreen('profile_about')}
                className="min-h-[40px] px-3.5 rounded-xl liquid-glass-btn text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Info className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>{t.profile.aboutOption}</span>
              </button>
              <button
                type="button"
                aria-label={t.profile.shareProfile}
                onClick={handleShareProfile}
                className="min-h-[40px] min-w-[40px] rounded-xl liquid-glass-btn flex items-center justify-center text-slate-700 dark:text-slate-200"
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
              <div className="pt-0.5">
                <a
                  href={profileUser.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 min-h-[36px] px-3.5 rounded-xl liquid-glass-btn text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-[260px]">
                    {profileUser.website.replace(/^https?:\/\//i, '')}
                  </span>
                </a>
              </div>
            )}

            {!masked.isDeactivatedView && (profileUser.interests || []).length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                {(profileUser.interests || []).join(' · ')}
              </p>
            )}
          </div>

          {/* Stats Strip */}
          <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-slate-800/70 grid grid-cols-3 gap-2 text-center">
            <div className="p-2">
              <p className="text-lg font-bold font-mono-num text-slate-900 dark:text-white">
                {formatCompactCount(canViewContent ? allUserPosts.length : 0)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.profile.posts}</p>
            </div>
            <button
              type="button"
              disabled={!isOwn && !canViewContent}
              onClick={() => openConnectionsModal('followers')}
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
              onClick={() => openConnectionsModal('following')}
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

      {/* Story Highlights Strip */}
      {canViewContent && (isOwn || userHighlights.length > 0) && (
        <section
          aria-label={t.profile.highlightsTitle}
          className="liquid-glass rounded-2xl p-4 space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.profile.highlightsTitle}
            </h2>
          </div>
          <div className="flex items-start gap-3.5 overflow-x-auto no-scrollbar pb-1">
            {isOwn && (
              <button
                type="button"
                onClick={openNewHighlightCreator}
                className="flex flex-col items-center gap-1.5 shrink-0 w-[68px] group"
              >
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-sky-500/70 bg-sky-500/5 group-hover:bg-sky-500/12 flex items-center justify-center text-sky-600 dark:text-sky-400 transition-colors duration-150">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[68px]">
                  {t.profile.newHighlight}
                </span>
              </button>
            )}

            {userHighlights.map((hl) => {
              const cover = hl.coverUrl || hl.items.find((it) => it.mediaUrl)?.mediaUrl || '';
              return (
                <button
                  key={hl.id}
                  type="button"
                  onClick={() => {
                    setActiveHighlightId(hl.id);
                    setHlSlideIdx(0);
                    setHlEditingTitle(false);
                    setSubscreen('highlight_viewer');
                  }}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-[68px] group"
                >
                  <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-sky-500 via-blue-500 to-cyan-400 shadow-sm group-hover:scale-105 transition-transform duration-150">
                    <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 ring-2 ring-white dark:ring-slate-900 flex items-center justify-center">
                      {cover ? (
                        <img
                          src={cover}
                          alt={hl.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Sparkles className="w-5 h-5 text-sky-400" />
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate max-w-[68px]">
                    {hl.title}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

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
                        const msg = err instanceof Error ? err.message : 'Sign in required';
                        showToast(msg);
                        setAccountSwitcherOpen(false);
                        openAuthModal(msg, entry.username || entry.email);
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

              {/* Permanent Date of Birth (Locked — Read Only) */}
              <div className="p-3.5 rounded-2xl liquid-glass-subtle flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {t.profile.dateOfBirth}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {currentUser.dateOfBirth
                      ? formatCalendarDate(currentUser.dateOfBirth, language)
                      : t.profile.dobNotProvided}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 shrink-0">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t.profile.dobLockedNote}</span>
                </span>
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
      {(subscreen === 'followers' || subscreen === 'following') && (() => {
        const listIds = isOwn
          ? subscreen === 'followers'
            ? followerIds
            : followingIds
          : subscreen === 'followers'
          ? connectionsModalData.followerIds
          : connectionsModalData.followingIds;

        return (
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
              {!isOwn && connectionsModalData.loading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
                </div>
              ) : listIds.length === 0 ? (
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
                  {listIds.map((uid) => {
                    const u = creators.find((c) => c.uid === uid);
                    if (!u) return null;
                    const m = getMaskedUserDisplay(u, currentUser.uid, u.uid);
                    const amFollowing = followingIds.includes(u.uid);
                    const isFollowerOfMine = followerIds.includes(u.uid);
                    const isMe = u.uid === currentUser.uid;

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
                        {isOwn ? (
                          subscreen === 'followers' ? (
                            <button
                              type="button"
                              onClick={() => removeFollower(u.uid)}
                              className="min-h-[36px] px-3 rounded-xl liquid-glass-btn text-xs font-medium text-rose-600"
                            >
                              {t.profile.removeFollower}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleFollow(u.uid)}
                              className="min-h-[36px] px-3 rounded-xl liquid-glass-btn text-xs font-medium text-slate-700 dark:text-slate-300"
                            >
                              Unfollow
                            </button>
                          )
                        ) : !isMe && !m.isDeactivatedView ? (
                          <button
                            type="button"
                            onClick={() => toggleFollow(u.uid)}
                            className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold ${
                              amFollowing
                                ? 'liquid-glass-btn text-slate-700 dark:text-slate-200'
                                : 'bg-sky-600 text-white'
                            }`}
                          >
                            {amFollowing
                              ? t.explore.following
                              : isFollowerOfMine
                              ? t.explore.followBack
                              : t.explore.follow}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Highlight Creator Modal */}
      {subscreen === 'highlight_creator' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.profile.addHighlightTitle}
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="liquid-glass rounded-3xl p-5 sm:p-6 max-w-md w-full max-h-[88vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {t.profile.addHighlightTitle}
              </h2>
              <button
                type="button"
                aria-label="Close highlight creator"
                onClick={() => setSubscreen(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHighlightSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="highlight-title-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {language === 'bn' ? 'হাইলাইটের নাম' : 'Highlight Name'}
                </label>
                <input
                  id="highlight-title-input"
                  type="text"
                  required
                  maxLength={36}
                  value={hlTitle}
                  onChange={(e) => setHlTitle(e.target.value)}
                  placeholder={language === 'bn' ? 'যেমন: ভ্রমণ, স্মৃতি...' : 'e.g. Travels, Moments'}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {language === 'bn' ? 'ছবি যোগ করুন' : 'Add Photos / Stories'}
                  </p>
                  <label className="min-h-[34px] px-3 rounded-xl liquid-glass-btn text-xs font-semibold text-sky-600 dark:text-sky-400 inline-flex items-center gap-1.5 cursor-pointer">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'ছবি আপলোড' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleAddHighlightPhoto}
                      className="sr-only"
                    />
                  </label>
                </div>

                {hlCustomItems.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {hlCustomItems.map((it) => (
                      <div key={it.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-sky-500">
                        <img src={it.mediaUrl || ''} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          aria-label="Remove photo"
                          onClick={() =>
                            setHlCustomItems((prev) => prev.filter((x) => x.id !== it.id))
                          }
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {myActiveStories.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-slate-500">
                      {language === 'bn' ? 'আপনার সক্রিয় স্টোরি থেকে বাছাই করুন:' : 'Pick from your active stories:'}
                    </p>
                    <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                      {myActiveStories.map((st) => {
                        const selected = hlSelectedStoryIds.includes(st.id);
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() =>
                              setHlSelectedStoryIds((prev) =>
                                selected ? prev.filter((id) => id !== st.id) : [...prev, st.id]
                              )
                            }
                            className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${
                              selected ? 'border-sky-500 ring-2 ring-sky-500/40' : 'border-transparent opacity-80'
                            }`}
                          >
                            {st.mediaUrl ? (
                              <img src={st.mediaUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-sky-700 to-indigo-900 p-2 flex items-center justify-center text-[10px] text-white text-center">
                                {st.textContent}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={hlSaving || !isValidHighlightTitle(hlTitle)}
                className="w-full min-h-[44px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                {hlSaving ? '...' : t.profile.addHighlightTitle}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Highlight Viewer Modal */}
      {subscreen === 'highlight_viewer' && activeHighlight && (() => {
        const slides = activeHighlight.items.length > 0
          ? activeHighlight.items
          : [
              {
                id: 'fallback',
                mediaType: activeHighlight.coverUrl ? ('photo' as const) : ('text' as const),
                mediaUrl: activeHighlight.coverUrl,
                textContent: activeHighlight.title,
                createdAt: activeHighlight.createdAt,
              },
            ];
        const safeSlideIdx = Math.min(hlSlideIdx, slides.length - 1);
        const slide = slides[safeSlideIdx];
        const isHlOwner = activeHighlight.ownerUid === currentUser.uid;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={activeHighlight.title}
            className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-md h-[80vh] max-h-[740px] rounded-3xl overflow-hidden bg-slate-900 border border-white/15 shadow-2xl flex flex-col justify-between">
              {slide.mediaType === 'photo' && slide.mediaUrl ? (
                <img
                  src={slide.mediaUrl}
                  alt={slide.textContent || activeHighlight.title}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : slide.mediaType === 'video' && slide.mediaUrl ? (
                <video
                  src={slide.mediaUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-sky-700 via-indigo-800 to-slate-950 flex items-center justify-center p-8 text-center">
                  <p className="text-2xl font-display font-semibold text-white">
                    {slide.textContent || activeHighlight.title}
                  </p>
                </div>
              )}

              <div className="relative z-10 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent space-y-3">
                <div className="flex gap-1.5">
                  {slides.map((sl, idx) => (
                    <div key={sl.id} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          idx <= safeSlideIdx ? 'bg-white w-full' : 'w-0'
                        }`}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {hlEditingTitle ? (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!isValidHighlightTitle(hlDraftTitle)) return;
                          await updateHighlight(activeHighlight.id, { title: hlDraftTitle.trim() });
                          setHlEditingTitle(false);
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <input
                          type="text"
                          value={hlDraftTitle}
                          maxLength={36}
                          onChange={(e) => setHlDraftTitle(e.target.value)}
                          className="min-h-[34px] px-2.5 rounded-lg bg-white/15 border border-white/25 text-xs text-white focus:outline-none w-36"
                        />
                        <button
                          type="submit"
                          className="min-h-[34px] min-w-[34px] rounded-lg bg-sky-600 text-white flex items-center justify-center"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-white truncate">{activeHighlight.title}</p>
                        <p className="text-[11px] text-white/75">
                          {formatRelativeTime(slide.createdAt, language)}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isHlOwner && !hlEditingTitle && (
                      <button
                        type="button"
                        aria-label="Edit highlight title"
                        onClick={() => {
                          setHlDraftTitle(activeHighlight.title);
                          setHlEditingTitle(true);
                        }}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-white/90 hover:text-white"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {isHlOwner && (
                      <button
                        type="button"
                        aria-label={t.profile.deleteHighlight}
                        onClick={async () => {
                          await deleteHighlight(activeHighlight.id);
                        }}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-white/90 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Close highlight viewer"
                      onClick={() => {
                        setActiveHighlightId(null);
                        setSubscreen(null);
                      }}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-white/90 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex items-center justify-between px-2">
                <button
                  type="button"
                  aria-label="Previous highlight item"
                  disabled={safeSlideIdx === 0}
                  onClick={() => setHlSlideIdx(Math.max(0, safeSlideIdx - 1))}
                  className="min-h-[44px] min-w-[44px] rounded-full bg-black/35 text-white flex items-center justify-center disabled:opacity-25"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next highlight item"
                  disabled={safeSlideIdx >= slides.length - 1}
                  onClick={() => setHlSlideIdx(Math.min(slides.length - 1, safeSlideIdx + 1))}
                  className="min-h-[44px] min-w-[44px] rounded-full bg-black/35 text-white flex items-center justify-center disabled:opacity-25"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="relative z-10 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                {slide.textContent && slide.mediaType !== 'text' && (
                  <p className="text-sm text-white/95 text-center">{slide.textContent}</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
