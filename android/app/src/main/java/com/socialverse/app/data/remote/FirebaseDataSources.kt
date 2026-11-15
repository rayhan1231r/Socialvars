package com.socialverse.app.data.remote

import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.socialverse.app.BuildConfig
import com.socialverse.app.domain.model.ChatMessage
import com.socialverse.app.domain.model.Post
import com.socialverse.app.domain.model.Story
import com.socialverse.app.domain.model.UserPublic
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FirebaseSocialRepository @Inject constructor(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) {
    private val httpClient = OkHttpClient()

    fun observePublicFeed(limitCount: Long = 20): Flow<List<Post>> = callbackFlow {
        val sub = firestore.collection("posts")
            .whereEqualTo("visibility", "public")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(limitCount)
            .addSnapshotListener { snapshot, error ->
                if (error != null) return@addSnapshotListener
                val items = snapshot?.documents?.mapNotNull { it.toObject(Post::class.java) } ?: emptyList()
                trySend(items)
            }
        awaitClose { sub.remove() }
    }

    fun observeActiveStories(): Flow<List<Story>> = callbackFlow {
        val now = Timestamp.now()
        val sub = firestore.collection("stories")
            .whereGreaterThan("expiresAt", now)
            .addSnapshotListener { snapshot, error ->
                if (error != null) return@addSnapshotListener
                val items = snapshot?.documents?.mapNotNull { it.toObject(Story::class.java) } ?: emptyList()
                trySend(items)
            }
        awaitClose { sub.remove() }
    }

    suspend fun claimUsernameAndCompleteOnboarding(
        username: String,
        displayName: String,
        bio: String,
        interests: List<String>,
        isPrivate: Boolean
    ) {
        val uid = auth.currentUser?.uid ?: error("Not authenticated")
        val email = auth.currentUser?.email ?: ""
        firestore.runTransaction { tx ->
            val claimRef = firestore.collection("usernames").document(username)
            if (tx.get(claimRef).exists()) {
                throw IllegalStateException("USERNAME_TAKEN")
            }
            tx.set(claimRef, mapOf(
                "uid" to uid,
                "username" to username,
                "createdAt" to FieldValue.serverTimestamp()
            ))
            tx.set(firestore.collection("users").document(uid), mapOf(
                "uid" to uid,
                "username" to username,
                "displayName" to displayName,
                "bio" to bio,
                "interests" to interests,
                "isPrivate" to isPrivate,
                "followersCount" to 0,
                "followingCount" to 0,
                "postsCount" to 0,
                "onboardingCompleted" to true,
                "createdAt" to FieldValue.serverTimestamp()
            ))
            tx.set(firestore.collection("users").document(uid).collection("private").document("info"), mapOf(
                "uid" to uid,
                "email" to email,
                "language" to "en",
                "whoCanMessage" to "everyone",
                "whoCanViewStories" to "everyone",
                "updatedAt" to FieldValue.serverTimestamp()
            ))
        }.await()
    }

    suspend fun requestAiProfileAssist(
        task: String,
        contextText: String,
        currentBio: String,
        language: String
    ): Pair<List<String>, String> = withContext(Dispatchers.IO) {
        val user = auth.currentUser ?: error("Authentication required")
        val idToken = user.getIdToken(false).await().token ?: error("Missing Firebase ID token")

        val payload = JSONObject().apply {
            put("task", task)
            put("contextText", contextText)
            put("currentBio", currentBio)
            put("language", language)
        }
        val request = Request.Builder()
            .url("${BuildConfig.CLOUD_FUNCTIONS_BASE_URL}/ai/profile-assist")
            .addHeader("Authorization", "Bearer $idToken")
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()

        httpClient.newCall(request).execute().use { response ->
            val bodyStr = response.body?.string() ?: "{}"
            if (!response.isSuccessful) error("AI endpoint failed: ${response.code}")
            val json = JSONObject(bodyStr)
            val arr = json.optJSONArray("suggestions")
            val suggestions = buildList {
                if (arr != null) {
                    for (i in 0 until arr.length()) add(arr.getString(i))
                }
            }
            suggestions to json.optString("tip", "")
        }
    }
}

class SocialVerseFcmService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return
        FirebaseFirestore.getInstance()
            .document("users/$uid/private/fcm")
            .set(mapOf("token" to token, "updatedAt" to FieldValue.serverTimestamp()))
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
    }
}
