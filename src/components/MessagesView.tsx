import { useRef, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  CheckCheck,
  Download,
  Heart,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Play,
  Reply,
  Search,
  Send,
  Square,
  SquarePen,
  Trash2,
  Users,
} from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { formatRelativeTime } from '../utils/validation';
import { Avatar } from './Avatar';

export function MessagesView() {
  const {
    chats,
    activeChatId,
    setActiveChatId,
    messagesByChat,
    currentUser,
    creators,
    userPrivate,
    friendRequests,
    respondToFriendRequest,
    sendMessage,
    reactToMessage,
    deleteMessage,
    createDirectOrGroupChat,
    blockUser,
    unblockUser,
    openUserProfile,
    language,
    t,
  } = useSocialVerse();

  const [chatSearch, setChatSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'primary' | 'groups' | 'requests'>('primary');
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>(['user_rafi_02']);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);

  const pendingRequests = friendRequests.filter((r) => r.status === 'pending');

  const filteredChats = chats.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(chatSearch.trim().toLowerCase());
    if (!matchesSearch) return false;
    if (inboxFilter === 'groups') return c.type === 'group';
    return true;
  });

  const activeChat = chats.find((c) => c.id === activeChatId) || filteredChats[0] || null;
  const activeMessages = activeChat ? messagesByChat[activeChat.id] || [] : [];

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

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setMobileShowThread(true);
  };

  const handleStartDirectFromNote = (creatorUid: string, displayName: string) => {
    const createdId = createDirectOrGroupChat(displayName, [currentUser.uid, creatorUid], 'direct');
    if (createdId) {
      setMobileShowThread(true);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !draftText.trim() || isBlocked) return;
    sendMessage(activeChat.id, {
      type: 'text',
      text: draftText.trim(),
      replyToId: replyingTo?.id,
      replyPreview: replyingTo?.text,
    });
    setDraftText('');
    setReplyingTo(null);
  };

  const handleToggleVoiceRecord = async () => {
    if (!activeChat || isBlocked) return;
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
          const url = URL.createObjectURL(blob);
          const durationMs = Math.max(1200, Date.now() - recordStartRef.current);
          sendMessage(activeChat.id, {
            type: 'voice',
            mediaUrl: url,
            durationMs,
            fileName: `voice_${Date.now()}.webm`,
          });
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
        sendMessage(activeChat.id, {
          type: 'voice',
          durationMs,
          fileName: `voice_${Date.now()}.m4a`,
        });
      }
    }
  };

  const handleFileAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat || isBlocked) return;
    const url = URL.createObjectURL(file);
    const kind = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
      ? 'video'
      : 'file';
    sendMessage(activeChat.id, {
      type: kind,
      mediaUrl: url,
      fileName: file.name,
      text: kind === 'file' ? file.name : undefined,
    });
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitle.trim() || groupMembers.length === 0) return;
    const id = createDirectOrGroupChat(groupTitle, [currentUser.uid, ...groupMembers], 'group');
    if (id) {
      setGroupTitle('');
      setShowNewGroup(false);
      setMobileShowThread(true);
    }
  };

  return (
    <div className="liquid-glass rounded-3xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[620px]">
      {/* Instagram-style Inbox Sidebar */}
      <aside
        className={`md:col-span-5 border-b md:border-b-0 md:border-r border-slate-200/70 dark:border-slate-800/70 flex flex-col ${
          mobileShowThread ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Top Inbox Header */}
        <div className="p-4 space-y-3 border-b border-slate-200/70 dark:border-slate-800/70">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {currentUser.username}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t.messages.chatsTitle}
              </p>
            </div>
            <button
              type="button"
              aria-label={t.messages.newGroup}
              onClick={() => setShowNewGroup((s) => !s)}
              className="min-h-[40px] px-3 rounded-xl liquid-glass-subtle text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors"
            >
              <SquarePen className="w-4 h-4 text-sky-600" />
              <span>{t.messages.newGroup}</span>
            </button>
          </div>

          {/* Search Pill */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder={t.messages.searchChats}
              aria-label={t.messages.searchChats}
              className="w-full min-h-[40px] pl-10 pr-3.5 rounded-2xl bg-slate-100/90 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Instagram-style Active Notes Strip */}
          <div aria-label={t.messages.notesTitle} className="pt-1">
            <div className="flex items-start gap-3 overflow-x-auto no-scrollbar pb-1">
              {creators.map((creator) => {
                const isSelf = creator.uid === currentUser.uid;
                return (
                  <button
                    key={creator.uid}
                    type="button"
                    onClick={() =>
                      isSelf
                        ? openUserProfile(creator.uid)
                        : handleStartDirectFromNote(creator.uid, creator.displayName)
                    }
                    className="flex flex-col items-center shrink-0 w-[68px] group"
                  >
                    <div className="mb-1 px-2 py-0.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-sm text-[10px] text-slate-700 dark:text-slate-200 truncate max-w-[68px]">
                      {creator.noteText || (isSelf ? 'Your note' : 'Active')}
                    </div>
                    <Avatar
                      src={creator.photoUrl}
                      name={creator.displayName}
                      size="md"
                      online={creator.onlineStatus === 'online'}
                    />
                    <span className="mt-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[66px]">
                      {isSelf ? 'You' : creator.displayName.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary / Groups / Requests Filter Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-900/70">
            <button
              type="button"
              onClick={() => setInboxFilter('primary')}
              className={`min-h-[34px] rounded-lg text-xs font-semibold transition-colors ${
                inboxFilter === 'primary'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t.messages.primaryTab}
            </button>
            <button
              type="button"
              onClick={() => setInboxFilter('groups')}
              className={`min-h-[34px] rounded-lg text-xs font-semibold transition-colors ${
                inboxFilter === 'groups'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t.messages.groupsTab}
            </button>
            <button
              type="button"
              onClick={() => setInboxFilter('requests')}
              className={`min-h-[34px] rounded-lg text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1 ${
                inboxFilter === 'requests'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span>{t.messages.requestsTab}</span>
              {pendingRequests.length > 0 && (
                <span className="font-mono-num text-[10px] text-sky-600 dark:text-sky-400">
                  ({pendingRequests.length})
                </span>
              )}
            </button>
          </div>

          {showNewGroup && (
            <form onSubmit={handleCreateGroup} className="p-3 rounded-2xl liquid-glass-subtle space-y-2.5">
              <input
                type="text"
                required
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="Group name"
                className="w-full min-h-[38px] px-3 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
              <div className="flex flex-wrap gap-1.5">
                {creators
                  .filter((u) => u.uid !== currentUser.uid)
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
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${
                          selected
                            ? 'bg-sky-600 text-white'
                            : 'bg-white/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {u.displayName}
                      </button>
                    );
                  })}
              </div>
              <button
                type="submit"
                className="w-full min-h-[36px] rounded-lg bg-sky-600 text-white text-xs font-semibold"
              >
                Create Group Chat
              </button>
            </form>
          )}
        </div>

        {/* Conversation List or Requests */}
        {inboxFilter === 'requests' ? (
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60 overflow-y-auto flex-1 p-2">
            {pendingRequests.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">{t.profile.noRequests}</p>
            ) : (
              pendingRequests.map((req) => (
                <div key={req.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={req.fromAvatar} name={req.fromDisplayName} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {req.fromDisplayName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        @{req.fromUsername} · {req.mutualCount} mutual
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => respondToFriendRequest(req.id, true)}
                      className="min-h-[34px] px-3 rounded-lg bg-sky-600 text-white text-xs font-semibold"
                    >
                      {t.profile.accept}
                    </button>
                    <button
                      type="button"
                      onClick={() => respondToFriendRequest(req.id, false)}
                      className="min-h-[34px] px-2.5 rounded-lg liquid-glass-subtle text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {t.profile.reject}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50 overflow-y-auto flex-1">
            {filteredChats.map((chat) => {
              const active = activeChat?.id === chat.id;
              const peerId = chat.participantIds.find((id) => id !== currentUser.uid);
              const avatar = peerId ? chat.participantAvatars[peerId] : undefined;
              const peer = peerId ? creators.find((c) => c.uid === peerId) : undefined;
              const hasUnread = chat.unreadCount > 0;
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => handleSelectChat(chat.id)}
                  className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                    active
                      ? 'bg-sky-500/10 dark:bg-sky-500/15'
                      : 'hover:bg-white/50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {chat.type === 'group' ? (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500/20 to-cyan-500/20 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                  ) : (
                    <Avatar
                      src={avatar}
                      name={chat.title}
                      size="md"
                      online={peer?.onlineStatus === 'online'}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-sm truncate ${
                          hasUnread
                            ? 'font-bold text-slate-950 dark:text-white'
                            : 'font-semibold text-slate-900 dark:text-white'
                        }`}
                      >
                        {chat.title}
                      </p>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {formatRelativeTime(chat.lastMessageAt, language)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={`text-xs truncate ${
                          hasUnread
                            ? 'font-semibold text-slate-800 dark:text-slate-200'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {chat.lastMessageText}
                      </p>
                      {hasUnread && (
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* Instagram-style Active DM Thread */}
      <section
        className={`md:col-span-7 flex-col justify-between h-[580px] md:h-[640px] ${
          mobileShowThread ? 'flex' : 'hidden md:flex'
        }`}
      >
        {activeChat ? (
          <>
            {/* Clean Thread Header */}
            <div className="px-4 py-3 border-b border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-3 bg-white/40 dark:bg-slate-900/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  aria-label={t.messages.backToInbox}
                  onClick={() => setMobileShowThread(false)}
                  className="md:hidden min-h-[40px] min-w-[40px] -ml-2 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {activeChat.type === 'group' ? (
                  <div className="w-9 h-9 rounded-full bg-sky-600/15 text-sky-600 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                ) : (
                  <Avatar
                    src={otherUser?.photoUrl}
                    name={activeChat.title}
                    size="sm"
                    online={otherUser?.onlineStatus === 'online'}
                  />
                )}
                <button
                  type="button"
                  onClick={() => otherUser && openUserProfile(otherUser.uid)}
                  className="min-w-0 text-left"
                >
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {activeChat.title}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {activeChat.type === 'group'
                      ? `${activeChat.participantIds.length} members`
                      : otherUser?.onlineStatus === 'online'
                      ? `@${otherUser.username} · ${t.messages.activeNow}`
                      : `Last seen ${formatRelativeTime(otherUser?.lastSeenAt || activeChat.lastMessageAt, language)}`}
                  </p>
                </button>
              </div>
              {otherParticipantId && (
                <button
                  type="button"
                  onClick={() =>
                    isBlocked ? unblockUser(otherParticipantId) : blockUser(otherParticipantId)
                  }
                  className="min-h-[36px] px-3 rounded-xl liquid-glass-subtle text-xs font-semibold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1.5 shrink-0"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{isBlocked ? t.messages.unblockUser : t.messages.blockUser}</span>
                </button>
              )}
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeMessages.map((msg, idx) => {
                const mine = msg.senderId === currentUser.uid;
                const isLastMsg = idx === activeMessages.length - 1;
                const reactionEntries = Object.entries(msg.reactions).filter(
                  ([, list]) => list.length > 0
                );
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${mine ? 'items-end' : 'items-start'} group`}
                  >
                    <div
                      className={`max-w-[78%] rounded-3xl px-4 py-2.5 space-y-1.5 shadow-sm ${
                        mine
                          ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-br-md'
                          : 'bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/70 rounded-bl-md'
                      }`}
                    >
                      {activeChat.type === 'group' && !mine && (
                        <p className="text-[11px] font-semibold opacity-75">{msg.senderName}</p>
                      )}
                      {msg.replyPreview && (
                        <div className="px-2.5 py-1 rounded-xl bg-black/10 dark:bg-white/10 text-[11px] opacity-85 truncate">
                          {msg.replyPreview}
                        </div>
                      )}

                      {msg.type === 'image' && msg.mediaUrl && (
                        <img
                          src={msg.mediaUrl}
                          alt={msg.text || 'Attachment'}
                          referrerPolicy="no-referrer"
                          className="rounded-2xl max-h-52 object-cover"
                        />
                      )}

                      {msg.type === 'voice' && (
                        <div className="flex items-center gap-2.5 py-0.5">
                          {msg.mediaUrl ? (
                            <audio controls src={msg.mediaUrl} className="h-8 max-w-[200px]" />
                          ) : (
                            <button
                              type="button"
                              aria-label="Play voice message"
                              onClick={() => {}}
                              className="inline-flex items-center gap-2 text-xs font-medium"
                            >
                              <Play className="w-4 h-4 fill-current" />
                              <span className="font-mono-num">
                                0:{String(Math.round((msg.durationMs || 3000) / 1000)).padStart(2, '0')}
                              </span>
                            </button>
                          )}
                          {msg.mediaUrl && (
                            <a
                              href={msg.mediaUrl}
                              download={msg.fileName || 'voice-note.webm'}
                              aria-label="Download voice message"
                              className="p-1.5 rounded-lg bg-black/15 hover:bg-black/25"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      )}

                      {msg.type === 'file' && (
                        <p className="text-xs underline">{msg.fileName || 'Attachment'}</p>
                      )}

                      {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                    </div>

                    {/* Message Meta, Reactions & Actions */}
                    <div className="flex items-center gap-1.5 mt-1 px-1">
                      {reactionEntries.map(([emoji, users]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => reactToMessage(activeChat.id, msg.id, emoji)}
                          className="px-2 py-0.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-[11px] border border-slate-200 dark:border-slate-700 shadow-sm"
                        >
                          {emoji} {users.length}
                        </button>
                      ))}
                      <button
                        type="button"
                        aria-label="React heart"
                        onClick={() => reactToMessage(activeChat.id, msg.id, '❤️')}
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <Heart className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Reply to message"
                        onClick={() =>
                          setReplyingTo({
                            id: msg.id,
                            text: msg.text || msg.fileName || 'Voice note',
                          })
                        }
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                      {mine && (
                        <button
                          type="button"
                          aria-label={t.messages.deleteMessage}
                          onClick={() => deleteMessage(activeChat.id, msg.id)}
                          className="p-1 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="text-[10px] text-slate-400 inline-flex items-center gap-0.5 ml-1">
                        <span>{formatRelativeTime(msg.createdAt, language)}</span>
                        {mine && isLastMsg && (
                          <>
                            <CheckCheck className="w-3 h-3 text-sky-500 ml-0.5" />
                            <span>{msg.status === 'seen' ? t.messages.seen : t.messages.delivered}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Clean Instagram-style Pill Composer */}
            <div className="p-3.5 border-t border-slate-200/70 dark:border-slate-800/70 space-y-2 bg-white/40 dark:bg-slate-900/40">
              {replyingTo && (
                <div className="flex items-center justify-between text-xs text-sky-600 dark:text-sky-400 px-3 py-1.5 rounded-xl bg-sky-500/10">
                  <span className="truncate">
                    {t.messages.replyingTo}: {replyingTo.text}
                  </span>
                  <button type="button" onClick={() => setReplyingTo(null)} className="underline ml-2 font-semibold">
                    Cancel
                  </button>
                </div>
              )}

              {isBlocked ? (
                <p className="text-xs text-center text-rose-600 py-2">
                  You blocked this user. Unblock to send messages.
                </p>
              ) : (
                <form
                  onSubmit={handleSendText}
                  className="flex items-center gap-1.5 p-1.5 rounded-full bg-white/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-700/80 shadow-sm"
                >
                  <button
                    type="button"
                    aria-label={isRecording ? t.messages.stopRecording : t.messages.recordVoice}
                    onClick={handleToggleVoiceRecord}
                    className={`min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors ${
                      isRecording
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <input
                    type="text"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    placeholder={t.messages.typeMessage}
                    aria-label={t.messages.typeMessage}
                    className="flex-1 min-h-[40px] px-2 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none"
                  />

                  <label
                    aria-label="Attach image, video, or file"
                    className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <input type="file" onChange={handleFileAttachment} className="sr-only" />
                  </label>

                  <label
                    aria-label="Attach file"
                    className="hidden sm:flex min-h-[40px] min-w-[40px] rounded-full items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Paperclip className="w-4 h-4" />
                    <input type="file" onChange={handleFileAttachment} className="sr-only" />
                  </label>

                  <button
                    type="submit"
                    aria-label="Send message"
                    className="min-h-[40px] px-4 rounded-full bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center gap-1 text-xs font-semibold transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
            Select a conversation to start messaging.
          </div>
        )}
      </section>
    </div>
  );
}
