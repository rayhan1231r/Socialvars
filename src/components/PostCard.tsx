import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Send,
  Share2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import type { Post } from '../types/social';
import {
  NICKNAME_FONT_CLASSES,
  formatCompactCount,
  formatRelativeTime,
  getMaskedUserDisplay,
  isVideoMediaUrl,
} from '../utils/validation';
import { Avatar } from './Avatar';
import { CommentsDrawer } from './CommentsDrawer';
import { MentionInput } from './MentionInput';
import { RichMentionText } from './RichMentionText';

export function PostCard({ post }: { post: Post }) {
  const {
    currentUser,
    creators,
    chats,
    isAuthenticated,
    t,
    language,
    followingIds,
    toggleFollow,
    toggleLikePost,
    toggleSavePost,
    sharePost,
    sharePostToInbox,
    editPost,
    deletePost,
    openUserProfile,
    openReportModal,
  } = useSocialVerse();

  const [mediaIdx, setMediaIdx] = useState(0);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareQuery, setShareQuery] = useState('');
  const [sharingTarget, setSharingTarget] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption);
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});

  const authorUser = creators.find((u) => u.uid === post.authorId);
  const masked = getMaskedUserDisplay(
    {
      displayName: authorUser?.displayName || post.authorDisplayName,
      username: authorUser?.username || post.authorUsername,
      isDeactivated: authorUser?.isDeactivated,
    },
    currentUser.uid || null,
    post.authorId
  );
  const authorFontClass =
    NICKNAME_FONT_CLASSES[authorUser?.nicknameFont || 'classic'] || NICKNAME_FONT_CLASSES.classic;

  const isOwn = isAuthenticated && post.authorId === currentUser.uid;
  const isFollowing = followingIds.includes(post.authorId);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await editPost(post.id, editCaption);
    setIsEditing(false);
  };

  const currentMedia = post.mediaUrls?.[mediaIdx] || post.coverUrl;
  const isVideoMedia =
    post.mediaType === 'video' ||
    post.mediaType === 'reel' ||
    isVideoMediaUrl(currentMedia);

  const normalizedQuery = shareQuery.trim().toLowerCase();
  const activeGroupChats = chats.filter(
    (c) =>
      c.type === 'group' &&
      (!normalizedQuery || c.title.toLowerCase().includes(normalizedQuery))
  );
  const shareableCreators = creators.filter(
    (c) =>
      !c.isDeactivated &&
      c.uid !== currentUser.uid &&
      (!normalizedQuery ||
        c.displayName.toLowerCase().includes(normalizedQuery) ||
        c.username.toLowerCase().includes(normalizedQuery))
  );

  return (
    <article className="liquid-glass rounded-none border-x-0 border-y border-slate-200/80 dark:border-white/10 py-3.5 sm:py-4 space-y-3">
      {/* Top Header: Author + Date */}
      <div className="px-3.5 sm:px-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => openUserProfile(post.authorId)}
          className="flex items-center gap-3 min-w-0 text-left"
        >
          <Avatar src={masked.isDeactivatedView ? '' : post.authorAvatar} name={masked.displayName} size="md" />
          <div className="min-w-0">
            <p className={`text-sm text-slate-900 dark:text-white truncate ${authorFontClass}`}>
              {masked.displayName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              @{masked.username} · {formatRelativeTime(post.createdAt, language)}
              {post.visibility !== 'public' ? ` · ${post.visibility === 'only_me' ? 'Only me' : 'Friends'}` : ''}
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
            aria-label={`More options for post by ${masked.displayName}`}
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
                    openReportModal('post', post.id, `@${masked.username}'s post`);
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

      {/* Caption above media for text-only posts or when editing */}
      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="px-3.5 sm:px-4 space-y-2">
          <MentionInput
            multiline
            rows={3}
            value={editCaption}
            onChange={setEditCaption}
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
        !currentMedia &&
        post.caption && (
          <p className="px-3.5 sm:px-4 text-sm sm:text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-line">
            <RichMentionText text={post.caption} />
          </p>
        )
      )}

      {/* Full-Width Edge-to-Edge Media (No Side Borders / No Side Cropping) */}
      {currentMedia && (
        <div className="relative w-full overflow-hidden bg-slate-950/90 dark:bg-black border-y border-slate-200/40 dark:border-white/5">
          {post.mediaType === 'reel' && (
            <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/55 text-white text-[11px] font-semibold">
              <Clapperboard className="w-3.5 h-3.5" />
              <span>Reel</span>
            </span>
          )}
          {isVideoMedia && (isVideoMediaUrl(post.mediaUrls[mediaIdx]) || post.mediaType === 'video' || post.mediaType === 'reel') ? (
            <video
              src={post.mediaUrls[mediaIdx]}
              poster={post.coverUrl}
              controls
              playsInline
              className="w-full max-h-[560px] object-contain mx-auto block"
            />
          ) : !brokenImages[mediaIdx] ? (
            <img
              src={currentMedia}
              alt={post.caption.slice(0, 60) || masked.displayName}
              referrerPolicy="no-referrer"
              onError={() => setBrokenImages((b) => ({ ...b, [mediaIdx]: true }))}
              className="w-full max-h-[560px] object-contain mx-auto block"
            />
          ) : (
            <div className="w-full min-h-[220px] flex items-center justify-center bg-gradient-to-br from-sky-600/20 to-slate-800/30 text-sm text-slate-600 dark:text-slate-300 p-6 text-center">
              {masked.displayName} · {post.mediaType}
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
      <div className="px-3.5 sm:px-4 flex items-center justify-between pt-0.5">
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
            <Heart className={`w-4.5 h-4.5 ${post.likedByMe ? 'fill-current' : ''}`} />
            <span className="font-mono-num">{formatCompactCount(post.likesCount)}</span>
          </button>

          <button
            type="button"
            aria-label={`${t.feed.comment} (${post.commentsCount})`}
            onClick={() => setShowCommentsModal(true)}
            className="min-h-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          >
            <MessageCircle className="w-4.5 h-4.5" />
            <span className="font-mono-num">{formatCompactCount(post.commentsCount)}</span>
          </button>

          <button
            type="button"
            aria-label={`${t.feed.share} (${post.sharesCount})`}
            onClick={() => setShowShareModal(true)}
            className="min-h-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          >
            <Share2 className="w-4.5 h-4.5" />
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
          <Bookmark className={`w-4.5 h-4.5 ${post.savedByMe ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Bottom Caption + Quick Comment Trigger for media posts */}
      {!isEditing && currentMedia && post.caption && (
        <div className="px-3.5 sm:px-4 space-y-1">
          <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-line">
            <button
              type="button"
              onClick={() => openUserProfile(post.authorId)}
              className="font-semibold text-slate-900 dark:text-white mr-1.5 hover:underline"
            >
              @{masked.username}
            </button>
            <RichMentionText text={post.caption} />
          </p>
        </div>
      )}

      {showCommentsModal && (
        <CommentsDrawer post={post} onClose={() => setShowCommentsModal(false)} />
      )}

      {/* Share Sheet Modal: Copy Link & Send to Inbox */}
      {showShareModal &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.messages.sendToInbox}
            className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowShareModal(false);
            }}
          >
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-white/15 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-5 space-y-4 max-h-[82vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t.messages.sendToInbox}
              </h3>
              <button
                type="button"
                aria-label="Close share sheet"
                onClick={() => setShowShareModal(false)}
                className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200/50 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={async () => {
                await sharePost(post.id);
                setShowShareModal(false);
              }}
              className="w-full min-h-[44px] px-4 rounded-2xl liquid-glass-btn text-xs font-semibold text-slate-900 dark:text-white flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4 text-sky-600" />
              <span>{language === 'bn' ? 'লিঙ্ক কপি করুন' : 'Copy link'}</span>
            </button>

            <input
              type="search"
              value={shareQuery}
              onChange={(e) => setShareQuery(e.target.value)}
              placeholder={language === 'bn' ? 'ব্যবহারকারী বা গ্রুপ খুঁজুন...' : 'Search people or groups...'}
              className="w-full min-h-[40px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/75 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
              {activeGroupChats.map((grp) => (
                <button
                  key={grp.id}
                  type="button"
                  disabled={sharingTarget === grp.id}
                  onClick={async () => {
                    setSharingTarget(grp.id);
                    await sharePostToInbox(post, { chatId: grp.id });
                    setSharingTarget(null);
                    setShowShareModal(false);
                  }}
                  className="w-full flex items-center justify-between gap-2.5 p-2.5 rounded-2xl hover:bg-slate-200/50 dark:hover:bg-white/10 transition text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {grp.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {t.messages.group} · {grp.participantIds.length}
                      </p>
                    </div>
                  </div>
                  <span className="min-h-[32px] px-3 rounded-xl bg-sky-600 text-white text-[11px] font-semibold inline-flex items-center gap-1 shrink-0">
                    <Send className="w-3 h-3" />
                    <span>{t.messages.send}</span>
                  </span>
                </button>
              ))}

              {shareableCreators.slice(0, 12).map((peer) => (
                <button
                  key={peer.uid}
                  type="button"
                  disabled={sharingTarget === peer.uid}
                  onClick={async () => {
                    setSharingTarget(peer.uid);
                    await sharePostToInbox(post, { userUid: peer.uid });
                    setSharingTarget(null);
                    setShowShareModal(false);
                  }}
                  className="w-full flex items-center justify-between gap-2.5 p-2.5 rounded-2xl hover:bg-slate-200/50 dark:hover:bg-white/10 transition text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={peer.photoUrl} name={peer.displayName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {peer.displayName}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        @{peer.username}
                      </p>
                    </div>
                  </div>
                  <span className="min-h-[32px] px-3 rounded-xl bg-sky-600 text-white text-[11px] font-semibold inline-flex items-center gap-1 shrink-0">
                    <Send className="w-3 h-3" />
                    <span>{t.messages.send}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </article>
  );
}
