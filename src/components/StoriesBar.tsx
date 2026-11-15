import { useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Image as ImageIcon, Plus, Send, Trash2, VolumeX, X } from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { formatRelativeTime, isHomeStoryVisibleToUser } from '../utils/validation';
import { Avatar } from './Avatar';

export function StoriesBar() {
  const {
    currentUser,
    isAuthenticated,
    creators,
    followingIds,
    stories,
    t,
    language,
    activeStoryIndex,
    setActiveStoryIndex,
    setSubscreen,
    subscreen,
    openUserProfile,
    reactToStory,
    replyToStory,
    deleteStory,
    muteStoryAuthor,
    createStory,
    uploadImageDataUrl,
  } = useSocialVerse();

  const [replyText, setReplyText] = useState('');
  const [showViewers, setShowViewers] = useState(false);

  // Story creator local state
  const [storyType, setStoryType] = useState<'text' | 'photo' | 'video'>('text');
  const [storyText, setStoryText] = useState('');
  const [storyMediaUrl, setStoryMediaUrl] = useState('');
  const [storyPrivacy, setStoryPrivacy] = useState<'everyone' | 'followers' | 'close_friends'>('everyone');

  const visibleStories = stories.filter((s) =>
    isHomeStoryVisibleToUser(
      s,
      creators.find((c) => c.uid === s.authorId),
      isAuthenticated ? currentUser.uid : null,
      followingIds
    )
  );

  const activeStory =
    activeStoryIndex !== null && visibleStories[activeStoryIndex]
      ? visibleStories[activeStoryIndex]
      : null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImageDataUrl(file, 1080);
    setStoryMediaUrl(url);
    if (file.type.startsWith('video/')) setStoryType('video');
    else setStoryType('photo');
  };

  const handlePublishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (storyType === 'text' && !storyText.trim()) return;
    if (storyType !== 'text' && !storyMediaUrl.trim()) return;
    await createStory({
      mediaType: storyType,
      mediaUrl: storyType === 'text' ? undefined : storyMediaUrl,
      textContent: storyText.trim() || undefined,
      privacy: storyPrivacy,
    });
    setStoryText('');
    setStoryMediaUrl('');
  };

  return (
    <>
      <section aria-label={t.feed.stories} className="liquid-glass rounded-2xl p-3.5">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSubscreen('story_creator')}
            className="flex flex-col items-center gap-1.5 shrink-0 min-w-[68px] group"
          >
            <div className="relative p-0.5 rounded-full border border-dashed border-sky-500">
              <Avatar
                src={isAuthenticated ? currentUser.photoUrl : ''}
                name={isAuthenticated ? currentUser.displayName : 'You'}
                size="lg"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center shadow ring-2 ring-white dark:ring-slate-900">
                <Plus className="w-3.5 h-3.5" />
              </span>
            </div>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[72px]">
              {t.feed.addStory}
            </span>
          </button>

          {visibleStories.map((story, idx) => (
            <button
              key={story.id}
              type="button"
              onClick={() => {
                setShowViewers(false);
                setActiveStoryIndex(idx);
              }}
              className="flex flex-col items-center gap-1.5 shrink-0 min-w-[68px]"
            >
              <div className="p-0.5 rounded-full bg-gradient-to-tr from-sky-500 to-cyan-400">
                <div className="p-0.5 rounded-full bg-white dark:bg-slate-900">
                  <Avatar src={story.authorAvatar} name={story.authorDisplayName} size="lg" />
                </div>
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[72px]">
                {story.authorDisplayName.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Story Viewer Modal */}
      {activeStory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Story by ${activeStory.authorDisplayName}`}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="relative w-full max-w-md h-[82vh] max-h-[760px] rounded-3xl overflow-hidden bg-slate-900 border border-white/15 shadow-2xl flex flex-col justify-between">
            {activeStory.mediaType === 'photo' && activeStory.mediaUrl ? (
              <img
                src={activeStory.mediaUrl}
                alt={activeStory.textContent || activeStory.authorDisplayName}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : activeStory.mediaType === 'video' && activeStory.mediaUrl ? (
              <video
                src={activeStory.mediaUrl}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className={`absolute inset-0 bg-gradient-to-br ${
                  activeStory.backgroundGradient || 'from-sky-700 via-indigo-800 to-slate-950'
                } flex items-center justify-center p-8 text-center`}
              >
                <p className="text-2xl font-display font-semibold text-white leading-snug">
                  {activeStory.textContent}
                </p>
              </div>
            )}

            <div className="relative z-10 p-4 bg-gradient-to-b from-black/75 via-black/35 to-transparent">
              <div className="flex gap-1.5 mb-3">
                {visibleStories.map((s, i) => (
                  <div key={s.id} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        i <= (activeStoryIndex ?? 0) ? 'bg-white w-full' : 'w-0'
                      }`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const targetUid = activeStory.authorId;
                    setActiveStoryIndex(null);
                    openUserProfile(targetUid);
                  }}
                  className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-90"
                >
                  <Avatar src={activeStory.authorAvatar} name={activeStory.authorDisplayName} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {activeStory.authorDisplayName}
                    </p>
                    <p className="text-xs text-white/75">
                      {formatRelativeTime(activeStory.createdAt, language)} · {activeStory.privacy}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  {activeStory.authorId === currentUser.uid ? (
                    <button
                      type="button"
                      aria-label="Delete story"
                      onClick={() => deleteStory(activeStory.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/90 hover:text-rose-400"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="Mute stories from user"
                      onClick={() => muteStoryAuthor(activeStory.authorId)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/90 hover:text-white"
                    >
                      <VolumeX className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Close story viewer"
                    onClick={() => setActiveStoryIndex(null)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/90 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between px-2">
              <button
                type="button"
                aria-label="Previous story"
                disabled={(activeStoryIndex ?? 0) === 0}
                onClick={() => setActiveStoryIndex(Math.max(0, (activeStoryIndex ?? 0) - 1))}
                className="min-h-[44px] min-w-[44px] rounded-full bg-black/30 text-white flex items-center justify-center disabled:opacity-25"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label="Next story"
                disabled={(activeStoryIndex ?? 0) >= visibleStories.length - 1}
                onClick={() =>
                  setActiveStoryIndex(
                    Math.min(visibleStories.length - 1, (activeStoryIndex ?? 0) + 1)
                  )
                }
                className="min-h-[44px] min-w-[44px] rounded-full bg-black/30 text-white flex items-center justify-center disabled:opacity-25"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="relative z-10 p-4 bg-gradient-to-t from-black/85 via-black/55 to-transparent space-y-3">
              {activeStory.mediaType !== 'text' && activeStory.textContent && (
                <p className="text-sm text-white/95 text-center">{activeStory.textContent}</p>
              )}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowViewers((v) => !v)}
                  className="min-h-[40px] px-3 rounded-xl bg-white/15 text-white text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <Eye className="w-4 h-4" />
                  <span className="font-mono-num">{activeStory.viewersCount}</span>
                </button>
                <div className="flex items-center gap-1.5">
                  {['🔥', '❤️', '✨', '👏'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`React ${emoji}`}
                      onClick={() => reactToStory(activeStory.id, emoji)}
                      className="min-h-[44px] min-w-[44px] rounded-full bg-white/15 hover:bg-white/25 text-lg flex items-center justify-center transition-transform active:scale-95"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {showViewers && (
                <div className="p-3 rounded-2xl bg-black/60 text-xs text-white/90">
                  <p className="font-semibold mb-1">Viewers</p>
                  <p className="text-white/75">
                    {activeStory.viewerUsernames.length > 0
                      ? activeStory.viewerUsernames.map((u) => `@${u}`).join(', ')
                      : 'No viewers yet'}
                  </p>
                </div>
              )}

              {activeStory.authorId !== currentUser.uid && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!replyText.trim()) return;
                    const msg = replyText;
                    setReplyText('');
                    await replyToStory(activeStory.id, msg);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply to story..."
                    aria-label="Reply to story"
                    className="flex-1 min-h-[44px] px-4 rounded-xl bg-white/15 border border-white/25 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <button
                    type="submit"
                    aria-label="Send story reply"
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-sky-600 text-white flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Story Creator Modal */}
      {subscreen === 'story_creator' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.create.newStory}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="liquid-glass rounded-3xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.create.newStory}</h2>
              <button
                type="button"
                aria-label="Close story creator"
                onClick={() => setSubscreen(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/70">
              {(['text', 'photo', 'video'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setStoryType(kind)}
                  className={`min-h-[40px] rounded-lg text-xs font-semibold capitalize ${
                    storyType === kind
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {kind}
                </button>
              ))}
            </div>

            <form onSubmit={handlePublishStory} className="space-y-4">
              {storyType !== 'text' && (
                <div className="space-y-2">
                  <label className="min-h-[44px] px-4 rounded-xl border border-dashed border-sky-500/50 bg-sky-500/5 text-sky-700 dark:text-sky-300 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer w-full justify-center">
                    <ImageIcon className="w-4 h-4" />
                    <span>{t.create.mediaUrlLabel}</span>
                    <input
                      type="file"
                      accept={storyType === 'video' ? 'video/*' : 'image/*'}
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                  <input
                    id="story-media-url"
                    type="text"
                    value={storyMediaUrl}
                    onChange={(e) => setStoryMediaUrl(e.target.value)}
                    placeholder="https://..."
                    aria-label="Story media URL"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="story-text-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Story Caption / Text
                </label>
                <textarea
                  id="story-text-input"
                  rows={3}
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  placeholder={t.create.storyTextPlaceholder}
                  className="w-full p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="story-privacy"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Story Privacy
                </label>
                <select
                  id="story-privacy"
                  value={storyPrivacy}
                  onChange={(e) =>
                    setStoryPrivacy(e.target.value as 'everyone' | 'followers' | 'close_friends')
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  <option value="everyone">Everyone</option>
                  <option value="followers">Followers only</option>
                  <option value="close_friends">Close friends</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold"
              >
                {t.create.publish}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
