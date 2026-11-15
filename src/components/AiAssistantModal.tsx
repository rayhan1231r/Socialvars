import { useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';

export function AiAssistantModal() {
  const {
    subscreen,
    setSubscreen,
    callAiAssistant,
    updateProfile,
    firebaseUser,
    t,
  } = useSocialVerse();

  const [task, setTask] = useState<'bio' | 'usernames' | 'caption' | 'improve_bio' | 'smart_replies'>('bio');
  const [contextText, setContextText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [tip, setTip] = useState<string>('');

  if (subscreen !== 'ai_assistant') return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await callAiAssistant(task, contextText);
      setSuggestions(res.suggestions);
      setTip(res.tip);
    } catch (err) {
      if (err instanceof Error && err.message === 'AUTH_REQUIRED') {
        setError(t.ai.signInRequired);
      } else {
        setError(err instanceof Error ? err.message : 'Unable to reach Gemini Assistant.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.ai.title}
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="liquid-glass rounded-3xl p-6 max-w-lg w-full space-y-5 max-h-[88vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-600" />
              <span>{t.ai.title}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.ai.subtitle}</p>
          </div>
          <button
            type="button"
            aria-label="Close AI Assistant"
            onClick={() => setSubscreen(null)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'bio', label: t.ai.taskBio },
              { id: 'usernames', label: t.ai.taskUsername },
              { id: 'caption', label: t.ai.taskCaption },
              { id: 'improve_bio', label: t.ai.taskImproveBio },
              { id: 'smart_replies', label: t.ai.taskSmartReplies },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTask(item.id)}
              className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold transition-colors ${
                task === item.id
                  ? 'bg-sky-600 text-white'
                  : 'liquid-glass-subtle text-slate-700 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleGenerate} className="space-y-3">
          <textarea
            rows={3}
            value={contextText}
            onChange={(e) => setContextText(e.target.value)}
            placeholder={t.ai.promptPlaceholder}
            aria-label={t.ai.promptPlaceholder}
            className="w-full p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
          />
          {!firebaseUser && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t.ai.signInRequired}
            </p>
          )}
          {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Generating...' : t.ai.generate}
          </button>
        </form>

        {suggestions.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800/70">
            {suggestions.map((text, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl liquid-glass-subtle flex items-start justify-between gap-3">
                <p className="text-sm text-slate-800 dark:text-slate-200">{text}</p>
                {(task === 'bio' || task === 'improve_bio') && (
                  <button
                    type="button"
                    onClick={() => {
                      updateProfile({ bio: text.slice(0, 240) });
                      setSubscreen(null);
                    }}
                    className="min-h-[34px] px-3 rounded-lg bg-sky-600 text-white text-xs font-semibold shrink-0 inline-flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{t.ai.applyToProfile}</span>
                  </button>
                )}
              </div>
            ))}
            {tip && <p className="text-xs text-slate-500 dark:text-slate-400">Tip: {tip}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
