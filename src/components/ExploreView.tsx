import { useMemo, useState } from 'react';
import { Clapperboard, Hash, Search } from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import {
  canViewPrivateProfileContent,
  formatCompactCount,
  getMaskedUserDisplay,
} from '../utils/validation';
import { Avatar } from './Avatar';
import { PostCard } from './PostCard';

export function ExploreView() {
  const {
    posts,
    creators,
    currentUser,
    isAuthenticated,
    followingIds,
    followerIds,
    friendRequests,
    toggleFollow,
    openUserProfile,
    setActiveTab,
    t,
  } = useSocialVerse();

  const [queryText, setQueryText] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'users' | 'posts' | 'reels'>('all');

  const accessiblePosts = useMemo(() => {
    const viewerUid = isAuthenticated ? currentUser.uid : null;
    return posts.filter((p) => {
      const author = creators.find((c) => c.uid === p.authorId);
      if (!author) return true;
      return canViewPrivateProfileContent(author, viewerUid, followingIds);
    });
  }, [posts, creators, isAuthenticated, currentUser.uid, followingIds]);

  const trendingHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    accessiblePosts.forEach((p) => {
      p.hashtags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [accessiblePosts]);

  const normalizedQuery = queryText.trim().toLowerCase().replace(/^#/, '');

  const matchedUsers = useMemo(() => {
    return creators.filter((u) => {
      if (isAuthenticated && u.uid === currentUser.uid) return false;
      if (u.isDeactivated && u.uid !== currentUser.uid) return false;
      if (!normalizedQuery) return true;
      const masked = getMaskedUserDisplay(u, isAuthenticated ? currentUser.uid : null, u.uid);
      return (
        u.uid.toLowerCase().includes(normalizedQuery) ||
        masked.username.toLowerCase().includes(normalizedQuery) ||
        masked.displayName.toLowerCase().includes(normalizedQuery) ||
        u.bio.toLowerCase().includes(normalizedQuery) ||
        u.interests.some((i) => i.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [creators, currentUser.uid, isAuthenticated, normalizedQuery]);

  const matchedPosts = useMemo(() => {
    const base =
      filterTab === 'reels'
        ? accessiblePosts.filter((p) => p.mediaType === 'reel' || p.mediaType === 'video')
        : filterTab === 'posts'
        ? accessiblePosts.filter((p) => p.mediaType !== 'reel')
        : accessiblePosts;
    if (!normalizedQuery) return base;
    return base.filter(
      (p) =>
        p.caption.toLowerCase().includes(normalizedQuery) ||
        p.authorUsername.toLowerCase().includes(normalizedQuery) ||
        p.authorDisplayName.toLowerCase().includes(normalizedQuery) ||
        p.authorId.toLowerCase().includes(normalizedQuery) ||
        p.hashtags.some((h) => h.toLowerCase().includes(normalizedQuery))
    );
  }, [accessiblePosts, filterTab, normalizedQuery]);

  return (
    <div className="space-y-5">
      {/* Search Bar */}
      <div className="liquid-glass rounded-2xl p-3 flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
        <input
          type="search"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder={t.explore.searchPlaceholder}
          aria-label={t.explore.searchPlaceholder}
          className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none min-h-[40px]"
        />
        {queryText && (
          <button
            type="button"
            onClick={() => setQueryText('')}
            className="min-h-[36px] px-3 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
          >
            Clear
          </button>
        )}
      </div>

      {/* Filter Tabs & Reels Shortcut */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl liquid-glass-subtle">
          {(['all', 'users', 'posts', 'reels'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterTab(tab)}
              className={`min-h-[40px] px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                filterTab === tab
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t.explore[tab]}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('reels')}
          className="min-h-[42px] px-4 rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-2 hover:bg-sky-700 transition-colors"
        >
          <Clapperboard className="w-4 h-4" />
          <span>{t.nav.reels}</span>
        </button>
      </div>

      {/* Trending Hashtags */}
      {trendingHashtags.length > 0 && (
        <section aria-label={t.explore.trendingHashtags} className="liquid-glass rounded-2xl p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {t.explore.trendingHashtags}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {trendingHashtags.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                onClick={() => setQueryText(`#${tag}`)}
                className="min-h-[48px] p-3 rounded-xl liquid-glass-subtle text-left hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-2"
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white truncate">
                  <Hash className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  {tag}
                </span>
                <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400 shrink-0">
                  {count}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Accounts */}
      {(filterTab === 'all' || filterTab === 'users') && (
        <section aria-label={t.explore.suggestedAccounts} className="liquid-glass rounded-2xl p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {t.explore.suggestedAccounts}
          </h2>
          {matchedUsers.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {normalizedQuery ? 'No matching accounts found.' : t.feed.emptyHomeDesc}
            </p>
          ) : (
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {matchedUsers.map((creator) => {
                const isFollowing = followingIds.includes(creator.uid);
                const isFollower = followerIds.includes(creator.uid);
                const hasPendingRequest = friendRequests.some(
                  (r) =>
                    r.fromUid === currentUser.uid &&
                    r.toUid === creator.uid &&
                    r.status === 'pending'
                );
                const masked = getMaskedUserDisplay(
                  creator,
                  isAuthenticated ? currentUser.uid : null,
                  creator.uid
                );

                const followLabel = isFollowing
                  ? t.explore.following
                  : hasPendingRequest
                  ? t.explore.requestSent
                  : isFollower
                  ? t.explore.followBack
                  : t.explore.follow;

                return (
                  <div key={creator.uid} className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => openUserProfile(creator.uid)}
                      className="flex items-center gap-3 min-w-0 text-left"
                    >
                      <Avatar
                        src={creator.photoUrl}
                        name={masked.displayName}
                        size="md"
                        online={creator.onlineStatus === 'online'}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {masked.displayName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          @{masked.username} · {formatCompactCount(creator.followersCount)}{' '}
                          {t.profile.followers.toLowerCase()}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFollow(creator.uid)}
                      className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                        isFollowing || hasPendingRequest
                          ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          : 'bg-sky-600 text-white hover:bg-sky-700'
                      }`}
                    >
                      {followLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Popular Content */}
      {filterTab !== 'users' && (
        <section aria-label={t.explore.popularPosts} className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white px-1">
            {t.explore.popularPosts}
          </h2>
          {matchedPosts.length === 0 ? (
            <div className="liquid-glass rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {t.feed.noPosts}
            </div>
          ) : (
            matchedPosts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </section>
      )}
    </div>
  );
}
