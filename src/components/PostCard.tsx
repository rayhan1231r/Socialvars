import { useState } from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Send,
  Share2,
  Trash2,
} from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import type { Post } from '../types/social';
import { formatCompactCount, formatRelativeTime } from '../utils/validation';
import { Avatar } from './Avatar';

export function PostCard({ post }: { post: Post }) {
  const {
    currentUser,
    isAuthenticated,
    t,
    language,
    commentsByPost,
    followingIds,
    toggleFollow,
    toggleLikePost,
    toggleSavePost,
    sharePost,
    addComment,
    editPost,
    deletePost,
    openUserProfile,
    openReportModal,
  } = useSocialVerse();

  const [mediaIdx, setMediaIdx] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption);
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});

  const isOwn = isAuthenticated && post.authorId === currentUser.uid;
  const isFollowing = followingIds.includes(post.authorId);
  const comments = commentsByPost[post.id] || [];

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment(post.id, commentText, replyingTo?.id);
    setCommentText('');
    setReplyingTo(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await editPost(post.id, editCaption);
    setIsEditing(false);
  };

  return (
    <article className="liquid-glass rounded-2xl p-4 sm:p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => openUserProfile(post.authorId)}
          className="flex items-center gap-3 min-w-0 text-left"
        >
          <Avatar src={post.authorAvatar} name={post.authorDisplayName} size="md" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {post.authorDisplayName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              @{post.authorUsername} · {formatRelativeTime(post.createdAt, language)}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0 relative">
          {!isOwn && (
            <button
              type="button"
              onClick={() => toggleFollow(post.authorId)}
              className={`min-h-[36px] px-3.5 rounded-xl text-xs font-semibold transition-colors ${
                isFollowing
                  ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  : 'bg-sky-600 text-white hover:bg-sky-700'
              }`}
            >
              {isFollowing ? t.explore.following : t.explore.follow}
            </button>
          )}
          <button
            type="button"
            aria-label={`More options for post by ${post.authorDisplayName}`}
            onClick={() => setShowMenu((m) => !m)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-11 z-20 w-44 liquid-glass rounded-2xl p-1.5 shadow-xl">
              {isOwn ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="w-full min-h-[40px] px-3 rounded-xl text-left text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 flex items-center gap-2"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{t.feed.editPost}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deletePost(post.id);
                      setShowMenu(false);
                    }}
                    className="w-full min-h-[40px] px-3 rounded-xl text-left text-xs font-medium text-rose-600 hover:bg-rose-500/10 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.feed.deletePost}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    openReportModal('post', post.id, `@${post.authorUsername}'s post`);
                    setShowMenu(false);
                  }}
                  className="w-full min-h-[40px] px-3 rounded-xl text-left text-xs font-medium text-rose-600 hover:bg-rose-500/10 flex items-center gap-2"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{t.feed.report}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="space-y-2">
          <textarea
            rows={3}
            value={editCaption}
            onChange={(e) => setEditCaption(e.target.value)}
            className="w-full p-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="min-h-[38px] px-3.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[38px] px-4 rounded-xl bg-sky-600 text-white text-xs font-semibold"
            >
              Save
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm sm:text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-line">
          {post.caption}
        </p>
      )}

      {post.mediaUrls.length > 0 && (
        <div className="relative rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 aspect-[4/3]">
          {post.mediaType === 'video' ? (
            <video
              src={post.mediaUrls[mediaIdx]}
              controls
              playsInline
              className="w-full h-full object-cover"
            />
          ) : !brokenImages[mediaIdx] ? (
            <img
              src={post.mediaUrls[mediaIdx]}
              alt={post.caption.slice(0, 60)}
              referrerPolicy="no-referrer"
              onError={() => setBrokenImages((b) => ({ ...b, [mediaIdx]: true }))}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sky-600/20 to-slate-800/30 text-sm text-slate-600 dark:text-slate-300 p-6 text-center">
              {post.authorDisplayName} · {post.mediaType}
            </div>
          )}

          {post.mediaUrls.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                disabled={mediaIdx === 0}
                onClick={() => setMediaIdx((i) => Math.max(0, i - 1))}
                className="absolute left-2 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] rounded-full bg-black/50 text-white flex items-center justify-center disabled:opacity-25"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                disabled={mediaIdx >= post.mediaUrls.length - 1}
                onClick={() => setMediaIdx((i) => Math.min(post.mediaUrls.length - 1, i + 1))}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] rounded-full bg-black/50 text-white flex items-center justify-center disabled:opacity-25"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/60 text-[11px] font-mono-num text-white">
                {mediaIdx + 1} / {post.mediaUrls.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`${t.feed.like} (${post.likesCount})`}
            onClick={() => toggleLikePost(post.id)}
            className={`min-h-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              post.likedByMe
                ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Heart className={`w-4 h-4 ${post.likedByMe ? 'fill-current' : ''}`} />
            <span className="font-mono-num">{formatCompactCount(post.likesCount)}</span>
          </button>

          <button
            type="button"
            aria-label={`${t.feed.comment} (${post.commentsCount})`}
            onClick={() => setShowComments((c) => !c)}
            className="min-h-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="font-mono-num">{formatCompactCount(post.commentsCount)}</span>
          </button>

          <button
            type="button"
            aria-label={`${t.feed.share} (${post.sharesCount})`}
            onClick={() => sharePost(post.id)}
            className="min-h-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          >
            <Share2 className="w-4 h-4" />
            <span className="font-mono-num">{formatCompactCount(post.sharesCount)}</span>
          </button>
        </div>

        <button
          type="button"
          aria-label={post.savedByMe ? t.feed.saved : t.feed.save}
          onClick={() => toggleSavePost(post.id)}
          className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-colors ${
            post.savedByMe
              ? 'text-sky-600 dark:text-sky-400 bg-sky-500/10'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${post.savedByMe ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Comments Drawer */}
      {showComments && (
        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/70 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className={`flex items-start gap-2.5 ${c.parentCommentId ? 'pl-8' : ''}`}>
              <Avatar src={c.authorAvatar} name={c.authorUsername} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-800 dark:text-slate-200">
                  <span className="font-semibold">@{c.authorUsername}</span>{' '}
                  <span className="text-slate-700 dark:text-slate-300">{c.text}</span>
                </p>
                <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500">
                  <span>{formatRelativeTime(c.createdAt, language)}</span>
                  <button
                    type="button"
                    onClick={() => setReplyingTo({ id: c.id, username: c.authorUsername })}
                    className="font-medium hover:text-sky-600"
                  >
                    Reply
                  </button>
                </div>
              </div>
            </div>
          ))}

          {replyingTo && (
            <div className="flex items-center justify-between text-xs text-sky-600 dark:text-sky-400">
              <span>Replying to @{replyingTo.username}</span>
              <button type="button" onClick={() => setReplyingTo(null)} className="underline">
                Cancel
              </button>
            </div>
          )}

          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t.feed.writeComment}
              aria-label={t.feed.writeComment}
              className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="submit"
              aria-label={t.feed.postButton}
              className="min-h-[42px] px-4 rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t.feed.postButton}</span>
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
