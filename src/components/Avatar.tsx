import { useEffect, useState } from 'react';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

export function Avatar({ src, name, size = 'md', online, className = '' }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const safeName = (name || 'SocialVerse').trim() || 'SocialVerse';

  const initials = safeName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'S';

  return (
    <div className={`relative inline-flex shrink-0 ${SIZE_CLASSES[size]} ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt={safeName}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full rounded-full object-cover border border-white/60 dark:border-white/15"
        />
      ) : (
        <div
          aria-label={safeName}
          className="w-full h-full rounded-full bg-gradient-to-br from-sky-500 to-cyan-700 text-white font-semibold flex items-center justify-center border border-white/50 dark:border-white/15"
        >
          {initials}
        </div>
      )}
      {online && (
        <span
          aria-label="Online"
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
        />
      )}
    </div>
  );
}
