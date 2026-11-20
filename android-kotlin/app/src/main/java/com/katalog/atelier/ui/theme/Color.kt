package com.katalog.atelier.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import com.katalog.atelier.domain.model.MaterialColorSeed

private val OchreLight = lightColorScheme(
    primary = Color(0xFF7D4E24),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFFFDCC2),
    onPrimaryContainer = Color(0xFF2D1600),
    secondary = Color(0xFF755846),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFFFDCC7),
    onSecondaryContainer = Color(0xFF2B1609),
    tertiary = Color(0xFF5D6236),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFE3E7B0),
    onTertiaryContainer = Color(0xFF1A1E00),
    background = Color(0xFFFBF8F4),
    onBackground = Color(0xFF201A16),
    surface = Color(0xFFFBF8F4),
    onSurface = Color(0xFF201A16),
    surfaceVariant = Color(0xFFF1E6DC),
    onSurfaceVariant = Color(0xFF51443A),
    outline = Color(0xFF837468),
    outlineVariant = Color(0xFFD5C3B6),
    error = Color(0xFFBA1A1A),
    onError = Color(0xFFFFFFFF)
)

private val OchreDark = darkColorScheme(
    primary = Color(0xFFF4B886),
    onPrimary = Color(0xFF492705),
    primaryContainer = Color(0xFF633A14),
    onPrimaryContainer = Color(0xFFFFDCC2),
    secondary = Color(0xFFE4BFA9),
    onSecondary = Color(0xFF422B1C),
    secondaryContainer = Color(0xFF5B4130),
    onSecondaryContainer = Color(0xFFFFDCC7),
    tertiary = Color(0xFFC6CB96),
    onTertiary = Color(0xFF2F330C),
    background = Color(0xFF171310),
    onBackground = Color(0xFFEDE0D8),
    surface = Color(0xFF171310),
    onSurface = Color(0xFFEDE0D8),
    surfaceVariant = Color(0xFF2A231E),
    onSurfaceVariant = Color(0xFFD5C3B6),
    outline = Color(0xFF9D8E82),
    outlineVariant = Color(0xFF51443A)
)

private val IndigoLight = lightColorScheme(
    primary = Color(0xFF3B5392),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFDCE2FF),
    onPrimaryContainer = Color(0xFF001849),
    secondary = Color(0xFF585E72),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFDCE2F9),
    onSecondaryContainer = Color(0xFF151B2C),
    background = Color(0xFFF9F9FD),
    onBackground = Color(0xFF1A1B20),
    surface = Color(0xFFF9F9FD),
    onSurface = Color(0xFF1A1B20),
    surfaceVariant = Color(0xFFE2E2EC),
    onSurfaceVariant = Color(0xFF45464F),
    outlineVariant = Color(0xFFC5C6D0)
)

private val IndigoDark = darkColorScheme(
    primary = Color(0xFFB5C4FF),
    onPrimary = Color(0xFF032864),
    primaryContainer = Color(0xFF223C79),
    onPrimaryContainer = Color(0xFFDCE2FF),
    background = Color(0xFF121318),
    onBackground = Color(0xFFE3E2E9),
    surface = Color(0xFF121318),
    onSurface = Color(0xFFE3E2E9),
    surfaceVariant = Color(0xFF23252E),
    onSurfaceVariant = Color(0xFFC5C6D0)
)

private val SageLight = lightColorScheme(
    primary = Color(0xFF3E6846),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFBFF0C4),
    onPrimaryContainer = Color(0xFF00210A),
    secondary = Color(0xFF516351),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFD4E8D2),
    onSecondaryContainer = Color(0xFF0F1F11),
    background = Color(0xFFF7FBF5),
    onBackground = Color(0xFF181D18),
    surface = Color(0xFFF7FBF5),
    onSurface = Color(0xFF181D18),
    surfaceVariant = Color(0xFFDEE5DC),
    onSurfaceVariant = Color(0xFF414941),
    outlineVariant = Color(0xFFC1C9BF)
)

private val SageDark = darkColorScheme(
    primary = Color(0xFFA4D3A9),
    onPrimary = Color(0xFF0E381B),
    primaryContainer = Color(0xFF265030),
    onPrimaryContainer = Color(0xFFBFF0C4),
    background = Color(0xFF111511),
    onBackground = Color(0xFFE0E4DE),
    surface = Color(0xFF111511),
    onSurface = Color(0xFFE0E4DE),
    surfaceVariant = Color(0xFF222822),
    onSurfaceVariant = Color(0xFFC1C9BF)
)

private val SlateLight = lightColorScheme(
    primary = Color(0xFF3C5F73),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFC0E8FF),
    onPrimaryContainer = Color(0xFF001E2B),
    secondary = Color(0xFF4E616C),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFD1E5F3),
    onSecondaryContainer = Color(0xFF0A1E28),
    background = Color(0xFFF7FAFC),
    onBackground = Color(0xFF181C1F),
    surface = Color(0xFFF7FAFC),
    onSurface = Color(0xFF181C1F),
    surfaceVariant = Color(0xFFDFE6EB),
    onSurfaceVariant = Color(0xFF41484D),
    outlineVariant = Color(0xFFC1C7CC)
)

private val SlateDark = darkColorScheme(
    primary = Color(0xFFA4CBE2),
    onPrimary = Color(0xFF053447),
    primaryContainer = Color(0xFF23475B),
    onPrimaryContainer = Color(0xFFC0E8FF),
    background = Color(0xFF111417),
    onBackground = Color(0xFFE0E3E6),
    surface = Color(0xFF111417),
    onSurface = Color(0xFFE0E3E6),
    surfaceVariant = Color(0xFF22272B),
    onSurfaceVariant = Color(0xFFC1C7CC)
)

fun colorSchemeForSeed(seed: MaterialColorSeed, darkTheme: Boolean): ColorScheme = when (seed) {
    MaterialColorSeed.OCHRE -> if (darkTheme) OchreDark else OchreLight
    MaterialColorSeed.INDIGO -> if (darkTheme) IndigoDark else IndigoLight
    MaterialColorSeed.SAGE -> if (darkTheme) SageDark else SageLight
    MaterialColorSeed.SLATE -> if (darkTheme) SlateDark else SlateLight
}
