import type {
  AppNotification,
  BroadcastChannel,
  Chat,
  ChatMessage,
  FriendRequest,
  NoteItem,
  Post,
  PostComment,
  StickerItem,
  Story,
  UserPrivate,
  UserPublic,
} from '../types/social';

import IMG_ARIA from '../assets/images/avatar_aria_1794697849198.jpg';
import IMG_RAFI from '../assets/images/avatar_rafi_1794697849109.jpg';
import IMG_SKYLINE from '../assets/images/post_skyline_golden_1794697850259.jpg';
import IMG_DESK from '../assets/images/post_studio_desk_1794697851365.jpg';
import IMG_COASTAL from '../assets/images/story_coastal_dawn_1794697851133.jpg';

export { IMG_ARIA, IMG_RAFI, IMG_SKYLINE, IMG_DESK, IMG_COASTAL };

export const INITIAL_USER: UserPublic = {
  uid: '',
  username: '',
  displayName: '',
  nicknameFont: 'classic',
  bio: '',
  pronouns: '',
  website: '',
  noteText: '',
  photoUrl: '',
  coverUrl: IMG_SKYLINE,
  interests: [],
  isPrivate: false,
  isDeactivated: false,
  deactivatedUntil: null,
  followersCount: 0,
  followingCount: 0,
  postsCount: 0,
  onlineStatus: 'online',
  lastSeenAt: new Date().toISOString(),
  lastNicknameChangedAt: null,
  lastUsernameChangedAt: null,
  onboardingCompleted: false,
  createdAt: new Date().toISOString(),
};

export const INITIAL_USER_PRIVATE: UserPrivate = {
  uid: '',
  email: '',
  language: 'en',
  themeMode: 'light',
  biometricLockEnabled: false,
  twoFactorEnabled: false,
  saveLoginInfo: true,
  whoCanMessage: 'everyone',
  whoCanViewStories: 'everyone',
  whoCanFollow: 'everyone',
  notificationPrefs: {
    follows: true,
    friendRequests: true,
    likes: true,
    comments: true,
    stories: true,
    messages: true,
    mentions: true,
    announcements: true,
  },
  blockedUserIds: [],
  mutedStoryUserIds: [],
  updatedAt: new Date().toISOString(),
};

// Clean empty initial state: no pre-populated accounts, posts, stories, or chats
export const INITIAL_CREATORS: UserPublic[] = [];
export const INITIAL_POSTS: Post[] = [];
export const INITIAL_COMMENTS: Record<string, PostComment[]> = {};
export const INITIAL_STORIES: Story[] = [];
export const INITIAL_CHATS: Chat[] = [];
export const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {};
export const INITIAL_NOTES: NoteItem[] = [];
export const INITIAL_BROADCASTS: BroadcastChannel[] = [];
export const INITIAL_FRIEND_REQUESTS: FriendRequest[] = [];
export const INITIAL_NOTIFICATIONS: AppNotification[] = [];

export const DEFAULT_STICKERS: StickerItem[] = [
  {
    id: 'stk_skyline',
    creatorUid: 'system',
    label: 'Golden Skyline',
    imageUrl: IMG_SKYLINE,
    kind: 'sticker',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'stk_coastal',
    creatorUid: 'system',
    label: 'Coastal Dawn',
    imageUrl: IMG_COASTAL,
    kind: 'sticker',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'stk_desk',
    creatorUid: 'system',
    label: 'Studio Vibe',
    imageUrl: IMG_DESK,
    kind: 'gif',
    createdAt: new Date().toISOString(),
  },
];
