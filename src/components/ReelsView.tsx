import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
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
import { canViewPrivateProfileContent, formatCompactCount } from '../utils/validation';
import { Avatar } from './Avatar';
import { CommentsDrawer } from './CommentsDrawer';
import { ReelsSkeleton } from './LiquidGlassSkeletons';

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
    if (p.mediaType !== 'reel' && p.mediaType !== 'video' && p.mediaUrls.length === 0) {
      return false;
    }
    const author = creators.find((c) => c.uid === p.authorId);
    if (!author) return true;
    return canViewPrivateProfileContent(author, viewerUid, followingIds);
  });

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const swipeStartXRef = useRef<number | null>(null);
  const wheelLockRef = useRef<number>(0);
  const lastTapRef = useRef<number>(0);
  const lastHeartBurstRef = useRef<number>(0);
  const didDragRef = useRef<boolean>(false);

  const safeIndex = reelPosts.length > 0 ? Math.min(index, reelPosts.length - 1) : 0;
  const currentReel = reelPosts[safeIndex];

  const suggestedRecipients = creators.filter(
    (u) => u.uid !== currentUser.uid && !u.isDeactivated
  );

  const goToIndex = useCallback(
    (nextIdx: number) => {
      if (reelPosts.length === 0) return;
      const clamped = Math.max(0, Math.min(reelPosts.length - 1, nextIdx));
      if (clamped !== safeIndex) {
        setIndex(clamped);
        setPlaying(true);
        setShowShareSheet(false);
      }
    },
    [reelPosts.length, safeIndex]
  );

  const goNext = useCallback(() => goToIndex(safeIndex + 1), [goToIndex, safeIndex]);
  const goPrev = useCallback(() => goToIndex(safeIndex - 1), [goToIndex, safeIndex]);

  // Sync HTML5 video play/pause with playing state
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (playing) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [playing, safeIndex]);

  // Keyboard ArrowUp / ArrowDown navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showCommentsModal || showShareSheet) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, showCommentsModal, showShareSheet]);

  const spawnHeartAt = useCallback((clientX?: number, clientY?: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const x = rect && clientX !== undefined ? clientX - rect.left : (rect?.width || 320) / 2;
    const y = rect && clientY !== undefined ? clientY - rect.top : (rect?.height || 520) / 2;
    const id = Date.now() + Math.random();
    setHearts((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id));
    }, 750);
  }, []);

  const handleDoubleLike = useCallback(
    (clientX?: number, clientY?: number) => {
      if (!currentReel) return;
      const now = Date.now();
      if (now - lastHeartBurstRef.current > 320) {
        lastHeartBurstRef.current = now;
        spawnHeartAt(clientX, clientY);
      }
      void likePostIfNeeded(currentReel.id);
    },
    [currentReel, likePostIfNeeded, spawnHeartAt]
  );

  // Touch swipe handlers (up = next reel, down = previous reel)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (showCommentsModal || showShareSheet) return;
    swipeStartYRef.current = e.touches[0].clientY;
    swipeStartXRef.current = e.touches[0].clientX;
    didDragRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (swipeStartYRef.current === null || showCommentsModal || showShareSheet) return;
    const dy = e.touches[0].clientY - swipeStartYRef.current;
    const dx =
      swipeStartXRef.current !== null ? e.touches[0].clientX - swipeStartXRef.current : 0;
    if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
      didDragRef.current = true;
      setDragOffsetY(Math.max(-90, Math.min(90, dy * 0.4)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartYRef.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? swipeStartYRef.current;
    const dy = endY - swipeStartYRef.current;
    swipeStartYRef.current = null;
    swipeStartXRef.current = null;
    setDragOffsetY(0);

    if (dy <= -42) {
      goNext();
    } else if (dy >= 42) {
      goPrev();
    }
  };

  // Pointer drag handlers for desktop mouse swipe
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return; // handled by touch events
    if (showCommentsModal || showShareSheet) return;
    swipeStartYRef.current = e.clientY;
    didDragRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || swipeStartYRef.current === null) return;
    const dy = e.clientY - swipeStartYRef.current;
    if (Math.abs(dy) > 12) {
      didDragRef.current = true;
      setDragOffsetY(Math.max(-90, Math.min(90, dy * 0.35)));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || swipeStartYRef.current === null) return;
    const dy = e.clientY - swipeStartYRef.current;
    swipeStartYRef.current = null;
    setDragOffsetY(0);
    if (dy <= -44) {
      goNext();
    } else if (dy >= 44) {
      goPrev();
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (showCommentsModal || showShareSheet) return;
    const now = Date.now();
    if (now - wheelLockRef.current < 420) return;
    if (Math.abs(e.deltaY) < 24) return;
    wheelLockRef.current = now;
    if (e.deltaY > 0) goNext();
    else goPrev();
  };

  const handleMediaTap = (e: React.MouseEvent) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0;
      handleDoubleLike(e.clientX, e.clientY);
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
    a.download = `socialverse_reel_${currentReel.id}.${url.startsWith('data:video/') ? 'mp4' : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(language === 'bn' ? 'রিল ডাউনলোড হচ্ছে...' : 'Downloading reel...');
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
        className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4"
      >
        <div className="max-w-md w-full relative">
          <button
            type="button"
            aria-label="Close reels"
            onClick={() => setSubscreen(null)}
            className="absolute right-3 top-3 z-10 min-h-[40px] min-w-[40px] rounded-full bg-slate-900/70 text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
          {emptyContent}
        </div>
      </div>
    );
  }

  const isFollowing = followingIds.includes(currentReel.authorId);
  const mediaSrc = currentReel.mediaUrls[0] || currentReel.coverUrl;
  const isVideo =
    currentReel.mediaType === 'video' || Boolean(mediaSrc?.startsWith('data:video/'));

  const playerCard = (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        transform: dragOffsetY ? `translateY(${dragOffsetY}px)` : undefined,
      }}
      className="relative w-full max-w-md mx-auto h-[76vh] sm:h-[82vh] max-h-[800px] rounded-3xl overflow-hidden bg-slate-900 border border-white/15 shadow-2xl flex flex-col justify-between select-none touch-pan-x transition-transform duration-150"
    >
      {/* Interactive Media Surface: Double-click / Double-tap to Like */}
      <div
        data-testid="reel-canvas"
        onClick={handleMediaTap}
        onDoubleClick={(e) => handleDoubleLike(e.clientX, e.clientY)}
        aria-label="Reel media canvas"
        className="absolute inset-0 cursor-pointer"
      >
        {isVideo && currentReel.mediaUrls[0] ? (
          <video
            ref={videoRef}
            src={currentReel.mediaUrls[0]}
            poster={currentReel.coverUrl}
            autoPlay={playing}
            loop
            muted={muted}
            playsInline
            className="w-full h-full object-cover"
          />
        ) : mediaSrc ? (
          <img
            src={mediaSrc}
            alt={currentReel.caption}
            referrerPolicy="no-referrer"
            draggable={false}
            className={`w-full h-full object-cover transition-transform duration-700 ${
              playing ? 'scale-105' : 'scale-100'
            }`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-sky-950 to-cyan-950 flex flex-col items-center justify-center p-8 text-center">
            <Clapperboard className="w-12 h-12 text-sky-400/80 mb-3" />
            <p className="text-sm font-medium text-white/90 max-w-xs line-clamp-5">
              {currentReel.caption}
            </p>
          </div>
        )}
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

      {/* Top Bar */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className="pointer-events-none relative z-10 p-4 bg-gradient-to-b from-black/75 via-black/30 to-transparent flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="text-sm font-display font-bold text-white">{t.explore.reels}</span>
          <span className="text-[11px] font-mono-num text-white/80">
            {safeIndex + 1} / {reelPosts.length}
          </span>
        </div>
        <div className="flex items-center gap-1 pointer-events-auto">
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
              onClick={() => setSubscreen(null)}
              className="min-h-[38px] min-w-[38px] rounded-full bg-black/45 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Overlay + Vertical Action Column */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className="pointer-events-none relative z-10 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-end justify-between gap-4"
      >
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-center gap-2.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => openUserProfile(currentReel.authorId)}
              className="flex items-center gap-2 text-left min-w-0"
            >
              <Avatar src={currentReel.authorAvatar} name={currentReel.authorDisplayName} size="sm" />
              <span className="text-sm font-semibold text-white truncate">
                @{currentReel.authorUsername}
              </span>
            </button>
            {currentReel.authorId !== currentUser.uid && (
              <button
                type="button"
                onClick={() => toggleFollow(currentReel.authorId)}
                className="min-h-[32px] px-3 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold"
              >
                {isFollowing ? t.explore.following : t.explore.follow}
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-white/90 line-clamp-3 leading-relaxed">
            {currentReel.caption}
          </p>
          <p className="text-[10px] text-white/60">
            {language === 'bn'
              ? 'ডাবল-ট্যাপে লাইক · উপরে/নিচে সোয়াইপ করে রিল বদলান'
              : 'Double-tap to like · Swipe up/down to switch'}
          </p>
        </div>

        <div className="pointer-events-auto flex flex-col items-center gap-2 shrink-0">
          <button
            type="button"
            aria-label="Previous reel"
            disabled={safeIndex === 0}
            onClick={goPrev}
            className="min-h-[38px] min-w-[38px] rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center disabled:opacity-30"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Next reel"
            disabled={safeIndex >= reelPosts.length - 1}
            onClick={goNext}
            className="min-h-[38px] min-w-[38px] rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center disabled:opacity-30"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          <button
            type="button"
            aria-label={`Like reel (${currentReel.likesCount})`}
            onClick={() => toggleLikePost(currentReel.id)}
            className="flex flex-col items-center text-white min-w-[44px]"
          >
            <span
              className={`min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-transform active:scale-90 ${
                currentReel.likedByMe ? 'bg-rose-500/25' : 'bg-white/15'
              }`}
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  currentReel.likedByMe ? 'fill-rose-500 text-rose-500' : ''
                }`}
              />
            </span>
            <span className="text-[11px] font-mono-num mt-0.5">
              {formatCompactCount(currentReel.likesCount)}
            </span>
          </button>

          <button
            type="button"
            aria-label={`Comments (${currentReel.commentsCount})`}
            onClick={() => setShowCommentsModal(true)}
            className="flex flex-col items-center text-white min-w-[44px]"
          >
            <span className="min-h-[40px] min-w-[40px] rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </span>
            <span className="text-[11px] font-mono-num mt-0.5">
              {formatCompactCount(currentReel.commentsCount)}
            </span>
          </button>

          <button
            type="button"
            aria-label="Save reel"
            onClick={() => toggleSavePost(currentReel.id)}
            className="min-h-[40px] min-w-[40px] rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
          >
            <Bookmark className={`w-5 h-5 ${currentReel.savedByMe ? 'fill-sky-400 text-sky-400' : ''}`} />
          </button>

          <button
            type="button"
            aria-label="Share reel to inbox"
            onClick={() => setShowShareSheet(true)}
            className="min-h-[40px] min-w-[40px] rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
          >
            <Share2 className="w-5 h-5" />
          </button>

          <button
            type="button"
            aria-label="Download reel"
            onClick={handleDownloadReel}
            className="min-h-[40px] min-w-[40px] rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Share Reel to Inbox Sheet */}
      {showShareSheet && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute inset-x-0 bottom-0 z-30 bg-slate-900/95 backdrop-blur-lg border-t border-white/15 rounded-t-3xl p-4 space-y-3 max-h-[60%] overflow-y-auto"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Send Reel to Inbox</h3>
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
                    <span>Send</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCommentsModal && (
        <CommentsDrawer post={currentReel} onClose={() => setShowCommentsModal(false)} />
      )}
    </div>
  );

  if (embedded) {
    return <div className="py-1">{playerCard}</div>;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Short Videos and Reels"
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-lg flex items-center justify-center p-3 sm:p-6"
    >
      {playerCard}
    </div>
  );
}
