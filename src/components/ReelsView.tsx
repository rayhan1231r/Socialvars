import { useState } from 'react';
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Heart,
  MessageCircle,
  Pause,
  Play,
  Share2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { formatCompactCount } from '../utils/validation';
import { Avatar } from './Avatar';

export function ReelsView() {
  const {
    posts,
    followingIds,
    toggleFollow,
    toggleLikePost,
    toggleSavePost,
    sharePost,
    setSubscreen,
    openUserProfile,
    t,
  } = useSocialVerse();

  const reelPosts = posts.filter(
    (p) => p.mediaType === 'reel' || p.mediaType === 'video' || p.mediaUrls.length > 0
  );
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);

  const currentReel = reelPosts[index] || reelPosts[0];
  if (!currentReel) return null;

  const isFollowing = followingIds.includes(currentReel.authorId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Short Videos and Reels"
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-lg flex items-center justify-center p-3 sm:p-6"
    >
      <div className="relative w-full max-w-md h-[88vh] max-h-[820px] rounded-3xl overflow-hidden bg-slate-900 border border-white/15 shadow-2xl flex flex-col justify-between">
        {currentReel.mediaType === 'video' ? (
          <video
            src={currentReel.mediaUrls[0]}
            autoPlay={playing}
            loop
            muted={muted}
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <img
            src={currentReel.mediaUrls[0]}
            alt={currentReel.caption}
            referrerPolicy="no-referrer"
            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${
              playing ? 'scale-105' : 'scale-100'
            }`}
          />
        )}

        {/* Top Bar */}
        <div className="relative z-10 p-4 bg-gradient-to-b from-black/75 via-black/30 to-transparent flex items-center justify-between">
          <span className="text-sm font-display font-bold text-white">Reels</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={playing ? 'Pause reel' : 'Play reel'}
              onClick={() => setPlaying((p) => !p)}
              className="min-h-[44px] min-w-[44px] rounded-full bg-black/40 text-white flex items-center justify-center"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              type="button"
              aria-label={muted ? 'Unmute reel' : 'Mute reel'}
              onClick={() => setMuted((m) => !m)}
              className="min-h-[44px] min-w-[44px] rounded-full bg-black/40 text-white flex items-center justify-center"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              aria-label="Close reels"
              onClick={() => setSubscreen(null)}
              className="min-h-[44px] min-w-[44px] rounded-full bg-black/40 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bottom Overlay + Vertical Action Column */}
        <div className="relative z-10 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-center gap-2.5">
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
              <button
                type="button"
                onClick={() => toggleFollow(currentReel.authorId)}
                className="min-h-[32px] px-3 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold"
              >
                {isFollowing ? t.explore.following : t.explore.follow}
              </button>
            </div>
            <p className="text-xs sm:text-sm text-white/90 line-clamp-3 leading-relaxed">
              {currentReel.caption}
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 shrink-0">
            <button
              type="button"
              aria-label="Previous reel"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="min-h-[40px] min-w-[40px] rounded-full bg-white/15 text-white flex items-center justify-center disabled:opacity-30"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="Next reel"
              disabled={index >= reelPosts.length - 1}
              onClick={() => setIndex((i) => Math.min(reelPosts.length - 1, i + 1))}
              className="min-h-[40px] min-w-[40px] rounded-full bg-white/15 text-white flex items-center justify-center disabled:opacity-30"
            >
              <ChevronDown className="w-5 h-5" />
            </button>

            <button
              type="button"
              aria-label={`Like reel (${currentReel.likesCount})`}
              onClick={() => toggleLikePost(currentReel.id)}
              className="flex flex-col items-center text-white min-w-[44px]"
            >
              <span className="min-h-[42px] min-w-[42px] rounded-full bg-white/15 flex items-center justify-center">
                <Heart className={`w-5 h-5 ${currentReel.likedByMe ? 'fill-rose-500 text-rose-500' : ''}`} />
              </span>
              <span className="text-[11px] font-mono-num mt-0.5">
                {formatCompactCount(currentReel.likesCount)}
              </span>
            </button>

            <button
              type="button"
              aria-label={`Comments (${currentReel.commentsCount})`}
              onClick={() => setSubscreen(null)}
              className="flex flex-col items-center text-white min-w-[44px]"
            >
              <span className="min-h-[42px] min-w-[42px] rounded-full bg-white/15 flex items-center justify-center">
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
              className="min-h-[42px] min-w-[42px] rounded-full bg-white/15 text-white flex items-center justify-center"
            >
              <Bookmark className={`w-5 h-5 ${currentReel.savedByMe ? 'fill-sky-400 text-sky-400' : ''}`} />
            </button>

            <button
              type="button"
              aria-label="Share reel"
              onClick={() => sharePost(currentReel.id)}
              className="min-h-[42px] min-w-[42px] rounded-full bg-white/15 text-white flex items-center justify-center"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
