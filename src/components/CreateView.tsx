import { useState } from 'react';
import { Clapperboard, ImagePlus, Sparkles, Star, Type as TypeIcon, Upload, Users, X } from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import type { MediaType, PostVisibility } from '../types/social';
import { extractHashtags, isVideoMediaUrl } from '../utils/validation';
import { MentionInput } from './MentionInput';

export function CreateView() {
  const { createPost, createStory, setSubscreen, uploadImageDataUrl, userPrivate, setCloseFriendsModalOpen, showToast, t } = useSocialVerse();

  const [mode, setMode] = useState<'post' | 'story' | 'reel'>('post');
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [caption, setCaption] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [reelCoverUrl, setReelCoverUrl] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [storyType, setStoryType] = useState<'text' | 'photo' | 'video'>('photo');
  const [storyPrivacy, setStoryPrivacy] = useState<'everyone' | 'followers' | 'close_friends'>('everyone');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const detectedTags = extractHashtags(caption);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingMedia(true);
    try {
      const dataUrl = await uploadImageDataUrl(file, 1080);
      if (mode === 'story') {
        setStoryType(file.type.startsWith('video/') ? 'video' : 'photo');
        setSelectedMedia([dataUrl]);
      } else if (mode === 'reel') {
        setMediaType('reel');
        setSelectedMedia([dataUrl]);
      } else {
        if (file.type.startsWith('video/')) {
          setMediaType('video');
          setSelectedMedia([dataUrl]);
        } else {
          setSelectedMedia((prev) => (mediaType === 'carousel' ? [...prev, dataUrl] : [dataUrl]));
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not upload selected media.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleReelCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingMedia(true);
    try {
      const dataUrl = await uploadImageDataUrl(file, 960);
      setReelCoverUrl(dataUrl);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not upload cover image.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'story') {
        await createStory({
          mediaType: selectedMedia[0] ? storyType : 'text',
          mediaUrl: selectedMedia[0] || customUrl.trim() || undefined,
          textContent: caption.trim() || undefined,
          privacy: storyPrivacy,
        });
      } else {
        const effectiveType: MediaType = mode === 'reel' ? 'reel' : mediaType;
        const urls =
          effectiveType === 'text'
            ? []
            : customUrl.trim()
            ? [customUrl.trim()]
            : selectedMedia;
        await createPost({
          caption: caption.trim() || ' ',
          mediaUrls: urls,
          coverUrl: mode === 'reel' && reelCoverUrl ? reelCoverUrl : undefined,
          mediaType: effectiveType,
          visibility,
        });
      }
      setCaption('');
      setCustomUrl('');
      setSelectedMedia([]);
      setReelCoverUrl('');
      setSubscreen(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.nav.create}
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="liquid-glass rounded-3xl p-5 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {mode === 'post' ? t.create.newPost : mode === 'reel' ? t.create.newReel : t.create.newStory}
          </h1>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSubscreen('ai_assistant')}
              className="min-h-[38px] px-3 rounded-xl bg-sky-600/10 text-sky-700 dark:text-sky-300 text-xs font-semibold inline-flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI</span>
            </button>
            <button
              type="button"
              aria-label="Close upload sheet"
              onClick={() => setSubscreen(null)}
              className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Post / Story / Reel Switcher */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/70">
          {(
            [
              { id: 'post', label: t.profile.posts, icon: ImagePlus },
              { id: 'story', label: t.feed.stories, icon: TypeIcon },
              { id: 'reel', label: t.explore.reels, icon: Clapperboard },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id);
                if (id === 'reel') setMediaType('reel');
                else if (id === 'post' && mediaType === 'reel') setMediaType('image');
              }}
              className={`min-h-[40px] px-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                mode === id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {mode === 'post' && (
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl liquid-glass-subtle">
            {(['image', 'carousel', 'text'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setMediaType(kind)}
                className={`min-h-[34px] rounded-lg text-xs font-semibold capitalize ${
                  mediaType === kind
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {kind}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="create-caption" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {mode === 'story' ? 'Story Text / Caption' : 'Caption'}
            </label>
            <MentionInput
              id="create-caption"
              multiline
              rows={3}
              required={mode === 'post' && mediaType === 'text'}
              maxLength={2200}
              value={caption}
              onChange={setCaption}
              placeholder={mode === 'story' ? t.create.storyTextPlaceholder : t.create.captionPlaceholder}
              className="w-full p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {detectedTags.length > 0 && (
              <p className="mt-1.5 text-xs text-sky-600 dark:text-sky-400">
                Tags: {detectedTags.map((tag) => `#${tag}`).join(' · ')}
              </p>
            )}
          </div>

          {(mode !== 'post' || mediaType !== 'text') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t.create.mediaUrlLabel}
                </span>
                <label className="min-h-[38px] px-3.5 rounded-xl bg-sky-600/10 text-sky-700 dark:text-sky-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Gallery Upload</span>
                  <input
                    type="file"
                    accept={mode === 'reel' ? 'video/*,image/*' : 'image/*,video/*'}
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>

              {selectedMedia.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {selectedMedia.map((url, idx) => (
                    <div key={idx} className="relative rounded-2xl overflow-hidden aspect-video bg-slate-900">
                      {isVideoMediaUrl(url) ? (
                        <video src={url} controls className="w-full h-full object-cover" />
                      ) : (
                        <img src={url} alt="Upload preview" className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedMedia((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="Or paste image / video URL (optional)"
                aria-label="Custom media URL"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>
          )}

          {/* Reel Cover / Banner Photo Upload */}
          {mode === 'reel' && (
            <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {t.create.reelCoverLabel}
                </span>
                <label className="min-h-[34px] px-3 rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>Upload Cover</span>
                  <input type="file" accept="image/*" onChange={handleReelCoverUpload} className="sr-only" />
                </label>
              </div>
              {reelCoverUrl && (
                <div className="relative h-28 rounded-xl overflow-hidden">
                  <img src={reelCoverUrl} alt="Reel cover preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setReelCoverUrl('')}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 pt-2">
            {mode === 'story' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.create.visibilityLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCloseFriendsModalOpen(true)}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {t.messages.manageCloseFriends} ({(userPrivate.closeFriendUids || []).length})
                    </span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'everyone', label: t.create.publicOpt, icon: Users },
                      { id: 'followers', label: t.create.followersOpt, icon: Users },
                      { id: 'close_friends', label: t.create.closeFriendsOpt, icon: Star },
                    ] as const
                  ).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setStoryPrivacy(id)}
                      className={`min-h-[40px] px-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors ${
                        storyPrivacy === id
                          ? id === 'close_friends'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-sky-600 text-white shadow-sm'
                          : 'liquid-glass-btn text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${id === 'close_friends' && storyPrivacy === id ? 'fill-current' : ''}`} />
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="post-visibility" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t.create.visibilityLabel}
                </label>
                <select
                  id="post-visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as PostVisibility)}
                  className="min-h-[42px] px-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white"
                >
                  <option value="public">{t.create.publicOpt}</option>
                  <option value="followers">{t.create.followersOpt}</option>
                  <option value="only_me">{t.create.onlyMeOpt}</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || uploadingMedia || (!caption.trim() && selectedMedia.length === 0 && !customUrl.trim())}
              className="w-full min-h-[44px] px-6 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {submitting || uploadingMedia ? t.create.uploadingProgress : t.create.publish}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
