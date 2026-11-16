import React from 'react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { splitTextWithMentions } from '../utils/validation';

interface RichMentionTextProps {
  text: string;
  className?: string;
  mentionClassName?: string;
  onMentionClick?: (uid: string, username: string) => void;
}

export function RichMentionText({
  text,
  className = '',
  mentionClassName = 'text-sky-600 dark:text-sky-400 font-semibold hover:underline cursor-pointer',
  onMentionClick,
}: RichMentionTextProps) {
  const { creators, currentUser, openUserProfile } = useSocialVerse();

  if (!text) return null;

  const segments = splitTextWithMentions(text);

  return (
    <span className={className}>
      {segments.map((seg, idx) => {
        if (seg.type !== 'mention' || !seg.username) {
          return <React.Fragment key={idx}>{seg.value}</React.Fragment>;
        }

        const norm = seg.username.toLowerCase();
        const target =
          (currentUser.username && currentUser.username.toLowerCase() === norm
            ? currentUser
            : creators.find(
                (c) => !c.isDeactivated && c.username.toLowerCase() === norm
              )) || null;

        if (!target) {
          return (
            <span key={idx} className="text-sky-600/80 dark:text-sky-400/80 font-medium">
              {seg.value}
            </span>
          );
        }

        return (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMentionClick?.(target.uid, target.username);
              openUserProfile(target.uid);
            }}
            className={`inline p-0 m-0 bg-transparent border-0 align-baseline ${mentionClassName}`}
          >
            {seg.value}
          </button>
        );
      })}
    </span>
  );
}
