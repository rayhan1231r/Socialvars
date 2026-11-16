import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BROADCAST_MIN_FOLLOWERS,
  canAddGroupMembers,
  canChangeNickname,
  canChangeUsername,
  canEditGroupInfo,
  canMessageUser,
  canOpenBroadcastChannel,
  canPostInBroadcast,
  canRemoveGroupMember,
  canSendInGroupChat,
  canViewPrivateProfileContent,
  canonicalizeEmail,
  evaluateRouteAccess,
  extractHashtags,
  formatCalendarDate,
  formatCompactCount,
  getMaskedUserDisplay,
  isAllowedSignupEmailProvider,
  isDisposableEmail,
  isHomeStoryVisibleToUser,
  isNoteVisibleToUser,
  isProtectedAppRoute,
  isStoryActive,
  isValidBio,
  isValidDateOfBirth,
  isValidDisplayName,
  isValidHighlightTitle,
  isValidPostCaption,
  isValidUsername,
  isValidWebsiteUrl,
  MAX_BIO_LENGTH,
  MAX_GROUP_MEMBERS,
  mapFirebaseAuthError,
  normalizeUsername,
  normalizeWebsiteUrl,
  parseAppRouteFromLocation,
  requiresFollowApproval,
  shouldNotifyUser,
  validateSignupEmail,
} from './validation';
import { TRANSLATIONS } from './i18n';
import {
  fromFirestoreValue,
  handleStandaloneApi,
  normalizeFirestorePost,
  resetStandaloneStoreForTesting,
  sha256Hex,
  toFirestoreFields,
} from './standaloneBackend';

test('username normalization and strict validation rules', () => {
  assert.equal(normalizeUsername('  Rafi_Ahmed! '), 'rafi_ahmed');
  assert.equal(isValidUsername('rafi_dhaka01'), true);
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('RafiUpper'), false);
  assert.equal(isValidUsername('bad-hyphen'), false);
});

test('email canonicalization enforces one account per Gmail and blocks disposable mail', () => {
  assert.equal(canonicalizeEmail('  John.Doe+work@Gmail.com '), 'johndoe@gmail.com');
  assert.equal(canonicalizeEmail('j.o.h.n.d.o.e@googlemail.com'), 'johndoe@gmail.com');
  assert.equal(canonicalizeEmail('Aria+news@outlook.com'), 'aria@outlook.com');

  // Temporary/disposable providers blocked strictly
  for (const temp of [
    'abc@tempmail.com',
    'user@temp-mail.org',
    'x@10minutemail.com',
    'y@guerrillamail.com',
    'z@mailinator.com',
    'q@yopmail.com',
    'sub@inbox.yopmail.com',
    'n@getnada.com',
    'm@maildrop.cc',
    't@trashmail.com',
    'b@burnermail.io',
    'd@mytemp.email',
    'e@tmpmail.org',
    'f@1secmail.com',
    'g@mail.tm',
    'h@mail.gw',
    'i@emailnator.com',
    'j@tmailor.com',
    'k@fviainboxes.com',
  ]) {
    assert.equal(isDisposableEmail(temp), true, `Expected ${temp} to be blocked`);
    assert.equal(validateSignupEmail(temp, 'en').valid, false);
    assert.equal(validateSignupEmail(temp, 'bn').valid, false);
  }

  // Allowed providers strictly limited to Gmail, Yahoo, Hotmail, and Outlook
  for (const allowed of [
    'rafi.ahmed@gmail.com',
    'rafi@googlemail.com',
    'aria@yahoo.com',
    'aria.bd@ymail.com',
    'studio@outlook.com',
    'member@hotmail.com',
    'team@live.com',
    'legacy@msn.com',
  ]) {
    assert.equal(isDisposableEmail(allowed), false, `Expected ${allowed} not disposable`);
    assert.equal(isAllowedSignupEmailProvider(allowed), true, `Expected ${allowed} in allowlist`);
    assert.equal(validateSignupEmail(allowed, 'en').valid, true);
    assert.equal(validateSignupEmail(allowed, 'bn').valid, true);
  }

  // Other unknown/custom/third-party domains blocked on signup
  for (const blocked of [
    'creator@icloud.com',
    'dev@proton.me',
    'someone@customdomain.xyz',
    'test@randommail.org',
  ]) {
    assert.equal(isAllowedSignupEmailProvider(blocked), false, `Expected ${blocked} rejected`);
    const resEn = validateSignupEmail(blocked, 'en');
    assert.equal(resEn.valid, false);
    assert.match(resEn.reason || '', /not allowed/i);
    assert.equal(validateSignupEmail(blocked, 'bn').valid, false);
  }
});

test('display name, 150-char bio, website, and post caption validation boundaries', () => {
  assert.equal(MAX_BIO_LENGTH, 150);
  assert.equal(isValidDisplayName('Aria Chowdhury'), true);
  assert.equal(isValidDisplayName('   '), false);
  assert.equal(isValidBio('A'.repeat(150)), true);
  assert.equal(isValidBio('A'.repeat(151)), false);
  assert.equal(isValidPostCaption('Hello SocialVerse!'), true);
  assert.equal(isValidPostCaption(''), false);
  assert.equal(isValidWebsiteUrl(''), true);
  assert.equal(isValidWebsiteUrl('aria.studio'), true);
  assert.equal(isValidWebsiteUrl('https://socialverse.app'), true);
  assert.equal(isValidWebsiteUrl('not a domain'), false);
  assert.equal(normalizeWebsiteUrl('aria.studio'), 'https://aria.studio');
});

test('7-day nickname cooldown and 14-day username cooldown enforcement', () => {
  const now = Date.UTC(2026, 10, 14, 12, 0, 0);
  assert.equal(canChangeNickname(null, now).allowed, true);
  assert.equal(canChangeUsername(null, now).allowed, true);

  const threeDaysAgo = new Date(now - 3 * 24 * 3_600_000).toISOString();
  const nickCheck = canChangeNickname(threeDaysAgo, now);
  assert.equal(nickCheck.allowed, false);
  assert.equal(nickCheck.remainingDays, 4);

  const eightDaysAgo = new Date(now - 8 * 24 * 3_600_000).toISOString();
  assert.equal(canChangeNickname(eightDaysAgo, now).allowed, true);

  const tenDaysAgo = new Date(now - 10 * 24 * 3_600_000).toISOString();
  const userCheck = canChangeUsername(tenDaysAgo, now);
  assert.equal(userCheck.allowed, false);
  assert.equal(userCheck.remainingDays, 4);

  const fifteenDaysAgo = new Date(now - 15 * 24 * 3_600_000).toISOString();
  assert.equal(canChangeUsername(fifteenDaysAgo, now).allowed, true);
});

test('broadcast channel 500-follower threshold and role permissions', () => {
  assert.equal(BROADCAST_MIN_FOLLOWERS, 500);
  assert.equal(canOpenBroadcastChannel(499), false);
  assert.equal(canOpenBroadcastChannel(500), true);

  const channel = {
    ownerUid: 'u_owner',
    adminUids: ['u_admin'],
    collaboratorUids: ['u_collab'],
  };
  assert.equal(canPostInBroadcast(channel, 'u_owner'), true);
  assert.equal(canPostInBroadcast(channel, 'u_admin'), true);
  assert.equal(canPostInBroadcast(channel, 'u_collab'), true);
  assert.equal(canPostInBroadcast(channel, 'u_follower'), false);
});

test('group chat 250-member limit and owner/admin hierarchy', () => {
  assert.equal(MAX_GROUP_MEMBERS, 250);
  const group = {
    ownerUid: 'owner_1',
    createdBy: 'owner_1',
    adminUids: ['admin_1'],
    participantIds: ['owner_1', 'admin_1', 'member_1'],
    maxMembers: 250,
    requireAddApproval: false,
  };
  assert.equal(canRemoveGroupMember(group, 'admin_1', 'owner_1'), false);
  assert.equal(canRemoveGroupMember(group, 'admin_1', 'member_1'), true);
  assert.equal(canRemoveGroupMember(group, 'owner_1', 'admin_1'), true);
  assert.equal(canRemoveGroupMember(group, 'member_1', 'admin_1'), false);

  const fullGroup = {
    ...group,
    participantIds: Array.from({ length: 250 }, (_, i) => `u_${i}`),
  };
  assert.equal(canAddGroupMembers(fullGroup, 'owner_1').allowed, false);
});

test('private profile content visibility and deactivated account masking', () => {
  const privateUser = { uid: 'u1', isPrivate: true, isDeactivated: false, displayName: 'Aria', username: 'aria' };
  assert.equal(canViewPrivateProfileContent(privateUser, 'u2', []), false);
  assert.equal(canViewPrivateProfileContent(privateUser, 'u2', ['u1']), true);
  assert.equal(canViewPrivateProfileContent(privateUser, 'u1', []), true);

  const deactivatedUser = { displayName: 'Aria', username: 'aria', isDeactivated: true };
  const masked = getMaskedUserDisplay(deactivatedUser, 'u2', 'u1');
  assert.equal(masked.displayName, 'SocialVerse User');
  assert.equal(masked.isDeactivatedView, true);
  assert.equal(getMaskedUserDisplay(deactivatedUser, 'u1', 'u1').displayName, 'Aria');
});

test('hashtag extraction supports English and Bengali scripts', () => {
  const tags = extractHashtags('Sunset over #Dhaka and #বাংলাদেশ #photography #dhaka');
  assert.deepEqual(tags, ['dhaka', 'বাংলাদেশ', 'photography']);
});

test('story 24h expiration check respects expiresAt timestamp', () => {
  const now = Date.UTC(2026, 10, 14, 12, 0, 0);
  const future = new Date(now + 3600_000).toISOString();
  const past = new Date(now - 1000).toISOString();
  assert.equal(isStoryActive({ expiresAt: future }, now), true);
  assert.equal(isStoryActive({ expiresAt: past }, now), false);
});

test('messaging privacy gate enforces blocklist and follower rules', () => {
  const basePrivacy = { whoCanMessage: 'followers' as const, blockedUserIds: ['bad_uid'] };
  assert.equal(canMessageUser(basePrivacy, 'bad_uid', true), false);
  assert.equal(canMessageUser(basePrivacy, 'stranger_uid', false), false);
  assert.equal(canMessageUser(basePrivacy, 'friend_uid', true), true);
  assert.equal(canMessageUser({ whoCanMessage: 'nobody', blockedUserIds: [] }, 'friend_uid', true), false);
});

test('firebase auth error mapping returns actionable bilingual guidance', () => {
  const opMsg = mapFirebaseAuthError({ code: 'auth/operation-not-allowed' }, 'en');
  assert.match(opMsg, /socialvars/);
  const credBn = mapFirebaseAuthError({ code: 'auth/invalid-credential' }, 'bn');
  assert.match(credBn, /সঠিক নয়/);
});

test('compact number formatting and bilingual translation key parity', () => {
  assert.equal(formatCompactCount(950), '950');
  assert.equal(formatCompactCount(12400), '12.4K');
  assert.equal(formatCompactCount(2_000_000), '2M');
  assert.deepEqual(Object.keys(TRANSLATIONS.en), Object.keys(TRANSLATIONS.bn));
  assert.deepEqual(Object.keys(TRANSLATIONS.en.auth), Object.keys(TRANSLATIONS.bn.auth));
  assert.deepEqual(Object.keys(TRANSLATIONS.en.feed), Object.keys(TRANSLATIONS.bn.feed));
  assert.deepEqual(Object.keys(TRANSLATIONS.en.nav), Object.keys(TRANSLATIONS.bn.nav));
  assert.deepEqual(Object.keys(TRANSLATIONS.en.messages), Object.keys(TRANSLATIONS.bn.messages));
  assert.deepEqual(Object.keys(TRANSLATIONS.en.profile), Object.keys(TRANSLATIONS.bn.profile));
  assert.deepEqual(Object.keys(TRANSLATIONS.en.settings), Object.keys(TRANSLATIONS.bn.settings));
});

test('group restrictions and highlight validation rules', () => {
  const chat = {
    type: 'group' as const,
    ownerUid: 'u_owner',
    createdBy: 'u_owner',
    adminUids: ['u_admin'],
    participantIds: ['u_owner', 'u_admin', 'u_member'],
    restrictions: {
      adminsOnlyMessages: true,
      onlyAdminsEditInfo: true,
      blockMediaAttachments: true,
    },
  };
  assert.equal(canSendInGroupChat(chat, 'u_owner', 'text').allowed, true);
  assert.equal(canSendInGroupChat(chat, 'u_admin', 'image').allowed, true);
  assert.equal(canSendInGroupChat(chat, 'u_member', 'text').allowed, false);
  assert.equal(canEditGroupInfo(chat, 'u_admin'), true);
  assert.equal(canEditGroupInfo(chat, 'u_member'), false);

  const mediaRestrictedOnly = {
    ...chat,
    restrictions: { adminsOnlyMessages: false, onlyAdminsEditInfo: false, blockMediaAttachments: true },
  };
  assert.equal(canSendInGroupChat(mediaRestrictedOnly, 'u_member', 'text').allowed, true);
  assert.equal(canSendInGroupChat(mediaRestrictedOnly, 'u_member', 'image').allowed, false);
  assert.equal(canEditGroupInfo(mediaRestrictedOnly, 'u_member'), true);

  assert.equal(isValidHighlightTitle('Dhaka Trip'), true);
  assert.equal(isValidHighlightTitle('   '), false);
  assert.equal(isValidHighlightTitle('A'.repeat(37)), false);
});

test('home stories bar only shows followed friends and own active stories', () => {
  const now = Date.UTC(2026, 10, 15, 12, 0, 0);
  const future = new Date(now + 3600_000).toISOString();
  const storyFriend = { authorId: 'u_friend', expiresAt: future, privacy: 'everyone' as const };
  const storyStranger = { authorId: 'u_stranger', expiresAt: future, privacy: 'everyone' as const };
  const storyOwn = { authorId: 'u_me', expiresAt: future, privacy: 'everyone' as const };

  assert.equal(
    isHomeStoryVisibleToUser(storyOwn, { uid: 'u_me', isPrivate: true, isDeactivated: false }, 'u_me', [], now),
    true
  );
  assert.equal(
    isHomeStoryVisibleToUser(storyFriend, { uid: 'u_friend', isPrivate: true, isDeactivated: false }, 'u_me', ['u_friend'], now),
    true
  );
  assert.equal(
    isHomeStoryVisibleToUser(storyStranger, { uid: 'u_stranger', isPrivate: false, isDeactivated: false }, 'u_me', ['u_friend'], now),
    false
  );
  assert.equal(
    isHomeStoryVisibleToUser(storyStranger, { uid: 'u_stranger', isPrivate: false, isDeactivated: false }, null, [], now),
    false
  );
});

test('follow approval requirement respects both private lock and whoCanFollow setting', () => {
  assert.equal(requiresFollowApproval({ isPrivate: true }, { whoCanFollow: 'everyone' }), true);
  assert.equal(requiresFollowApproval({ isPrivate: false }, { whoCanFollow: 'approval' }), true);
  assert.equal(requiresFollowApproval({ isPrivate: false }, { whoCanFollow: 'everyone' }), false);
  assert.equal(requiresFollowApproval({ isPrivate: false }, undefined), false);
});

test('dateOfBirth strict calendar, 13+ age, and timezone-safe formatting validation', () => {
  const now = Date.UTC(2026, 10, 15, 12, 0, 0); // Nov 15, 2026
  assert.equal(isValidDateOfBirth('2001-05-15', now).valid, true);
  assert.equal(isValidDateOfBirth('2013-11-15', now).valid, true); // Exactly 13 today
  assert.equal(isValidDateOfBirth('2013-11-16', now).reason, 'too_young'); // 13 tomorrow
  assert.equal(isValidDateOfBirth('2027-01-01', now).reason, 'future');
  assert.equal(isValidDateOfBirth('2000-02-30', now).reason, 'invalid_date');
  assert.equal(isValidDateOfBirth('1899-12-31', now).reason, 'too_old');
  assert.equal(isValidDateOfBirth('15-05-2001', now).reason, 'format');

  assert.equal(formatCalendarDate('2001-05-15', 'en'), 'May 15, 2001');
  assert.ok(formatCalendarDate('2026-11-15T10:00:00.000Z', 'en').includes('2026'));
});

test('close friends stories and notes are restricted to owner and approved close friends', () => {
  const now = Date.UTC(2026, 10, 15, 12, 0, 0);
  const future = new Date(now + 3600_000).toISOString();
  const cfStory = { authorId: 'u_author', expiresAt: future, privacy: 'close_friends' as const };
  const cfNote = { authorUid: 'u_author', expiresAt: future, audience: 'close_friends' as const };
  const author = { uid: 'u_author', isPrivate: false, isDeactivated: false };

  assert.equal(isHomeStoryVisibleToUser(cfStory, author, 'u_author', [], now, []), true);
  assert.equal(isHomeStoryVisibleToUser(cfStory, author, 'u_bestie', ['u_author'], now, ['u_bestie']), true);
  assert.equal(isHomeStoryVisibleToUser(cfStory, author, 'u_other', ['u_author'], now, ['u_bestie']), false);

  assert.equal(isNoteVisibleToUser(cfNote, author, 'u_author', [], now, []), true);
  assert.equal(isNoteVisibleToUser(cfNote, author, 'u_bestie', ['u_author'], now, ['u_bestie']), true);
  assert.equal(isNoteVisibleToUser(cfNote, author, 'u_other', ['u_author'], now, ['u_bestie']), false);
});

test('notification gating honors pausedAll, per-type prefs, and muted chats', () => {
  assert.equal(shouldNotifyUser(undefined, 'message', false), true);
  assert.equal(shouldNotifyUser(undefined, 'group_message', true), false);
  assert.equal(shouldNotifyUser({ pausedAll: true, messages: true }, 'message', false), false);
  assert.equal(shouldNotifyUser({ groupMessages: false }, 'group_message', false), false);
  assert.equal(shouldNotifyUser({ uploadProgress: false }, 'upload', false), false);
  assert.equal(shouldNotifyUser({ uploadProgress: true, groupMessages: true }, 'upload', false), true);
});

test('protected route guard enforces Firebase Auth readiness and route protection rules', () => {
  assert.equal(isProtectedAppRoute({ activeTab: 'home', subscreen: null }), false);
  assert.equal(isProtectedAppRoute({ activeTab: 'reels', subscreen: null }), false);
  assert.equal(isProtectedAppRoute({ activeTab: 'explore', subscreen: null }), false);
  assert.equal(isProtectedAppRoute({ activeTab: 'messages', subscreen: null }), true);
  assert.equal(isProtectedAppRoute({ activeTab: 'profile', subscreen: null, currentUid: '' }), true);
  assert.equal(
    isProtectedAppRoute({
      activeTab: 'profile',
      subscreen: null,
      viewedProfileUid: 'u_creator',
      currentUid: '',
    }),
    false
  );
  assert.equal(isProtectedAppRoute({ activeTab: 'home', subscreen: 'settings_home' }), true);
  assert.equal(isProtectedAppRoute({ activeTab: 'home', subscreen: 'notifications' }), true);
  assert.equal(isProtectedAppRoute({ activeTab: 'home', subscreen: 'create_sheet' }), true);

  assert.deepEqual(
    evaluateRouteAccess({
      activeTab: 'home',
      isAuthenticated: false,
      authReady: false,
    }),
    { protectedRoute: false, decision: 'loading' }
  );
  assert.deepEqual(
    evaluateRouteAccess({
      activeTab: 'messages',
      isAuthenticated: false,
      authReady: true,
    }),
    { protectedRoute: true, decision: 'require_auth' }
  );
  assert.deepEqual(
    evaluateRouteAccess({
      activeTab: 'messages',
      isAuthenticated: true,
      authReady: true,
    }),
    { protectedRoute: true, decision: 'allow' }
  );
  assert.deepEqual(
    evaluateRouteAccess({
      activeTab: 'home',
      isAuthenticated: false,
      authReady: true,
    }),
    { protectedRoute: false, decision: 'allow' }
  );
});

test('URL route parser maps paths, hashes, and query tabs accurately', () => {
  assert.deepEqual(parseAppRouteFromLocation('/messages'), { tab: 'messages', subscreen: null });
  assert.deepEqual(parseAppRouteFromLocation('/', '#/reels'), { tab: 'reels', subscreen: null });
  assert.deepEqual(parseAppRouteFromLocation('/', '', '?tab=explore'), {
    tab: 'explore',
    subscreen: null,
  });
  assert.deepEqual(parseAppRouteFromLocation('/settings'), {
    tab: 'home',
    subscreen: 'settings_home',
  });
  assert.deepEqual(parseAppRouteFromLocation('/notifications'), {
    tab: 'home',
    subscreen: 'notifications',
  });
  assert.deepEqual(parseAppRouteFromLocation('/create'), {
    tab: 'home',
    subscreen: 'create_sheet',
  });
  assert.deepEqual(parseAppRouteFromLocation('/'), { tab: 'home', subscreen: null });
});

test('standalone Android backend handles OTP signup, login, posts, likes, and bilingual AI assist', async () => {
  resetStandaloneStoreForTesting();
  const initialState = await handleStandaloneApi('/api/state', {}, null);
  assert.equal(initialState.ok, true);
  assert.equal(initialState.data.currentUser, null);

  const otpRes = await handleStandaloneApi('/api/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email: 'aria.test@gmail.com', purpose: 'signup', language: 'en' }),
  });
  assert.equal(otpRes.ok, true);
  const code = String(otpRes.data.devOtpCode);
  assert.equal(code.length, 6);

  const verRes = await handleStandaloneApi('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email: 'aria.test@gmail.com', code, purpose: 'signup' }),
  });
  assert.equal(verRes.ok, true);

  const regRes = await handleStandaloneApi('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      verificationToken: verRes.data.verificationToken,
      email: 'aria.test@gmail.com',
      password: 'password123',
      displayName: 'Aria Rahman',
      nicknameFont: 'classic',
      username: 'aria_rahman',
      dateOfBirth: '2000-05-10',
      language: 'en',
    }),
  });
  assert.equal(regRes.ok, true);
  const token = String(regRes.data.token);

  const loginByUsername = await handleStandaloneApi('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: '@aria_rahman', password: 'password123' }),
  });
  assert.equal(loginByUsername.ok, true);

  const savedTokenLogin = await handleStandaloneApi('/api/auth/login-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  assert.equal(savedTokenLogin.ok, true);

  const postRes = await handleStandaloneApi(
    '/api/posts',
    {
      method: 'POST',
      body: JSON.stringify({
        caption: 'Hello #SocialVerse from Android!',
        mediaUrls: [],
        mediaType: 'text',
        visibility: 'public',
      }),
    },
    token
  );
  assert.equal(postRes.ok, true);
  const postId = String((postRes.data.post as { id: string }).id);

  const likeRes = await handleStandaloneApi(`/api/posts/${postId}/like`, { method: 'POST' }, token);
  assert.equal(likeRes.ok, true);
  assert.equal(likeRes.data.likesCount, 1);

  const aiBnRes = await handleStandaloneApi(
    '/api/ai/profile-assist',
    {
      method: 'POST',
      body: JSON.stringify({ task: 'bio', contextText: 'photography', language: 'bn' }),
    },
    token
  );
  assert.equal(aiBnRes.ok, true);
  assert.equal(Array.isArray(aiBnRes.data.suggestions), true);
  assert.equal((aiBnRes.data.suggestions as string[]).length, 3);
  resetStandaloneStoreForTesting();
});

test('Firestore REST serialization and coverUrl-to-mediaUrls hydration for posts match Node crypto', () => {
  const sampleEmail = 'rayhanahamad50@gmail.com';
  const expectedHash = crypto.createHash('sha256').update(sampleEmail).digest('hex');
  assert.equal(sha256Hex(sampleEmail), expectedHash);

  const fields = toFirestoreFields({
    id: 'post_1',
    likesCount: 3,
    visibility: 'public',
    hashtags: ['socialverse'],
  });
  assert.equal(fromFirestoreValue(fields.id), 'post_1');
  assert.equal(fromFirestoreValue(fields.likesCount), 3);
  assert.deepEqual(fromFirestoreValue(fields.hashtags), ['socialverse']);

  const hydratedPost = normalizeFirestorePost(
    {
      id: 'post_1794820104512_klml',
      authorId: 'z8GLaTu6RVNpz9OKEDI32YZvNMe2',
      authorUsername: 'r1achr',
      caption: 'First post',
      mediaUrls: [],
      coverUrl: 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4',
      mediaType: 'image',
      visibility: 'public',
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
    },
    { displayName: 'Rayhan', photoUrl: '' }
  );

  assert.equal(hydratedPost.caption, 'First post');
  assert.equal(hydratedPost.authorUsername, 'r1achr');
  assert.equal(hydratedPost.authorDisplayName, 'Rayhan');
  assert.deepEqual(hydratedPost.mediaUrls, ['data:image/webp;base64,UklGRh4AAABXRUJQVlA4']);
});



