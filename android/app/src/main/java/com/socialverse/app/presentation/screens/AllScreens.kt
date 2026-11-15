package com.socialverse.app.presentation.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.socialverse.app.R
import com.socialverse.app.core.security.SecurityValidators
import com.socialverse.app.core.theme.liquidGlass
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(onFinished: () -> Unit) {
    LaunchedEffect(Unit) {
        delay(800)
        onFinished()
    }
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(stringResource(R.string.app_name), style = MaterialTheme.typography.headlineLarge)
    }
}

@Composable
fun LoginScreen(darkTheme: Boolean, onAuthenticated: (Boolean) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().liquidGlass(darkTheme).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(stringResource(R.string.app_name), style = MaterialTheme.typography.headlineMedium)
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Email") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                modifier = Modifier.fillMaxWidth()
            )
            Button(
                onClick = { onAuthenticated(true) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(stringResource(R.string.auth_sign_in))
            }
            TextButton(onClick = { onAuthenticated(false) }, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.auth_google))
            }
        }
    }
}

@Composable
fun OnboardingScreen(darkTheme: Boolean, onCompleted: () -> Unit) {
    var username by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var bio by remember { mutableStateOf("") }
    var isPrivate by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().liquidGlass(darkTheme).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Set up your profile", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(
                value = username,
                onValueChange = { username = SecurityValidators.normalizeUsername(it) },
                label = { Text("Username") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = displayName,
                onValueChange = { displayName = it },
                label = { Text("Display Name") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = bio,
                onValueChange = { bio = it.take(240) },
                label = { Text("Bio") },
                modifier = Modifier.fillMaxWidth()
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Private account")
                Switch(checked = isPrivate, onCheckedChange = { isPrivate = it })
            }
            Button(
                onClick = onCompleted,
                enabled = SecurityValidators.isValidUsername(username) &&
                    SecurityValidators.isValidDisplayName(displayName),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Continue")
            }
        }
    }
}

@Composable
fun HomeFeedScreen(darkTheme: Boolean, onOpenReels: () -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(stringResource(R.string.app_name), style = MaterialTheme.typography.titleLarge)
                TextButton(onClick = onOpenReels) { Text("Reels") }
            }
        }
        item {
            Column(modifier = Modifier.fillMaxWidth().liquidGlass(darkTheme).padding(16.dp)) {
                Text("Stories & Live Feed", style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(6.dp))
                Text("Connected to Cloud Firestore posts and 24-hour expiring stories.")
            }
        }
    }
}

@Composable
fun ExploreScreen(darkTheme: Boolean, onOpenReels: () -> Unit) {
    var search by remember { mutableStateOf("") }
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
            value = search,
            onValueChange = { search = it },
            label = { Text("Search users, posts, #hashtags") },
            modifier = Modifier.fillMaxWidth()
        )
        Button(onClick = onOpenReels) { Text("Watch Short Videos / Reels") }
    }
}

@Composable
fun CreatePostScreen(darkTheme: Boolean, onPublished: () -> Unit) {
    var caption by remember { mutableStateOf("") }
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(modifier = Modifier.fillMaxWidth().liquidGlass(darkTheme).padding(16.dp)) {
            Text("Create Post / Story / Reel", style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = caption,
                onValueChange = { caption = it.take(2200) },
                label = { Text("Caption & #hashtags") },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = onPublished,
                enabled = SecurityValidators.isValidCaption(caption),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Publish")
            }
        }
    }
}

@Composable
fun MessagesListScreen(darkTheme: Boolean) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Column(modifier = Modifier.fillMaxWidth().liquidGlass(darkTheme).padding(16.dp)) {
            Text(stringResource(R.string.nav_messages), style = MaterialTheme.typography.titleLarge)
            Spacer(modifier = Modifier.height(8.dp))
            Text("1:1 chats, group chats, voice notes, replies, reactions, typing & seen status.")
        }
    }
}

@Composable
fun ProfileScreen(
    darkTheme: Boolean,
    onOpenAiAssistant: () -> Unit,
    onOpenSettings: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(modifier = Modifier.fillMaxWidth().liquidGlass(darkTheme).padding(16.dp)) {
            Text(stringResource(R.string.nav_profile), style = MaterialTheme.typography.titleLarge)
            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = onOpenAiAssistant, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.ai_assistant))
            }
            Spacer(modifier = Modifier.height(8.dp))
            TextButton(onClick = onOpenSettings, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.settings_title))
            }
        }
    }
}

@Composable
fun ReelsScreen(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.SpaceBetween) {
        Text("Vertical Short Videos (Media3 ExoPlayer)", style = MaterialTheme.typography.titleLarge)
        Button(onClick = onBack) { Text("Back") }
    }
}

@Composable
fun AiProfileAssistantScreen(darkTheme: Boolean, onBack: () -> Unit) {
    var topic by remember { mutableStateOf("") }
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(R.string.ai_assistant), style = MaterialTheme.typography.titleLarge)
        OutlinedTextField(
            value = topic,
            onValueChange = { topic = it },
            label = { Text("Describe your niche or bio topic") },
            modifier = Modifier.fillMaxWidth()
        )
        Button(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
            Text("Done")
        }
    }
}

@Composable
fun SettingsScreen(darkTheme: Boolean, onToggleTheme: () -> Unit, onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(R.string.settings_title), style = MaterialTheme.typography.titleLarge)
        Row(
            modifier = Modifier.fillMaxWidth().liquidGlass(darkTheme).padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Dark Mode")
            Switch(checked = darkTheme, onCheckedChange = { onToggleTheme() })
        }
        Button(onClick = onBack, modifier = Modifier.fillMaxWidth()) { Text("Back") }
    }
}
