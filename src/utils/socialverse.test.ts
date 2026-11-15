import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canMessageUser,
  extractHashtags,
  formatCompactCount,
  isStoryActive,
  isValidBio,
  isValidDisplayName,
  isValidPostCaption,
  isValidUsername,
  isValidWebsiteUrl,
  mapFirebaseAuthError,
  normalizeUsername,
  normalizeWebsiteUrl,
} from './validation';
import { TRANSLATIONS } from './i18n';

test('username normalization and strict validation rules', () => {
  assert.equal(normalizeUsername('  Rafi_Ahmed! '), 'rafi_ahmed');
  assert.equal(isValidUsername('rafi_dhaka01'), true);
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('RafiUpper'), false);
  assert.equal(isValidUsername('bad-hyphen'), false);
});

test('display name, bio, website, and post caption validation boundaries', () => {
  assert.equal(isValidDisplayName('Aria Chowdhury'), true);
  assert.equal(isValidDisplayName('   '), false);
  assert.equal(isValidBio('A'.repeat(240)), true);
  assert.equal(isValidBio('A'.repeat(241)), false);
  assert.equal(isValidPostCaption('Hello SocialVerse!'), true);
  assert.equal(isValidPostCaption(''), false);
  assert.equal(isValidWebsiteUrl(''), true);
  assert.equal(isValidWebsiteUrl('aria.studio'), true);
  assert.equal(isValidWebsiteUrl('https://socialverse.app'), true);
  assert.equal(isValidWebsiteUrl('not a domain'), false);
  assert.equal(normalizeWebsiteUrl('aria.studio'), 'https://aria.studio');
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
  assert.match(opMsg, /Continue with Google/i);
  assert.match(opMsg, /ai-studio-applet-webapp-7613c/);
  const credBn = mapFirebaseAuthError({ code: 'auth/invalid-credential' }, 'bn');
  assert.match(credBn, /সঠিক নয়/);
});

test('compact number formatting and bilingual translation key parity', () => {
  assert.equal(formatCompactCount(950), '950');
  assert.equal(formatCompactCount(12400), '12.4K');
  assert.equal(formatCompactCount(2_000_000), '2M');
  assert.deepEqual(Object.keys(TRANSLATIONS.en), Object.keys(TRANSLATIONS.bn));
  assert.deepEqual(Object.keys(TRANSLATIONS.en.auth), Object.keys(TRANSLATIONS.bn.auth));
  assert.deepEqual(Object.keys(TRANSLATIONS.en.nav), Object.keys(TRANSLATIONS.bn.nav));
  assert.deepEqual(Object.keys(TRANSLATIONS.en.messages), Object.keys(TRANSLATIONS.bn.messages));
  assert.deepEqual(Object.keys(TRANSLATIONS.en.profile), Object.keys(TRANSLATIONS.bn.profile));
  assert.deepEqual(Object.keys(TRANSLATIONS.en.settings), Object.keys(TRANSLATIONS.bn.settings));
});
