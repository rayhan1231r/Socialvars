package com.socialverse.app.presentation.navigation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddBox
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.socialverse.app.R
import com.socialverse.app.core.theme.liquidGlass
import com.socialverse.app.presentation.screens.AiProfileAssistantScreen
import com.socialverse.app.presentation.screens.CreatePostScreen
import com.socialverse.app.presentation.screens.ExploreScreen
import com.socialverse.app.presentation.screens.HomeFeedScreen
import com.socialverse.app.presentation.screens.LoginScreen
import com.socialverse.app.presentation.screens.MessagesListScreen
import com.socialverse.app.presentation.screens.OnboardingScreen
import com.socialverse.app.presentation.screens.ProfileScreen
import com.socialverse.app.presentation.screens.ReelsScreen
import com.socialverse.app.presentation.screens.SettingsScreen
import com.socialverse.app.presentation.screens.SplashScreen

sealed class Route(val route: String) {
    data object Splash : Route("splash")
    data object Login : Route("login")
    data object Onboarding : Route("onboarding")
    data object Main : Route("main")
    data object Reels : Route("reels")
    data object AiAssistant : Route("ai_assistant")
    data object Settings : Route("settings")
}

@Composable
fun SocialVerseNavHost(
    darkTheme: Boolean,
    onToggleTheme: () -> Unit,
    isLocked: Boolean,
    onRequestBiometricUnlock: () -> Unit
) {
    val navController = rememberNavController()
    var selectedTab by remember { mutableStateOf(0) }

    if (isLocked) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(
                modifier = Modifier
                    .padding(24.dp)
                    .liquidGlass(darkTheme)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(stringResource(R.string.biometric_prompt_title))
                Button(onClick = onRequestBiometricUnlock) {
                    Text(stringResource(R.string.biometric_prompt_subtitle))
                }
            }
        }
        return
    }

    NavHost(navController = navController, startDestination = Route.Splash.route) {
        composable(Route.Splash.route) {
            SplashScreen(onFinished = {
                navController.navigate(Route.Login.route) {
                    popUpTo(Route.Splash.route) { inclusive = true }
                }
            })
        }
        composable(Route.Login.route) {
            LoginScreen(
                darkTheme = darkTheme,
                onAuthenticated = { needsOnboarding ->
                    navController.navigate(
                        if (needsOnboarding) Route.Onboarding.route else Route.Main.route
                    )
                }
            )
        }
        composable(Route.Onboarding.route) {
            OnboardingScreen(
                darkTheme = darkTheme,
                onCompleted = {
                    navController.navigate(Route.Main.route) {
                        popUpTo(Route.Onboarding.route) { inclusive = true }
                    }
                }
            )
        }
        composable(Route.Main.route) {
            Scaffold(
                bottomBar = {
                    NavigationBar(modifier = Modifier.liquidGlass(darkTheme, cornerRadius = 0.dp)) {
                        val tabs = listOf(
                            Triple(0, stringResource(R.string.nav_home), Icons.Default.Home),
                            Triple(1, stringResource(R.string.nav_explore), Icons.Default.Explore),
                            Triple(2, stringResource(R.string.nav_create), Icons.Default.AddBox),
                            Triple(3, stringResource(R.string.nav_messages), Icons.Default.ChatBubble),
                            Triple(4, stringResource(R.string.nav_profile), Icons.Default.Person),
                        )
                        tabs.forEach { (idx, label, icon) ->
                            NavigationBarItem(
                                selected = selectedTab == idx,
                                onClick = { selectedTab = idx },
                                icon = { Icon(icon, contentDescription = label) },
                                label = { Text(label) }
                            )
                        }
                    }
                }
            ) { padding ->
                Box(modifier = Modifier.padding(padding).fillMaxSize()) {
                    when (selectedTab) {
                        0 -> HomeFeedScreen(darkTheme, onOpenReels = { navController.navigate(Route.Reels.route) })
                        1 -> ExploreScreen(darkTheme, onOpenReels = { navController.navigate(Route.Reels.route) })
                        2 -> CreatePostScreen(darkTheme, onPublished = { selectedTab = 0 })
                        3 -> MessagesListScreen(darkTheme)
                        4 -> ProfileScreen(
                            darkTheme = darkTheme,
                            onOpenAiAssistant = { navController.navigate(Route.AiAssistant.route) },
                            onOpenSettings = { navController.navigate(Route.Settings.route) }
                        )
                    }
                }
            }
        }
        composable(Route.Reels.route) { ReelsScreen(onBack = { navController.popBackStack() }) }
        composable(Route.AiAssistant.route) { AiProfileAssistantScreen(darkTheme, onBack = { navController.popBackStack() }) }
        composable(Route.Settings.route) { SettingsScreen(darkTheme, onToggleTheme, onBack = { navController.popBackStack() }) }
    }
}
