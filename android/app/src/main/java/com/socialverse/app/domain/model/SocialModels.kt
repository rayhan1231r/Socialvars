package com.socialverse.app.domain.model

import com.google.firebase.Timestamp

data class UserPublic(
    val uid: String = "",
    val username: String = "",
    val displayName: String = "",
    val bio: String = "",
    val photoUrl: String = "",
    val coverUrl: String = "",
    val interests: List<String> = emptyList(),
    val isPrivate: Boolean = false,
    val followersCount: Int = 0,
    val followingCount: Int = 0,
    val postsCount: Int = 0,
    val onlineStatus: String = "offline",
    val onboardingCompleted: Boolean = false,
    val createdAt: Timestamp? = null
)

data class UserPrivate(
    val uid: String = "",
    val email: String = "",
    val language: String = "en",
    val themeMode: String = "light",
    val biometricLockEnabled: Boolean = false,
    val whoCanMessage: String = "everyone",
    val whoCanViewStories: String = "everyone",
    val whoCanFollow: String = "everyone",
    val blockedUserIds: List<String> = emptyList(),
    val mutedStoryUserIds: List<String> = emptyList()
)

data class Post(
    val id: String = "",
    val authorId: String = "",
    val authorUsername: String = "",
    val authorDisplayName: String = "",
    val authorAvatar: String = "",
    val caption: String = "",
    val mediaUrls: List<String> = emptyList(),
    val mediaType: String = "text",
    val hashtags: List<String> = emptyList(),
    val likesCount: Int = 0,
    val commentsCount: Int = 0,
    val sharesCount: Int = 0,
    val visibility: String = "public",
    val createdAt: Timestamp? = null
)

data class Story(
    val id: String = "",
    val authorId: String = "",
    val authorUsername: String = "",
    val mediaType: String = "photo",
    val mediaUrl: String = "",
    val textContent: String = "",
    val privacy: String = "everyone",
    val viewersCount: Int = 0,
    val expiresAt: Timestamp? = null,
    val createdAt: Timestamp? = null
)

data class ChatThread(
    val id: String = "",
    val type: String = "direct",
    val title: String = "",
    val participantIds: List<String> = emptyList(),
    val lastMessageText: String = "",
    val lastMessageAt: Timestamp? = null,
    val createdBy: String = ""
)

data class ChatMessage(
    val id: String = "",
    val chatId: String = "",
    val senderId: String = "",
    val type: String = "text",
    val text: String = "",
    val mediaUrl: String = "",
    val durationMs: Long = 0L,
    val replyToId: String = "",
    val status: String = "sent",
    val reactions: Map<String, List<String>> = emptyMap(),
    val createdAt: Timestamp? = null
)
