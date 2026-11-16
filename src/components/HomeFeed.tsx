import { useRef, useState } from 'react';
import { Clapperboard, PlusSquare, RefreshCw, Sparkles } from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { canViewPrivateProfileContent } from '../utils/validation';
import { FeedSkeleton } from './LiquidGlassSkeletons';
import { PostCard } from './PostCard';
import { StoriesBar } from './StoriesBar';

export function HomeFeed() {
  const {
    posts,
    creators,
    isFeedLoading,
    refreshFeed,
    visiblePostLimit,
    loadMorePosts,
    followingIds,
    currentUser,
    isAuthenticated,
    t,
    setSubscreen,
    setActiveTab,
  } = useSocialVerse();
  const [feedMode, setFeedMode] = useState<'recommended' | 'following'>('recommended');
  const swipeStartX = useRef<number | null>(null);

  if (isFeedLoading) {
    return <FeedSkeleton label={t.feed.loadingFeed} />;
  }

  const viewerUid = isAuthenticated ? currentUser.uid : null;
  const accessiblePosts = posts.filter((p) => {
    const author = creators.find((c) => c.uid === p.authorId);
    if (!author) return true;
    return canViewPrivateProfileContent(author, viewerUid, followingIds);
  });

  const filteredPosts =
    feedMode === 'following'
      ? accessiblePosts.filter(
          (p) => followingIds.includes(p.authorId) || p.authorId === currentUser.uid
        )
      : accessiblePosts;

  const visiblePosts = filteredPosts.slice(0, visiblePostLimit);
  const hasMore = visiblePosts.length < filteredPosts.length;

  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? swipeStartX.current;
    const deltaX = swipeStartX.current - endX;
    swipeStartX.current = null;
    if (deltaX > 70) {
      setSubscreen('create_sheet');
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="space-y-4"
    >
      <StoriesBar />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl liquid-glass-subtle">
          <button
            type="button"
            onClick={() => setFeedMode('recommended')}
            className={`min-h-[40px] px-3 sm:px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              feedMode === 'recommended'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t.feed.recommended}
          </button>
          <button
            type="button"
            onClick={() => setFeedMode('following')}
            className={`min-h-[40px] px-3 sm:px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              feedMode === 'following'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t.feed.followingFeed}
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            aria-label={t.feed.refreshFeed}
            onClick={() => {
              void refreshFeed();
            }}
            className="min-h-[40px] min-w-[40px] rounded-xl liquid-glass-subtle text-slate-700 dark:text-slate-200 inline-flex items-center justify-center hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setSubscreen('create_sheet')}
            className="min-h-[40px] px-2.5 sm:px-3.5 rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-sky-700 transition-colors whitespace-nowrap"
          >
            <PlusSquare className="w-4 h-4" />
            <span>{t.nav.create}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reels')}
            className="min-h-[40px] px-2.5 sm:px-3.5 rounded-xl liquid-glass-subtle text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors whitespace-nowrap"
          >
            <Clapperboard className="w-4 h-4 text-sky-600" />
            <span>{t.explore.reels}</span>
          </button>
        </div>
      </div>

      {visiblePosts.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-8 sm:p-10 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-600/10 text-sky-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto">
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {t.feed.noPosts}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.feed.emptyHomeDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSubscreen('create_sheet')}
            className="min-h-[42px] px-5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold inline-flex items-center gap-2"
          >
            <PlusSquare className="w-4 h-4" />
            <span>{t.create.newPost}</span>
          </button>
          <p className="text-[11px] text-slate-400">{t.feed.swipeCreateHint}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visiblePosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={loadMorePosts}
            className="min-h-[44px] px-6 rounded-xl liquid-glass-subtle text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/80"
          >
            {t.feed.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
