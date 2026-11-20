package com.katalog.atelier.ui.screens

import android.os.Build
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.katalog.atelier.data.remote.AuthUserSession
import com.katalog.atelier.domain.model.MaterialColorSeed

@Composable
fun SecuritySettingsScreen(
    session: AuthUserSession,
    colorSeed: MaterialColorSeed,
    darkModeOverride: Boolean?,
    dynamicColorEnabled: Boolean,
    onSelectSeed: (MaterialColorSeed) -> Unit,
    onToggleDarkMode: (Boolean?) -> Unit,
    onToggleDynamicColor: (Boolean) -> Unit,
    onResendVerification: () -> Unit,
    onRefreshVerification: () -> Unit,
    onSignOut: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Security & Appearance", style = MaterialTheme.typography.headlineMedium)

        Card(
            shape = MaterialTheme.shapes.large,
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
            ),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("Account & Owner Isolation", style = MaterialTheme.typography.titleLarge)
                Text(session.displayName, style = MaterialTheme.typography.titleMedium)
                Text(
                    session.email,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = when {
                        session.isOfflineLocalMode -> "Local Offline Atelier Mode (Room SQLite encrypted device sandbox)"
                        session.emailVerified -> "Email Verified · Owner-isolated Firestore Rules Active"
                        else -> "Email Verification Required for Cloud Sync"
                    },
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )

                if (!session.isOfflineLocalMode && !session.emailVerified) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = onResendVerification) { Text("Send Link") }
                        Button(onClick = onRefreshVerification) { Text("Check Status") }
                    }
                }
            }
        }

        Card(
            shape = MaterialTheme.shapes.large,
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
            ),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Material 3 Expressive Theme", style = MaterialTheme.typography.titleLarge)
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    MaterialColorSeed.entries.forEach { seed ->
                        FilterChip(
                            selected = colorSeed == seed && !dynamicColorEnabled,
                            onClick = {
                                onToggleDynamicColor(false)
                                onSelectSeed(seed)
                            },
                            label = { Text(seed.label) }
                        )
                    }
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Android Dynamic Color", style = MaterialTheme.typography.titleSmall)
                            Text(
                                "Match wallpaper palette on Android 12+",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Switch(checked = dynamicColorEnabled, onCheckedChange = onToggleDynamicColor)
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = darkModeOverride == null,
                        onClick = { onToggleDarkMode(null) },
                        label = { Text("System") }
                    )
                    FilterChip(
                        selected = darkModeOverride == false,
                        onClick = { onToggleDarkMode(false) },
                        label = { Text("Light") }
                    )
                    FilterChip(
                        selected = darkModeOverride == true,
                        onClick = { onToggleDarkMode(true) },
                        label = { Text("Dark") }
                    )
                }
            }
        }

        OutlinedButton(
            onClick = onSignOut,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            Text("Sign Out")
        }

        Spacer(Modifier.height(16.dp))
    }
}
