import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  Ban,
  Bell,
  BellOff,
  Bookmark,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Clock,
  Compass,
  Copy,
  CornerUpRight,
  Crown,
  Download,
  FileText,
  Heart,
  Home,
  Image as ImageIcon,
  Info,
  Mail,
  MessageCircle,
  Mic,
  Moon,
  MoreHorizontal,
  Palette,
  Paperclip,
  Pencil,
  Phone,
  Pin,
  PinOff,
  Play,
  Plus,
  PlusSquare,
  Radio,
  Reply,
  Search,
  Send,
  Settings,
  Shield,
  Smile,
  Sparkles,
  Square,
  SquarePen,
  Star,
  Sun,
  Trash2,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import type { Chat, ChatMessage, NoteItem } from '../types/social';
import {
  BROADCAST_MIN_FOLLOWERS,
  CHAT_THEME_PRESETS,
  MAX_GROUP_MEMBERS,
  canEditGroupInfo,
  canOpenBroadcastChannel,
  canPostInBroadcast,
  canRemoveGroupMember,
  canSendInGroupChat,
  formatRelativeTime,
  isGroupAdmin,
  isGroupOwner,
} from '../utils/validation';
import { Avatar } from './Avatar';

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👏'];
const QUICK_EMOJIS = ['😊', '😂', '❤️', '🔥', '🙌', '🥳', '🤩', '😍', '🤝', '✨', '💯', '😎'];
const NOTE_QUICK_THOUGHTS = [
  { emoji: '☕', en: 'Coffee break', bn: 'কফি বিরতি' },
  { emoji: '🎧', en: 'Listening to music', bn: 'গান শুনছি' },
  { emoji: '💻', en: 'Deep focus mode', bn: 'কাজে ব্যস্ত' },
  { emoji: '🌙', en: 'Late night thoughts', bn: 'রাতের ভাবনা' },
  { emoji: '✨', en: 'Feeling inspired', bn: 'দারুণ অনুপ্রেরণা' },
  { emoji: '🏃', en: 'On the move', bn: 'বাইরে যাচ্ছি' },
];
const NOTE_EMOJI_BAR = ['🔥', '❤️', '😂', '✨', '💯', '🎧', '☕', '🌙'];

function formatDateDivider(isoDate: string, lang: 'en' | 'bn'): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMsgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfMsgDay) / 86_400_000);
  if (diffDays === 0) return lang === 'bn' ? 'আজ' : 'Today';
  if (diffDays === 1) return lang === 'bn' ? 'গতকাল' : 'Yesterday';
  return date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function getDayKey(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function MessagesView() {
  const {
    chats,
    activeChatId,
    setActiveChatId,
    messagesByChat,
    notes,
    stickers,
    favoriteStickerIds,
    broadcastChannels,
    currentUser,
    creators,
    userPrivate,
    friendRequests,
    isAuthenticated,
    openAuthModal,
    setActiveTab,
    setSubscreen,
    language,
    setLanguage,
    theme,
    setTheme,
    respondToFriendRequest,
    typingByChat,
    sendTypingSignal,
    sendMessage,
    editMessage,
    reactToMessage,
    starMessage,
    pinMessage,
    forwardMessage,
    updateChatPreferences,
    deleteChatFromInbox,
    setCloseFriendsModalOpen,
    deleteMessage,
    createDirectOrGroupChat,
    updateChatTheme,
    updateChatNickname,
    addGroupMember,
    approveGroupMember,
    removeGroupMember,
    updateGroupRole,
    updateGroupSettings,
    publishNote,
    deleteMyNote,
    toggleLikeNote,
    createSticker,
    toggleFavoriteSticker,
    createBroadcastChannel,
    toggleFollowBroadcast,
    assignBroadcastRole,
    sendBroadcastMessage,
    reactBroadcastMessage,
    startCall,
    blockUser,
    unblockUser,
    uploadImageDataUrl,
    openUserProfile,
    mobileThreadOpen: mobileShowThread,
    setMobileThreadOpen: setMobileShowThread,
    showToast,
    t,
  } = useSocialVerse();

  const [chatSearch, setChatSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<
    'primary' | 'groups' | 'broadcasts' | 'archived' | 'requests'
  >('primary');
  const [draftText, setDraftText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string } | null>(null);
  const [editingMsg, setEditingMsg] = useState<{ id: string; text: string } | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<ChatMessage | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');

  // Recording with live timer
  const [isRecording, setIsRecording] = useState(false);
  const [recordElapsedSec, setRecordElapsedSec] = useState(0);

  // Modals & Drawers inside Inbox
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupBio, setGroupBio] = useState('');
  const [groupAvatarUrl, setGroupAvatarUrl] = useState('');
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [showGroupPage, setShowGroupPage] = useState(false);
  const [groupEditTitle, setGroupEditTitle] = useState('');
  const [groupEditBio, setGroupEditBio] = useState('');
  const [groupEditAvatar, setGroupEditAvatar] = useState('');
  const [groupPageMemberQuery, setGroupPageMemberQuery] = useState('');
  const [savingGroupPage, setSavingGroupPage] = useState(false);
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [showStickerDrawer, setShowStickerDrawer] = useState(false);
  const [showQuickEmojiBar, setShowQuickEmojiBar] = useState(false);
  const [stickerTab, setStickerTab] = useState<'favorites' | 'all'>('all');
  const [reactMenuMsgId, setReactMenuMsgId] = useState<string | null>(null);
  const [chatMenuOpenId, setChatMenuOpenId] = useState<string | null>(null);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [infoTab, setInfoTab] = useState<'overview' | 'customize' | 'media' | 'starred' | 'members'>(
    'overview'
  );

  // In-chat search & scroll
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatQuery, setInChatQuery] = useState('');
  const [activeMatchCursor, setActiveMatchCursor] = useState(0);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  // Notes Modal state
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [noteAudience, setNoteAudience] = useState<'followers' | 'close_friends'>('followers');
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);
  const [noteReplyText, setNoteReplyText] = useState('');

  // Chat Nickname & Theme editor state
  const [nicknameDrafts, setNicknameDrafts] = useState<Record<string, string>>({});
  const [addMemberUid, setAddMemberUid] = useState('');

  // Broadcast state
  const [activeBroadcastId, setActiveBroadcastId] = useState<string | null>(null);
  const [showCreateBroadcast, setShowCreateBroadcast] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastDesc, setBroadcastDesc] = useState('');
  const [broadcastDraft, setBroadcastDraft] = useState('');
  const [roleTargetUid, setRoleTargetUid] = useState('');
  const [roleType, setRoleType] = useState<'admin' | 'moderator' | 'collaborator'>('collaborator');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const threadScrollRef = useRef<HTMLDivElement | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Live voice recording timer
  useEffect(() => {
    if (!isRecording) {
      setRecordElapsedSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setRecordElapsedSec(Math.floor((Date.now() - recordStartRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  const pendingRequests = friendRequests.filter(
    (r) => r.status === 'pending' && r.toUid === currentUser.uid
  );

  const archivedCount = useMemo(
    () => chats.filter((c) => c.archivedByUids?.includes(currentUser.uid)).length,
    [chats, currentUser.uid]
  );

  const totalUnreadChats = useMemo(
    () =>
      chats.filter(
        (c) =>
          !c.archivedByUids?.includes(currentUser.uid) &&
          (c.unreadCount > 0 || c.unreadByUids?.includes(currentUser.uid))
      ).length,
    [chats, currentUser.uid]
  );

  const filteredChats = useMemo(() => {
    const query = chatSearch.trim().toLowerCase();
    const list = chats.filter((c) => {
      const isArchived = Boolean(c.archivedByUids?.includes(currentUser.uid));
      if (inboxFilter === 'archived') {
        if (!isArchived) return false;
      } else {
        if (isArchived) return false;
        if (inboxFilter === 'groups' && c.type !== 'group') return false;
      }
      if (!query) return true;
      const peerId = c.participantIds.find((id) => id !== currentUser.uid);
      const peer = peerId ? creators.find((u) => u.uid === peerId) : undefined;
      const hay = `${c.title} ${c.lastMessageText} ${peer?.displayName || ''} ${peer?.username || ''}`.toLowerCase();
      return hay.includes(query);
    });

    return [...list].sort((a, b) => {
      const aPinned = a.pinnedByUids?.includes(currentUser.uid) ? 1 : 0;
      const bPinned = b.pinnedByUids?.includes(currentUser.uid) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt);
    });
  }, [chats, chatSearch, inboxFilter, currentUser.uid, creators]);

  const activeChat: Chat | null =
    chats.find((c) => c.id === activeChatId) || filteredChats[0] || null;
  const activeMessages = useMemo(
    () => (activeChat ? messagesByChat[activeChat.id] || [] : []),
    [activeChat, messagesByChat]
  );

  const activeBroadcast =
    broadcastChannels.find((b) => b.id === activeBroadcastId) || broadcastChannels[0] || null;

  const otherParticipantId =
    activeChat?.type === 'direct'
      ? activeChat.participantIds.find((id) => id !== currentUser.uid)
      : undefined;
  const otherUser = otherParticipantId
    ? creators.find((c) => c.uid === otherParticipantId)
    : undefined;
  const isBlocked = otherParticipantId
    ? userPrivate.blockedUserIds.includes(otherParticipantId)
    : false;

  const activeDisplayTitle =
    activeChat?.type === 'direct' && otherParticipantId
      ? activeChat.chatNicknames?.[otherParticipantId] || otherUser?.displayName || activeChat.title
      : activeChat?.title || '';

  const activeTheme = activeChat?.theme || { presetId: 'default' };
  const matchedPreset =
    CHAT_THEME_PRESETS.find((p) => p.id === activeTheme.presetId) || CHAT_THEME_PRESETS[0];

  const availablePeers = creators.filter((c) => c.uid !== currentUser.uid && !c.isDeactivated);
  const myNote = notes.find((n) => n.authorUid === currentUser.uid);

  const activeTypingPeers = useMemo(() => {
    if (!activeChat) return [];
    const ids = typingByChat[activeChat.id] || [];
    return ids
      .filter((uid) => uid !== currentUser.uid)
      .map((uid) => activeChat.chatNicknames?.[uid] || activeChat.participantNames?.[uid] || 'Someone');
  }, [activeChat, typingByChat, currentUser.uid]);

  const pinnedMessage = useMemo(() => {
    if (!activeChat?.pinnedMessageId) return null;
    return activeMessages.find((m) => m.id === activeChat.pinnedMessageId) || null;
  }, [activeChat, activeMessages]);

  const starredMessages = useMemo(
    () => activeMessages.filter((m) => m.starredByUids?.includes(currentUser.uid)),
    [activeMessages, currentUser.uid]
  );

  const mediaMessages = useMemo(
    () =>
      activeMessages.filter(
        (m) =>
          m.type === 'image' ||
          m.type === 'video' ||
          m.type === 'file' ||
          m.type === 'reel_share'
      ),
    [activeMessages]
  );

  const searchMatches = useMemo(() => {
    const q = inChatQuery.trim().toLowerCase();
    if (!q) return [];
    return activeMessages
      .filter((m) => (m.text || m.fileName || m.sharedPostCaption || '').toLowerCase().includes(q))
      .map((m) => m.id);
  }, [activeMessages, inChatQuery]);

  // Auto-scroll to bottom on chat switch or new message when near bottom
  useEffect(() => {
    const el = threadScrollRef.current;
    if (!el || showInChatSearch) return;
    el.scrollTop = el.scrollHeight;
  }, [activeChat?.id, activeMessages.length, showInChatSearch]);

  // Clear per-chat search & menus when switching chats
  useEffect(() => {
    setShowInChatSearch(false);
    setInChatQuery('');
    setEditingMsg(null);
    setReplyingTo(null);
    setReactMenuMsgId(null);
    setShowGroupPage(false);
    setInfoTab('overview');
  }, [activeChat?.id]);

  // Keep Group Page form drafts synchronized with active group
  useEffect(() => {
    if (!activeChat || activeChat.type !== 'group') return;
    setGroupEditTitle(activeChat.title || '');
    setGroupEditBio(activeChat.bio || '');
    setGroupEditAvatar(activeChat.avatarUrl || '');
  }, [activeChat?.id, activeChat?.title, activeChat?.bio, activeChat?.avatarUrl, activeChat?.type]);

  const scrollToMessage = (messageId: string) => {
    const target = document.querySelector(`[data-msg-id="${messageId}"]`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('ring-2', 'ring-sky-400', 'rounded-3xl');
      window.setTimeout(() => {
        target.classList.remove('ring-2', 'ring-sky-400', 'rounded-3xl');
      }, 1500);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="absolute top-4 left-4 min-h-[42px] px-4 rounded-xl liquid-glass text-xs font-semibold inline-flex items-center gap-2 text-slate-800 dark:text-slate-100"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.messages.backToFeed}</span>
        </button>

        <div className="liquid-glass rounded-3xl p-8 sm:p-10 text-center space-y-4 max-w-md w-full shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-600/15 text-sky-600 flex items-center justify-center">
            <MessageCircle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.messages.chatsTitle}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t.auth.guestBannerDesc}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={() => openAuthModal()}
              className="flex-1 min-h-[44px] px-6 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors"
            >
              {t.auth.signIn} / {t.auth.register}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="min-h-[44px] px-5 rounded-xl liquid-glass-subtle text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              {t.messages.backToFeed}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setShowChatInfo(false);
    setShowGroupPage(false);
    setChatMenuOpenId(null);
    setMobileShowThread(true);
    const chosen = chats.find((c) => c.id === chatId);
    if (chosen?.unreadByUids?.includes(currentUser.uid)) {
      updateChatPreferences(chatId, { unread: false });
    }
  };

  const textPermission = activeChat
    ? canSendInGroupChat(activeChat, currentUser.uid, 'text')
    : { allowed: true };
  const mediaPermission = activeChat
    ? canSendInGroupChat(activeChat, currentUser.uid, 'image')
    : { allowed: true };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !draftText.trim() || isBlocked) return;
    if (!textPermission.allowed) {
      showToast(textPermission.reason || 'Only group admins can send messages');
      return;
    }
    if (editingMsg) {
      await editMessage(activeChat.id, editingMsg.id, draftText.trim());
      setEditingMsg(null);
      setDraftText('');
      return;
    }
    await sendMessage(activeChat.id, {
      type: 'text',
      text: draftText.trim(),
      replyToId: replyingTo?.id,
      replyPreview: replyingTo?.text,
    });
    setDraftText('');
    setReplyingTo(null);
    setShowQuickEmojiBar(false);
  };

  const handleDraftChange = (val: string) => {
    setDraftText(val);
    if (!activeChat || !val.trim()) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      sendTypingSignal(activeChat.id);
    }
  };

  const handleSendSticker = async (imageUrl: string) => {
    if (!activeChat || isBlocked) return;
    const perm = canSendInGroupChat(activeChat, currentUser.uid, 'sticker');
    if (!perm.allowed) {
      showToast(perm.reason || 'Media attachments are blocked for members');
      return;
    }
    await sendMessage(activeChat.id, {
      type: 'sticker',
      stickerUrl: imageUrl,
      replyToId: replyingTo?.id,
      replyPreview: replyingTo?.text,
    });
    setShowStickerDrawer(false);
    setReplyingTo(null);
  };

  const handleCreateStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await uploadImageDataUrl(file, 400);
      const created = await createSticker(file.name.slice(0, 24), dataUrl, 'sticker');
      if (created && activeChat && !isBlocked) {
        await handleSendSticker(created.imageUrl);
      }
    } catch {
      showToast('Could not create sticker.');
    }
  };

  const handleToggleVoiceRecord = async () => {
    if (!activeChat || isBlocked) return;
    const perm = canSendInGroupChat(activeChat, currentUser.uid, 'voice');
    if (!perm.allowed) {
      showToast(perm.reason || 'Media attachments are blocked for members');
      return;
    }
    if (!isRecording) {
      recordStartRef.current = Date.now();
      setIsRecording(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onload = () => {
            const durationMs = Math.max(1200, Date.now() - recordStartRef.current);
            sendMessage(activeChat.id, {
              type: 'voice',
              mediaUrl: String(reader.result || ''),
              durationMs,
              fileName: `voice_${Date.now()}.webm`,
            });
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach((tr) => tr.stop());
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
      } catch {
        mediaRecorderRef.current = null;
      }
    } else {
      setIsRecording(false);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        const durationMs = Math.max(1800, Date.now() - recordStartRef.current);
        await sendMessage(activeChat.id, {
          type: 'voice',
          durationMs,
          fileName: `voice_${Date.now()}.m4a`,
        });
      }
    }
  };

  const handleFileAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeChat || isBlocked) return;
    const kind = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
      ? 'video'
      : 'file';
    const perm = canSendInGroupChat(activeChat, currentUser.uid, kind);
    if (!perm.allowed) {
      showToast(perm.reason || 'Media attachments are blocked for members');
      return;
    }
    const dataUrl = await uploadImageDataUrl(file, 1080);
    await sendMessage(activeChat.id, {
      type: kind,
      mediaUrl: dataUrl,
      fileName: file.name,
      text: kind === 'file' ? file.name : undefined,
    });
  };

  const handleGroupAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode = false) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await uploadImageDataUrl(file, 480);
      if (isEditMode) {
        setGroupEditAvatar(dataUrl);
      } else {
        setGroupAvatarUrl(dataUrl);
      }
    } catch {
      showToast('Could not load group photo.');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitle.trim() || groupMembers.length === 0) return;
    const titleToCreate = groupTitle.trim();
    const bioToCreate = groupBio.trim();
    const avatarToCreate = groupAvatarUrl;
    const selectedMembers = [...groupMembers];

    // Instant UI reset & focus transition while optimistic store inserts group immediately
    setGroupTitle('');
    setGroupBio('');
    setGroupAvatarUrl('');
    setGroupMemberSearch('');
    setGroupMembers([]);
    setShowNewGroup(false);
    setInboxFilter('groups');
    setMobileShowThread(true);

    await createDirectOrGroupChat(titleToCreate, [currentUser.uid, ...selectedMembers], 'group', {
      avatarUrl: avatarToCreate || undefined,
      bio: bioToCreate || undefined,
    });
  };

  const handleThemeGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeChat) return;
    const dataUrl = await uploadImageDataUrl(file, 1280);
    await updateChatTheme(activeChat.id, {
      presetId: 'custom',
      customImageUrl: dataUrl,
      imageFit: activeTheme.imageFit || 'cover',
      imageScale: activeTheme.imageScale || 1,
      overlayOpacity: activeTheme.overlayOpacity ?? 0.25,
    });
  };

  const handleCopyMessage = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(language === 'bn' ? 'মেসেজ কপি করা হয়েছে' : 'Message copied');
    } catch {
      showToast(language === 'bn' ? 'কপি করা যায়নি' : 'Could not copy text');
    }
  };

  const handleJumpMatch = (dir: 1 | -1) => {
    if (searchMatches.length === 0) return;
    const nextIdx = (activeMatchCursor + dir + searchMatches.length) % searchMatches.length;
    setActiveMatchCursor(nextIdx);
    scrollToMessage(searchMatches[nextIdx]);
  };

  const displayedStickers =
    stickerTab === 'favorites'
      ? stickers.filter((s) => favoriteStickerIds.includes(s.id))
      : stickers;

  const isPinnedChat = Boolean(activeChat?.pinnedByUids?.includes(currentUser.uid));
  const isMutedChat = Boolean(activeChat?.mutedByUids?.includes(currentUser.uid));
  const isArchivedChat = Boolean(activeChat?.archivedByUids?.includes(currentUser.uid));
  const disappearingMode = activeChat?.disappearingMode || 'off';

  return (
    <div
      data-testid="fullscreen-inbox"
      className="h-[100dvh] w-full flex overflow-hidden relative bg-slate-50/80 dark:bg-[#050811]/95 backdrop-blur-2xl"
    >
      {/* Desktop Mini Navigation Rail */}
      <nav
        aria-label="Inbox app navigation"
        className="hidden lg:flex w-[78px] shrink-0 h-full flex-col items-center justify-between py-4 border-r border-slate-200/70 dark:border-white/[0.08] bg-white/85 dark:bg-[#070b16]/95 backdrop-blur-2xl"
      >
        <div className="flex flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            title={t.messages.backToFeed}
            aria-label={t.messages.backToFeed}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white font-display font-bold text-base flex items-center justify-center shadow-lg shadow-sky-500/25 mb-2 active:scale-95 transition-transform duration-150"
          >
            SV
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('home')}
            title={t.nav.home}
            aria-label={t.nav.home}
            className="w-12 h-12 rounded-2xl liquid-glass-btn flex items-center justify-center text-slate-600 dark:text-slate-300"
          >
            <Home className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reels')}
            title={t.nav.reels}
            aria-label={t.nav.reels}
            className="w-12 h-12 rounded-2xl liquid-glass-btn flex items-center justify-center text-slate-600 dark:text-slate-300"
          >
            <Clapperboard className="w-5 h-5" />
          </button>

          <button
            type="button"
            aria-current="page"
            title={t.nav.messages}
            aria-label={t.nav.messages}
            className="relative w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/30"
          >
            <MessageCircle className="w-5 h-5" />
            {totalUnreadChats > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">
                {totalUnreadChats}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('explore')}
            title={t.nav.explore}
            aria-label={t.nav.explore}
            className="w-12 h-12 rounded-2xl liquid-glass-btn flex items-center justify-center text-slate-600 dark:text-slate-300"
          >
            <Compass className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setSubscreen('create_sheet')}
            title={t.nav.create}
            aria-label={t.nav.create}
            className="w-12 h-12 rounded-2xl liquid-glass-btn flex items-center justify-center text-sky-600 dark:text-sky-400"
          >
            <PlusSquare className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
            title={t.settings.language}
            aria-label="Toggle language"
            className="w-12 h-11 rounded-2xl liquid-glass-btn text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center"
          >
            {language === 'en' ? 'বাং' : 'EN'}
          </button>
          <button
            type="button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={t.settings.theme}
            aria-label="Toggle theme"
            className="w-12 h-12 rounded-2xl liquid-glass-btn text-slate-700 dark:text-slate-200 flex items-center justify-center"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => setSubscreen('settings_home')}
            title={t.settings.title}
            aria-label={t.settings.title}
            className="w-12 h-12 rounded-2xl liquid-glass-btn text-slate-700 dark:text-slate-200 flex items-center justify-center"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => openUserProfile(currentUser.uid)}
            title={t.nav.profile}
            aria-label={t.nav.profile}
            className="mt-1 rounded-full ring-2 ring-sky-500/40"
          >
            <Avatar src={currentUser.photoUrl} name={currentUser.displayName} size="md" online />
          </button>
        </div>
      </nav>

      {/* Conversation List Sidebar */}
      <aside
        className={`w-full md:w-[365px] lg:w-[416px] shrink-0 h-full border-r border-slate-200/70 dark:border-white/[0.08] bg-white/85 dark:bg-[#070b16]/95 backdrop-blur-2xl flex flex-col ${
          mobileShowThread ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 sm:p-5 space-y-3.5 border-b border-slate-200/70 dark:border-white/[0.08]">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                aria-label={t.messages.backToFeed}
                onClick={() => setActiveTab('home')}
                className="lg:hidden min-h-[46px] min-w-[46px] rounded-2xl liquid-glass-btn flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                    {t.messages.chatsTitle}
                  </h1>
                  {totalUnreadChats > 0 && (
                    <span className="text-xs font-bold font-mono-num text-sky-600 dark:text-sky-400">
                      · {totalUnreadChats}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  @{currentUser.username}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                aria-label="New message"
                onClick={() => {
                  setShowNewDirect((s) => !s);
                  setShowNewGroup(false);
                }}
                className={`min-h-[44px] px-3.5 sm:px-4 rounded-2xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-all duration-150 ${
                  showNewDirect
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'liquid-glass-btn text-slate-800 dark:text-slate-200'
                }`}
              >
                <SquarePen className="w-4 h-4" />
                <span>DM</span>
              </button>
              <button
                type="button"
                aria-label={t.messages.newGroup}
                onClick={() => {
                  setShowNewGroup((s) => !s);
                  setShowNewDirect(false);
                }}
                className={`min-h-[44px] px-3.5 sm:px-4 rounded-2xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-all duration-150 ${
                  showNewGroup
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'liquid-glass-btn text-slate-800 dark:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Group</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder={t.messages.searchChats}
              aria-label={t.messages.searchChats}
              className="w-full min-h-[46px] pl-11 pr-4 rounded-2xl bg-slate-100/90 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Instagram-Style Notes Bar */}
          <div aria-label={t.messages.notesTitle} className="pt-0.5">
            <div className="flex items-end gap-3.5 overflow-x-auto no-scrollbar pb-1 pt-4 px-1.5">
              <div className="relative flex flex-col items-center shrink-0 w-[96px]">
                <button
                  type="button"
                  aria-label={myNote ? `Edit note: ${myNote.text}` : t.messages.yourNote}
                  onClick={() => {
                    setNoteInput(myNote?.text || '');
                    setNoteAudience(myNote?.audience || 'followers');
                    setShowNoteComposer(true);
                  }}
                  className="flex flex-col items-center w-full group"
                >
                  {/* Floating Thought Bubble */}
                  <div className="relative z-10 -mb-2.5 flex flex-col items-center">
                    <div
                      className={`px-3 py-2 rounded-2xl min-w-[78px] max-w-[96px] text-center shadow-md border transition-transform group-hover:scale-[1.03] ${
                        myNote?.audience === 'close_friends'
                          ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-400/70 text-emerald-950 dark:text-emerald-100'
                          : myNote
                          ? 'bg-white dark:bg-[#1a2642] border-sky-200/90 dark:border-sky-400/35 text-slate-900 dark:text-white'
                          : 'bg-white/95 dark:bg-[#152038] border-slate-200/85 dark:border-white/15 text-slate-500 dark:text-slate-300'
                      }`}
                    >
                      <p className="text-xs font-medium leading-snug line-clamp-2 break-words">
                        {myNote ? myNote.text : t.messages.noteThoughtPrompt}
                      </p>
                    </div>
                    <div className="flex flex-col items-start self-start ml-3 -mt-0.5 space-y-0.5" aria-hidden="true">
                      <span className="w-2.5 h-2.5 rounded-full bg-white dark:bg-[#1a2642] border border-slate-200/90 dark:border-white/25 shadow-xs" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#1a2642] border border-slate-200/90 dark:border-white/25 ml-1" />
                    </div>
                  </div>

                  <div className="relative">
                    <Avatar src={currentUser.photoUrl} name={currentUser.displayName} size="lg" online={false} />
                    {!myNote ? (
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-sky-600 text-white border-2 border-white dark:border-[#070b16] flex items-center justify-center shadow"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                    ) : myNote.audience === 'close_friends' ? (
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-600 text-white border-2 border-white dark:border-[#070b16] flex items-center justify-center shadow"
                      >
                        <Star className="w-2.5 h-2.5 fill-current" />
                      </span>
                    ) : null}
                  </div>
                  <span className="mt-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[84px]">
                    {t.messages.yourNote}
                  </span>
                </button>
                {myNote && (
                  <button
                    type="button"
                    aria-label="Clear my note"
                    onClick={() => deleteMyNote()}
                    className="absolute -top-2.5 -right-1.5 z-20 w-6 h-6 rounded-full bg-slate-800 hover:bg-rose-600 text-white flex items-center justify-center shadow-md ring-2 ring-white dark:ring-[#070b16] transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {notes
                .filter((n) => n.authorUid !== currentUser.uid)
                .map((note) => {
                  const liked = note.likedByUids.includes(currentUser.uid);
                  const isCfNote = note.audience === 'close_friends';
                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => {
                        setActiveNote(note);
                        setNoteReplyText('');
                      }}
                      className="flex flex-col items-center shrink-0 w-[96px] group"
                    >
                      <div className="relative z-10 -mb-2.5 flex flex-col items-center">
                        <div
                          className={`px-3 py-2 rounded-2xl min-w-[78px] max-w-[96px] shadow-md text-xs font-medium inline-flex items-center justify-center gap-1 group-hover:scale-[1.03] transition-transform border ${
                            isCfNote
                              ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-400/70 text-emerald-950 dark:text-emerald-100'
                              : 'bg-white dark:bg-[#1a2642] border-slate-200/90 dark:border-white/20 text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          <span className="line-clamp-2 leading-snug break-words text-center">{note.text}</span>
                          {liked && <Heart className="w-3 h-3 fill-rose-500 text-rose-500 shrink-0" />}
                        </div>
                        <div className="flex flex-col items-start self-start ml-3 -mt-0.5 space-y-0.5" aria-hidden="true">
                          <span className="w-2.5 h-2.5 rounded-full bg-white dark:bg-[#1a2642] border border-slate-200/90 dark:border-white/25 shadow-xs" />
                          <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#1a2642] border border-slate-200/90 dark:border-white/25 ml-1" />
                        </div>
                      </div>
                      <div className="relative">
                        <Avatar src={note.authorAvatar} name={note.authorDisplayName} size="lg" online />
                        {isCfNote && (
                          <span
                            aria-label={t.messages.closeFriends}
                            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-600 text-white border-2 border-white dark:border-[#070b16] flex items-center justify-center shadow"
                          >
                            <Star className="w-2.5 h-2.5 fill-current" />
                          </span>
                        )}
                      </div>
                      <span className="mt-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[84px]">
                        {note.authorDisplayName.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* 5 Inbox Filter Tabs */}
          <div className="flex items-center justify-between gap-0.5 overflow-x-auto no-scrollbar p-1.5 rounded-2xl bg-slate-100/90 dark:bg-white/[0.06] border border-transparent dark:border-white/[0.06]">
            {(
              [
                { id: 'primary', label: t.messages.primaryTab },
                { id: 'groups', label: t.messages.groupsTab },
                { id: 'broadcasts', label: t.messages.broadcastsTab },
                {
                  id: 'archived',
                  label: `${t.messages.archivedTab}${archivedCount > 0 ? ` (${archivedCount})` : ''}`,
                },
                {
                  id: 'requests',
                  label: `${t.messages.requestsTab}${
                    pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''
                  }`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setInboxFilter(tab.id)}
                className={`min-h-[38px] px-2.5 rounded-xl text-[11.5px] sm:text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  inboxFilter === tab.id
                    ? 'bg-white dark:bg-[#131c31] text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Start DM Panel */}
          {showNewDirect && (
            <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Start DM</p>
                <button
                  type="button"
                  aria-label="Close start DM"
                  onClick={() => setShowNewDirect(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {availablePeers.length === 0 ? (
                <p className="text-xs text-slate-500">No other accounts available yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                  {availablePeers.map((u) => (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={async () => {
                        const id = await createDirectOrGroupChat(
                          u.displayName,
                          [currentUser.uid, u.uid],
                          'direct'
                        );
                        if (id) {
                          setShowNewDirect(false);
                          setInboxFilter('primary');
                          setMobileShowThread(true);
                        }
                      }}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white/85 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-sky-600 hover:text-white transition-colors"
                    >
                      {u.displayName} (@{u.username})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create Group Panel */}
          {showNewGroup && (
            <form onSubmit={handleCreateGroup} className="p-3.5 rounded-2xl liquid-glass-subtle space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {t.messages.newGroup}
                </span>
                <button
                  type="button"
                  aria-label="Close new group form"
                  onClick={() => setShowNewGroup(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer border border-sky-500/25">
                  {groupAvatarUrl ? (
                    <img src={groupAvatarUrl} alt="Group avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    aria-label={t.messages.groupPhoto}
                    onChange={(e) => handleGroupAvatarPick(e, false)}
                    className="sr-only"
                  />
                </label>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    type="text"
                    required
                    value={groupTitle}
                    onChange={(e) => setGroupTitle(e.target.value)}
                    placeholder="Group name (max 250 members)"
                    aria-label="Group name"
                    className="w-full min-h-[38px] px-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <input
                    type="text"
                    value={groupBio}
                    onChange={(e) => setGroupBio(e.target.value)}
                    placeholder={t.messages.groupBio}
                    aria-label={t.messages.groupBio}
                    className="w-full min-h-[34px] px-3 rounded-xl bg-white/80 dark:bg-slate-900/75 border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {availablePeers.length === 0 ? (
                <p className="text-xs text-slate-500">Wait for other users to sign up first.</p>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="search"
                    value={groupMemberSearch}
                    onChange={(e) => setGroupMemberSearch(e.target.value)}
                    placeholder={t.messages.addMembers}
                    aria-label="Search members to add"
                    className="w-full min-h-[34px] px-3 rounded-xl bg-white/85 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white"
                  />
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {availablePeers
                      .filter((u) => {
                        const q = groupMemberSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          u.displayName.toLowerCase().includes(q) ||
                          u.username.toLowerCase().includes(q)
                        );
                      })
                      .map((u) => {
                        const selected = groupMembers.includes(u.uid);
                        return (
                          <button
                            key={u.uid}
                            type="button"
                            onClick={() =>
                              setGroupMembers((prev) =>
                                selected ? prev.filter((id) => id !== u.uid) : [...prev, u.uid]
                              )
                            }
                            className={`min-h-[32px] px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-colors ${
                              selected
                                ? 'bg-sky-600 text-white'
                                : 'bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {selected ? '✓ ' : ''}
                            {u.displayName}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!groupTitle.trim() || groupMembers.length === 0}
                className="w-full min-h-[44px] rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold disabled:opacity-45 transition-colors"
              >
                Create Group Chat ({groupMembers.length + 1})
              </button>
            </form>
          )}
        </div>

        {/* Conversation List Body */}
        {inboxFilter === 'requests' ? (
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60 overflow-y-auto flex-1 p-2">
            {pendingRequests.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">{t.profile.noRequests}</p>
            ) : (
              pendingRequests.map((req) => (
                <div key={req.id} className="p-3.5 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={req.fromAvatar} name={req.fromDisplayName} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {req.fromDisplayName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">@{req.fromUsername}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => respondToFriendRequest(req.id, true)}
                      className="min-h-[38px] px-3.5 rounded-xl bg-sky-600 text-white text-xs font-semibold"
                    >
                      {t.profile.accept}
                    </button>
                    <button
                      type="button"
                      onClick={() => respondToFriendRequest(req.id, false)}
                      className="min-h-[38px] px-3 rounded-xl liquid-glass-subtle text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {t.profile.reject}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : inboxFilter === 'broadcasts' ? (
          <div className="p-3 space-y-3 overflow-y-auto flex-1">
            <div className="p-3 rounded-2xl liquid-glass-subtle space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-sky-600" />
                  <span>{t.profile.broadcastChannel}</span>
                </span>
                <span className="text-[11px] font-mono-num text-slate-500">
                  {currentUser.followersCount} / {BROADCAST_MIN_FOLLOWERS}
                </span>
              </div>
              {canOpenBroadcastChannel(currentUser.followersCount) ? (
                <button
                  type="button"
                  onClick={() => setShowCreateBroadcast((v) => !v)}
                  className="w-full min-h-[36px] rounded-xl bg-sky-600 text-white text-xs font-semibold"
                >
                  + Create Broadcast Channel
                </button>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Reach {BROADCAST_MIN_FOLLOWERS} followers to open your own Broadcast Channel.
                </p>
              )}

              {showCreateBroadcast && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await createBroadcastChannel(broadcastTitle, broadcastDesc);
                    setBroadcastTitle('');
                    setBroadcastDesc('');
                    setShowCreateBroadcast(false);
                  }}
                  className="space-y-2 pt-2"
                >
                  <input
                    type="text"
                    required
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="Channel title"
                    className="w-full min-h-[36px] px-3 rounded-lg bg-white/80 dark:bg-slate-900 text-xs"
                  />
                  <input
                    type="text"
                    value={broadcastDesc}
                    onChange={(e) => setBroadcastDesc(e.target.value)}
                    placeholder="Channel description"
                    className="w-full min-h-[36px] px-3 rounded-lg bg-white/80 dark:bg-slate-900 text-xs"
                  />
                  <button
                    type="submit"
                    className="w-full min-h-[36px] rounded-lg bg-sky-600 text-white text-xs font-semibold"
                  >
                    Launch Channel
                  </button>
                </form>
              )}
            </div>

            {broadcastChannels.length === 0 ? (
              <p className="text-xs text-center text-slate-500 py-6">No broadcast channels yet.</p>
            ) : (
              broadcastChannels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setActiveBroadcastId(ch.id);
                    setMobileShowThread(true);
                  }}
                  className={`w-full p-3 rounded-2xl text-left flex items-center justify-between gap-2 ${
                    activeBroadcast?.id === ch.id
                      ? 'bg-sky-500/15'
                      : 'liquid-glass-subtle hover:bg-white/70 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {ch.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {ch.followerUids.length} members · {ch.messages.length} updates
                    </p>
                  </div>
                  <Radio className="w-4 h-4 text-sky-600 shrink-0" />
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200/50 dark:divide-white/[0.06] overflow-y-auto flex-1">
            {filteredChats.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs font-medium text-slate-500">
                  {inboxFilter === 'archived'
                    ? 'No archived conversations.'
                    : 'No conversations yet.'}
                </p>
                {inboxFilter !== 'archived' && (
                  <p className="text-[11px] text-slate-400">
                    Tap DM or Group above to start messaging.
                  </p>
                )}
              </div>
            ) : (
              filteredChats.map((chat) => {
                const active = activeChat?.id === chat.id;
                const peerId = chat.participantIds.find((id) => id !== currentUser.uid);
                const avatar = peerId ? chat.participantAvatars?.[peerId] : undefined;
                const peer = peerId ? creators.find((c) => c.uid === peerId) : undefined;
                const displayTitle =
                  chat.type === 'direct' && peerId
                    ? chat.chatNicknames?.[peerId] || peer?.displayName || chat.title
                    : chat.title;
                const pinned = Boolean(chat.pinnedByUids?.includes(currentUser.uid));
                const muted = Boolean(chat.mutedByUids?.includes(currentUser.uid));
                const archived = Boolean(chat.archivedByUids?.includes(currentUser.uid));
                const unread =
                  chat.unreadCount > 0 || Boolean(chat.unreadByUids?.includes(currentUser.uid));
                const isTyping = (typingByChat[chat.id] || []).some(
                  (uid) => uid !== currentUser.uid
                );

                return (
                  <div key={chat.id} className="relative group">
                    <div
                      className={`w-full px-4 py-3.5 flex items-center gap-3.5 transition-colors ${
                        active
                          ? 'bg-sky-500/12 dark:bg-sky-500/16'
                          : 'hover:bg-white/60 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectChat(chat.id)}
                        className="flex-1 min-w-0 flex items-center gap-3.5 text-left"
                      >
                        {chat.type === 'group' ? (
                          chat.avatarUrl ? (
                            <img
                              src={chat.avatarUrl}
                              alt={displayTitle}
                              className="w-13 h-13 rounded-full object-cover shrink-0 ring-1 ring-white/20"
                            />
                          ) : (
                            <div className="w-13 h-13 rounded-full bg-gradient-to-br from-sky-500/25 to-cyan-500/25 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                              <Users className="w-6 h-6" />
                            </div>
                          )
                        ) : (
                          <Avatar
                            src={avatar}
                            name={displayTitle}
                            size="lg"
                            online={peer?.onlineStatus === 'online'}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {pinned && <Pin className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                              <p
                                className={`text-[15px] truncate ${
                                  unread
                                    ? 'font-bold text-slate-950 dark:text-white'
                                    : 'font-semibold text-slate-900 dark:text-white'
                                }`}
                              >
                                {displayTitle}
                              </p>
                              {muted && <BellOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                              {chat.disappearingMode && chat.disappearingMode !== 'off' && (
                                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              )}
                            </div>
                            <span className="text-xs text-slate-400 shrink-0">
                              {formatRelativeTime(chat.lastMessageAt, language)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <p
                              className={`text-[13px] truncate ${
                                isTyping
                                  ? 'text-sky-600 dark:text-sky-400 font-medium italic'
                                  : unread
                                  ? 'text-slate-900 dark:text-slate-100 font-semibold'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {isTyping ? t.messages.typing : chat.lastMessageText}
                            </p>
                            {unread && (
                              <span className="w-3 h-3 rounded-full bg-sky-600 shrink-0" />
                            )}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        aria-label="Conversation options"
                        onClick={() =>
                          setChatMenuOpenId((cur) => (cur === chat.id ? null : chat.id))
                        }
                        className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/70 shrink-0"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </div>

                    {chatMenuOpenId === chat.id && (
                      <div className="mx-3.5 mb-2.5 p-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg flex flex-wrap gap-1.5 z-20">
                        <button
                          type="button"
                          onClick={() => {
                            updateChatPreferences(chat.id, { pinned: !pinned });
                            setChatMenuOpenId(null);
                          }}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1.5"
                        >
                          {pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                          <span>{pinned ? t.messages.unpinChat : t.messages.pinChat}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateChatPreferences(chat.id, { muted: !muted });
                            setChatMenuOpenId(null);
                          }}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1.5"
                        >
                          {muted ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                          <span>{muted ? t.messages.unmuteChat : t.messages.muteChat}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateChatPreferences(chat.id, { unread: !unread });
                            setChatMenuOpenId(null);
                          }}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1.5"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>{t.messages.markUnread}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateChatPreferences(chat.id, { archived: !archived });
                            setChatMenuOpenId(null);
                          }}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1.5"
                        >
                          {archived ? (
                            <ArchiveRestore className="w-3.5 h-3.5" />
                          ) : (
                            <Archive className="w-3.5 h-3.5" />
                          )}
                          <span>{archived ? t.messages.unarchiveChat : t.messages.archiveChat}</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setChatMenuOpenId(null);
                            await deleteChatFromInbox(chat.id);
                          }}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 inline-flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>
                            {chat.type === 'group' ? t.messages.deleteGroup : t.messages.deleteChat}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </aside>

      {/* Center Thread Canvas */}
      <section
        className={`flex-1 h-full min-w-0 flex-col relative overflow-hidden ${
          mobileShowThread ? 'flex' : 'hidden md:flex'
        }`}
      >
        {inboxFilter === 'broadcasts' ? (
          activeBroadcast ? (
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-3 bg-white/75 dark:bg-slate-900/75 backdrop-blur-md">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileShowThread(false)}
                    className="md:hidden min-h-[38px] min-w-[38px] rounded-full flex items-center justify-center"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-9 h-9 rounded-full bg-sky-600/15 text-sky-600 flex items-center justify-center shrink-0">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {activeBroadcast.title}
                    </h2>
                    <p className="text-[11px] text-slate-500 truncate">
                      {activeBroadcast.followerUids.length} members · Broadcast Channel
                    </p>
                  </div>
                </div>
                {activeBroadcast.ownerUid !== currentUser.uid && (
                  <button
                    type="button"
                    onClick={() => toggleFollowBroadcast(activeBroadcast.id)}
                    className="min-h-[36px] px-3 rounded-xl bg-sky-600 text-white text-xs font-semibold"
                  >
                    {activeBroadcast.followerUids.includes(currentUser.uid) ? 'Joined' : 'Join'}
                  </button>
                )}
              </div>

              {activeBroadcast.ownerUid === currentUser.uid && availablePeers.length > 0 && (
                <div className="px-4 py-2 border-b border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center gap-2 bg-slate-50/60 dark:bg-slate-900/40">
                  <span className="text-[11px] font-semibold text-slate-500">Assign Role:</span>
                  <select
                    value={roleTargetUid}
                    onChange={(e) => setRoleTargetUid(e.target.value)}
                    className="min-h-[32px] px-2 rounded-lg bg-white dark:bg-slate-800 text-xs"
                  >
                    <option value="">Select user</option>
                    {availablePeers.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        @{u.username}
                      </option>
                    ))}
                  </select>
                  <select
                    value={roleType}
                    onChange={(e) =>
                      setRoleType(e.target.value as 'admin' | 'moderator' | 'collaborator')
                    }
                    className="min-h-[32px] px-2 rounded-lg bg-white dark:bg-slate-800 text-xs"
                  >
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                    <option value="collaborator">Collaborator</option>
                  </select>
                  <button
                    type="button"
                    disabled={!roleTargetUid}
                    onClick={async () => {
                      if (!roleTargetUid) return;
                      await assignBroadcastRole(activeBroadcast.id, roleTargetUid, roleType);
                      setRoleTargetUid('');
                    }}
                    className="min-h-[32px] px-3 rounded-lg bg-sky-600 text-white text-xs font-semibold disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeBroadcast.messages.map((bm) => {
                  const liked = bm.likedByUids.includes(currentUser.uid);
                  return (
                    <div key={bm.id} className="p-3.5 rounded-2xl liquid-glass-subtle space-y-2 max-w-md">
                      <p className="text-xs font-semibold text-sky-600">{bm.senderName}</p>
                      <p className="text-sm text-slate-900 dark:text-white">{bm.text}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            reactBroadcastMessage(activeBroadcast.id, bm.id, { like: true })
                          }
                          className={`px-2.5 py-1 rounded-full text-xs inline-flex items-center gap-1 ${
                            liked
                              ? 'bg-rose-500/15 text-rose-600'
                              : 'bg-white/70 dark:bg-slate-800 text-slate-600'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
                          <span>{bm.likesCount}</span>
                        </button>
                        {['🔥', '👏', '✨'].map((em) => {
                          const cnt = (bm.reactions[em] || []).length;
                          return (
                            <button
                              key={em}
                              type="button"
                              onClick={() =>
                                reactBroadcastMessage(activeBroadcast.id, bm.id, { emoji: em })
                              }
                              className="px-2 py-0.5 rounded-full bg-white/70 dark:bg-slate-800 text-xs"
                            >
                              {em} {cnt > 0 ? cnt : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {canPostInBroadcast(activeBroadcast, currentUser.uid) ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!broadcastDraft.trim()) return;
                    await sendBroadcastMessage(activeBroadcast.id, broadcastDraft);
                    setBroadcastDraft('');
                  }}
                  className="p-3.5 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center gap-2 bg-white/75 dark:bg-slate-900/75"
                >
                  <input
                    type="text"
                    value={broadcastDraft}
                    onChange={(e) => setBroadcastDraft(e.target.value)}
                    placeholder="Send broadcast update..."
                    className="flex-1 min-h-[42px] px-4 rounded-full bg-white/90 dark:bg-slate-800 text-sm"
                  />
                  <button
                    type="submit"
                    className="min-h-[42px] px-4 rounded-full bg-sky-600 text-white text-xs font-semibold"
                  >
                    Send
                  </button>
                </form>
              ) : (
                <p className="p-3 text-center text-xs text-slate-500 border-t border-slate-200/70 dark:border-slate-800/70">
                  Only Owner, Admins, and Collaborators can send messages here. Followers can like & react.
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500 p-6 text-center">
              Select or create a Broadcast Channel (unlocks at 500 followers).
            </div>
          )
        ) : activeChat ? (
          <div className="flex flex-1 min-h-0 h-full overflow-hidden">
            {/* Active Conversation Column */}
            <div className="flex-1 flex flex-col min-w-0 h-full relative">
              {/* Thread Header */}
              <div className="relative z-20 px-4 sm:px-6 py-3.5 border-b border-slate-200/70 dark:border-white/[0.08] flex items-center justify-between gap-2.5 bg-white/85 dark:bg-[#070b16]/95 backdrop-blur-2xl">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    aria-label={t.messages.backToInbox}
                    onClick={() => setMobileShowThread(false)}
                    className="md:hidden min-h-[46px] min-w-[46px] -ml-1 rounded-full liquid-glass-btn flex items-center justify-center text-slate-700 dark:text-slate-200"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  {activeChat.type === 'group' ? (
                    activeChat.avatarUrl ? (
                      <img
                        src={activeChat.avatarUrl}
                        alt={activeDisplayTitle}
                        className="w-11 h-11 rounded-full object-cover shrink-0 ring-1 ring-white/20"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-sky-600/15 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                    )
                  ) : (
                    <Avatar
                      src={otherUser?.photoUrl}
                      name={activeDisplayTitle}
                      size="md"
                      online={otherUser?.onlineStatus === 'online'}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (activeChat.type === 'group') {
                        setShowChatInfo(false);
                        setShowGroupPage(true);
                      } else {
                        setShowChatInfo((s) => !s);
                      }
                    }}
                    className="min-w-0 text-left py-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-base sm:text-[17px] font-bold text-slate-900 dark:text-white truncate">
                        {activeDisplayTitle}
                      </h2>
                      {disappearingMode !== 'off' && (
                        <span className="text-amber-600 dark:text-amber-300 text-xs font-bold inline-flex items-center gap-0.5 shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                          {disappearingMode}
                        </span>
                      )}
                      {isMutedChat && (
                        <BellOff className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {activeTypingPeers.length > 0 ? (
                        <span className="text-sky-600 dark:text-sky-400 font-semibold">
                          {activeTypingPeers.join(', ')} {t.messages.typing}
                        </span>
                      ) : activeChat.type === 'group' ? (
                        `${activeChat.participantIds.length} / ${MAX_GROUP_MEMBERS} members · ${t.messages.groupInfo}`
                      ) : otherUser?.onlineStatus === 'online' ? (
                        `@${otherUser.username} · ${t.messages.activeNow}`
                      ) : (
                        `@${otherUser?.username || 'member'} · ${t.messages.chatInfo}`
                      )}
                    </p>
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    aria-label={t.messages.searchInChat}
                    onClick={() => {
                      setShowInChatSearch((s) => !s);
                      setInChatQuery('');
                    }}
                    className={`min-h-[46px] min-w-[46px] rounded-full flex items-center justify-center transition-all duration-150 ${
                      showInChatSearch
                        ? 'bg-sky-600 text-white'
                        : 'liquid-glass-btn text-slate-700 dark:text-slate-200 hover:text-sky-500'
                    }`}
                  >
                    <Search className="w-5 h-5" />
                  </button>
                  {otherParticipantId && (
                    <>
                      <button
                        type="button"
                        aria-label={t.messages.voiceCall}
                        onClick={() => startCall(activeChat.id, otherParticipantId, 'voice')}
                        className="min-h-[46px] min-w-[46px] rounded-full liquid-glass-btn flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-sky-500"
                      >
                        <Phone className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        aria-label={t.messages.videoCall}
                        onClick={() => startCall(activeChat.id, otherParticipantId, 'video')}
                        className="min-h-[46px] min-w-[46px] rounded-full liquid-glass-btn flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-sky-500"
                      >
                        <Video className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    aria-label={activeChat.type === 'group' ? t.messages.groupInfo : t.messages.chatInfo}
                    onClick={() => {
                      if (activeChat.type === 'group') {
                        setShowChatInfo(false);
                        setShowGroupPage((s) => !s);
                      } else {
                        setShowChatInfo((s) => !s);
                      }
                    }}
                    className={`min-h-[46px] min-w-[46px] rounded-full flex items-center justify-center transition-all duration-150 ${
                      showChatInfo || showGroupPage
                        ? 'bg-sky-600 text-white'
                        : 'liquid-glass-btn text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <Info className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Collapsible In-Chat Search Bar */}
              {showInChatSearch && (
                <div className="relative z-20 px-4 py-2 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/90 dark:bg-slate-900/90 flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="search"
                    autoFocus
                    value={inChatQuery}
                    onChange={(e) => {
                      setInChatQuery(e.target.value);
                      setActiveMatchCursor(0);
                    }}
                    placeholder={t.messages.searchInChat}
                    className="flex-1 min-h-[34px] bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                  {inChatQuery.trim() && (
                    <div className="flex items-center gap-1 text-[11px] font-mono-num text-slate-500">
                      <span>
                        {searchMatches.length === 0
                          ? '0'
                          : `${activeMatchCursor + 1}/${searchMatches.length}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleJumpMatch(-1)}
                        disabled={searchMatches.length === 0}
                        className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-40"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleJumpMatch(1)}
                        disabled={searchMatches.length === 0}
                        className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-40"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowInChatSearch(false);
                      setInChatQuery('');
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Sticky Pinned Message Banner */}
              {pinnedMessage && (
                <div className="relative z-20 px-4 py-2 border-b border-slate-200/70 dark:border-slate-800/70 bg-sky-50/90 dark:bg-sky-950/60 backdrop-blur-md flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => scrollToMessage(pinnedMessage.id)}
                    className="flex items-center gap-2 min-w-0 text-left flex-1"
                  >
                    <Pin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                        Pinned Message
                      </p>
                      <p className="text-xs text-slate-800 dark:text-slate-100 truncate">
                        {pinnedMessage.text ||
                          pinnedMessage.fileName ||
                          pinnedMessage.sharedPostCaption ||
                          'Media attachment'}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={t.messages.unpinMessage}
                    onClick={() => pinMessage(activeChat.id, null)}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Scrollable Messages Feed with Per-Chat Theme */}
              <div className={`relative flex-1 min-h-0 flex flex-col overflow-hidden ${
                  activeTheme.presetId !== 'custom' ? matchedPreset.bgClass : ''
                }`}
              >
                {activeTheme.presetId === 'custom' && activeTheme.customImageUrl && (
                  <>
                    <img
                      src={activeTheme.customImageUrl}
                      alt="Chat theme background"
                      style={{
                        transform: `scale(${activeTheme.imageScale || 1})`,
                        objectFit: activeTheme.imageFit || 'cover',
                      }}
                      className="pointer-events-none absolute inset-0 w-full h-full transition-transform"
                    />
                    <div
                      style={{ opacity: activeTheme.overlayOpacity ?? 0.25 }}
                      className="pointer-events-none absolute inset-0 bg-slate-950"
                    />
                  </>
                )}

              <div
                ref={threadScrollRef}
                onScroll={(e) => {
                  const target = e.currentTarget;
                  const distFromBottom =
                    target.scrollHeight - target.scrollTop - target.clientHeight;
                  setShowScrollBottomBtn(distFromBottom > 180);
                }}
                className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-5 space-y-3"
              >
                <div className="space-y-3 max-w-4xl mx-auto">
                  {activeMessages.length === 0 ? (
                    <div className="py-16 text-center space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-600/15 text-sky-600 flex items-center justify-center">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Say hello to {activeDisplayTitle}
                      </p>
                      <p className="text-xs text-slate-500">
                        Messages, voice notes, stickers, reels, and files stay synced live.
                      </p>
                    </div>
                  ) : (
                    activeMessages.map((msg, idx) => {
                      const mine = msg.senderId === currentUser.uid;
                      const isLastMsg = idx === activeMessages.length - 1;
                      const prevMsg = idx > 0 ? activeMessages[idx - 1] : null;
                      const showDateDivider =
                        !prevMsg || getDayKey(prevMsg.createdAt) !== getDayKey(msg.createdAt);
                      const reactionEntries = Object.entries(msg.reactions || {}).filter(
                        ([, list]) => Array.isArray(list) && list.length > 0
                      );
                      const displaySender =
                        activeChat.chatNicknames?.[msg.senderId] || msg.senderName;
                      const isStarred = Boolean(msg.starredByUids?.includes(currentUser.uid));
                      const isPinnedMsg = activeChat.pinnedMessageId === msg.id;
                      const isSearchMatch =
                        inChatQuery.trim().length > 0 && searchMatches.includes(msg.id);

                      return (
                        <div key={msg.id} data-msg-id={msg.id} className="space-y-3">
                          {showDateDivider && (
                            <div className="flex justify-center my-2">
                              <span className="px-3 py-1 rounded-full bg-white/80 dark:bg-slate-800/85 border border-slate-200/70 dark:border-slate-700/70 text-[10px] font-semibold text-slate-500 dark:text-slate-300 shadow-sm">
                                {formatDateDivider(msg.createdAt, language)}
                              </span>
                            </div>
                          )}

                          <div
                            onDoubleClick={() => reactToMessage(activeChat.id, msg.id, '❤️')}
                            className={`flex flex-col ${mine ? 'items-end' : 'items-start'} group`}
                          >
                            <div
                              className={`max-w-[84%] sm:max-w-[72%] rounded-3xl px-4.5 py-3 space-y-1.5 shadow-sm transition-all ${
                                isSearchMatch ? 'ring-2 ring-amber-400' : ''
                              } ${
                                msg.type === 'sticker'
                                  ? 'bg-transparent shadow-none p-1'
                                  : mine
                                  ? `${matchedPreset.bubbleMine} rounded-br-md`
                                  : 'bg-white/95 dark:bg-[#11192e]/95 text-slate-900 dark:text-slate-100 border border-slate-200/70 dark:border-white/[0.08] rounded-bl-md'
                              }`}
                            >
                              {msg.forwarded && (
                                <p className="text-[11px] italic opacity-75 inline-flex items-center gap-1">
                                  <CornerUpRight className="w-3.5 h-3.5" />
                                  <span>{t.messages.forwardedLabel}</span>
                                </p>
                              )}

                              {activeChat.type === 'group' && !mine && (
                                <p className="text-xs font-semibold opacity-80">
                                  {displaySender}
                                </p>
                              )}

                              {msg.replyPreview && (
                                <button
                                  type="button"
                                  onClick={() => msg.replyToId && scrollToMessage(msg.replyToId)}
                                  className="w-full text-left px-3 py-2 rounded-xl bg-black/15 dark:bg-white/15 border-l-2 border-white/70 text-xs opacity-90 truncate"
                                >
                                  {msg.replyPreview}
                                </button>
                              )}

                              {msg.type === 'sticker' && msg.stickerUrl && (
                                <div className="relative inline-block">
                                  <img
                                    src={msg.stickerUrl}
                                    alt="Sticker"
                                    className="w-36 h-36 rounded-2xl object-cover shadow-md"
                                  />
                                  <button
                                    type="button"
                                    aria-label={t.messages.saveSticker}
                                    onClick={() =>
                                      toggleFavoriteSticker(
                                        `inline_${msg.id}`,
                                        msg.stickerUrl,
                                        'Saved Sticker'
                                      )
                                    }
                                    className="mt-1.5 min-h-[30px] px-3 py-1 rounded-full bg-black/65 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                                  >
                                    <Bookmark className="w-3.5 h-3.5" />
                                    <span>{t.messages.saveSticker}</span>
                                  </button>
                                </div>
                              )}

                              {msg.type === 'reel_share' && (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('reels')}
                                  className="rounded-2xl overflow-hidden bg-black/20 border border-white/15 w-56 space-y-1.5 p-2.5 text-left hover:opacity-95"
                                >
                                  {msg.sharedPostThumb && (
                                    <img
                                      src={msg.sharedPostThumb}
                                      alt="Shared reel"
                                      className="w-full h-36 object-cover rounded-xl"
                                    />
                                  )}
                                  <p className="text-xs font-semibold truncate flex items-center gap-1.5">
                                    <Clapperboard className="w-3.5 h-3.5 shrink-0" />
                                    <span>Reel by @{msg.sharedPostAuthor || 'creator'}</span>
                                  </p>
                                  {msg.sharedPostCaption && (
                                    <p className="text-xs opacity-85 line-clamp-2">
                                      {msg.sharedPostCaption}
                                    </p>
                                  )}
                                </button>
                              )}

                              {msg.type === 'image' && msg.mediaUrl && (
                                <img
                                  src={msg.mediaUrl}
                                  alt={msg.text || 'Attachment'}
                                  referrerPolicy="no-referrer"
                                  className="rounded-2xl max-h-72 object-cover"
                                />
                              )}

                              {msg.type === 'video' && msg.mediaUrl && (
                                <video src={msg.mediaUrl} controls className="rounded-2xl max-h-72" />
                              )}

                              {msg.type === 'voice' && (
                                <div className="flex items-center gap-3 py-0.5">
                                  {msg.mediaUrl ? (
                                    <audio
                                      controls
                                      src={msg.mediaUrl}
                                      className="h-9 max-w-[225px]"
                                    />
                                  ) : (
                                    <div className="inline-flex items-center gap-2 text-sm font-medium">
                                      <Play className="w-4 h-4 fill-current" />
                                      <span className="font-mono-num">
                                        0:
                                        {String(Math.round((msg.durationMs || 3000) / 1000)).padStart(
                                          2,
                                          '0'
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  {msg.mediaUrl && (
                                    <a
                                      href={msg.mediaUrl}
                                      download={msg.fileName || 'voice-note.webm'}
                                      aria-label="Download voice message"
                                      className="p-2 rounded-lg bg-black/15 hover:bg-black/25"
                                    >
                                      <Download className="w-4 h-4" />
                                    </a>
                                  )}
                                </div>
                              )}

                              {msg.type === 'file' && (
                                <a
                                  href={msg.mediaUrl || '#'}
                                  download={msg.fileName || 'attachment'}
                                  className="inline-flex items-center gap-2 text-sm underline font-medium"
                                >
                                  <FileText className="w-4 h-4 shrink-0" />
                                  <span className="truncate">{msg.fileName || 'Attachment'}</span>
                                </a>
                              )}

                              {msg.text && msg.type !== 'reel_share' && msg.type !== 'file' && (
                                <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                  {msg.text}
                                </p>
                              )}

                              <div className="flex items-center justify-end gap-1.5 text-[11px] opacity-75 pt-0.5">
                                {isPinnedMsg && <Pin className="w-3 h-3" />}
                                {isStarred && <Star className="w-3 h-3 fill-amber-400 text-amber-400" />}
                                {msg.editedAt && <span>{t.messages.editedLabel} ·</span>}
                                <span>{formatRelativeTime(msg.createdAt, language)}</span>
                                {mine && isLastMsg && <CheckCheck className="w-3.5 h-3.5" />}
                              </div>
                            </div>

                            {/* Reactions + Action Toolbar */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 px-1 relative">
                              {reactionEntries.map(([emoji, users]) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  title="Click to toggle reaction"
                                  onClick={() => reactToMessage(activeChat.id, msg.id, emoji)}
                                  className="min-h-[30px] px-2.5 py-0.5 rounded-full bg-white/95 dark:bg-slate-800/95 text-xs border border-slate-200 dark:border-slate-700 shadow-sm"
                                >
                                  {emoji} {users.length}
                                </button>
                              ))}

                              <div className="inline-flex items-center gap-0.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  aria-label="React to message"
                                  title="React"
                                  onClick={() =>
                                    setReactMenuMsgId((cur) => (cur === msg.id ? null : msg.id))
                                  }
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white/80 dark:hover:bg-slate-800"
                                >
                                  <Smile className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Reply to message"
                                  title="Reply"
                                  onClick={() => {
                                    setEditingMsg(null);
                                    setReplyingTo({
                                      id: msg.id,
                                      text: msg.text || msg.fileName || 'Sticker / Media',
                                    });
                                  }}
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-800"
                                >
                                  <Reply className="w-4 h-4" />
                                </button>
                                {msg.text && (
                                  <button
                                    type="button"
                                    aria-label={t.messages.copyMessage}
                                    title={t.messages.copyMessage}
                                    onClick={() => handleCopyMessage(msg.text)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-800"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  aria-label={
                                    isStarred ? t.messages.unstarMessage : t.messages.starMessage
                                  }
                                  title={
                                    isStarred ? t.messages.unstarMessage : t.messages.starMessage
                                  }
                                  onClick={() => starMessage(activeChat.id, msg.id)}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/80 dark:hover:bg-slate-800 ${
                                    isStarred ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'
                                  }`}
                                >
                                  <Star className={`w-4 h-4 ${isStarred ? 'fill-current' : ''}`} />
                                </button>
                                <button
                                  type="button"
                                  aria-label={
                                    isPinnedMsg ? t.messages.unpinMessage : t.messages.pinMessage
                                  }
                                  title={
                                    isPinnedMsg ? t.messages.unpinMessage : t.messages.pinMessage
                                  }
                                  onClick={() =>
                                    pinMessage(activeChat.id, isPinnedMsg ? null : msg.id)
                                  }
                                  className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/80 dark:hover:bg-slate-800 ${
                                    isPinnedMsg ? 'text-sky-600' : 'text-slate-400 hover:text-sky-600'
                                  }`}
                                >
                                  <Pin className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={t.messages.forwardMessage}
                                  title={t.messages.forwardMessage}
                                  onClick={() => {
                                    setForwardingMsg(msg);
                                    setForwardSearch('');
                                  }}
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-sky-600 hover:bg-white/80 dark:hover:bg-slate-800"
                                >
                                  <CornerUpRight className="w-4 h-4" />
                                </button>
                                {mine && msg.type === 'text' && (
                                  <button
                                    type="button"
                                    aria-label={t.messages.editMessage}
                                    title={t.messages.editMessage}
                                    onClick={() => {
                                      setReplyingTo(null);
                                      setEditingMsg({ id: msg.id, text: msg.text || '' });
                                      setDraftText(msg.text || '');
                                    }}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-sky-600 hover:bg-white/80 dark:hover:bg-slate-800"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                )}
                                {mine && (
                                  <button
                                    type="button"
                                    aria-label={t.messages.deleteMessage}
                                    title={t.messages.deleteMessage}
                                    onClick={() => deleteMessage(activeChat.id, msg.id)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white/80 dark:hover:bg-slate-800"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>

                              {reactMenuMsgId === msg.id && (
                                <div className="flex items-center gap-1 p-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg z-20">
                                  {QUICK_REACTIONS.map((em) => (
                                    <button
                                      key={em}
                                      type="button"
                                      onClick={() => {
                                        reactToMessage(activeChat.id, msg.id, em);
                                        setReactMenuMsgId(null);
                                      }}
                                      className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-base flex items-center justify-center"
                                    >
                                      {em}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Live Typing Bubble */}
                  {activeTypingPeers.length > 0 && (
                    <div className="flex items-start">
                      <div className="px-4 py-2.5 rounded-3xl rounded-bl-md bg-white/95 dark:bg-slate-800/95 border border-slate-200/70 dark:border-slate-700/70 inline-flex items-center gap-1.5 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" />
                        <span
                          className="w-2 h-2 rounded-full bg-sky-500 animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <span
                          className="w-2 h-2 rounded-full bg-sky-500 animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </div>

              {/* Scroll-to-Bottom Button */}
              {showScrollBottomBtn && (
                <button
                  type="button"
                  aria-label="Scroll to latest message"
                  onClick={() => {
                    if (threadScrollRef.current) {
                      threadScrollRef.current.scrollTo({
                        top: threadScrollRef.current.scrollHeight,
                        behavior: 'smooth',
                      });
                    }
                  }}
                  className="absolute bottom-24 right-5 z-20 w-11 h-11 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-sky-600"
                >
                  <ArrowDown className="w-5 h-5" />
                </button>
              )}

              {/* Quick Emoji Bar */}
              {showQuickEmojiBar && (
                <div className="relative z-20 px-4 py-2.5 border-t border-slate-200/70 dark:border-slate-800/70 bg-white/95 dark:bg-slate-900/95 flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {QUICK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setDraftText((prev) => `${prev}${em}`)}
                      className="w-11 h-11 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-xl flex items-center justify-center shrink-0"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}

              {/* Sticker Drawer */}
              {showStickerDrawer && (
                <div className="relative z-20 p-3.5 border-t border-slate-200/70 dark:border-slate-800/70 bg-white/95 dark:bg-slate-900/95 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => setStickerTab('all')}
                        className={`min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-semibold ${
                          stickerTab === 'all'
                            ? 'bg-white dark:bg-slate-900 shadow-sm'
                            : 'text-slate-500'
                        }`}
                      >
                        {t.messages.stickers}
                      </button>
                      <button
                        type="button"
                        onClick={() => setStickerTab('favorites')}
                        className={`min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-semibold ${
                          stickerTab === 'favorites'
                            ? 'bg-white dark:bg-slate-900 shadow-sm'
                            : 'text-slate-500'
                        }`}
                      >
                        {t.messages.savedStickers} ({favoriteStickerIds.length})
                      </button>
                    </div>
                    <label className="min-h-[38px] px-3.5 rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                      <Plus className="w-4 h-4" />
                      <span>{t.messages.createSticker}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCreateStickerUpload}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {displayedStickers.length === 0 ? (
                    <p className="text-xs text-center text-slate-500 py-4">
                      No saved stickers yet. Create one or save any sticker you receive!
                    </p>
                  ) : (
                    <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 max-h-36 overflow-y-auto">
                      {displayedStickers.map((stk) => (
                        <div key={stk.id} className="relative group">
                          <button
                            type="button"
                            onClick={() => handleSendSticker(stk.imageUrl)}
                            className="w-full rounded-xl overflow-hidden aspect-square border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform"
                          >
                            <img
                              src={stk.imageUrl}
                              alt={stk.label}
                              className="w-full h-full object-cover"
                            />
                          </button>
                          <button
                            type="button"
                            aria-label="Favorite sticker"
                            onClick={() => toggleFavoriteSticker(stk.id)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-90"
                          >
                            <Bookmark
                              className={`w-3.5 h-3.5 ${
                                favoriteStickerIds.includes(stk.id)
                                  ? 'fill-amber-400 text-amber-400'
                                  : ''
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Composer */}
              <div className="relative z-20 p-3 sm:p-4 border-t border-slate-200/70 dark:border-white/[0.08] space-y-2 bg-white/85 dark:bg-[#070b16]/95 backdrop-blur-2xl">
                {replyingTo && (
                  <div className="flex items-center justify-between text-xs text-sky-700 dark:text-sky-300 px-3.5 py-2 rounded-xl bg-sky-500/10">
                    <span className="truncate">
                      {t.messages.replyingTo}: {replyingTo.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="underline ml-2 font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {editingMsg && (
                  <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 px-3.5 py-2 rounded-xl bg-amber-500/12">
                    <span className="truncate inline-flex items-center gap-1.5">
                      <Pencil className="w-4 h-4" />
                      <span>
                        {t.messages.editMessage}: {editingMsg.text}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMsg(null);
                        setDraftText('');
                      }}
                      className="underline ml-2 font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {isRecording && (
                  <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                      <span>Recording voice message...</span>
                    </span>
                    <span className="font-mono-num">
                      {String(Math.floor(recordElapsedSec / 60)).padStart(2, '0')}:
                      {String(recordElapsedSec % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}

                {isBlocked ? (
                  <p className="text-xs text-center text-rose-600 py-2">
                    You blocked this user. Unblock to send messages.
                  </p>
                ) : !textPermission.allowed ? (
                  <p
                    role="status"
                    className="text-xs text-center text-amber-600 dark:text-amber-300 font-semibold py-2.5 px-3 rounded-2xl bg-amber-500/10 border border-amber-500/20"
                  >
                    {textPermission.reason || 'Only group admins can send messages'}
                  </p>
                ) : (
                  <form
                    onSubmit={handleSendText}
                    className="flex items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 rounded-full bg-white/95 dark:bg-[#0e1526]/95 border border-slate-200/90 dark:border-white/[0.08] shadow-sm w-full min-w-0"
                  >
                    {mediaPermission.allowed && (
                      <button
                        type="button"
                        aria-label={isRecording ? t.messages.stopRecording : t.messages.recordVoice}
                        onClick={handleToggleVoiceRecord}
                        className={`min-h-[44px] min-w-[44px] shrink-0 rounded-full flex items-center justify-center transition-colors ${
                          isRecording
                            ? 'bg-rose-600 text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>
                    )}

                    <button
                      type="button"
                      aria-label="Quick emojis"
                      onClick={() => {
                        setShowQuickEmojiBar((s) => !s);
                        setShowStickerDrawer(false);
                      }}
                      className={`min-h-[44px] min-w-[44px] shrink-0 rounded-full flex items-center justify-center ${
                        showQuickEmojiBar
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Smile className="w-5 h-5" />
                    </button>

                    <input
                      type="text"
                      value={draftText}
                      onChange={(e) => handleDraftChange(e.target.value)}
                      placeholder={t.messages.typeMessage}
                      aria-label={t.messages.typeMessage}
                      className="flex-1 min-w-0 w-full min-h-[44px] px-2.5 bg-transparent text-[15px] text-slate-900 dark:text-white focus:outline-none"
                    />

                    {mediaPermission.allowed && (
                      <>
                        <button
                          type="button"
                          aria-label={t.messages.stickers}
                          onClick={() => {
                            setShowStickerDrawer((s) => !s);
                            setShowQuickEmojiBar(false);
                          }}
                          className={`min-h-[44px] min-w-[44px] shrink-0 rounded-full flex items-center justify-center ${
                            showStickerDrawer
                              ? 'bg-sky-600 text-white'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Sparkles className="w-5 h-5" />
                        </button>

                        <label
                          aria-label="Attach image, video, or file"
                          className="min-h-[44px] min-w-[44px] shrink-0 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Paperclip className="w-5 h-5" />
                          <input
                            type="file"
                            accept="image/*,video/*,*/*"
                            onChange={handleFileAttachment}
                            className="sr-only"
                          />
                        </label>
                      </>
                    )}

                    <button
                      type="submit"
                      aria-label={editingMsg ? 'Save edit' : 'Send message'}
                      className="min-h-[44px] px-4 sm:px-5 shrink-0 rounded-full bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center gap-1.5 text-sm font-semibold transition-colors"
                    >
                      {editingMsg ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                      <span className="hidden sm:inline">{editingMsg ? 'Save' : 'Send'}</span>
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Right Docked Details Drawer (Side pane on xl, overlay drawer on < xl) */}
            {showChatInfo && (
              <aside className="absolute inset-0 xl:static xl:w-[360px] shrink-0 z-30 border-l border-slate-200/70 dark:border-white/[0.08] bg-white/95 dark:bg-[#070b16]/98 backdrop-blur-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t.messages.chatInfo}
                  </h3>
                  <button
                    type="button"
                    aria-label="Close chat details"
                    onClick={() => setShowChatInfo(false)}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Tabs */}
                <div className="px-3.5 pt-3 flex flex-wrap items-center gap-1.5 border-b border-slate-200/70 dark:border-slate-800/70 pb-3">
                  {(
                    [
                      { id: 'overview', label: 'Overview' },
                      { id: 'customize', label: t.messages.themes },
                      { id: 'media', label: `${t.messages.mediaAndFiles} (${mediaMessages.length})` },
                      {
                        id: 'starred',
                        label: `${t.messages.starredMessages} (${starredMessages.length})`,
                      },
                      ...(activeChat.type === 'group'
                        ? [{ id: 'members' as const, label: `Members (${activeChat.participantIds.length})` }]
                        : []),
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setInfoTab(tab.id)}
                      className={`min-h-[34px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 ${
                        infoTab === tab.id
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {infoTab === 'overview' && (
                    <>
                      {/* Identity summary */}
                      <div className="p-4 rounded-2xl liquid-glass-subtle flex flex-col items-center text-center gap-2">
                        {activeChat.type === 'group' ? (
                          <div className="w-16 h-16 rounded-full bg-sky-600/15 text-sky-600 flex items-center justify-center">
                            <Users className="w-7 h-7" />
                          </div>
                        ) : (
                          <Avatar
                            src={otherUser?.photoUrl}
                            name={activeDisplayTitle}
                            size="lg"
                            online={otherUser?.onlineStatus === 'online'}
                          />
                        )}
                        <p className="text-base font-bold text-slate-900 dark:text-white">
                          {activeDisplayTitle}
                        </p>
                        {otherUser && (
                          <p className="text-xs text-slate-500">@{otherUser.username}</p>
                        )}
                        {otherParticipantId && (
                          <button
                            type="button"
                            onClick={() => openUserProfile(otherParticipantId)}
                            className="mt-1 min-h-[40px] px-5 rounded-xl bg-sky-600 text-white text-xs font-semibold"
                          >
                            View Profile
                          </button>
                        )}
                      </div>

                      {/* Quick Conversation Controls */}
                      <div className="p-3 rounded-2xl liquid-glass-subtle space-y-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateChatPreferences(activeChat.id, { pinned: !isPinnedChat })
                          }
                          className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800"
                        >
                          <span className="inline-flex items-center gap-2.5">
                            <Pin className="w-4 h-4 text-sky-600" />
                            <span>
                              {isPinnedChat ? t.messages.unpinChat : t.messages.pinChat}
                            </span>
                          </span>
                          <span className="text-xs text-slate-500">
                            {isPinnedChat ? 'On' : 'Off'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateChatPreferences(activeChat.id, { muted: !isMutedChat })
                          }
                          className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800"
                        >
                          <span className="inline-flex items-center gap-2.5">
                            {isMutedChat ? (
                              <BellOff className="w-4 h-4 text-amber-500" />
                            ) : (
                              <Bell className="w-4 h-4 text-sky-600" />
                            )}
                            <span>
                              {isMutedChat ? t.messages.unmuteChat : t.messages.muteChat}
                            </span>
                          </span>
                          <span className="text-xs text-slate-500">
                            {isMutedChat ? 'Muted' : 'Active'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateChatPreferences(activeChat.id, { archived: !isArchivedChat })
                          }
                          className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800"
                        >
                          <span className="inline-flex items-center gap-2.5">
                            <Archive className="w-4 h-4 text-sky-600" />
                            <span>
                              {isArchivedChat ? t.messages.unarchiveChat : t.messages.archiveChat}
                            </span>
                          </span>
                        </button>
                      </div>

                      {/* Disappearing Messages Timer */}
                      <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                          <Clock className="w-4 h-4 text-amber-500" />
                          <span>{t.messages.disappearing}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['off', '24h', '7d'] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() =>
                                updateChatPreferences(activeChat.id, { disappearingMode: mode })
                              }
                              className={`min-h-[34px] rounded-xl text-xs font-semibold uppercase ${
                                disappearingMode === mode
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          setShowChatInfo(false);
                          await deleteChatFromInbox(activeChat.id);
                        }}
                        className="w-full min-h-[42px] px-3.5 rounded-xl bg-rose-500/12 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>
                          {activeChat.type === 'group'
                            ? t.messages.deleteGroup
                            : t.messages.deleteChat}
                        </span>
                      </button>

                      {otherParticipantId && (
                        <button
                          type="button"
                          onClick={() =>
                            isBlocked ? unblockUser(otherParticipantId) : blockUser(otherParticipantId)
                          }
                          className="w-full min-h-[40px] px-3.5 rounded-xl bg-rose-500/10 text-rose-600 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>{isBlocked ? t.messages.unblockUser : t.messages.blockUser}</span>
                        </button>
                      )}
                    </>
                  )}

                  {infoTab === 'customize' && (
                    <>
                      {/* Themes & Gallery Wallpaper */}
                      <div className="p-4 rounded-2xl liquid-glass-subtle space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                            <Palette className="w-4 h-4 text-sky-600" />
                            <span>{t.messages.themes}</span>
                          </span>
                          <label className="min-h-[32px] px-2.5 rounded-xl bg-sky-600 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>{t.messages.uploadTheme}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleThemeGalleryUpload}
                              className="sr-only"
                            />
                          </label>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {CHAT_THEME_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() =>
                                updateChatTheme(activeChat.id, { presetId: preset.id })
                              }
                              className={`p-2 rounded-xl border text-center space-y-1 ${
                                activeTheme.presetId === preset.id
                                  ? 'border-sky-600 bg-sky-500/10'
                                  : 'border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <div
                                className={`w-7 h-7 mx-auto rounded-full bg-gradient-to-br ${preset.previewSwatch}`}
                              />
                              <span className="block text-[10px] font-medium truncate">
                                {language === 'bn' ? preset.nameBn : preset.name}
                              </span>
                            </button>
                          ))}
                        </div>

                        {activeTheme.presetId === 'custom' && activeTheme.customImageUrl && (
                          <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/70 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium">Image Fit</span>
                              <div className="inline-flex gap-1">
                                {(['cover', 'contain'] as const).map((fit) => (
                                  <button
                                    key={fit}
                                    type="button"
                                    onClick={() =>
                                      updateChatTheme(activeChat.id, {
                                        ...activeTheme,
                                        imageFit: fit,
                                      })
                                    }
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize ${
                                      (activeTheme.imageFit || 'cover') === fit
                                        ? 'bg-sky-600 text-white'
                                        : 'bg-slate-200 dark:bg-slate-800'
                                    }`}
                                  >
                                    {fit}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <label className="block text-xs">
                              <span>Zoom ({(activeTheme.imageScale || 1).toFixed(1)}x)</span>
                              <input
                                type="range"
                                min="1"
                                max="2"
                                step="0.1"
                                value={activeTheme.imageScale || 1}
                                onChange={(e) =>
                                  updateChatTheme(activeChat.id, {
                                    ...activeTheme,
                                    imageScale: Number(e.target.value),
                                  })
                                }
                                className="w-full"
                              />
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Nicknames Editor */}
                      <div className="p-4 rounded-2xl liquid-glass-subtle space-y-2.5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {t.messages.chatNicknames}
                        </h4>
                        {activeChat.participantIds.map((pUid) => {
                          const defaultName = activeChat.participantNames?.[pUid] || pUid;
                          const currentNick =
                            nicknameDrafts[pUid] ?? activeChat.chatNicknames?.[pUid] ?? '';
                          return (
                            <div key={pUid} className="flex items-center gap-2">
                              <span className="text-xs w-24 truncate text-slate-600 dark:text-slate-300">
                                {defaultName}
                              </span>
                              <input
                                type="text"
                                value={currentNick}
                                onChange={(e) =>
                                  setNicknameDrafts((prev) => ({ ...prev, [pUid]: e.target.value }))
                                }
                                placeholder="Nickname"
                                className="flex-1 min-h-[34px] px-2.5 rounded-lg bg-white/80 dark:bg-slate-900 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateChatNickname(activeChat.id, pUid, currentNick)
                                }
                                className="min-h-[34px] px-2.5 rounded-lg bg-sky-600 text-white text-xs font-semibold"
                              >
                                Save
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {infoTab === 'media' && (
                    <div className="space-y-3">
                      {mediaMessages.length === 0 ? (
                        <p className="text-xs text-center text-slate-500 py-8">
                          No shared photos, videos, reels, or files in this chat yet.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {mediaMessages.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setShowChatInfo(false);
                                scrollToMessage(m.id);
                              }}
                              className="rounded-xl overflow-hidden liquid-glass-subtle border border-slate-200/70 dark:border-slate-800/70 text-left"
                            >
                              {m.type === 'image' && m.mediaUrl ? (
                                <img
                                  src={m.mediaUrl}
                                  alt={m.fileName || 'Shared'}
                                  className="w-full h-24 object-cover"
                                />
                              ) : m.type === 'reel_share' && m.sharedPostThumb ? (
                                <img
                                  src={m.sharedPostThumb}
                                  alt="Reel"
                                  className="w-full h-24 object-cover"
                                />
                              ) : (
                                <div className="h-24 p-2.5 flex flex-col justify-between bg-slate-100 dark:bg-slate-900">
                                  <FileText className="w-5 h-5 text-sky-600" />
                                  <p className="text-[11px] font-medium truncate">
                                    {m.fileName || m.type}
                                  </p>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {infoTab === 'starred' && (
                    <div className="space-y-2.5">
                      {starredMessages.length === 0 ? (
                        <p className="text-xs text-center text-slate-500 py-8">
                          Star important messages to keep them handy here.
                        </p>
                      ) : (
                        starredMessages.map((m) => (
                          <div
                            key={m.id}
                            className="p-3 rounded-2xl liquid-glass-subtle space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {m.senderName}
                              </span>
                              <span>{formatRelativeTime(m.createdAt, language)}</span>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-200 line-clamp-3">
                              {m.text || m.fileName || 'Media attachment'}
                            </p>
                            <div className="flex items-center justify-between pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowChatInfo(false);
                                  scrollToMessage(m.id);
                                }}
                                className="text-[11px] font-semibold text-sky-600"
                              >
                                Jump to message
                              </button>
                              <button
                                type="button"
                                onClick={() => starMessage(activeChat.id, m.id)}
                                className="text-[11px] text-slate-400 hover:text-rose-500"
                              >
                                {t.messages.unstarMessage}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {infoTab === 'members' && activeChat.type === 'group' && (
                    <div className="p-3.5 rounded-2xl liquid-glass-subtle space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Group Members ({activeChat.participantIds.length} / {MAX_GROUP_MEMBERS})
                        </h4>
                        {isGroupAdmin(activeChat, currentUser.uid) && (
                          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(activeChat.requireAddApproval)}
                              onChange={(e) =>
                                updateGroupSettings(activeChat.id, {
                                  requireAddApproval: e.target.checked,
                                })
                              }
                              className="rounded text-sky-600"
                            />
                            <span>Approval</span>
                          </label>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={addMemberUid}
                          onChange={(e) => setAddMemberUid(e.target.value)}
                          className="flex-1 min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-slate-900 text-xs"
                        >
                          <option value="">Add member...</option>
                          {availablePeers
                            .filter((u) => !activeChat.participantIds.includes(u.uid))
                            .map((u) => (
                              <option key={u.uid} value={u.uid}>
                                {u.displayName} (@{u.username})
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          disabled={!addMemberUid}
                          onClick={async () => {
                            if (!addMemberUid) return;
                            const status = await addGroupMember(activeChat.id, addMemberUid);
                            showToast(
                              status === 'pending_approval'
                                ? 'Member request sent to admins'
                                : 'Member added'
                            );
                            setAddMemberUid('');
                          }}
                          className="min-h-[36px] px-3 rounded-lg bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-40"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>

                      {isGroupAdmin(activeChat, currentUser.uid) &&
                        (activeChat.pendingMemberIds?.length || 0) > 0 && (
                          <div className="p-2.5 rounded-xl bg-amber-500/10 space-y-2">
                            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                              Pending Member Approvals
                            </p>
                            {activeChat.pendingMemberIds!.map((pUid) => {
                              const u = creators.find((c) => c.uid === pUid);
                              return (
                                <div
                                  key={pUid}
                                  className="flex items-center justify-between gap-2 text-xs"
                                >
                                  <span>{u ? `@${u.username}` : pUid}</span>
                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => approveGroupMember(activeChat.id, pUid, true)}
                                      className="px-2.5 py-1 rounded-lg bg-sky-600 text-white font-semibold"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => approveGroupMember(activeChat.id, pUid, false)}
                                      className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                      <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                        {activeChat.participantIds.map((pUid) => {
                          const owner = isGroupOwner(activeChat, pUid);
                          const admin = isGroupAdmin(activeChat, pUid);
                          const canRemove = canRemoveGroupMember(
                            activeChat,
                            currentUser.uid,
                            pUid
                          );
                          const iAmOwner = isGroupOwner(activeChat, currentUser.uid);
                          const iAmAdmin = isGroupAdmin(activeChat, currentUser.uid);

                          return (
                            <div
                              key={pUid}
                              className="py-2 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                  {activeChat.participantNames?.[pUid] || pUid}
                                </p>
                                <p className="text-[10px] text-slate-500 inline-flex items-center gap-1">
                                  {owner ? (
                                    <>
                                      <Crown className="w-3 h-3 text-amber-500" />
                                      <span>Owner</span>
                                    </>
                                  ) : admin ? (
                                    <>
                                      <Shield className="w-3 h-3 text-sky-600" />
                                      <span>Admin</span>
                                    </>
                                  ) : (
                                    <span>Member</span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                {iAmAdmin && !admin && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateGroupRole(activeChat.id, pUid, 'promote_admin')
                                    }
                                    className="px-2 py-1 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 text-[10px] font-semibold"
                                  >
                                    Admin
                                  </button>
                                )}
                                {iAmOwner && admin && !owner && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateGroupRole(activeChat.id, pUid, 'demote_admin')
                                      }
                                      className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-[10px]"
                                    >
                                      Demote
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateGroupRole(activeChat.id, pUid, 'transfer_owner')
                                      }
                                      className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-semibold"
                                    >
                                      Owner
                                    </button>
                                  </>
                                )}
                                {canRemove && (
                                  <button
                                    type="button"
                                    onClick={() => removeGroupMember(activeChat.id, pUid)}
                                    className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 text-[10px] font-semibold"
                                  >
                                    {pUid === currentUser.uid ? 'Leave' : 'Remove'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            )}

            {/* Dedicated Full Group Profile & Management Page */}
            {showGroupPage && activeChat.type === 'group' && (
              <div
                data-testid="dedicated-group-page"
                role="dialog"
                aria-modal="true"
                aria-label={t.messages.groupInfo}
                className="fixed inset-0 md:absolute z-40 bg-slate-50/96 dark:bg-[#050811]/98 backdrop-blur-2xl flex flex-col overflow-hidden"
              >
                <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200/70 dark:border-white/[0.08] flex items-center justify-between gap-3 bg-white/85 dark:bg-[#070b16]/95 backdrop-blur-xl shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      aria-label={t.profile.back}
                      onClick={() => setShowGroupPage(false)}
                      className="min-h-[44px] min-w-[44px] rounded-xl liquid-glass-btn flex items-center justify-center text-slate-800 dark:text-slate-100 shrink-0"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {t.messages.groupInfo}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {activeChat.participantIds.length} / {MAX_GROUP_MEMBERS} members
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGroupPage(false);
                      setShowChatInfo(true);
                      setInfoTab('customize');
                    }}
                    className="min-h-[40px] px-3.5 rounded-xl liquid-glass-btn text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Palette className="w-4 h-4 text-sky-500" />
                    <span>{t.messages.themes}</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  <div className="max-w-2xl mx-auto space-y-5 pb-12">
                    {/* Identity Editor / Viewer */}
                    <section className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative shrink-0">
                          {groupEditAvatar ? (
                            <img
                              src={groupEditAvatar}
                              alt={activeChat.title}
                              className="w-20 h-20 rounded-full object-cover ring-2 ring-sky-500/40"
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-500/25 to-cyan-500/25 text-sky-600 dark:text-sky-300 flex items-center justify-center ring-2 ring-sky-500/30">
                              <Users className="w-9 h-9" />
                            </div>
                          )}
                          {canEditGroupInfo(activeChat, currentUser.uid) && (
                            <label
                              aria-label={t.messages.groupPhoto}
                              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center shadow-lg cursor-pointer"
                            >
                              <Camera className="w-4 h-4" />
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleGroupAvatarPick(e, true)}
                                className="sr-only"
                              />
                            </label>
                          )}
                        </div>

                        <div className="flex-1 w-full space-y-2.5 text-center sm:text-left">
                          {canEditGroupInfo(activeChat, currentUser.uid) ? (
                            <>
                              <input
                                type="text"
                                value={groupEditTitle}
                                onChange={(e) => setGroupEditTitle(e.target.value)}
                                placeholder="Group name"
                                aria-label="Edit group name"
                                className="w-full min-h-[42px] px-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                              />
                              <textarea
                                rows={2}
                                value={groupEditBio}
                                onChange={(e) => setGroupEditBio(e.target.value)}
                                placeholder={t.messages.groupBio}
                                aria-label={t.messages.groupBio}
                                className="w-full px-3.5 py-2.5 rounded-xl bg-white/85 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                              />
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  disabled={savingGroupPage || !groupEditTitle.trim()}
                                  onClick={async () => {
                                    setSavingGroupPage(true);
                                    try {
                                      await updateGroupSettings(activeChat.id, {
                                        title: groupEditTitle.trim(),
                                        bio: groupEditBio.trim(),
                                        avatarUrl: groupEditAvatar,
                                      });
                                      showToast('Group info saved');
                                    } finally {
                                      setSavingGroupPage(false);
                                    }
                                  }}
                                  className="min-h-[40px] px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold disabled:opacity-50"
                                >
                                  {t.profile.saveChanges}
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                                {activeChat.title}
                              </h4>
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                {activeChat.bio || 'No group bio yet.'}
                              </p>
                              <p className="text-[11px] text-amber-600 dark:text-amber-300">
                                Only group admins can edit group details.
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* Quick Controls */}
                    <section className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateChatPreferences(activeChat.id, { pinned: !isPinnedChat })
                        }
                        className="min-h-[44px] px-3 rounded-2xl liquid-glass-btn text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-1.5"
                      >
                        <Pin className="w-4 h-4 text-sky-500" />
                        <span>{isPinnedChat ? t.messages.unpinChat : t.messages.pinChat}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateChatPreferences(activeChat.id, { muted: !isMutedChat })
                        }
                        className="min-h-[44px] px-3 rounded-2xl liquid-glass-btn text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-1.5"
                      >
                        {isMutedChat ? (
                          <BellOff className="w-4 h-4 text-amber-500" />
                        ) : (
                          <Bell className="w-4 h-4 text-sky-500" />
                        )}
                        <span>{isMutedChat ? t.messages.unmuteChat : t.messages.muteChat}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateChatPreferences(activeChat.id, {
                            disappearingMode:
                              disappearingMode === 'off'
                                ? '24h'
                                : disappearingMode === '24h'
                                ? '7d'
                                : 'off',
                          })
                        }
                        className="min-h-[44px] px-3 rounded-2xl liquid-glass-btn text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-1.5 col-span-2 sm:col-span-1"
                      >
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span>
                          {t.messages.disappearing}: {disappearingMode.toUpperCase()}
                        </span>
                      </button>
                    </section>

                    {/* Add Members + Search */}
                    <section className="liquid-glass-subtle rounded-3xl p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white inline-flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-sky-500" />
                          <span>{t.messages.addMembers}</span>
                        </h4>
                        <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                          {activeChat.participantIds.length} / {MAX_GROUP_MEMBERS}
                        </span>
                      </div>

                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="search"
                          value={groupPageMemberQuery}
                          onChange={(e) => setGroupPageMemberQuery(e.target.value)}
                          placeholder="Search friends or group members..."
                          aria-label="Search friends or group members"
                          className="w-full min-h-[40px] pl-10 pr-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      {(() => {
                        const q = groupPageMemberQuery.trim().toLowerCase();
                        const addCandidates = availablePeers.filter(
                          (u) =>
                            !activeChat.participantIds.includes(u.uid) &&
                            (!q ||
                              u.displayName.toLowerCase().includes(q) ||
                              u.username.toLowerCase().includes(q))
                        );
                        if (addCandidates.length === 0) {
                          return (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {q
                                ? 'No matching users available to add.'
                                : 'All available accounts are already in this group.'}
                            </p>
                          );
                        }
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                            {addCandidates.slice(0, 12).map((u) => (
                              <div
                                key={u.uid}
                                className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-white/10"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Avatar src={u.photoUrl} name={u.displayName} size="sm" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                      {u.displayName}
                                    </p>
                                    <p className="text-[11px] text-slate-500 truncate">
                                      @{u.username}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const status = await addGroupMember(activeChat.id, u.uid);
                                    showToast(
                                      status === 'pending_approval'
                                        ? 'Member request sent to admins'
                                        : 'Member added'
                                    );
                                  }}
                                  className="min-h-[34px] px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shrink-0"
                                >
                                  + Add
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </section>

                    {/* Pending Member Approvals */}
                    {isGroupAdmin(activeChat, currentUser.uid) &&
                      (activeChat.pendingMemberIds?.length || 0) > 0 && (
                        <section className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
                          <h4 className="text-xs font-bold text-amber-700 dark:text-amber-300">
                            Pending Member Approvals ({activeChat.pendingMemberIds!.length})
                          </h4>
                          {activeChat.pendingMemberIds!.map((pUid) => {
                            const u = creators.find((c) => c.uid === pUid);
                            return (
                              <div
                                key={pUid}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {u ? `${u.displayName} (@${u.username})` : pUid}
                                </span>
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => approveGroupMember(activeChat.id, pUid, true)}
                                    className="min-h-[34px] px-3 rounded-xl bg-sky-600 text-white font-semibold"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => approveGroupMember(activeChat.id, pUid, false)}
                                    className="min-h-[34px] px-3 rounded-xl liquid-glass-btn text-slate-700 dark:text-slate-200 font-semibold"
                                  >
                                    Decline
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </section>
                      )}

                    {/* Group Restrictions */}
                    {isGroupAdmin(activeChat, currentUser.uid) && (
                      <section className="liquid-glass-subtle rounded-3xl p-4 sm:p-5 space-y-3">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white inline-flex items-center gap-2">
                          <Shield className="w-4 h-4 text-sky-500" />
                          <span>{t.messages.groupRestrictions}</span>
                        </h4>
                        <div className="space-y-2.5">
                          <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/75 dark:bg-slate-900/75 border border-slate-200/70 dark:border-white/10 cursor-pointer">
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                              {t.messages.adminsOnlyMessages}
                            </span>
                            <input
                              type="checkbox"
                              checked={Boolean(activeChat.restrictions?.adminsOnlyMessages)}
                              onChange={(e) =>
                                updateGroupSettings(activeChat.id, {
                                  restrictions: {
                                    ...activeChat.restrictions,
                                    adminsOnlyMessages: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 rounded text-sky-600"
                            />
                          </label>

                          <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/75 dark:bg-slate-900/75 border border-slate-200/70 dark:border-white/10 cursor-pointer">
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                              {t.messages.onlyAdminsEditInfo}
                            </span>
                            <input
                              type="checkbox"
                              checked={Boolean(activeChat.restrictions?.onlyAdminsEditInfo)}
                              onChange={(e) =>
                                updateGroupSettings(activeChat.id, {
                                  restrictions: {
                                    ...activeChat.restrictions,
                                    onlyAdminsEditInfo: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 rounded text-sky-600"
                            />
                          </label>

                          <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/75 dark:bg-slate-900/75 border border-slate-200/70 dark:border-white/10 cursor-pointer">
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                              {t.messages.blockMediaAttachments}
                            </span>
                            <input
                              type="checkbox"
                              checked={Boolean(activeChat.restrictions?.blockMediaAttachments)}
                              onChange={(e) =>
                                updateGroupSettings(activeChat.id, {
                                  restrictions: {
                                    ...activeChat.restrictions,
                                    blockMediaAttachments: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 rounded text-sky-600"
                            />
                          </label>

                          <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/75 dark:bg-slate-900/75 border border-slate-200/70 dark:border-white/10 cursor-pointer">
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                              Require admin approval when members add users
                            </span>
                            <input
                              type="checkbox"
                              checked={Boolean(activeChat.requireAddApproval)}
                              onChange={(e) =>
                                updateGroupSettings(activeChat.id, {
                                  requireAddApproval: e.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded text-sky-600"
                            />
                          </label>
                        </div>
                      </section>
                    )}

                    {/* Group Members List (Inline role typography — zero rounded-full static pills) */}
                    <section className="liquid-glass-subtle rounded-3xl p-4 sm:p-5 space-y-3">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Members ({activeChat.participantIds.length})
                      </h4>
                      <div className="divide-y divide-slate-200/60 dark:divide-white/10">
                        {[...activeChat.participantIds]
                          .sort((a, b) => {
                            const score = (uid: string) =>
                              isGroupOwner(activeChat, uid)
                                ? 0
                                : isGroupAdmin(activeChat, uid)
                                ? 1
                                : 2;
                            return score(a) - score(b);
                          })
                          .filter((pUid) => {
                            const q = groupPageMemberQuery.trim().toLowerCase();
                            if (!q) return true;
                            const memberUser = creators.find((c) => c.uid === pUid);
                            const name = (
                              memberUser?.displayName ||
                              activeChat.participantNames?.[pUid] ||
                              pUid
                            ).toLowerCase();
                            return (
                              name.includes(q) ||
                              (memberUser?.username || '').toLowerCase().includes(q)
                            );
                          })
                          .map((pUid) => {
                            const memberUser = creators.find((c) => c.uid === pUid);
                            const displayName =
                              memberUser?.displayName || activeChat.participantNames?.[pUid] || pUid;
                            const owner = isGroupOwner(activeChat, pUid);
                            const admin = isGroupAdmin(activeChat, pUid);
                            const canRemove = canRemoveGroupMember(
                              activeChat,
                              currentUser.uid,
                              pUid
                            );
                            const iAmOwner = isGroupOwner(activeChat, currentUser.uid);
                            const iAmAdmin = isGroupAdmin(activeChat, currentUser.uid);

                            return (
                              <div
                                key={pUid}
                                className="py-3 flex flex-wrap items-center justify-between gap-2.5"
                              >
                                <button
                                  type="button"
                                  onClick={() => openUserProfile(pUid)}
                                  className="flex items-center gap-3 min-w-0 text-left"
                                >
                                  <Avatar
                                    src={memberUser?.photoUrl}
                                    name={displayName}
                                    size="sm"
                                    online={memberUser?.onlineStatus === 'online'}
                                  />
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                      {displayName}
                                      {pUid === currentUser.uid ? ' (You)' : ''}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
                                      {memberUser && <span>@{memberUser.username} ·</span>}
                                      {owner ? (
                                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300 font-semibold">
                                          <Crown className="w-3 h-3" />
                                          Owner
                                        </span>
                                      ) : admin ? (
                                        <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold">
                                          <Shield className="w-3 h-3" />
                                          Admin
                                        </span>
                                      ) : (
                                        <span>Member</span>
                                      )}
                                    </p>
                                  </div>
                                </button>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  {iAmAdmin && !admin && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateGroupRole(activeChat.id, pUid, 'promote_admin')
                                      }
                                      className="min-h-[34px] px-2.5 rounded-xl liquid-glass-btn text-sky-700 dark:text-sky-300 text-[11px] font-semibold"
                                    >
                                      {t.messages.promoteAdmin}
                                    </button>
                                  )}
                                  {iAmOwner && admin && !owner && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateGroupRole(activeChat.id, pUid, 'demote_admin')
                                        }
                                        className="min-h-[34px] px-2.5 rounded-xl liquid-glass-btn text-slate-700 dark:text-slate-200 text-[11px] font-semibold"
                                      >
                                        {t.messages.demoteAdmin}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateGroupRole(activeChat.id, pUid, 'transfer_owner')
                                        }
                                        className="min-h-[34px] px-2.5 rounded-xl liquid-glass-btn text-amber-600 dark:text-amber-300 text-[11px] font-semibold"
                                      >
                                        {t.messages.transferOwner}
                                      </button>
                                    </>
                                  )}
                                  {canRemove && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await removeGroupMember(activeChat.id, pUid);
                                        if (pUid === currentUser.uid) {
                                          setShowGroupPage(false);
                                        }
                                      }}
                                      className="min-h-[34px] px-2.5 rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400 text-[11px] font-semibold"
                                    >
                                      {pUid === currentUser.uid ? 'Leave' : 'Remove'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </section>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateChatPreferences(activeChat.id, { muted: !isMutedChat })
                        }
                        className="w-full min-h-[44px] rounded-2xl liquid-glass-btn text-slate-800 dark:text-slate-100 text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors"
                      >
                        {isMutedChat ? <Bell className="w-4 h-4 text-sky-600" /> : <BellOff className="w-4 h-4 text-amber-500" />}
                        <span>{isMutedChat ? t.messages.unmuteChat : t.messages.muteChat}</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteChatFromInbox(activeChat.id);
                          setShowGroupPage(false);
                        }}
                        className="w-full min-h-[44px] rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{t.messages.deleteGroup}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 text-slate-500">
            <div className="w-16 h-16 rounded-3xl bg-sky-600/10 text-sky-600 flex items-center justify-center">
              <MessageCircle className="w-8 h-8" />
            </div>
            <p className="text-base font-bold text-slate-800 dark:text-slate-100">
              {t.messages.chatsTitle}
            </p>
            <p className="text-xs max-w-xs leading-relaxed">
              Start a private DM, create a 250-member group, customize themes, pin messages, or place
              voice & video calls.
            </p>
            <button
              type="button"
              onClick={() => setShowNewDirect(true)}
              className="min-h-[40px] px-4 rounded-xl bg-sky-600 text-white text-xs font-semibold"
            >
              Start Conversation
            </button>
          </div>
        )}
      </section>

      {/* Forward Message Modal */}
      {forwardingMsg && activeChat && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.messages.forwardMessage}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="liquid-glass rounded-3xl p-5 sm:p-6 max-w-sm w-full space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.messages.forwardMessage}
              </h3>
              <button
                type="button"
                aria-label="Close forward modal"
                onClick={() => setForwardingMsg(null)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="search"
              value={forwardSearch}
              onChange={(e) => setForwardSearch(e.target.value)}
              placeholder={t.messages.searchChats}
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-white/85 dark:bg-slate-900 text-sm"
            />
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {chats
                .filter((c) =>
                  c.title.toLowerCase().includes(forwardSearch.trim().toLowerCase())
                )
                .map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={async () => {
                      await forwardMessage(activeChat.id, forwardingMsg.id, target.id);
                      setForwardingMsg(null);
                    }}
                    className="w-full min-h-[46px] py-2.5 px-3 flex items-center justify-between text-left hover:bg-sky-500/10 rounded-xl"
                  >
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {target.title}
                    </span>
                    <span className="min-h-[32px] px-3 py-1 rounded-xl bg-sky-600 text-white text-xs font-semibold inline-flex items-center">
                      Send
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Upgraded Instagram-Style Self Note Composer Modal */}
      {showNoteComposer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.messages.newNoteTitle}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!noteInput.trim()) return;
              await publishNote(noteInput, noteAudience);
              setShowNoteComposer(false);
            }}
            className="liquid-glass rounded-3xl p-5 sm:p-7 max-w-md w-full space-y-5 shadow-2xl"
          >
            {/* Top Bar: Close · Title · Share CTA */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Close note composer"
                onClick={() => setShowNoteComposer(false)}
                className="min-h-[44px] min-w-[44px] rounded-2xl liquid-glass-btn flex items-center justify-center text-slate-700 dark:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                {t.messages.newNoteTitle}
              </h3>
              <button
                type="submit"
                disabled={!noteInput.trim()}
                className={`min-h-[44px] px-5 rounded-full text-white text-sm font-semibold shadow-md disabled:opacity-45 transition-all ${
                  noteAudience === 'close_friends'
                    ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-emerald-600/25'
                    : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 shadow-sky-600/25'
                }`}
              >
                {t.messages.shareNote}
              </button>
            </div>

            {/* Live Instagram Floating Bubble + Avatar Preview */}
            <div className="pt-2 pb-1 flex flex-col items-center">
              <div className="relative z-10 -mb-3 w-full max-w-[300px] flex flex-col items-center">
                <div
                  className={`w-full rounded-3xl px-5 py-4 shadow-xl space-y-2 focus-within:ring-2 border ${
                    noteAudience === 'close_friends'
                      ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-400/70 focus-within:ring-emerald-500'
                      : 'bg-white dark:bg-[#1a2642] border-slate-200/90 dark:border-white/25 focus-within:ring-sky-500'
                  }`}
                >
                  <textarea
                    rows={2}
                    autoFocus
                    required
                    maxLength={80}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder={t.messages.addNotePlaceholder}
                    aria-label={t.messages.yourNote}
                    className="w-full bg-transparent text-center text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none focus:outline-none leading-snug"
                  />
                  <div className="flex items-center justify-between text-[11px] font-mono-num text-slate-400">
                    <span>24h</span>
                    <span className={noteInput.length >= 75 ? 'text-amber-500 font-semibold' : ''}>
                      {noteInput.length}/80
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-start self-start ml-12 -mt-0.5 space-y-1" aria-hidden="true">
                  <span className="w-4 h-4 rounded-full bg-white dark:bg-[#1a2642] border border-slate-200/90 dark:border-white/25 shadow-sm" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white dark:bg-[#1a2642] border border-slate-200/90 dark:border-white/25 ml-2 shadow-sm" />
                </div>
              </div>

              <Avatar src={currentUser.photoUrl} name={currentUser.displayName} size="xl" online />
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {currentUser.displayName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-0.5">
                {noteAudience === 'close_friends'
                  ? t.messages.noteCloseFriendsHint
                  : t.messages.noteHint24h}
              </p>
            </div>

            {/* Audience Selector: Followers vs Close Friends */}
            <div className="space-y-2 pt-1 border-t border-slate-200/70 dark:border-white/10">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNoteAudience('followers')}
                  className={`min-h-[42px] px-3 rounded-2xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                    noteAudience === 'followers'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'liquid-glass-btn text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>{t.messages.followersAudience}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNoteAudience('close_friends')}
                  className={`min-h-[42px] px-3 rounded-2xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                    noteAudience === 'close_friends'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'liquid-glass-btn text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <Star className={`w-4 h-4 ${noteAudience === 'close_friends' ? 'fill-current' : ''}`} />
                  <span>{t.messages.closeFriends}</span>
                </button>
              </div>
            </div>

            {/* Quick Emoji & Thought Prompts */}
            <div className="space-y-2.5 pt-1 border-t border-slate-200/70 dark:border-white/10">
              <div className="flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar py-1">
                {NOTE_EMOJI_BAR.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() =>
                      setNoteInput((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${em}`.slice(0, 80))
                    }
                    className="w-10 h-10 rounded-2xl liquid-glass-btn text-lg flex items-center justify-center shrink-0"
                  >
                    {em}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t.messages.quickVibes}
                </p>
                <div className="flex flex-wrap gap-2">
                  {NOTE_QUICK_THOUGHTS.map((prompt) => {
                    const label = `${prompt.emoji} ${language === 'bn' ? prompt.bn : prompt.en}`;
                    return (
                      <button
                        key={prompt.en}
                        type="button"
                        onClick={() => setNoteInput(label.slice(0, 80))}
                        className="min-h-[38px] px-3.5 rounded-2xl liquid-glass-btn text-xs font-semibold text-slate-800 dark:text-slate-100"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {myNote && (
              <button
                type="button"
                onClick={async () => {
                  await deleteMyNote();
                  setShowNoteComposer(false);
                }}
                className="w-full min-h-[44px] px-4 rounded-2xl bg-rose-500/12 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t.messages.deleteNote}</span>
              </button>
            )}
          </form>
        </div>
      )}

      {/* Friend Note View + Like & Reply into DM Modal */}
      {activeNote && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Note by ${activeNote.authorDisplayName}`}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="liquid-glass rounded-3xl p-5 sm:p-7 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar src={activeNote.authorAvatar} name={activeNote.authorDisplayName} size="md" online />
                <div className="min-w-0">
                  <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                    {activeNote.authorDisplayName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                    <span>@{activeNote.authorUsername}</span>
                    {activeNote.audience === 'close_friends' && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        · <Star className="w-3 h-3 fill-current" /> {t.messages.closeFriends}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close note"
                onClick={() => setActiveNote(null)}
                className="min-h-[44px] min-w-[44px] rounded-2xl liquid-glass-btn flex items-center justify-center text-slate-600 dark:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-2 flex flex-col items-center">
              <div className="relative z-10 -mb-3 w-full max-w-[300px] flex flex-col items-center">
                <div className="w-full p-5 rounded-3xl bg-white dark:bg-[#1a2642] border border-slate-200/90 dark:border-white/25 shadow-xl text-center space-y-3">
                  <p className="text-lg font-medium text-slate-900 dark:text-white leading-snug break-words">
                    {activeNote.text}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleLikeNote(activeNote.id)}
                    className={`min-h-[40px] px-4 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 transition-colors ${
                      activeNote.likedByUids.includes(currentUser.uid)
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        : 'liquid-glass-btn text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        activeNote.likedByUids.includes(currentUser.uid) ? 'fill-current' : ''
                      }`}
                    />
                    <span className="font-mono-num">{activeNote.likedByUids.length}</span>
                  </button>
                </div>
                <div className="flex flex-col items-start self-start ml-12 -mt-0.5 space-y-1" aria-hidden="true">
                  <span className="w-4 h-4 rounded-full bg-white dark:bg-[#1a2642] border border-slate-200/90 dark:border-white/25 shadow-sm" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white dark:bg-[#1a2642] border border-slate-200/90 dark:border-white/25 ml-2 shadow-sm" />
                </div>
              </div>
              <Avatar src={activeNote.authorAvatar} name={activeNote.authorDisplayName} size="xl" online />
            </div>

            {activeNote.authorUid !== currentUser.uid && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!noteReplyText.trim()) return;
                  const chatId = await createDirectOrGroupChat(
                    activeNote.authorDisplayName,
                    [currentUser.uid, activeNote.authorUid],
                    'direct'
                  );
                  if (chatId) {
                    await sendMessage(chatId, {
                      type: 'text',
                      text: `Note reply ("${activeNote.text}"): ${noteReplyText.trim()}`,
                    });
                    setMobileShowThread(true);
                  }
                  setActiveNote(null);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={noteReplyText}
                  onChange={(e) => setNoteReplyText(e.target.value)}
                  placeholder="Reply to note..."
                  aria-label="Reply to note"
                  className="flex-1 min-h-[48px] px-4 rounded-2xl bg-white/85 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-[15px] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="submit"
                  className="min-h-[48px] px-5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors"
                >
                  Send
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
