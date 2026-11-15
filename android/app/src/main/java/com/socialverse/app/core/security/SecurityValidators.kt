package com.socialverse.app.core.security

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

object SecurityValidators {
    private val usernameRegex = Regex("^[a-z0-9_]{3,24}$")

    fun normalizeUsername(raw: String): String =
        raw.trim().lowercase().replace(Regex("[^a-z0-9_]"), "")

    fun isValidUsername(username: String): Boolean = usernameRegex.matches(username)

    fun isValidDisplayName(name: String): Boolean {
        val trimmed = name.trim()
        return trimmed.isNotEmpty() && trimmed.length <= 50
    }

    fun isValidBio(bio: String): Boolean = bio.length <= 240

    fun isValidCaption(caption: String): Boolean =
        caption.trim().isNotEmpty() && caption.length <= 2200

    fun extractHashtags(caption: String): List<String> =
        Regex("#[a-zA-Z0-9_\\u0980-\\u09FF]{1,40}")
            .findAll(caption)
            .map { it.value.drop(1).lowercase() }
            .distinct()
            .take(20)
            .toList()
}

object BiometricLockManager {
    fun authenticate(
        activity: FragmentActivity,
        title: String,
        subtitle: String,
        onSuccess: () -> Unit
    ) {
        val manager = BiometricManager.from(activity)
        val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
        if (manager.canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS) {
            onSuccess()
            return
        }
        val executor = ContextCompat.getMainExecutor(activity)
        val prompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onSuccess()
                }
            }
        )
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(authenticators)
            .build()
        prompt.authenticate(promptInfo)
    }
}
