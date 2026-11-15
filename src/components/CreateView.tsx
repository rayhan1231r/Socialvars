import { useState } from 'react';
import { Clapperboard, ImagePlus, Sparkles, Type as TypeIcon, Upload } from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { IMG_COASTAL, IMG_DESK, IMG_SKYLINE } from '../data/seed';
import type { MediaType } from '../types/social';
import { extractHashtags } from '../utils/validation';

const SAMPLE_MEDIA = [
  { label: 'Skyline Terrace', url: IMG_SKYLINE },
  { label: 'Design Studio', url: IMG_DESK },
  { label: 'Coastal Dawn', url: IMG_COASTAL },
];

export function CreateView() {
  const { createPost, setSubscreen, t } = useSocialVerse();

  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [caption, setCaption] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<string[]>([IMG_SKYLINE]);
  const [customUrl, setCustomUrl] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public');
  const [submitting, setSubmitting] = useState(false);

  const detectedTags = extractHashtags(caption);

  const handleTogglePreset = (url: string) => {
    if (mediaType === 'carousel') {
      setSelectedMedia((prev) =>
        prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url].slice(0, 6)
      );
    } else {
      setSelectedMedia([url]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) {
      setMediaType('video');
      setSelectedMedia([objectUrl]);
    } else {
      setSelectedMedia((prev) =>
        mediaType === 'carousel' ? [...prev, objectUrl] : [objectUrl]
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !caption.trim()) return;
    setSubmitting(true);
    const urls =
      mediaType === 'text'
        ? []
        : customUrl.trim()
        ? [customUrl.trim()]
        : selectedMedia;
    await createPost({
      caption,
      mediaUrls: urls,
      mediaType,
      visibility,
    });
    setCaption('');
    setCustomUrl('');
    setSubmitting(false);
  };

  return (
    <div className="space-y-5">
      <div className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.create.newPost}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubscreen('story_creator')}
              className="min-h-[40px] px-3.5 rounded-xl liquid-glass-subtle text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/80"
            >
              + {t.create.newStory}
            </button>
            <button
              type="button"
              onClick={() => setSubscreen('ai_assistant')}
              className="min-h-[40px] px-3.5 rounded-xl bg-sky-600/10 text-sky-700 dark:text-sky-300 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Caption</span>
            </button>
          </div>
        </div>

        {/* Format Switcher */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/70">
          {(
            [
              { id: 'text', label: 'Text', icon: TypeIcon },
              { id: 'image', label: 'Photo', icon: ImagePlus },
              { id: 'carousel', label: 'Carousel', icon: ImagePlus },
              { id: 'reel', label: 'Reel', icon: Clapperboard },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMediaType(id)}
              className={`min-h-[40px] px-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                mediaType === id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="create-caption"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Caption
            </label>
            <textarea
              id="create-caption"
              rows={4}
              required
              maxLength={2200}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t.create.captionPlaceholder}
              className="w-full p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {detectedTags.length > 0 && (
              <p className="mt-1.5 text-xs text-sky-600 dark:text-sky-400">
                Tags: {detectedTags.map((tag) => `#${tag}`).join(' · ')}
              </p>
            )}
          </div>

          {mediaType !== 'text' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t.create.mediaUrlLabel}
                </span>
                <label className="min-h-[36px] px-3 rounded-xl liquid-glass-subtle text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {SAMPLE_MEDIA.map((item) => {
                  const active = selectedMedia.includes(item.url);
                  return (
                    <button
                      key={item.url}
                      type="button"
                      onClick={() => handleTogglePreset(item.url)}
                      className={`relative rounded-xl overflow-hidden aspect-[4/3] border-2 transition-all ${
                        active ? 'border-sky-600 ring-2 ring-sky-500/30' : 'border-transparent opacity-80'
                      }`}
                    >
                      <img
                        src={item.url}
                        alt={item.label}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[11px] py-1 px-2 truncate">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="Or paste custom media URL (optional)"
                aria-label="Custom media URL"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2">
              <label
                htmlFor="post-visibility"
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {t.create.visibilityLabel}
              </label>
              <select
                id="post-visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'public' | 'followers')}
                className="min-h-[40px] px-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white"
              >
                <option value="public">{t.create.publicOpt}</option>
                <option value="followers">{t.create.followersOpt}</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting || !caption.trim()}
              className="min-h-[44px] px-6 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {t.create.publish}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
