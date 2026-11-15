import type { AppLanguage } from '../types/social';

export interface TranslationBundle {
  appName: string;
  tagline: string;
  nav: {
    home: string;
    reels: string;
    explore: string;
    create: string;
    messages: string;
    profile: string;
  };
  auth: {
    signIn: string;
    register: string;
    identifierLabel: string;
    emailLabel: string;
    passwordLabel: string;
    forgotPassword: string;
    sendReset: string;
    sendCode: string;
    verifyCode: string;
    otpTitle: string;
    otpDesc: string;
    otpPlaceholder: string;
    nicknameTitle: string;
    nicknameLabel: string;
    fontStyleLabel: string;
    usernameStepTitle: string;
    usernameAvailable: string;
    usernameTaken: string;
    usernameInvalid: string;
    photoStepTitle: string;
    skipForNow: string;
    savedLoginsTitle: string;
    useAnotherAccount: string;
    saveLoginInfo: string;
    logout: string;
    onboardingTitle: string;
    usernameLabel: string;
    displayNameLabel: string;
    bioLabel: string;
    interestsLabel: string;
    privateAccountLabel: string;
    completeSetup: string;
    biometricTitle: string;
    biometricUnlock: string;
    authGateTitle: string;
    authGateDesc: string;
    continueBrowsing: string;
    guestBannerTitle: string;
    guestBannerDesc: string;
    splashLoading: string;
  };
  feed: {
    stories: string;
    addStory: string;
    recommended: string;
    followingFeed: string;
    like: string;
    comment: string;
    share: string;
    save: string;
    saved: string;
    report: string;
    editPost: string;
    deletePost: string;
    writeComment: string;
    postButton: string;
    loadMore: string;
    noPosts: string;
    emptyHomeDesc: string;
    swipeCreateHint: string;
  };
  create: {
    newPost: string;
    newStory: string;
    newReel: string;
    captionPlaceholder: string;
    mediaUrlLabel: string;
    reelCoverLabel: string;
    visibilityLabel: string;
    publicOpt: string;
    followersOpt: string;
    onlyMeOpt: string;
    publish: string;
    storyTextPlaceholder: string;
  };
  explore: {
    searchPlaceholder: string;
    trendingHashtags: string;
    suggestedAccounts: string;
    popularPosts: string;
    all: string;
    users: string;
    posts: string;
    reels: string;
    follow: string;
    following: string;
    followBack: string;
    requestSent: string;
  };
  messages: {
    chatsTitle: string;
    searchChats: string;
    newGroup: string;
    online: string;
    typing: string;
    typeMessage: string;
    recordVoice: string;
    stopRecording: string;
    replyingTo: string;
    deleteMessage: string;
    blockUser: string;
    unblockUser: string;
    seen: string;
    delivered: string;
    primaryTab: string;
    groupsTab: string;
    broadcastsTab: string;
    requestsTab: string;
    notesTitle: string;
    yourNote: string;
    addNotePlaceholder: string;
    activeNow: string;
    backToInbox: string;
    chatInfo: string;
    themes: string;
    stickers: string;
    createSticker: string;
    saveSticker: string;
    savedStickers: string;
    voiceCall: string;
    videoCall: string;
    uploadTheme: string;
    chatNicknames: string;
    archivedTab: string;
    editMessage: string;
    editedLabel: string;
    copyMessage: string;
    forwardMessage: string;
    pinMessage: string;
    unpinMessage: string;
    starMessage: string;
    unstarMessage: string;
    pinChat: string;
    unpinChat: string;
    muteChat: string;
    unmuteChat: string;
    archiveChat: string;
    unarchiveChat: string;
    markUnread: string;
    searchInChat: string;
    disappearing: string;
    mediaAndFiles: string;
    starredMessages: string;
    forwardedLabel: string;
    backToFeed: string;
  };
  profile: {
    posts: string;
    reelsTab: string;
    followers: string;
    following: string;
    editProfile: string;
    shareProfile: string;
    message: string;
    savedPosts: string;
    friendRequests: string;
    aiAssistant: string;
    settings: string;
    broadcastChannel: string;
    switchAccount: string;
    addAccount: string;
    accept: string;
    reject: string;
    removeFollower: string;
    mutualFriends: string;
    publicProfile: string;
    privateProfile: string;
    privateAccountLocked: string;
    viewAll: string;
    noRequests: string;
    pronounsLabel: string;
    websiteLabel: string;
    changePhoto: string;
    deletePhoto: string;
    changeCover: string;
    removeCover: string;
    saveChanges: string;
    reportUser: string;
  };
  ai: {
    title: string;
    subtitle: string;
    openAssistant: string;
    taskBio: string;
    taskUsername: string;
    taskCaption: string;
    taskImproveBio: string;
    taskSmartReplies: string;
    promptPlaceholder: string;
    generate: string;
    applyToProfile: string;
    signInRequired: string;
  };
  settings: {
    title: string;
    notifications: string;
    privacy: string;
    security: string;
    account: string;
    accountSwitch: string;
    blockedUsers: string;
    language: string;
    theme: string;
    lightMode: string;
    darkMode: string;
    aboutLegal: string;
    androidProject: string;
    twoFactor: string;
    changePassword: string;
    deactivateAccount: string;
    deleteAccount: string;
    biometricLock: string;
    whoCanMessage: string;
    whoCanViewStories: string;
    submitReport: string;
    reportReason: string;
  };
}

export const TRANSLATIONS: Record<AppLanguage, TranslationBundle> = {
  en: {
    appName: 'SocialVerse',
    tagline: 'Pure connection in liquid clarity',
    nav: {
      home: 'Home',
      reels: 'Reels',
      explore: 'Explore',
      create: 'Create',
      messages: 'Inbox',
      profile: 'Profile',
    },
    auth: {
      signIn: 'Sign In',
      register: 'Sign Up',
      identifierLabel: 'Email or username',
      emailLabel: 'Email address',
      passwordLabel: 'Password',
      forgotPassword: 'Forgot password?',
      sendReset: 'Reset password',
      sendCode: 'Send verification code',
      verifyCode: 'Verify code',
      otpTitle: 'Enter verification code',
      otpDesc: 'Enter the 6-digit code sent to your email address.',
      otpPlaceholder: '6-digit code',
      nicknameTitle: 'Choose your nickname & style',
      nicknameLabel: 'Nickname',
      fontStyleLabel: 'Nickname font style',
      usernameStepTitle: 'Pick a unique username',
      usernameAvailable: 'Available',
      usernameTaken: 'Already taken',
      usernameInvalid: 'Use 3-24 lowercase letters, numbers, or underscores.',
      photoStepTitle: 'Add a profile picture',
      skipForNow: 'Skip for now',
      savedLoginsTitle: 'Saved accounts on this device',
      useAnotherAccount: 'Use email or username',
      saveLoginInfo: 'Save login info for faster sign-in',
      logout: 'Log Out',
      onboardingTitle: 'Set up your SocialVerse identity',
      usernameLabel: 'Username',
      displayNameLabel: 'Nickname',
      bioLabel: 'Bio (max 150 chars)',
      interestsLabel: 'Select interests',
      privateAccountLabel: 'Private account (approve followers)',
      completeSetup: 'Complete Sign Up',
      biometricTitle: 'SocialVerse Locked',
      biometricUnlock: 'Unlock with Biometrics',
      authGateTitle: 'Sign in to SocialVerse',
      authGateDesc: 'Sign in with your email or username, or create a new account.',
      continueBrowsing: 'Keep browsing',
      guestBannerTitle: 'Sign in to view your profile',
      guestBannerDesc: 'Your profile, messages, and saved items appear after you sign in.',
      splashLoading: 'Loading SocialVerse...',
    },
    feed: {
      stories: 'Stories',
      addStory: 'Your Story',
      recommended: 'For You',
      followingFeed: 'Following',
      like: 'Like',
      comment: 'Comment',
      share: 'Share',
      save: 'Save',
      saved: 'Saved',
      report: 'Report',
      editPost: 'Edit post',
      deletePost: 'Delete post',
      writeComment: 'Write a comment...',
      postButton: 'Post',
      loadMore: 'Load more posts',
      noPosts: 'No posts yet. Share your first post, story, or reel.',
      emptyHomeDesc: 'New accounts and posts from you and people you connect with will appear right here.',
      swipeCreateHint: 'Swipe left or tap + to create a Post, Story, or Reel',
    },
    create: {
      newPost: 'New Post',
      newStory: 'New Story',
      newReel: 'New Reel',
      captionPlaceholder: 'Write a caption or #hashtag...',
      mediaUrlLabel: 'Upload from Gallery or Paste URL',
      reelCoverLabel: 'Reel Cover / Banner Photo',
      visibilityLabel: 'Audience',
      publicOpt: 'Public',
      followersOpt: 'Friends only',
      onlyMeOpt: 'Only me (Private)',
      publish: 'Publish',
      storyTextPlaceholder: 'Write a text story for the next 24 hours...',
    },
    explore: {
      searchPlaceholder: 'Search usernames, IDs, posts, or reels',
      trendingHashtags: 'Trending Hashtags',
      suggestedAccounts: 'Accounts',
      popularPosts: 'Posts & Reels',
      all: 'All',
      users: 'Accounts',
      posts: 'Posts',
      reels: 'Reels',
      follow: 'Follow',
      following: 'Following',
      followBack: 'Follow Back',
      requestSent: 'Requested',
    },
    messages: {
      chatsTitle: 'Inbox',
      searchChats: 'Search messages or people...',
      newGroup: 'New Group',
      online: 'Online',
      typing: 'typing...',
      typeMessage: 'Message...',
      recordVoice: 'Record voice message',
      stopRecording: 'Stop & send voice note',
      replyingTo: 'Replying to',
      deleteMessage: 'Delete message',
      blockUser: 'Block user',
      unblockUser: 'Unblock',
      seen: 'Seen',
      delivered: 'Delivered',
      primaryTab: 'Primary',
      groupsTab: 'Groups',
      broadcastsTab: 'Broadcasts',
      requestsTab: 'Requests',
      notesTitle: 'Notes',
      yourNote: 'Your note',
      addNotePlaceholder: 'Share a quick note...',
      activeNow: 'Active now',
      backToInbox: 'Inbox',
      chatInfo: 'Chat Details',
      themes: 'Chat Theme',
      stickers: 'Stickers',
      createSticker: 'Create Sticker',
      saveSticker: 'Save Sticker',
      savedStickers: 'Favorites',
      voiceCall: 'Voice Call',
      videoCall: 'Video Call',
      uploadTheme: 'Upload from gallery',
      chatNicknames: 'Nicknames',
      archivedTab: 'Archived',
      editMessage: 'Edit',
      editedLabel: 'Edited',
      copyMessage: 'Copy',
      forwardMessage: 'Forward',
      pinMessage: 'Pin',
      unpinMessage: 'Unpin',
      starMessage: 'Star',
      unstarMessage: 'Unstar',
      pinChat: 'Pin chat',
      unpinChat: 'Unpin chat',
      muteChat: 'Mute notifications',
      unmuteChat: 'Unmute notifications',
      archiveChat: 'Archive chat',
      unarchiveChat: 'Unarchive chat',
      markUnread: 'Mark as unread',
      searchInChat: 'Search in conversation...',
      disappearing: 'Disappearing messages',
      mediaAndFiles: 'Media & Files',
      starredMessages: 'Starred Messages',
      forwardedLabel: 'Forwarded',
      backToFeed: 'Back to Feed',
    },
    profile: {
      posts: 'Posts',
      reelsTab: 'Reels',
      followers: 'Followers',
      following: 'Following',
      editProfile: 'Edit Profile',
      shareProfile: 'Share Profile',
      message: 'Message',
      savedPosts: 'Saved',
      friendRequests: 'Follow Requests',
      aiAssistant: 'AI Assistant',
      settings: 'Settings',
      broadcastChannel: 'Broadcast Channel',
      switchAccount: 'Switch Account',
      addAccount: 'Add Account',
      accept: 'Confirm',
      reject: 'Delete',
      removeFollower: 'Remove',
      mutualFriends: 'mutual',
      publicProfile: 'Public profile',
      privateProfile: 'Private account',
      privateAccountLocked: 'This account is private. Follow to see their posts and reels.',
      viewAll: 'View all',
      noRequests: 'No pending follow requests.',
      pronounsLabel: 'Pronouns',
      websiteLabel: 'Website / Link',
      changePhoto: 'Upload / Change Photo',
      deletePhoto: 'Delete Photo',
      changeCover: 'Change cover',
      removeCover: 'Remove cover',
      saveChanges: 'Save Changes',
      reportUser: 'Report User',
    },
    ai: {
      title: 'Gemini Profile Assistant',
      subtitle: 'Craft sharper bios, unique usernames, captions, and smart replies.',
      openAssistant: 'Open Gemini Assistant',
      taskBio: 'Generate Bio',
      taskUsername: 'Suggest Usernames',
      taskCaption: 'Write Caption',
      taskImproveBio: 'Improve My Bio',
      taskSmartReplies: 'Smart Replies',
      promptPlaceholder: 'Describe your vibe, niche, or topic...',
      generate: 'Generate with Gemini',
      applyToProfile: 'Apply to Profile',
      signInRequired: 'Sign in with an active session to run live Gemini generation.',
    },
    settings: {
      title: 'Settings & Activity',
      notifications: 'Notifications',
      privacy: 'Account Privacy',
      security: 'Password & Security',
      account: 'Account Ownership & Control',
      accountSwitch: 'Account Switcher & Saved Logins',
      blockedUsers: 'Blocked Accounts',
      language: 'Language',
      theme: 'Appearance',
      lightMode: 'Light',
      darkMode: 'Dark',
      aboutLegal: 'About & Safety',
      androidProject: 'Architecture & Firebase',
      twoFactor: 'Two-Factor Authentication (2FA)',
      changePassword: 'Change Password',
      deactivateAccount: 'Deactivate Account',
      deleteAccount: 'Delete Account Permanently',
      biometricLock: 'Biometric App Lock',
      whoCanMessage: 'Who can message you',
      whoCanViewStories: 'Who can view your stories',
      submitReport: 'Submit Report',
      reportReason: 'Add details or select a suggested reason...',
    },
  },
  bn: {
    appName: 'সোশ্যালভার্স',
    tagline: 'স্বচ্ছ তরল নকশায় সংযুক্ত থাকুন',
    nav: {
      home: 'হোম',
      reels: 'রিলস',
      explore: 'এক্সপ্লোর',
      create: 'তৈরি করুন',
      messages: 'ইনবক্স',
      profile: 'প্রোফাইল',
    },
    auth: {
      signIn: 'সাইন ইন',
      register: 'সাইন আপ',
      identifierLabel: 'ইমেইল বা ইউজারনেম',
      emailLabel: 'ইমেইল ঠিকানা',
      passwordLabel: 'পাসওয়ার্ড',
      forgotPassword: 'পাসওয়ার্ড ভুলে গেছেন?',
      sendReset: 'পাসওয়ার্ড রিসেট করুন',
      sendCode: 'কোড পাঠান',
      verifyCode: 'কোড যাচাই করুন',
      otpTitle: 'ভেরিফিকেশন কোড দিন',
      otpDesc: 'আপনার ইমেইলে পাঠানো ৬ ডিজিটের কোডটি বসান।',
      otpPlaceholder: '৬-ডিজিটের কোড',
      nicknameTitle: 'নিকনেম এবং ফন্ট স্টাইল বাছাই করুন',
      nicknameLabel: 'নিকনেম',
      fontStyleLabel: 'নিকনেম ফন্ট স্টাইল',
      usernameStepTitle: 'একটি ইউনিক ইউজারনেম দিন',
      usernameAvailable: 'এভেইলেবল',
      usernameTaken: 'অলরেডি টেকেন',
      usernameInvalid: '৩-২৪ অক্ষরের ছোট হাতের ইংরেজি অক্ষর, সংখ্যা বা _ ব্যবহার করুন।',
      photoStepTitle: 'প্রোফাইল ছবি আপলোড করুন',
      skipForNow: 'স্কিপ করুন',
      savedLoginsTitle: 'এই ডিভাইসে সেভ করা অ্যাকাউন্ট',
      useAnotherAccount: 'ইমেইল বা ইউজারনেম দিয়ে লগইন',
      saveLoginInfo: 'দ্রুত লগইনের জন্য তথ্য সেভ রাখুন',
      logout: 'লগ আউট',
      onboardingTitle: 'আপনার সোশ্যালভার্স পরিচিতি সাজান',
      usernameLabel: 'ইউজারনেম',
      displayNameLabel: 'নিকনেম',
      bioLabel: 'বায়ো (সর্বোচ্চ ১৫০ অক্ষর)',
      interestsLabel: 'আগ্রহের বিষয় নির্বাচন করুন',
      privateAccountLabel: 'প্রাইভেট অ্যাকাউন্ট (ফলো রিকোয়েস্ট অনুমোদন)',
      completeSetup: 'সাইন আপ সম্পন্ন করুন',
      biometricTitle: 'সোশ্যালভার্স লক করা আছে',
      biometricUnlock: 'বায়োমেট্রিক দিয়ে আনলক করুন',
      authGateTitle: 'সোশ্যালভার্সে সাইন ইন করুন',
      authGateDesc: 'ইমেইল বা ইউজারনেম দিয়ে লগইন করুন অথবা নতুন অ্যাকাউন্ট খুলুন।',
      continueBrowsing: 'ব্রাউজ চালিয়ে যান',
      guestBannerTitle: 'প্রোফাইল দেখতে সাইন ইন করুন',
      guestBannerDesc: 'প্রোফাইল, মেসেজ এবং সেভ করা পোস্ট দেখতে আপনার অ্যাকাউন্টে লগইন বা সাইন আপ করুন।',
      splashLoading: 'সোশ্যালভার্স লোড হচ্ছে...',
    },
    feed: {
      stories: 'স্টোরিজ',
      addStory: 'আপনার স্টোরি',
      recommended: 'আপনার জন্য',
      followingFeed: 'ফলোয়িং',
      like: 'লাইক',
      comment: 'মন্তব্য',
      share: 'শেয়ার',
      save: 'সেভ',
      saved: 'সেভ করা হয়েছে',
      report: 'রিপোর্ট',
      editPost: 'পোস্ট এডিট করুন',
      deletePost: 'পোস্ট মুছুন',
      writeComment: 'মন্তব্য লিখুন...',
      postButton: 'পোস্ট',
      loadMore: 'আরও পোস্ট দেখুন',
      noPosts: 'এখনো কোনো পোস্ট নেই। আপনার প্রথম পোস্ট, স্টোরি বা রিল শেয়ার করুন।',
      emptyHomeDesc: 'নতুন অ্যাকাউন্ট তৈরি হলে এবং পোস্ট করলে সেগুলো এখানে দেখাবে।',
      swipeCreateHint: 'বামে স্লাইড করুন বা + চাপুন পোস্ট, স্টোরি বা রিল আপলোড করতে',
    },
    create: {
      newPost: 'নতুন পোস্ট',
      newStory: 'নতুন স্টোরি',
      newReel: 'নতুন রিল',
      captionPlaceholder: 'আপনার ভাবনা, ক্যাপশন বা #হ্যাশট্যাগ লিখুন...',
      mediaUrlLabel: 'গ্যালারি থেকে আপলোড বা লিংক দিন',
      reelCoverLabel: 'রিল ব্যাকগ্রাউন্ড / ব্যানার ছবি',
      visibilityLabel: 'কারা দেখতে পারবে',
      publicOpt: 'পাবলিক (সবার জন্য)',
      followersOpt: 'শুধু ফ্রেন্ডস / ফলোয়ার',
      onlyMeOpt: 'শুধু আমি (প্রাইভেট)',
      publish: 'প্রকাশ করুন',
      storyTextPlaceholder: 'পরবর্তী ২৪ ঘণ্টার জন্য একটি টেক্সট স্টোরি লিখুন...',
    },
    explore: {
      searchPlaceholder: 'ইউজারনেম, আইডি, পোস্ট বা রিল খুঁজুন',
      trendingHashtags: 'ট্রেন্ডিং হ্যাশট্যাগ',
      suggestedAccounts: 'অ্যাকাউন্টসমূহ',
      popularPosts: 'পোস্ট ও রিলস',
      all: 'সব',
      users: 'অ্যাকাউন্ট',
      posts: 'পোস্ট',
      reels: 'রিলস',
      follow: 'ফলো করুন',
      following: 'ফলোয়িং',
      followBack: 'ফলো ব্যাক',
      requestSent: 'রিকোয়েস্ট পাঠানো হয়েছে',
    },
    messages: {
      chatsTitle: 'ইনবক্স',
      searchChats: 'চ্যাট বা মানুষ খুঁজুন...',
      newGroup: 'নতুন গ্রুপ',
      online: 'অনলাইন',
      typing: 'লিখছেন...',
      typeMessage: 'মেসেজ লিখুন...',
      recordVoice: 'ভয়েস মেসেজ রেকর্ড করুন',
      stopRecording: 'রেকর্ড থামিয়ে পাঠান',
      replyingTo: 'উত্তর দিচ্ছেন',
      deleteMessage: 'মেসেজ মুছুন',
      blockUser: 'ব্লক করুন',
      unblockUser: 'আনব্লক করুন',
      seen: 'দেখা হয়েছে',
      delivered: 'পৌঁছেছে',
      primaryTab: 'প্রাইমারি',
      groupsTab: 'গ্রুপ',
      broadcastsTab: 'ব্রডকাস্ট',
      requestsTab: 'রিকোয়েস্ট',
      notesTitle: 'নোটস',
      yourNote: 'আপনার নোট',
      addNotePlaceholder: 'নোট লিখুন...',
      activeNow: 'এখন সক্রিয়',
      backToInbox: 'ইনবক্স',
      chatInfo: 'চ্যাট বিস্তারিত',
      themes: 'চ্যাট থিম',
      stickers: 'স্টিকার',
      createSticker: 'স্টিকার তৈরি করুন',
      saveSticker: 'স্টিকার সেভ করুন',
      savedStickers: 'ফেভারিট',
      voiceCall: 'ভয়েস কল',
      videoCall: 'ভিডিও কল',
      uploadTheme: 'গ্যালারি থেকে থিম আপলোড',
      chatNicknames: 'নিকনেম',
      archivedTab: 'আর্কাইভ',
      editMessage: 'এডিট',
      editedLabel: 'সম্পাদিত',
      copyMessage: 'কপি',
      forwardMessage: 'ফরওয়ার্ড',
      pinMessage: 'পিন করুন',
      unpinMessage: 'আনপিন করুন',
      starMessage: 'স্টার দিন',
      unstarMessage: 'স্টার সরান',
      pinChat: 'চ্যাট পিন করুন',
      unpinChat: 'পিন সরান',
      muteChat: 'মিউট করুন',
      unmuteChat: 'আনমিউট করুন',
      archiveChat: 'আর্কাইভ করুন',
      unarchiveChat: 'আর্কাইভ থেকে ফিরান',
      markUnread: 'আনরিড চিহ্নিত করুন',
      searchInChat: 'চ্যাটে খুঁজুন...',
      disappearing: 'ডিসঅ্যাপিয়ারিং মেসেজ',
      mediaAndFiles: 'মিডিয়া ও ফাইল',
      starredMessages: 'স্টারড মেসেজ',
      forwardedLabel: 'ফরওয়ার্ডেড',
      backToFeed: 'হোমে ফিরুন',
    },
    profile: {
      posts: 'পোস্ট',
      reelsTab: 'রিলস',
      followers: 'ফলোয়ার',
      following: 'ফলোয়িং',
      editProfile: 'প্রোফাইল এডিট',
      shareProfile: 'শেয়ার প্রোফাইল',
      message: 'মেসেজ',
      savedPosts: 'সেভড',
      friendRequests: 'ফলো রিকোয়েস্ট',
      aiAssistant: 'এআই অ্যাসিস্ট্যান্ট',
      settings: 'সেটিংস',
      broadcastChannel: 'ব্রডকাস্ট চ্যানেল',
      switchAccount: 'অ্যাকাউন্ট সুইচ',
      addAccount: 'নতুন অ্যাকাউন্ট যোগ করুন',
      accept: 'অ্যাকসেপ্ট',
      reject: 'বাতিল',
      removeFollower: 'সরান',
      mutualFriends: 'পারস্পরিক',
      publicProfile: 'পাবলিক প্রোফাইল',
      privateProfile: 'প্রাইভেট অ্যাকাউন্ট',
      privateAccountLocked: 'এই অ্যাকাউন্টটি প্রাইভেট। পোস্ট ও রিল দেখতে ফলো রিকোয়েস্ট পাঠান।',
      viewAll: 'সব দেখুন',
      noRequests: 'কোনো পেন্ডিং ফলো রিকোয়েস্ট নেই।',
      pronounsLabel: 'সর্বনাম (Pronouns)',
      websiteLabel: 'ওয়েবসাইট / লিংক',
      changePhoto: 'ছবি আপলোড / পরিবর্তন',
      deletePhoto: 'ছবি মুছুন',
      changeCover: 'কভার পরিবর্তন',
      removeCover: 'কভার মুছুন',
      saveChanges: 'পরিবর্তন সংরক্ষণ করুন',
      reportUser: 'ইউজার রিপোর্ট করুন',
    },
    ai: {
      title: 'জেমিনি প্রোফাইল অ্যাসিস্ট্যান্ট',
      subtitle: 'আকর্ষণীয় বায়ো, ইউনিক ইউজারনেম, ক্যাপশন এবং স্মার্ট রিপ্লাই তৈরি করুন।',
      openAssistant: 'জেমিনি অ্যাসিস্ট্যান্ট খুলুন',
      taskBio: 'বায়ো তৈরি',
      taskUsername: 'ইউজারনেম পরামর্শ',
      taskCaption: 'ক্যাপশন লিখুন',
      taskImproveBio: 'বায়ো উন্নত করুন',
      taskSmartReplies: 'স্মার্ট রিপ্লাই',
      promptPlaceholder: 'আপনার আগ্রহ বা বিষয়বস্তু লিখুন...',
      generate: 'জেমিনি দিয়ে তৈরি করুন',
      applyToProfile: 'প্রোফাইলে প্রয়োগ করুন',
      signInRequired: 'লাইভ জেমিনি ব্যবহার করতে সাইন ইন করুন।',
    },
    settings: {
      title: 'সেটিংস ও অ্যাক্টিভিটি',
      notifications: 'নোটিফিকেশন',
      privacy: 'অ্যাকাউন্ট প্রাইভেসি',
      security: 'পাসওয়ার্ড ও সিকিউরিটি',
      account: 'অ্যাকাউন্ট নিয়ন্ত্রণ ও ডিলিট',
      accountSwitch: 'অ্যাকাউন্ট সুইচ ও সেভড লগইন',
      blockedUsers: 'ব্লক করা ব্যবহারকারী',
      language: 'ভাষা',
      theme: 'থিম',
      lightMode: 'লাইট',
      darkMode: 'ডার্ক',
      aboutLegal: 'সম্পর্কে ও নিরাপত্তা',
      androidProject: 'আর্কিটেকচার ও ফায়ারবেস',
      twoFactor: 'টু-ফ্যাক্টর অথেনটিকেশন (2FA)',
      changePassword: 'পাসওয়ার্ড পরিবর্তন',
      deactivateAccount: 'অ্যাকাউন্ট ডিঅ্যাক্টিভেট করুন',
      deleteAccount: 'স্থায়ীভাবে অ্যাকাউন্ট মুছুন',
      biometricLock: 'বায়োমেট্রিক অ্যাপ লক',
      whoCanMessage: 'কে আপনাকে মেসেজ করতে পারবে',
      whoCanViewStories: 'কে আপনার স্টোরি দেখতে পারবে',
      submitReport: 'রিপোর্ট জমা দিন',
      reportReason: 'কারণ লিখুন অথবা সাজেস্টেড কারণ বাছাই করুন...',
    },
  },
};
