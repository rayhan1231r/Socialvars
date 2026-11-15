package com.socialverse.app.core.theme

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

private val LightColors = lightColorScheme(
    primary = Color(0xFF0284C7),
    onPrimary = Color.White,
    background = Color(0xFFF1F5F9),
    surface = Color(0xCCFFFFFF),
    onBackground = Color(0xFF0F172A),
    onSurface = Color(0xFF0F172A),
    surfaceVariant = Color(0x99E2E8F0)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF38BDF8),
    onPrimary = Color(0xFF082F49),
    background = Color(0xFF020617),
    surface = Color(0xAD0F172A),
    onBackground = Color(0xFFF8FAFC),
    onSurface = Color(0xFFF8FAFC),
    surfaceVariant = Color(0x881E293B)
)

@Composable
fun SocialVerseTheme(
    darkTheme: Boolean,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}

@Composable
fun Modifier.liquidGlass(
    darkTheme: Boolean,
    cornerRadius: Dp = 24.dp
): Modifier {
    val shape = RoundedCornerShape(cornerRadius)
    val fill = if (darkTheme) Color(0xAD0F172A) else Color(0xCCFFFFFF)
    val borderBrush = Brush.verticalGradient(
        colors = if (darkTheme) {
            listOf(Color.White.copy(alpha = 0.16f), Color.White.copy(alpha = 0.04f))
        } else {
            listOf(Color.White.copy(alpha = 0.88f), Color.White.copy(alpha = 0.35f))
        }
    )
    return this
        .clip(shape)
        .background(fill)
        .border(BorderStroke(1.dp, borderBrush), shape)
}
