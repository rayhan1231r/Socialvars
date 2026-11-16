import React, { useMemo, useRef, useState } from 'react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { Avatar } from './Avatar';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
}

interface MentionMatch {
  query: string;
  startIndex: number;
  endIndex: number;
}

function findActiveMention(text: string, cursorPos: number): MentionMatch | null {
  if (cursorPos < 1) return null;
  const before = text.slice(0, cursorPos);
  const match = before.match(/(?:^|[\s\n.,!?;:()])@([a-zA-Z0-9._]{0,24})$/);
  if (!match) return null;
  const full = match[0];
  const atOffset = full.lastIndexOf('@');
  const startIndex = before.length - full.length + atOffset;
  return {
    query: match[1].toLowerCase(),
    startIndex,
    endIndex: cursorPos,
  };
}

export function MentionInput({
  value,
  onChange,
  multiline = false,
  rows = 3,
  maxLength,
  placeholder,
  id,
  ariaLabel,
  className = '',
  required,
  disabled,
  autoFocus,
  onKeyDown,
}: MentionInputProps) {
  const { creators, currentUser } = useSocialVerse();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [cursorPos, setCursorPos] = useState<number>(value.length);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [highlightIdx, setHighlightIdx] = useState<number>(0);

  const activeMention = useMemo(() => {
    if (!menuOpen) return null;
    return findActiveMention(value, cursorPos);
  }, [value, cursorPos, menuOpen]);

  const suggestions = useMemo(() => {
    if (!activeMention) return [];
    const q = activeMention.query;
    return creators
      .filter((c) => !c.isDeactivated && c.uid !== currentUser.uid)
      .filter(
        (c) =>
          !q ||
          c.username.toLowerCase().includes(q) ||
          c.displayName.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [activeMention, creators, currentUser.uid]);

  const syncCursorAndMenu = (el: HTMLInputElement | HTMLTextAreaElement, nextText?: string) => {
    const pos = el.selectionStart ?? (nextText ?? el.value).length;
    setCursorPos(pos);
    const match = findActiveMention(nextText ?? el.value, pos);
    if (match) {
      setMenuOpen(true);
      setHighlightIdx(0);
    } else {
      setMenuOpen(false);
    }
  };

  const applySuggestion = (username: string) => {
    if (!activeMention) return;
    const prefix = value.slice(0, activeMention.startIndex);
    const suffix = value.slice(activeMention.endIndex);
    const insert = `@${username} `;
    const nextValue = `${prefix}${insert}${suffix}`;
    const trimmed =
      typeof maxLength === 'number' ? nextValue.slice(0, maxLength) : nextValue;
    onChange(trimmed);
    setMenuOpen(false);
    const targetPos = Math.min(prefix.length + insert.length, trimmed.length);
    setCursorPos(targetPos);
    requestAnimationFrame(() => {
      const el = multiline ? textareaRef.current : inputRef.current;
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(targetPos, targetPos);
        } catch {
          // ignore
        }
      }
    });
  };

  const handleKeyDownInternal = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (menuOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const chosen = suggestions[highlightIdx] || suggestions[0];
        if (chosen) applySuggestion(chosen.username);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const sharedProps = {
    id,
    value,
    maxLength,
    placeholder,
    required,
    disabled,
    autoFocus,
    'aria-label': ariaLabel,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = e.target.value;
      onChange(next);
      syncCursorAndMenu(e.currentTarget, next);
    },
    onClick: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      syncCursorAndMenu(e.currentTarget);
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Escape') {
        syncCursorAndMenu(e.currentTarget);
      }
    },
    onBlur: () => {
      setTimeout(() => setMenuOpen(false), 150);
    },
    onKeyDown: handleKeyDownInternal,
    className,
  };

  return (
    <div className="relative w-full">
      {multiline ? (
        <textarea ref={textareaRef} rows={rows} {...sharedProps} />
      ) : (
        <input ref={inputRef} type="text" {...sharedProps} />
      )}

      {menuOpen && suggestions.length > 0 && (
        <div
          role="listbox"
          aria-label="Mention suggestions"
          className={`absolute left-0 right-0 z-50 rounded-2xl border border-slate-200 dark:border-white/15 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden ${
            multiline ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
          }`}
        >
          {suggestions.map((creator, idx) => (
            <button
              key={creator.uid}
              type="button"
              role="option"
              aria-selected={idx === highlightIdx}
              onMouseDown={(e) => {
                e.preventDefault();
                applySuggestion(creator.username);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition ${
                idx === highlightIdx
                  ? 'bg-sky-500/15 text-sky-900 dark:text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-slate-100'
              }`}
            >
              <Avatar
                src={creator.photoUrl}
                name={creator.displayName}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">
                  {creator.displayName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  @{creator.username}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
