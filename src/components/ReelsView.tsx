import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bookmark,
  Clapperboard,
  Download,
  Heart,
  MessageCircle,
  Pause,
  Play,
  PlusSquare,
  RefreshCw,
  Send,
  Share2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import {
  canViewPrivateProfileContent,
  formatCompactCount,
  isReelPost,
  isVideoMediaUrl,
} from '../utils/validation';
import { Avatar } from './Avatar';
import { CommentsDrawer } from './CommentsDrawer';
import { ReelsSkeleton } from './LiquidGlassSkeletons';
import { RichMentionText } from './RichMentionText';

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
}

export function ReelsView({ embedded = false }: { embedded?: boolean }) {
  const {
    posts,
    creators,
    isReelsLoading,
    refreshReels,
    currentUser,
    isAuthenticated,
    followingIds,
    activeReelId,
    setActiveReelId,
    toggleFollow,
    toggleLikePost,
    likePostIfNeeded,
    toggleSavePost,
    shareReelToInbox,
    setSubscreen,
    openUserProfile,
    showToast,
    language,
    t,
  } = useSocialVerse();

  const viewerUid = isAuthenticated ? currentUser.uid : null;
  const reelPosts = posts.filter((p) => {
    if (!isReelPost(p)) return false;
    const author = creators.find((c) => c.uid === p.authorId);
    if (!author) return true;
    return canViewPrivateProfileContent(author, viewerUid, followingIds);
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [commentsReelId, setCommentsReelId] = useState<string | null>(null);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const lastTapRef = useRef<number>(0);
  const lastHeartBurstRef = useRef<number>(0);

  const safeIndex = reelPosts.length > 0 ? Math.min(activeIndex, reelPosts.length - 1) : 0;
  const currentReel = reelPosts[safeIndex];
  const commentsPost =
    (commentsReelId ? reelPosts.find((r) => r.id === commentsReelId) : null) || null;

  const suggestedRecipients = creators.filter(
    (u) => u.uid !== currentUser.uid && !u.isDeactivated
  );

  // Scroll to activeReelId when opened from HomeFeed / Profile / Explore
  useEffect(() => {
    if (!activeReelId || reelPosts.length === 0) return;
    const idx = reelPosts.findIndex((r) => r.id === activeReelId);
    if (idx < 0) return;
    setActiveIndex(idx);
    setPlaying(true);
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el && el.clientHeight > 0) {
        el.scrollTo({ top: idx * el.clientHeight, behavior: 'auto' });
      }
    });
  }, [activeReelId, reelPosts.length]);

  // Sync HTML5 video play/pause cleanly across slides
  useEffect(() => {
    reelPosts.forEach((reel, idx) => {
      const vid = videoRefs.current[reel.id];
      if (!vid) return;
      if (idx === safeIndex && playing) {
        vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    });
  }, [playing, safeIndex, reelPosts]);

  const scrollToIndex = useCallback(
    (nextIdx: number) => {
      const el = scrollRef.current;
      if (!el || reelPosts.length === 0) return;
      const clamped = Math.max(0, Math.min(reelPosts.length - 1, nextIdx));
      setActiveIndex(clamped);
      setPlaying(true);
      el.scrollTo({ top: clamped * el.clientHeight, behavior: 'smooth' });
    },
    [reelPosts.length]
  );

  // Keyboard ArrowUp / ArrowDown + Escape close when fullscreen
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (commentsReelId || showShareSheet) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollToIndex(safeIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollToIndex(safeIndex - 1);
      } else if (e.key === 'Escape' && !embedded) {
        e.preventDefault();
        setActiveReelId(null);
        setSubscreen(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    commentsReelId,
    showShareSheet,
    safeIndex,
    scrollToIndex,
    embedded,
    setActiveReelId,
    setSubscreen,
  ]);

  const handleContainerScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientHeight <= 0) return;
    const nextIdx = Math.round(el.scrollTop / el.clientHeight);
    if (nextIdx !== activeIndex && nextIdx >= 0 && nextIdx < reelPosts.length) {
      setActiveIndex(nextIdx);
      setPlaying(true);
      setShowShareSheet(false);
    }
  };

  const spawnHeartAt = useCallback((clientX?: number, clientY?: number) => {
    const rect = scrollRef.current?.getBoundingClientRect();
    const x = rect && clientX !== undefined ? clientX - rect.left : (rect?.width || 320) / 2;
    const y = rect && clientY !== undefined ? clientY - rect.top : (rect?.height || 520) / 2;
    const id = Date.now() + Math.random();
    setHearts((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id));
    }, 750);
  }, []);

  const handleDoubleLike = useCallback(
    (reelId: string, clientX?: number, clientY?: number) => {
      const now = Date.now();
      if (now - lastHeartBurstRef.current > 320) {
        lastHeartBurstRef.current = now;
        spawnHeartAt(clientX, clientY);
      }
      void likePostIfNeeded(reelId);
    },
    [likePostIfNeeded, spawnHeartAt]
  );

  const handleMediaTap = (reelId: string, e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0;
      handleDoubleLike(reelId, e.clientX, e.clientY);
      return;
    }
    lastTapRef.current = now;
  };

  const handleDownloadReel = () => {
    if (!currentReel) return;
    const url = currentReel.mediaUrls[0] || currentReel.coverUrl;
    if (!url) {
      showToast('No downloadable media attached to this reel.');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `socialverse_reel_${currentReel.id}.${isVideoMediaUrl(url) ? 'mp4' : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(language === 'bn' ? 'রিল ডাউনলোড হচ্ছে...' : 'Downloading reel...');
  };

  const closeFullscreen = () => {
    setActiveReelId(null);
    setSubscreen(null);
  };

  if (isReelsLoading) {
    return <ReelsSkeleton embedded={embedded} label={t.feed.loadingFeed} />;
  }

  const emptyContent = (
    <div className="liquid-glass rounded-3xl p-8 sm:p-10 text-center space-y-4">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-600/10 text-sky-600 flex items-center justify-center">
        <Clapperboard className="w-7 h-7" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.explore.reels}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t.feed.noPosts}</p>
      </div>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            void refreshReels();
          }}
          className="min-h-[42px] px-4 rounded-xl liquid-glass-btn text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{t.feed.refreshFeed}</span>
        </button>
        <button
          type="button"
          onClick={() => setSubscreen('create_sheet')}
          className="min-h-[42px] px-5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold inline-flex items-center gap-2"
        >
          <PlusSquare className="w-4 h-4" />
          <span>{t.create.newReel}</span>
        </button>
      </div>
    </div>
  );

  if (!currentReel) {
    if (embedded) return emptyContent;
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reels"
        className="fixed inset-0 z-[70] bg-black flex items-center justify-center p-4"
      >
        <div className="max-w-md w-full relative">
          <button
            type="button"
            aria-label="Close reels"
            onClick={closeFullscreen}
            className="absolute right-3 top-3 z-10 min-h-[40px] min-w-[40px] rounded-full bg-slate-900/70 text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
          {emptyContent}
        </div>
      </div>
    );
  }

  const playerFrame = (
    <div
      className={
        embedded
          ? 'relative w-full max-w-[440px] mx-auto h-[78vh] sm:h-[82vh] max-h-[820px] rounded-3xl overflow-hidden bg-black border border-white/15 shadow-2xl'
          : 'relative w-full h-full sm:max-w-[440px] sm:h-[92vh] sm:rounded-3xl overflow-hidden bg-black border-0 sm:border sm:border-white/15 shadow-2xl'
      }
    >
      {/* Top Floating Bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-4 bg-gradient-to-b from-black/80 via-black/35 to-transparent flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="text-sm font-display font-bold text-white">{t.explore.reels}</span>
          <span className="text-xs font-mono-num text-white/80">
            {safeIndex + 1} / {reelPosts.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            aria-label={t.feed.refreshFeed}
            onClick={() => {
              void refreshReels();
            }}
            className="min-h-[38px] min-w-[38px] rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Upload reel"
            onClick={() => setSubscreen('create_sheet')}
            className="min-h-[38px] px-3 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold inline-flex items-center gap-1"
          >
            <PlusSquare className="w-3.5 h-3.5" />
            <span>+</span>
          </button>
          <button
            type="button"
            aria-label={playing ? 'Pause reel' : 'Play reel'}
            onClick={() => setPlaying((p) => !p)}
            className="min-h-[38px] min-w-[38px] rounded-full bg-black/45 text-white flex items-center justify-center"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            type="button"
            aria-label={muted ? 'Unmute reel' : 'Mute reel'}
            onClick={() => setMuted((m) => !m)}
            className="min-h-[38px] min-w-[38px] rounded-full bg-black/45 text-white flex items-center justify-center"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {!embedded && (
            <button
              type="button"
              aria-label="Close reels"
              onClick={closeFullscreen}
              className="min-h-[38px] min-w-[38px] rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Scroll-Snap Vertical Feed (no Up/Down chevrons) */}
      <div
        ref={scrollRef}
        onScroll={handleContainerScroll}
        data-testid="reels-scroll-container"
        className="w-full h-full overflow-y-auto snap-y snap-mandatory no-scrollbar"
      >
        {reelPosts.map((reel, idx) => {
          const isFollowing = followingIds.includes(reel.authorId);
          const mediaSrc = reel.mediaUrls[0] || reel.coverUrl;
          const isVideo =
            reel.mediaType === 'video' || isVideoMediaUrl(mediaSrc);
          const isActiveSlide = idx === safeIndex;

          return (
            <div
              key={reel.id}
              data-reel-id={reel.id}
              className="relative w-full h-full shrink-0 snap-start snap-always flex flex-col justify-end bg-black overflow-hidden select-none"
            >
              {/* Interactive Media Canvas */}
              <div
                data-testid="reel-canvas"
                onClick={(e) => handleMediaTap(reel.id, e)}
                onDoubleClick={(e) => handleDoubleLike(reel.id, e.clientX, e.clientY)}
                aria-label="Reel media canvas"
                className="absolute inset-0 cursor-pointer"
              >
                {isVideo && reel.mediaUrls[0] ? (
                  <video
                    ref={(el) => {
                      videoRefs.current[reel.id] = el;
                    }}
                    src={reel.mediaUrls[0]}
                    poster={reel.coverUrl}
                    autoPlay={isActiveSlide && playing}
                    loop
                    muted={muted}
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : mediaSrc ? (
                  <img
                    src={mediaSrc}
                    alt={reel.caption}
                    referrerPolicy="no-referrer"
                    draggable={false}
                    className={`w-full h-full object-cover transition-transform duration-700 ${
                      isActiveSlide && playing ? 'scale-105' : 'scale-100'
                    }`}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-900 via-sky-950 to-cyan-950 flex flex-col items-center justify-center p-8 text-center">
                    <Clapperboard className="w-12 h-12 text-sky-400/80 mb-3" />
                    <p className="text-sm font-medium text-white/90 max-w-xs line-clamp-5">
                      {reel.caption}
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Overlay + Enlarged Right-Column Action Controls */}
              <div className="pointer-events-none relative z-10 p-4 pb-5 bg-gradient-to-t from-black/90 via-black/45 to-transparent flex items-end justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2.5 pointer-events-auto">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (!embedded) closeFullscreen();
                        openUserProfile(reel.authorId);
                      }}
                      className="flex items-center gap-2 text-left min-w-0"
                    >
                      <Avatar src={reel.authorAvatar} name={reel.authorDisplayName} size="sm" />
                      <span className="text-sm font-semibold text-white truncate">
                        @{reel.authorUsername}
                      </span>
                    </button>
                    {reel.authorId !== currentUser.uid && (
                      <button
                        type="button"
                        onClick={() => toggleFollow(reel.authorId)}
                        className="min-h-[32px] px-3 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold"
                      >
                        {isFollowing ? t.explore.following : t.explore.follow}
                      </button>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-white/95 line-clamp-3 leading-relaxed">
                    <RichMentionText
                      text={reel.caption}
                      mentionClassName="text-sky-300 font-semibold hover:underline cursor-pointer"
                      onMentionClick={() => {
                        if (!embedded) closeFullscreen();
                      }}
                    />
                  </p>
                </div>

                {/* Enlarged Action Stack (No Up/Down chevrons) */}
                <div className="pointer-events-auto flex flex-col items-center gap-3 shrink-0">
                  <button
                    type="button"
                    aria-label={`Like reel (${reel.likesCount})`}
                    onClick={() => toggleLikePost(reel.id)}
                    className="flex flex-col items-center text-white min-w-[48px]"
                  >
                    <span
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform active:scale-90 ${
                        reel.likedByMe ? 'bg-rose-500/30' : 'bg-white/18 hover:bg-white/25'
                      }`}
                    >
                      <Heart
                        className={`w-6 h-6 transition-colors ${
                          reel.likedByMe ? 'fill-rose-500 text-rose-500' : ''
                        }`}
                      />
                    </span>
                    <span className="text-xs font-mono-num font-bold mt-1">
                      {formatCompactCount(reel.likesCount)}
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-label={`Comments (${reel.commentsCount})`}
                    onClick={() => setCommentsReelId(reel.id)}
                    className="flex flex-col items-center text-white min-w-[48px]"
                  >
                    <span className="w-12 h-12 rounded-full bg-white/18 hover:bg-white/25 flex items-center justify-center">
                      <MessageCircle className="w-6 h-6" />
                    </span>
                    <span className="text-xs font-mono-num font-bold mt-1">
                      {formatCompactCount(reel.commentsCount)}
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-label="Save reel"
                    onClick={() => toggleSavePost(reel.id)}
                    className="w-12 h-12 rounded-full bg-white/18 hover:bg-white/25 text-white flex items-center justify-center"
                  >
                    <Bookmark className={`w-6 h-6 ${reel.savedByMe ? 'fill-sky-400 text-sky-400' : ''}`} />
                  </button>

                  <button
                    type="button"
                    aria-label="Share reel to inbox"
                    onClick={() => setShowShareSheet(true)}
                    className="w-12 h-12 rounded-full bg-white/18 hover:bg-white/25 text-white flex items-center justify-center"
                  >
                    <Share2 className="w-6 h-6" />
                  </button>

                  <button
                    type="button"
                    aria-label="Download reel"
                    onClick={handleDownloadReel}
                    className="w-12 h-12 rounded-full bg-white/18 hover:bg-white/25 text-white flex items-center justify-center"
                  >
                    <Download className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Double-Tap Floating Hearts Burst */}
      {hearts.map((h) => (
        <div
          key={h.id}
          style={{ left: h.x, top: h.y }}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-30 animate-bounce"
        >
          <Heart className="w-20 h-20 fill-rose-500 text-rose-500 drop-shadow-[0_6px_24px_rgba(244,63,94,0.8)]" />
        </div>
      ))}

      {/* Share Reel to Inbox Sheet */}
      {showShareSheet && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute inset-x-0 bottom-0 z-30 bg-slate-900/95 backdrop-blur-lg border-t border-white/15 rounded-t-3xl p-4 space-y-3 max-h-[60%] overflow-y-auto"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">{t.messages.sendToInbox}</h3>
            <button
              type="button"
              onClick={() => setShowShareSheet(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {suggestedRecipients.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              No other accounts available to send to yet.
            </p>
          ) : (
            <div className="space-y-2">
              {suggestedRecipients.map((u) => (
                <div key={u.uid} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={u.photoUrl} name={u.displayName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{u.displayName}</p>
                      <p className="text-[11px] text-slate-400 truncate">@{u.username}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await shareReelToInbox(currentReel, u.uid);
                      setShowShareSheet(false);
                    }}
                    className="min-h-[34px] px-3 rounded-lg bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>{t.messages.send}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className="py-1">
        {playerFrame}
        {commentsPost && (
          <CommentsDrawer post={commentsPost} onClose={() => setCommentsReelId(null)} />
        )}
      </div>
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Short Videos and Reels"
      className="fixed inset-0 z-[70] bg-black flex items-center justify-center p-0 sm:p-4"
    >
      {playerFrame}
      {commentsPost && (
        <CommentsDrawer post={commentsPost} onClose={() => setCommentsReelId(null)} />
      )}
    </div>,
    document.body
  );
}
