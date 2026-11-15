import { useState } from 'react';
import { Clapperboard } from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { PostCard } from './PostCard';
import { StoriesBar } from './StoriesBar';

export function HomeFeed() {
  const { posts, visiblePostLimit, loadMorePosts, followingIds, currentUser, t, setSubscreen } =
    useSocialVerse();
  const [feedMode, setFeedMode] = useState<'recommended' | 'following'>('recommended');

  const filteredPosts =
    feedMode === 'following'
      ? posts.filter(
          (p) => followingIds.includes(p.authorId) || p.authorId === currentUser.uid
        )
      : posts;

  const visiblePosts = filteredPosts.slice(0, visiblePostLimit);
  const hasMore = visiblePosts.length < filteredPosts.length;

  return (
    <div className="space-y-4">
      <StoriesBar />

      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl liquid-glass-subtle">
          <button
            type="button"
            onClick={() => setFeedMode('recommended')}
            className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
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
            className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              feedMode === 'following'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t.feed.followingFeed}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setSubscreen('reels')}
          className="min-h-[42px] px-4 rounded-xl liquid-glass-subtle text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-2 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors whitespace-nowrap"
        >
          <Clapperboard className="w-4 h-4 text-sky-600" />
          <span>{t.explore.reels}</span>
        </button>
      </div>

      {visiblePosts.length === 0 ? (
        <div className="liquid-glass rounded-2xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {t.feed.noPosts}
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
