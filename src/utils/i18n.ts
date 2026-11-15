import type { AppLanguage } from '../types/social';

export interface TranslationBundle {
  appName: string;
  tagline: string;
  nav: {
    home: string;
    explore: string;
    create: string;
    messages: string;
    profile: string;
  };
  auth: {
    signIn: string;
    register: string;
    googleSignIn: string;
    emailLabel: string;
    passwordLabel: string;
    forgotPassword: string;
    sendReset: string;
    verifyEmailTitle: string;
    verifyEmailDesc: string;
    resendVerification: string;
    previewDemo: string;
    logout: string;
    onboardingTitle: string;
    usernameLabel: string;
    displayNameLabel: string;
    bioLabel: string;
    interestsLabel: string;
    privateAccountLabel: string;
    completeSetup: string;
    usernameTaken: string;
    usernameInvalid: string;
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
  };
  create: {
    newPost: string;
    newStory: string;
    newReel: string;
    captionPlaceholder: string;
    mediaUrlLabel: string;
    visibilityLabel: string;
    publicOpt: string;
    followersOpt: string;
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
    requestsTab: string;
    notesTitle: string;
    activeNow: string;
    backToInbox: string;
  };
  profile: {
    posts: string;
    followers: string;
    following: string;
    editProfile: string;
    shareProfile: string;
    message: string;
    savedPosts: string;
    friendRequests: string;
    aiAssistant: string;
    settings: string;
    accept: string;
    reject: string;
    removeFollower: string;
    mutualFriends: string;
    publicProfile: string;
    privateProfile: string;
    viewAll: string;
    noRequests: string;
    pronounsLabel: string;
    websiteLabel: string;
    changePhoto: string;
    changeCover: string;
    saveChanges: string;
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
    blockedUsers: string;
    language: string;
    theme: string;
    lightMode: string;
    darkMode: string;
    aboutLegal: string;
    androidProject: string;
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
      explore: 'Explore',
      create: 'Create',
      messages: 'Messages',
      profile: 'Profile',
    },
    auth: {
      signIn: 'Sign In',
      register: 'Create Account',
      googleSignIn: 'Continue with Google',
      emailLabel: 'Email address',
      passwordLabel: 'Password',
      forgotPassword: 'Forgot password?',
      sendReset: 'Send reset link',
      verifyEmailTitle: 'Verify your email',
      verifyEmailDesc: 'Check your inbox for the verification link to unlock full posting and messaging.',
      resendVerification: 'Resend verification email',
      previewDemo: 'Open Live Interactive Preview',
      logout: 'Log Out',
      onboardingTitle: 'Set up your SocialVerse identity',
      usernameLabel: 'Username',
      displayNameLabel: 'Display name',
      bioLabel: 'Bio',
      interestsLabel: 'Select interests',
      privateAccountLabel: 'Private account (approve followers)',
      completeSetup: 'Complete Setup',
      usernameTaken: 'This username is already claimed.',
      usernameInvalid: 'Use 3-24 lowercase letters, numbers, or underscores.',
      biometricTitle: 'SocialVerse Locked',
      biometricUnlock: 'Unlock with Biometrics',
      authGateTitle: 'Join SocialVerse to interact',
      authGateDesc: 'Sign in or create an account to like, comment, follow creators, post stories, and send messages.',
      continueBrowsing: 'Keep browsing',
      guestBannerTitle: 'Browsing in preview mode',
      guestBannerDesc: 'Sign in or create an account to customize your profile, post, and interact.',
      splashLoading: 'Loading your feed...',
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
      noPosts: 'No posts match this view yet.',
    },
    create: {
      newPost: 'New Post',
      newStory: 'New Story',
      newReel: 'New Reel',
      captionPlaceholder: 'Share a thought, story, or #hashtag...',
      mediaUrlLabel: 'Image or Video Upload / URL',
      visibilityLabel: 'Visibility',
      publicOpt: 'Public',
      followersOpt: 'Followers only',
      publish: 'Publish',
      storyTextPlaceholder: 'Write a text story for the next 24 hours...',
    },
    explore: {
      searchPlaceholder: 'Search people, posts, or #hashtags',
      trendingHashtags: 'Trending Hashtags',
      suggestedAccounts: 'Suggested Creators',
      popularPosts: 'Popular in Your Interests',
      all: 'All',
      users: 'People',
      posts: 'Posts',
      reels: 'Reels',
      follow: 'Follow',
      following: 'Following',
      requestSent: 'Requested',
    },
    messages: {
      chatsTitle: 'Messages',
      searchChats: 'Search conversations...',
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
      requestsTab: 'Requests',
      notesTitle: 'Active Notes',
      activeNow: 'Active now',
      backToInbox: 'Inbox',
    },
    profile: {
      posts: 'Posts',
      followers: 'Followers',
      following: 'Following',
      editProfile: 'Edit Profile',
      shareProfile: 'Share Profile',
      message: 'Message',
      savedPosts: 'Saved Posts',
      friendRequests: 'Requests',
      aiAssistant: 'AI Profile Assistant',
      settings: 'Settings',
      accept: 'Accept',
      reject: 'Decline',
      removeFollower: 'Remove',
      mutualFriends: 'mutual friends',
      publicProfile: 'Public profile',
      privateProfile: 'Private account',
      viewAll: 'View all',
      noRequests: 'No pending friend requests.',
      pronounsLabel: 'Pronouns',
      websiteLabel: 'Website / Link',
      changePhoto: 'Change profile photo',
      changeCover: 'Change cover photo',
      saveChanges: 'Save Changes',
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
      promptPlaceholder: 'Describe your vibe, niche, or topic (e.g. Dhaka street photography & coffee)...',
      generate: 'Generate with Gemini',
      applyToProfile: 'Apply to Profile',
      signInRequired: 'Sign in with Firebase Auth to run live Gemini generation.',
    },
    settings: {
      title: 'Settings',
      notifications: 'Notifications',
      privacy: 'Privacy & Visibility',
      security: 'Security & Biometric Lock',
      account: 'Account Management',
      blockedUsers: 'Blocked Users',
      language: 'Language',
      theme: 'Appearance',
      lightMode: 'Light',
      darkMode: 'Dark',
      aboutLegal: 'About & Legal',
      androidProject: 'Android Studio & Firebase Architecture',
      deleteAccount: 'Delete Account Permanently',
      biometricLock: 'Require Biometric App Lock',
      whoCanMessage: 'Who can message you',
      whoCanViewStories: 'Who can view your stories',
      submitReport: 'Submit Report',
      reportReason: 'Describe why you are reporting this content...',
    },
  },
  bn: {
    appName: 'সোশ্যালভার্স',
    tagline: 'স্বচ্ছ তরল নকশায় সংযুক্ত থাকুন',
    nav: {
      home: 'হোম',
      explore: 'এক্সপ্লোর',
      create: 'তৈরি করুন',
      messages: 'মেসেজ',
      profile: 'প্রোফাইল',
    },
    auth: {
      signIn: 'সাইন ইন',
      register: 'অ্যাকাউন্ট তৈরি করুন',
      googleSignIn: 'Google দিয়ে চালিয়ে যান',
      emailLabel: 'ইমেইল ঠিকানা',
      passwordLabel: 'পাসওয়ার্ড',
      forgotPassword: 'পাসওয়ার্ড ভুলে গেছেন?',
      sendReset: 'রিসেট লিংক পাঠান',
      verifyEmailTitle: 'ইমেইল যাচাই করুন',
      verifyEmailDesc: 'সব ফিচার ব্যবহার করতে আপনার ইনবক্সের ভেরিফিকেশন লিংক নিশ্চিত করুন।',
      resendVerification: 'ভেরিফিকেশন ইমেইল আবার পাঠান',
      previewDemo: 'লাইভ প্রিভিউ খুলুন',
      logout: 'লগ আউট',
      onboardingTitle: 'আপনার সোশ্যালভার্স পরিচিতি সাজান',
      usernameLabel: 'ইউজারনেম',
      displayNameLabel: 'প্রদর্শিত নাম',
      bioLabel: 'বায়ো',
      interestsLabel: 'আগ্রহের বিষয় নির্বাচন করুন',
      privateAccountLabel: 'প্রাইভেট অ্যাকাউন্ট (ফলোয়ার অনুমোদন)',
      completeSetup: 'সেটআপ সম্পন্ন করুন',
      usernameTaken: 'এই ইউজারনেমটি ইতিমধ্যেই ব্যবহৃত হয়েছে।',
      usernameInvalid: '৩-২৪ অক্ষরের ছোট হাতের ইংরেজি অক্ষর, সংখ্যা বা _ ব্যবহার করুন।',
      biometricTitle: 'সোশ্যালভার্স লক করা আছে',
      biometricUnlock: 'বায়োমেট্রিক দিয়ে আনলক করুন',
      authGateTitle: 'ইন্টারঅ্যাক্ট করতে সাইন ইন করুন',
      authGateDesc: 'লাইক, কমেন্ট, ফলো, স্টোরি বা মেসেজ করতে আপনার অ্যাকাউন্টে লগইন বা সাইন আপ করুন।',
      continueBrowsing: 'ব্রাউজ চালিয়ে যান',
      guestBannerTitle: 'প্রিভিউ মোডে দেখছেন',
      guestBannerDesc: 'প্রোফাইল সাজাতে, পোস্ট করতে এবং সবার সাথে যুক্ত হতে সাইন ইন বা সাইন আপ করুন।',
      splashLoading: 'আপনার ফিড লোড হচ্ছে...',
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
      noPosts: 'এখনো কোনো পোস্ট নেই।',
    },
    create: {
      newPost: 'নতুন পোস্ট',
      newStory: 'নতুন স্টোরি',
      newReel: 'নতুন রিল',
      captionPlaceholder: 'আপনার ভাবনা, গল্প বা #হ্যাশট্যাগ লিখুন...',
      mediaUrlLabel: 'ছবি বা ভিডিও আপলোড / লিংক',
      visibilityLabel: 'দৃশ্যমানতা',
      publicOpt: 'সবার জন্য',
      followersOpt: 'শুধু ফলোয়ারদের জন্য',
      publish: 'প্রকাশ করুন',
      storyTextPlaceholder: 'পরবর্তী ২৪ ঘণ্টার জন্য একটি টেক্সট স্টোরি লিখুন...',
    },
    explore: {
      searchPlaceholder: 'মানুষ, পোস্ট বা #হ্যাশট্যাগ খুঁজুন',
      trendingHashtags: 'ট্রেন্ডিং হ্যাশট্যাগ',
      suggestedAccounts: 'প্রস্তাবিত ক্রিয়েটর',
      popularPosts: 'জনপ্রিয় কনটেন্ট',
      all: 'সব',
      users: 'মানুষ',
      posts: 'পোস্ট',
      reels: 'রিলস',
      follow: 'ফলো করুন',
      following: 'ফলোয়িং',
      requestSent: 'অনুরোধ পাঠানো হয়েছে',
    },
    messages: {
      chatsTitle: 'মেসেজ',
      searchChats: 'চ্যাট খুঁজুন...',
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
      requestsTab: 'অনুরোধ',
      notesTitle: 'সক্রিয় নোটস',
      activeNow: 'এখন সক্রিয়',
      backToInbox: 'ইনবক্স',
    },
    profile: {
      posts: 'পোস্ট',
      followers: 'ফলোয়ার',
      following: 'ফলোয়িং',
      editProfile: 'প্রোফাইল এডিট',
      shareProfile: 'শেয়ার প্রোফাইল',
      message: 'মেসেজ',
      savedPosts: 'সেভড পোস্ট',
      friendRequests: 'অনুরোধ',
      aiAssistant: 'এআই প্রোফাইল অ্যাসিস্ট্যান্ট',
      settings: 'সেটিংস',
      accept: 'গ্রহণ করুন',
      reject: 'বাতিল',
      removeFollower: 'সরান',
      mutualFriends: 'পারস্পরিক বন্ধু',
      publicProfile: 'পাবলিক প্রোফাইল',
      privateProfile: 'প্রাইভেট অ্যাকাউন্ট',
      viewAll: 'সব দেখুন',
      noRequests: 'কোনো পেন্ডিং অনুরোধ নেই।',
      pronounsLabel: 'সর্বনাম (Pronouns)',
      websiteLabel: 'ওয়েবসাইট / লিংক',
      changePhoto: 'প্রোফাইল ছবি পরিবর্তন',
      changeCover: 'কভার ছবি পরিবর্তন',
      saveChanges: 'পরিবর্তন সংরক্ষণ করুন',
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
      signInRequired: 'লাইভ জেমিনি ব্যবহার করতে Firebase Auth দিয়ে সাইন ইন করুন।',
    },
    settings: {
      title: 'সেটিংস',
      notifications: 'নোটিফিকেশন',
      privacy: 'গোপনীয়তা ও দৃশ্যমানতা',
      security: 'সিকিউরিটি ও বায়োমেট্রিক লক',
      account: 'অ্যাকাউন্ট পরিচালনা',
      blockedUsers: 'ব্লক করা ব্যবহারকারী',
      language: 'ভাষা',
      theme: 'থিম',
      lightMode: 'লাইট',
      darkMode: 'ডার্ক',
      aboutLegal: 'সম্পর্কে ও আইনি তথ্য',
      androidProject: 'অ্যান্ড্রয়েড স্টুডিও ও ফায়ারবেস আর্কিটেকচার',
      deleteAccount: 'স্থায়ীভাবে অ্যাকাউন্ট মুছুন',
      biometricLock: 'বায়োমেট্রিক অ্যাপ লক চালু রাখুন',
      whoCanMessage: 'কে আপনাকে মেসেজ করতে পারবে',
      whoCanViewStories: 'কে আপনার স্টোরি দেখতে পারবে',
      submitReport: 'রিপোর্ট জমা দিন',
      reportReason: 'কেন রিপোর্ট করছেন তা লিখুন...',
    },
  },
};
