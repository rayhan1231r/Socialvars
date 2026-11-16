import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, ImagePlus, Send, Smile, X } from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import type { Post } from '../types/social';
import { formatRelativeTime } from '../utils/validation';
import { Avatar } from './Avatar';
import { MentionInput } from './MentionInput';
import { RichMentionText } from './RichMentionText';

interface CommentsDrawerProps {
  post: Post;
  onClose: () => void;
}

export function CommentsDrawer({ post, onClose }: CommentsDrawerProps) {
  const {
    t,
    language,
    commentsByPost,
    stickers,
    addComment,
    createSticker,
    uploadImageDataUrl,
    openUserProfile,
    showToast,
  } = useSocialVerse();

  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [showStickerTray, setShowStickerTray] = useState(false);
  const [trayKind, setTrayKind] = useState<'sticker' | 'gif'>('sticker');
  const [submitting, setSubmitting] = useState(false);

  const comments = commentsByPost[post.id] || [];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addComment(post.id, commentText, replyingTo?.id);
      setCommentText('');
      setReplyingTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendStickerOrGif = async (url: string, kind: 'sticker' | 'gif') => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await addComment(
        post.id,
        kind === 'gif' ? '[GIF]' : '[Sticker]',
        replyingTo?.id,
        kind === 'sticker' ? url : undefined,
        kind === 'gif' ? url : undefined
      );
      setShowStickerTray(false);
      setReplyingTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCommentSticker = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await uploadImageDataUrl(file, 420);
      const created = await createSticker(file.name.slice(0, 24), dataUrl, trayKind);
      if (created) {
        await handleSendStickerOrGif(created.imageUrl, trayKind);
      }
    } catch {
      showToast(language === 'bn' ? 'স্টিকার তৈরি করা যায়নি' : 'Could not create sticker from image');
    }
  };

  const handleCopyComment = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    showToast(language === 'bn' ? 'মন্তব্য কপি হয়েছে' : 'Comment copied');
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Comments"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[80] bg-slate-950/65 backdrop-blur-sm flex items-end justify-center p-0"
    >
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-200/80 dark:border-white/15 rounded-t-3xl rounded-b-none w-full max-w-lg max-h-[86vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-white/25" />
        </div>
        <div className="px-5 py-2.5 border-b border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {t.feed.comment} ({comments.length})
          </h2>
          <button
            type="button"
            aria-label="Close comments"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {comments.length === 0 ? (
            <p className="text-xs text-center text-slate-500 py-8">
              {language === 'bn'
                ? 'এখনো কোনো মন্তব্য নেই। প্রথম মন্তব্য করুন!'
                : 'No comments yet. Start the conversation!'}
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className={`flex items-start gap-2.5 ${c.parentCommentId ? 'pl-8' : ''}`}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openUserProfile(c.authorId);
                  }}
                  className="shrink-0"
                >
                  <Avatar src={c.authorAvatar} name={c.authorUsername} size="sm" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="p-2.5 rounded-2xl liquid-glass-subtle space-y-1.5">
                    <p className="text-xs text-slate-800 dark:text-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          openUserProfile(c.authorId);
                        }}
                        className="font-semibold hover:underline mr-1"
                      >
                        @{c.authorUsername}
                      </button>
                      {!c.stickerUrl && !c.gifUrl && (
                        <RichMentionText
                          text={c.text}
                          className="text-slate-700 dark:text-slate-300"
                          onMentionClick={onClose}
                        />
                      )}
                    </p>
                    {(c.stickerUrl || c.gifUrl) && (
                      <img
                        src={c.stickerUrl || c.gifUrl}
                        alt="Sticker comment"
                        className="w-24 h-24 rounded-xl object-cover"
                      />
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500 px-1">
                    <span>{formatRelativeTime(c.createdAt, language)}</span>
                    <button
                      type="button"
                      onClick={() => setReplyingTo({ id: c.id, username: c.authorUsername })}
                      className="font-semibold hover:text-sky-600"
                    >
                      {language === 'bn' ? 'উত্তর' : 'Reply'}
                    </button>
                    {!c.stickerUrl && !c.gifUrl && (
                      <button
                        type="button"
                        onClick={() => handleCopyComment(c.text)}
                        className="inline-flex items-center gap-1 font-semibold hover:text-sky-600"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{t.messages.copyMessage}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {showStickerTray && (
          <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-900/80 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setTrayKind('sticker')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    trayKind === 'sticker' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Stickers
                </button>
                <button
                  type="button"
                  onClick={() => setTrayKind('gif')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    trayKind === 'gif' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  GIFs
                </button>
              </div>

              <label className="min-h-[34px] px-3 rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer">
                <ImagePlus className="w-3.5 h-3.5" />
                <span>Create {trayKind === 'gif' ? 'GIF' : 'Sticker'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCreateCommentSticker}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto">
              {stickers
                .filter((s) => s.kind === trayKind)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSendStickerOrGif(item.imageUrl, trayKind)}
                    className="rounded-xl overflow-hidden aspect-square border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform"
                  >
                    <img src={item.imageUrl} alt={item.label} className="w-full h-full object-cover" />
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="p-3.5 border-t border-slate-200/70 dark:border-slate-800/70 space-y-2 shrink-0">
          {replyingTo && (
            <div className="flex items-center justify-between text-xs text-sky-600 dark:text-sky-400">
              <span>Replying to @{replyingTo.username}</span>
              <button type="button" onClick={() => setReplyingTo(null)} className="underline">
                Cancel
              </button>
            </div>
          )}

          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Open stickers and GIFs"
              onClick={() => setShowStickerTray((s) => !s)}
              className={`min-h-[42px] min-w-[42px] rounded-xl flex items-center justify-center shrink-0 ${
                showStickerTray
                  ? 'bg-sky-600 text-white'
                  : 'liquid-glass-subtle text-slate-600 dark:text-slate-300'
              }`}
            >
              <Smile className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <MentionInput
                value={commentText}
                onChange={setCommentText}
                placeholder={t.feed.writeComment}
                ariaLabel={t.feed.writeComment}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              aria-label={t.feed.postButton}
              className="min-h-[42px] px-4 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t.feed.postButton}</span>
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
