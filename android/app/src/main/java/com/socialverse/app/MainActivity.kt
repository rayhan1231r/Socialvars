package com.socialverse.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.socialverse.app.core.security.BiometricLockManager
import com.socialverse.app.core.theme.SocialVerseTheme
import com.socialverse.app.presentation.navigation.SocialVerseNavHost
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    private var darkTheme by mutableStateOf(false)
    private var unlocked by mutableStateOf(true)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            SocialVerseTheme(darkTheme = darkTheme) {
                SocialVerseNavHost(
                    darkTheme = darkTheme,
                    onToggleTheme = { darkTheme = !darkTheme },
                    isLocked = !unlocked,
                    onRequestBiometricUnlock = {
                        BiometricLockManager.authenticate(
                            activity = this,
                            title = getString(R.string.biometric_prompt_title),
                            subtitle = getString(R.string.biometric_prompt_subtitle),
                            onSuccess = { unlocked = true }
                        )
                    }
                )
            }
        }
    }
}
