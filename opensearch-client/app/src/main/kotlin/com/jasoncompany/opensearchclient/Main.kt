package com.jasoncompany.opensearchclient

import androidx.compose.material.MaterialTheme
import androidx.compose.material.Shapes
import androidx.compose.material.Typography
import androidx.compose.material.lightColors
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import androidx.compose.foundation.shape.RoundedCornerShape
import com.jasoncompany.opensearchclient.ui.MainScreen

// ─────────────────────────────────────────────
// Application entry point
// ─────────────────────────────────────────────

fun main() = application {
    val windowState = rememberWindowState(width = 1280.dp, height = 800.dp)

    Window(
        onCloseRequest = ::exitApplication,
        title = "OpenSearch Client",
        state = windowState,
    ) {
        AppTheme {
            MainScreen()
        }
    }
}

// ─────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────

private val AppColors = lightColors(
    primary          = Color(0xFF2563EB),
    primaryVariant   = Color(0xFF1D4ED8),
    secondary        = Color(0xFF0EA5E9),
    secondaryVariant = Color(0xFF0284C7),
    background       = Color(0xFFF8FAFC),
    surface          = Color(0xFFFFFFFF),
    error            = Color(0xFFEF4444),
    onPrimary        = Color(0xFFFFFFFF),
    onSecondary      = Color(0xFFFFFFFF),
    onBackground     = Color(0xFF1E293B),
    onSurface        = Color(0xFF1E293B),
    onError          = Color(0xFFFFFFFF),
)

@androidx.compose.runtime.Composable
fun AppTheme(content: @androidx.compose.runtime.Composable () -> Unit) {
    MaterialTheme(
        colors = AppColors,
        typography = Typography(
            h6       = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 18.sp, letterSpacing = 0.15.sp),
            subtitle1 = TextStyle(fontWeight = FontWeight.Medium, fontSize = 15.sp),
            subtitle2 = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 13.sp, letterSpacing = 0.1.sp),
            body1    = TextStyle(fontSize = 14.sp),
            body2    = TextStyle(fontSize = 13.sp, color = Color(0xFF64748B)),
            caption  = TextStyle(fontSize = 11.sp, color = Color(0xFF94A3B8)),
            button   = TextStyle(fontWeight = FontWeight.Medium, fontSize = 13.sp, letterSpacing = 0.5.sp),
        ),
        shapes = Shapes(
            small  = RoundedCornerShape(8.dp),
            medium = RoundedCornerShape(12.dp),
            large  = RoundedCornerShape(16.dp),
        ),
        content = content,
    )
}
