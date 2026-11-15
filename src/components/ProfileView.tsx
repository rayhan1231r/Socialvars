import { useState } from 'react';
import {
  Bookmark,
  Camera,
  ExternalLink,
  Image as ImageIcon,
  LogIn,
  MessageSquare,
  Settings,
  Share2,
  Sparkles,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { IMG_ARIA, IMG_COASTAL, IMG_DESK, IMG_RAFI, IMG_SKYLINE } from '../data/seed';
import { formatCompactCount, normalizeUsername } from '../utils/validation';
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

const AVATAR_PRESETS = [IMG_ARIA, IMG_RAFI, IMG_COASTAL];
const COVER_PRESETS = [IMG_SKYLINE, IMG_DESK, IMG_COASTAL];

export function ProfileView() {
  const {
    currentUser,
    isAuthenticated,
    openAuthModal,
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
    showToast,
    t,
  } = useSocialVerse();

  const profileUser =
    (viewedProfileUid ? creators.find((u) => u.uid === viewedProfileUid) : null) || currentUser;
  const isOwn = profileUser.uid === currentUser.uid;
  const isFollowing = followingIds.includes(profileUser.uid);

  const [profileTab, setProfileTab] = useState<'posts' | 'saved'>('posts');

  // Full Instagram-style Edit Profile state
  const [editName, setEditName] = useState(currentUser.displayName);
  const [editUsername, setEditUsername] = useState(currentUser.username);
  const [editPronouns, setEditPronouns] = useState(currentUser.pronouns || '');
  const [editBio, setEditBio] = useState(currentUser.bio);
  const [editWebsite, setEditWebsite] = useState(currentUser.website || '');
  const [editPhotoUrl, setEditPhotoUrl] = useState(currentUser.photoUrl);
  const [editCoverUrl, setEditCoverUrl] = useState(currentUser.coverUrl);
  const [editInterests, setEditInterests] = useState<string[]>(currentUser.interests);
  const [editIsPrivate, setEditIsPrivate] = useState(currentUser.isPrivate);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const userPosts = posts.filter((p) => p.authorId === profileUser.uid);
  const savedPosts = posts.filter((p) => p.savedByMe);
  const displayedPosts = profileTab === 'saved' && isOwn ? savedPosts : userPosts;
  const pendingRequests = friendRequests.filter((r) => r.status === 'pending');

  const openEditProfileModal = () => {
    setEditName(currentUser.displayName);
    setEditUsername(currentUser.username);
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
    if (!file) return;
    try {
      const url = await uploadProfileImage(file, kind);
      if (kind === 'avatar') setEditPhotoUrl(url);
      else setEditCoverUrl(url);
    } catch {
      setEditError('Could not load selected image.');
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
    setSavingEdit(true);
    const err = await updateProfile({
      displayName: editName,
      username: editUsername,
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
        .writeText(`${window.location.origin}/?u=${profileUser.username}`)
        .catch(() => {});
    }
    showToast(`Copied @${profileUser.username} profile link`);
  };

  const handleMessageUser = () => {
    const id = createDirectOrGroupChat(
      profileUser.displayName,
      [currentUser.uid, profileUser.uid],
      'direct'
    );
    if (id) {
      setActiveTab('messages');
    }
  };

  return (
    <div className="space-y-5">
      {!isAuthenticated && isOwn && (
        <section className="liquid-glass rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-sky-500/30">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {t.auth.guestBannerTitle}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {t.auth.guestBannerDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal()}
            className="min-h-[42px] px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0"
          >
            <LogIn className="w-4 h-4" />
            <span>
              {t.auth.signIn} / {t.auth.register}
            </span>
          </button>
        </section>
      )}

      {!isOwn && (
        <button
          type="button"
          onClick={() => openUserProfile(currentUser.uid)}
          className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
        >
          ← Back to my profile
        </button>
      )}

      {/* Profile Header Card */}
      <section className="liquid-glass rounded-3xl overflow-hidden">
        <div className="h-36 sm:h-44 bg-slate-200 dark:bg-slate-800 relative">
          <img
            src={profileUser.coverUrl}
            alt={`${profileUser.displayName} cover`}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </div>

        <div className="p-5 sm:p-6 -mt-12 relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <Avatar
              src={profileUser.photoUrl}
              name={profileUser.displayName}
              size="xl"
              online={profileUser.onlineStatus === 'online'}
              className="ring-4 ring-white dark:ring-slate-900 rounded-full"
            />
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
                  <button
                    type="button"
                    aria-label={t.profile.settings}
                    onClick={() => setSubscreen('settings_privacy')}
                    className="min-h-[40px] min-w-[40px] rounded-xl liquid-glass-subtle flex items-center justify-center text-slate-700 dark:text-slate-200"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => toggleFollow(profileUser.uid)}
                    className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${
                      isFollowing
                        ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                        : 'bg-sky-600 text-white'
                    }`}
                  >
                    {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    <span>{isFollowing ? t.explore.following : t.explore.follow}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleMessageUser}
                    className="min-h-[40px] px-4 rounded-xl liquid-glass-subtle text-xs font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{t.profile.message}</span>
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
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {profileUser.displayName}
                </h1>
                {profileUser.pronouns && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {profileUser.pronouns}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                @{profileUser.username} ·{' '}
                {profileUser.isPrivate ? t.profile.privateProfile : t.profile.publicProfile}
              </p>
            </div>
            {profileUser.bio && (
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {profileUser.bio}
              </p>
            )}
            {profileUser.website && (
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
            {profileUser.interests.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {profileUser.interests.join(' · ')}
              </p>
            )}
          </div>

          {/* Stats Strip */}
          <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-slate-800/70 grid grid-cols-3 gap-2 text-center">
            <div className="p-2">
              <p className="text-lg font-bold font-mono-num text-slate-900 dark:text-white">
                {formatCompactCount(userPosts.length)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.profile.posts}</p>
            </div>
            <button
              type="button"
              onClick={() => setSubscreen('followers')}
              className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <p className="text-lg font-bold font-mono-num text-slate-900 dark:text-white">
                {formatCompactCount(profileUser.followersCount)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.profile.followers}</p>
            </button>
            <button
              type="button"
              onClick={() => setSubscreen('following')}
              className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <p className="text-lg font-bold font-mono-num text-slate-900 dark:text-white">
                {formatCompactCount(profileUser.followingCount)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.profile.following}</p>
            </button>
          </div>
        </div>
      </section>

      {/* Pending Friend Requests Banner on Own Profile */}
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
                    {req.mutualCount} {t.profile.mutualFriends}
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

      {/* Posts / Saved Tabs */}
      {isOwn && (
        <div className="inline-flex items-center gap-1 p-1 rounded-xl liquid-glass-subtle">
          <button
            type="button"
            onClick={() => setProfileTab('posts')}
            className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold ${
              profileTab === 'posts'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t.profile.posts}
          </button>
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
        </div>
      )}

      <div className="space-y-4">
        {displayedPosts.length === 0 ? (
          <div className="liquid-glass rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.feed.noPosts}
          </div>
        ) : (
          displayedPosts.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>

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
                  <img
                    src={editCoverUrl}
                    alt="Cover preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <label className="absolute right-2.5 bottom-2.5 min-h-[34px] px-3 rounded-xl bg-black/65 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-black/80">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{t.profile.changeCover}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, 'cover')}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={editPhotoUrl}
                        alt="Avatar preview"
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-full object-cover ring-2 ring-sky-500/40"
                      />
                      <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center cursor-pointer shadow">
                        <Camera className="w-3.5 h-3.5" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoUpload(e, 'avatar')}
                          className="sr-only"
                        />
                      </label>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {t.profile.changePhoto}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {AVATAR_PRESETS.map((preset, idx) => (
                          <button
                            key={preset}
                            type="button"
                            aria-label={`Avatar preset ${idx + 1}`}
                            onClick={() => setEditPhotoUrl(preset)}
                            className={`w-7 h-7 rounded-full overflow-hidden border-2 ${
                              editPhotoUrl === preset ? 'border-sky-600' : 'border-transparent opacity-70'
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
                          editCoverUrl === preset ? 'border-sky-600' : 'border-transparent opacity-70'
                        }`}
                      >
                        <img src={preset} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="edit-display-name"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {t.auth.displayNameLabel}
                  </label>
                  <input
                    id="edit-display-name"
                    type="text"
                    required
                    maxLength={50}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-username"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {t.auth.usernameLabel}
                  </label>
                  <input
                    id="edit-username"
                    type="text"
                    required
                    maxLength={24}
                    value={editUsername}
                    onChange={(e) => setEditUsername(normalizeUsername(e.target.value))}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
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

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="edit-bio"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    {t.auth.bioLabel}
                  </label>
                  <span className="text-[11px] font-mono-num text-slate-400">
                    {editBio.length} / 240
                  </span>
                </div>
                <textarea
                  id="edit-bio"
                  rows={3}
                  maxLength={240}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
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
                disabled={savingEdit}
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
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {(subscreen === 'followers' ? followerIds : followingIds).map((uid) => {
                const u = creators.find((c) => c.uid === uid);
                if (!u) return null;
                return (
                  <div key={uid} className="py-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => openUserProfile(u.uid)}
                      className="flex items-center gap-3 min-w-0 text-left"
                    >
                      <Avatar src={u.photoUrl} name={u.displayName} size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {u.displayName}
                        </p>
                        <p className="text-xs text-slate-500">@{u.username}</p>
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
          </div>
        </div>
      )}

      {/* Friend Requests Modal */}
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
                          {req.mutualCount} {t.profile.mutualFriends}
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
