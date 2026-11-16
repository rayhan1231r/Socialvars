import { Clapperboard } from 'lucide-react';

export function StoriesBarSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="liquid-glass rounded-3xl px-4 pt-3.5 pb-3 space-y-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="h-3.5 w-20 rounded-full liquid-skeleton" />
        <div className="h-7 w-24 rounded-xl liquid-skeleton" />
      </div>
      <div className="flex items-start gap-4 overflow-hidden py-1">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="flex flex-col items-center gap-1.5 shrink-0 w-[72px]">
            <div className="w-[62px] h-[62px] rounded-full p-0.5 liquid-glass-subtle flex items-center justify-center">
              <div className="w-full h-full rounded-full liquid-skeleton" />
            </div>
            <div className="h-2.5 w-12 rounded-full liquid-skeleton" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function FeedPostSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <article
      aria-hidden="true"
      className="liquid-glass rounded-2xl p-4 sm:p-5 space-y-3.5"
    >
      {/* Author Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full liquid-skeleton shrink-0" />
          <div className="space-y-1.5 min-w-0">
            <div className="h-3.5 w-32 rounded-full liquid-skeleton" />
            <div className="h-2.5 w-24 rounded-full liquid-skeleton" />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-16 rounded-xl liquid-skeleton" />
          <div className="h-8 w-8 rounded-xl liquid-skeleton" />
        </div>
      </div>

      {/* Caption Lines */}
      <div className="space-y-2">
        <div className="h-3.5 w-11/12 rounded-full liquid-skeleton" />
        <div className="h-3.5 w-3/4 rounded-full liquid-skeleton" />
      </div>

      {/* Media Surface */}
      {!compact && (
        <div className="w-full aspect-[4/3] sm:aspect-[16/10] rounded-2xl liquid-skeleton border border-white/40 dark:border-white/10" />
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-16 rounded-xl liquid-skeleton" />
          <div className="h-9 w-16 rounded-xl liquid-skeleton" />
          <div className="h-9 w-12 rounded-xl liquid-skeleton" />
        </div>
        <div className="h-9 w-9 rounded-xl liquid-skeleton" />
      </div>
    </article>
  );
}

export function FeedSkeleton({
  includeStories = true,
  label = 'Loading feed',
}: {
  includeStories?: boolean;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      data-testid="feed-skeleton"
      className="space-y-4"
    >
      <span className="sr-only">{label}</span>
      {includeStories && <StoriesBarSkeleton />}

      <div className="flex flex-wrap items-center justify-between gap-2" aria-hidden="true">
        <div className="inline-flex items-center gap-1.5 p-1 rounded-xl liquid-glass-subtle">
          <div className="h-9 w-20 sm:w-24 rounded-lg liquid-skeleton" />
          <div className="h-9 w-20 sm:w-24 rounded-lg liquid-skeleton" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-9 w-10 rounded-xl liquid-skeleton" />
          <div className="h-9 w-16 sm:w-20 rounded-xl liquid-skeleton" />
          <div className="h-9 w-16 sm:w-20 rounded-xl liquid-skeleton" />
        </div>
      </div>

      <div className="space-y-4">
        <FeedPostSkeleton />
        <FeedPostSkeleton compact />
      </div>
    </div>
  );
}

export function ReelsSkeleton({
  embedded = false,
  label = 'Loading reels',
}: {
  embedded?: boolean;
  label?: string;
}) {
  const card = (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      data-testid="reels-skeleton"
      className="relative w-full max-w-md mx-auto h-[76vh] sm:h-[82vh] max-h-[800px] rounded-3xl overflow-hidden liquid-glass border border-white/25 dark:border-white/15 shadow-2xl flex flex-col justify-between select-none"
    >
      <span className="sr-only">{label}</span>

      {/* Ambient Shimmer Surface */}
      <div className="absolute inset-0 liquid-skeleton opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/25 via-transparent to-slate-950/65 dark:from-black/45 dark:to-black/80 pointer-events-none" />

      {/* Top Bar Skeleton */}
      <div className="relative z-10 p-4 flex items-center justify-between gap-2" aria-hidden="true">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl liquid-glass-subtle flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Clapperboard className="w-4 h-4" />
          </div>
          <div className="h-4 w-20 rounded-full liquid-skeleton" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-9 w-12 rounded-full liquid-skeleton" />
          <div className="h-9 w-9 rounded-full liquid-skeleton" />
          <div className="h-9 w-9 rounded-full liquid-skeleton" />
        </div>
      </div>

      {/* Center Frosted Emblem */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-3 px-6 text-center" aria-hidden="true">
        <div className="w-16 h-16 rounded-3xl liquid-glass-dock flex items-center justify-center">
          <Clapperboard className="w-7 h-7 text-sky-600 dark:text-sky-400 animate-pulse" />
        </div>
        <div className="h-3 w-32 rounded-full liquid-skeleton" />
      </div>

      {/* Bottom Caption + Right Rail Action Skeleton */}
      <div className="relative z-10 p-4 flex items-end justify-between gap-4" aria-hidden="true">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full liquid-skeleton shrink-0" />
            <div className="h-3.5 w-28 rounded-full liquid-skeleton" />
            <div className="h-7 w-16 rounded-lg liquid-skeleton" />
          </div>
          <div className="h-3 w-11/12 rounded-full liquid-skeleton" />
          <div className="h-3 w-2/3 rounded-full liquid-skeleton" />
        </div>

        <div className="flex flex-col items-center gap-2.5 shrink-0">
          <div className="w-10 h-10 rounded-full liquid-skeleton" />
          <div className="w-10 h-10 rounded-full liquid-skeleton" />
          <div className="w-10 h-10 rounded-full liquid-skeleton" />
          <div className="w-10 h-10 rounded-full liquid-skeleton" />
          <div className="w-10 h-10 rounded-full liquid-skeleton" />
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return <div className="py-1">{card}</div>;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-lg flex items-center justify-center p-3 sm:p-6"
    >
      {card}
    </div>
  );
}
