import { useState } from 'react';
import { ArrowLeft, Bell, CheckCheck, Heart, MessageCircle, ShieldCheck, UserPlus } from 'lucide-react';
import { useSocialVerse } from '../context/SocialVerseContext';
import { formatRelativeTime, getMaskedUserDisplay } from '../utils/validation';
import { Avatar } from './Avatar';

type NotifFilter = 'all' | 'follows' | 'requests' | 'activity';

export function NotificationsView() {
  const {
    currentUser,
    isAuthenticated,
    creators,
    notifications,
    friendRequests,
    followingIds,
    followerIds,
    goBack,
    openUserProfile,
    toggleFollow,
    respondToFriendRequest,
    markAllNotificationsRead,
    openAuthModal,
    language,
    t,
  } = useSocialVerse();

  const [filter, setFilter] = useState<NotifFilter>('all');

  if (!isAuthenticated) {
    return (
      <div className="liquid-glass rounded-3xl p-6 sm:p-8 text-center space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            aria-label={t.profile.back}
            className="min-h-[44px] px-3.5 rounded-2xl liquid-glass-btn inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.profile.back}</span>
          </button>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {t.settings.notifications}
          </span>
          <span className="w-16" />
        </div>
        <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-600/15 text-sky-500 flex items-center justify-center">
          <Bell className="w-6 h-6" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.auth.guestBannerDesc}</p>
        <button
          type="button"
          onClick={() => openAuthModal()}
          className="min-h-[44px] px-6 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold"
        >
          {t.auth.signIn} / {t.auth.register}
        </button>
      </div>
    );
  }

  const pendingRequests = friendRequests.filter(
    (r) => r.toUid === currentUser.uid && r.status === 'pending'
  );
  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifs = notifications.filter((n) => {
    if (filter === 'follows') {
      return n.type === 'follow';
    }
    if (filter === 'requests') {
      return n.type === 'friend_request';
    }
    if (filter === 'activity') {
      return (
        n.type === 'like' ||
        n.type === 'comment' ||
        n.type === 'reply' ||
        n.type === 'story_reaction' ||
        n.type === 'mention' ||
        n.type === 'message' ||
        n.type === 'group_message'
      );
    }
    return true;
  });

  const filterTabs: { id: NotifFilter; label: string }[] = [
    { id: 'all', label: language === 'bn' ? 'সব' : 'All' },
    { id: 'follows', label: language === 'bn' ? 'ফলো' : 'Follows' },
    {
      id: 'requests',
      label: `${language === 'bn' ? 'রিকোয়েস্ট' : 'Requests'}${
        pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''
      }`,
    },
    { id: 'activity', label: language === 'bn' ? 'অ্যাক্টিভিটি' : 'Activity' },
  ];

  const getTypeIcon = (type: string) => {
    if (type === 'like' || type === 'story_reaction') {
      return <Heart className="w-3.5 h-3.5 text-rose-500" />;
    }
    if (type === 'comment' || type === 'reply' || type === 'message' || type === 'group_message') {
      return <MessageCircle className="w-3.5 h-3.5 text-sky-500" />;
    }
    if (type === 'announcement') return <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />;
    return <UserPlus className="w-3.5 h-3.5 text-sky-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Sticky Top Header */}
      <div className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={goBack}
              aria-label={t.profile.back}
              className="min-h-[44px] min-w-[44px] px-3 rounded-2xl liquid-glass-btn inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{t.profile.back}</span>
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-display font-bold text-slate-900 dark:text-white truncate">
                {t.settings.notifications}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {unreadCount > 0
                  ? language === 'bn'
                    ? `${unreadCount}টি অপঠিত নোটিফিকেশন`
                    : `${unreadCount} unread updates`
                  : language === 'bn'
                  ? 'সব নোটিফিকেশন দেখা হয়েছে'
                  : 'All caught up'}
              </p>
            </div>
          </div>

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="min-h-[40px] px-3.5 rounded-2xl liquid-glass-btn text-xs font-semibold text-sky-600 dark:text-sky-400 inline-flex items-center gap-1.5 shrink-0"
            >
              <CheckCheck className="w-4 h-4" />
              <span>{language === 'bn' ? 'সব পড়া হয়েছে' : 'Mark all read'}</span>
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl liquid-glass-subtle">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[38px] px-2 rounded-xl text-xs font-semibold transition-all duration-150 whitespace-nowrap truncate ${
                filter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pending Follow Requests Section */}
      {(filter === 'all' || filter === 'requests') && pendingRequests.length > 0 && (
        <section
          aria-label={t.profile.friendRequests}
          className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t.profile.friendRequests} ({pendingRequests.length})
            </h2>
          </div>

          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {pendingRequests.map((req) => (
              <div key={req.id} className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => openUserProfile(req.fromUid)}
                  className="flex items-center gap-3 min-w-0 text-left flex-1"
                >
                  <Avatar src={req.fromAvatar} name={req.fromDisplayName} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {req.fromDisplayName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      @{req.fromUsername} · {formatRelativeTime(req.createdAt, language)}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => respondToFriendRequest(req.id, true)}
                    className="min-h-[40px] px-3.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors duration-150"
                  >
                    {t.profile.accept}
                  </button>
                  <button
                    type="button"
                    onClick={() => respondToFriendRequest(req.id, false)}
                    className="min-h-[40px] px-3.5 rounded-xl liquid-glass-btn text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {t.profile.reject}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notifications Timeline */}
      <section aria-label={t.settings.notifications} className="liquid-glass rounded-3xl p-4 sm:p-5">
        {filteredNotifs.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-600/10 text-sky-500 flex items-center justify-center">
              <Bell className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {language === 'bn' ? 'কোনো নোটিফিকেশন নেই।' : 'No notifications here yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {filteredNotifs.map((n) => {
              const actor = creators.find((c) => c.uid === n.actorUid);
              const maskedActor = actor
                ? getMaskedUserDisplay(actor, currentUser.uid, actor.uid)
                : { displayName: n.actorUsername, username: n.actorUsername, isDeactivatedView: false };
              const isSelfActor = n.actorUid === currentUser.uid;
              const isFollowingActor = followingIds.includes(n.actorUid);
              const isFollowerActor = followerIds.includes(n.actorUid);
              const hasOutgoingPending = friendRequests.some(
                (r) =>
                  r.fromUid === currentUser.uid &&
                  r.toUid === n.actorUid &&
                  r.status === 'pending'
              );

              const showFollowAction =
                !isSelfActor &&
                !maskedActor.isDeactivatedView &&
                (n.type === 'follow' || n.type === 'friend_request');

              const followLabel = isFollowingActor
                ? t.explore.following
                : hasOutgoingPending
                ? t.explore.requestSent
                : isFollowerActor
                ? t.explore.followBack
                : t.explore.follow;

              return (
                <div
                  key={n.id}
                  className={`py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 ${
                    !n.read ? 'bg-sky-500/[0.04] -mx-2 px-2 rounded-2xl' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openUserProfile(n.actorUid)}
                    className="flex items-start gap-3 min-w-0 text-left flex-1 group"
                  >
                    <div className="relative shrink-0">
                      <Avatar
                        src={maskedActor.isDeactivatedView ? '' : n.actorAvatar}
                        name={maskedActor.displayName}
                        size="md"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow ring-1 ring-slate-200 dark:ring-slate-700">
                        {getTypeIcon(n.type)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800 dark:text-slate-100 leading-snug">
                        <span className="font-semibold group-hover:text-sky-600 dark:group-hover:text-sky-400">
                          @{maskedActor.username}
                        </span>{' '}
                        <span className="text-slate-600 dark:text-slate-300">{n.summary}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 inline-flex items-center gap-1.5">
                        <span>{formatRelativeTime(n.createdAt, language)}</span>
                        {!n.read && (
                          <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold">
                            · <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />{' '}
                            {language === 'bn' ? 'নতুন' : 'New'}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>

                  {showFollowAction && (
                    <button
                      type="button"
                      onClick={() => toggleFollow(n.actorUid)}
                      className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold shrink-0 transition-all duration-150 ${
                        isFollowingActor || hasOutgoingPending
                          ? 'liquid-glass-btn text-slate-700 dark:text-slate-200'
                          : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/20'
                      }`}
                    >
                      {followLabel}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
