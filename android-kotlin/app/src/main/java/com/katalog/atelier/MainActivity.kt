package com.katalog.atelier

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Checkroom
import androidx.compose.material.icons.rounded.CloudSync
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.Security
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.katalog.atelier.ui.screens.AuthScreen
import com.katalog.atelier.ui.screens.CatalogueScreen
import com.katalog.atelier.ui.screens.CollectionsScreen
import com.katalog.atelier.ui.screens.DesignDetailsScreen
import com.katalog.atelier.ui.screens.ItemEditorScreen
import com.katalog.atelier.ui.screens.OfflineSyncScreen
import com.katalog.atelier.ui.screens.SecuritySettingsScreen
import com.katalog.atelier.ui.state.KatalogViewModel
import com.katalog.atelier.ui.theme.KatalogTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as KatalogApplication

        setContent {
            val viewModel: KatalogViewModel = viewModel(factory = KatalogViewModel.factory(app))
            KatalogAppRoot(viewModel = viewModel)
        }
    }
}

private enum class TopDestination(val route: String, val label: String) {
    CATALOGUE("catalogue", "Catalogue"),
    COLLECTIONS("collections", "Karigars"),
    OFFLINE("offline", "Offline"),
    SECURITY("security", "Security")
}

@Composable
private fun KatalogAppRoot(viewModel: KatalogViewModel) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.snackbarMessage) {
        val msg = uiState.snackbarMessage ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(msg)
        viewModel.clearSnackbar()
    }

    val darkTheme = uiState.darkModeOverride ?: isSystemInDarkTheme()

    KatalogTheme(
        seed = uiState.colorSeed,
        darkTheme = darkTheme,
        useDynamicColor = uiState.dynamicColorEnabled
    ) {
        val session = uiState.session
        if (session == null) {
            AuthScreen(
                isFirebaseConfigured = uiState.isFirebaseConfigured,
                isLoading = uiState.authLoading,
                errorMessage = uiState.authError,
                onSignInEmail = viewModel::signInWithEmail,
                onRegisterEmail = viewModel::registerWithEmail,
                onGoogleSignIn = viewModel::signInWithGoogle,
                onEnterOfflineMode = viewModel::enterOfflineAtelierMode
            )
            return@KatalogTheme
        }

        val navController = rememberNavController()
        val navBackStack by navController.currentBackStackEntryAsState()
        val currentRoute = navBackStack?.destination?.route
        val showBottomBar = TopDestination.entries.any { it.route == currentRoute }

        Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) },
            bottomBar = {
                if (showBottomBar) {
                    NavigationBar {
                        TopDestination.entries.forEach { dest ->
                            val icon = when (dest) {
                                TopDestination.CATALOGUE -> Icons.Rounded.Checkroom
                                TopDestination.COLLECTIONS -> Icons.Rounded.Groups
                                TopDestination.OFFLINE -> Icons.Rounded.CloudSync
                                TopDestination.SECURITY -> Icons.Rounded.Security
                            }
                            NavigationBarItem(
                                selected = currentRoute == dest.route,
                                onClick = {
                                    navController.navigate(dest.route) {
                                        popUpTo(TopDestination.CATALOGUE.route) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = { Icon(icon, contentDescription = dest.label) },
                                label = { Text(dest.label) }
                            )
                        }
                    }
                }
            }
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                NavHost(
                    navController = navController,
                    startDestination = TopDestination.CATALOGUE.route
                ) {
                    composable(TopDestination.CATALOGUE.route) {
                        CatalogueScreen(
                            uiState = uiState,
                            onQueryChange = viewModel::updateQuery,
                            onCategorySelected = viewModel::updateCategoryFilter,
                            onStatusSelected = viewModel::updateStatusFilter,
                            onViewModeChange = viewModel::setViewMode,
                            onToggleSelectionMode = viewModel::toggleSelectionMode,
                            onToggleItemSelected = viewModel::toggleItemSelected,
                            onToggleSelectAll = viewModel::toggleSelectAllVisible,
                            onClearSelection = viewModel::clearSelection,
                            onBatchUpdateStatus = viewModel::batchUpdateStatus,
                            onBatchDelete = viewModel::batchDeleteSelected,
                            onOpenDesign = { id ->
                                viewModel.markViewed(id)
                                navController.navigate("design/$id")
                            },
                            onCreateDesign = {
                                navController.navigate("editor")
                            }
                        )
                    }

                    composable(TopDestination.COLLECTIONS.route) {
                        CollectionsScreen(
                            items = uiState.allItems,
                            karigars = uiState.karigarDirectory,
                            onOpenDesign = { id ->
                                viewModel.markViewed(id)
                                navController.navigate("design/$id")
                            }
                        )
                    }

                    composable(TopDestination.OFFLINE.route) {
                        OfflineSyncScreen(
                            isOnline = uiState.isOnline,
                            allItems = uiState.allItems,
                            recentlyViewedIds = uiState.recentlyViewedIds,
                            syncQueue = uiState.syncQueue,
                            onSyncNow = viewModel::syncNow,
                            onOpenDesign = { id ->
                                viewModel.markViewed(id)
                                navController.navigate("design/$id")
                            }
                        )
                    }

                    composable(TopDestination.SECURITY.route) {
                        SecuritySettingsScreen(
                            session = session,
                            colorSeed = uiState.colorSeed,
                            darkModeOverride = uiState.darkModeOverride,
                            dynamicColorEnabled = uiState.dynamicColorEnabled,
                            onSelectSeed = viewModel::setColorSeed,
                            onToggleDarkMode = viewModel::setDarkModeOverride,
                            onToggleDynamicColor = viewModel::setDynamicColor,
                            onResendVerification = viewModel::resendVerificationEmail,
                            onRefreshVerification = viewModel::refreshEmailVerification,
                            onSignOut = viewModel::signOut
                        )
                    }

                    composable(
                        route = "design/{itemId}",
                        arguments = listOf(navArgument("itemId") { type = NavType.StringType })
                    ) { entry ->
                        val itemId = entry.arguments?.getString("itemId").orEmpty()
                        val item = uiState.allItems.firstOrNull { it.id == itemId }
                        if (item != null) {
                            DesignDetailsScreen(
                                item = item,
                                onBack = { navController.popBackStack() },
                                onEditFullDesign = { navController.navigate("editor?itemId=${item.id}") },
                                onUpdateSizeMatrix = { updatedSizes ->
                                    viewModel.updateSizeMatrix(item, updatedSizes)
                                },
                                onLogKarigarHandover = { handover ->
                                    viewModel.logKarigarHandover(item, handover)
                                },
                                onUpdateRawMaterials = { spec ->
                                    viewModel.updateRawMaterials(item, spec)
                                },
                                onDeleteDesign = {
                                    viewModel.deleteSingleItem(item.id) {
                                        navController.popBackStack()
                                    }
                                }
                            )
                        }
                    }

                    composable(
                        route = "editor?itemId={itemId}",
                        arguments = listOf(
                            navArgument("itemId") {
                                type = NavType.StringType
                                nullable = true
                                defaultValue = null
                            }
                        )
                    ) { entry ->
                        val editId = entry.arguments?.getString("itemId")
                        val existing = editId?.let { id -> uiState.allItems.firstOrNull { it.id == id } }
                        ItemEditorScreen(
                            ownerId = session.uid,
                            existingItem = existing,
                            onBack = { navController.popBackStack() },
                            onSave = { item, isNew ->
                                viewModel.saveItem(item, isNew) {
                                    navController.popBackStack()
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}
