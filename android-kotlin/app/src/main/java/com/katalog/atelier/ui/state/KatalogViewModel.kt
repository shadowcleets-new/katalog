package com.katalog.atelier.ui.state

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.katalog.atelier.KatalogApplication
import com.katalog.atelier.data.remote.AuthUserSession
import com.katalog.atelier.data.remote.FirebaseAuthManager
import com.katalog.atelier.data.repository.InventoryRepository
import com.katalog.atelier.domain.logic.InventoryFilterState
import com.katalog.atelier.domain.logic.InventoryLogic
import com.katalog.atelier.domain.logic.InventorySummaryMetrics
import com.katalog.atelier.domain.logic.KarigarDirectoryEntry
import com.katalog.atelier.domain.logic.SortOption
import com.katalog.atelier.domain.logic.SyncQueueRecord
import com.katalog.atelier.domain.model.InventoryCategory
import com.katalog.atelier.domain.model.InventoryItem
import com.katalog.atelier.domain.model.InventoryStatus
import com.katalog.atelier.domain.model.KarigarStageEntry
import com.katalog.atelier.domain.model.MaterialColorSeed
import com.katalog.atelier.domain.model.RawMaterialSpec
import com.katalog.atelier.domain.model.SizeInventoryEntry
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class ViewMode { GRID, LIST }

data class KatalogUiState(
    val session: AuthUserSession? = null,
    val authLoading: Boolean = false,
    val authError: String? = null,
    val isFirebaseConfigured: Boolean = false,
    val isOnline: Boolean = true,
    val allItems: List<InventoryItem> = emptyList(),
    val visibleItems: List<InventoryItem> = emptyList(),
    val metrics: InventorySummaryMetrics = InventorySummaryMetrics(0, 0, 0, 0, 0),
    val karigarDirectory: List<KarigarDirectoryEntry> = emptyList(),
    val knownKarigarNames: List<String> = emptyList(),
    val syncQueue: List<SyncQueueRecord> = emptyList(),
    val recentlyViewedIds: List<String> = emptyList(),
    val filters: InventoryFilterState = InventoryFilterState(),
    val viewMode: ViewMode = ViewMode.GRID,
    val selectionMode: Boolean = false,
    val selectedIds: Set<String> = emptySet(),
    val batchBusy: Boolean = false,
    val colorSeed: MaterialColorSeed = MaterialColorSeed.OCHRE,
    val darkModeOverride: Boolean? = null,
    val dynamicColorEnabled: Boolean = false,
    val appLockEnabled: Boolean = false,
    val isLocked: Boolean = false,
    val snackbarMessage: String? = null
)

class KatalogViewModel(
    private val authManager: FirebaseAuthManager,
    private val repository: InventoryRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        KatalogUiState(
            isFirebaseConfigured = authManager.isFirebaseConfigured,
            isOnline = repository.isOnline()
        )
    )
    val uiState: StateFlow<KatalogUiState> = _uiState.asStateFlow()

    private var catalogueJob: Job? = null

    init {
        observeGlobalStores()
        observeFirebaseSession()
    }

    private fun observeGlobalStores() {
        viewModelScope.launch {
            repository.observeSyncQueue().collectLatest { queue ->
                _uiState.update { it.copy(syncQueue = queue, isOnline = repository.isOnline()) }
            }
        }
        viewModelScope.launch {
            repository.observeRecentlyViewedIds().collectLatest { recents ->
                _uiState.update { it.copy(recentlyViewedIds = recents) }
            }
        }
    }

    private fun observeFirebaseSession() {
        viewModelScope.launch {
            authManager.observeAuthState().collectLatest { session ->
                if (session != null) {
                    activateSession(session)
                } else if (_uiState.value.session?.isOfflineLocalMode != true) {
                    catalogueJob?.cancel()
                    repository.setActiveSession(null)
                    _uiState.update { it.copy(session = null, allItems = emptyList(), visibleItems = emptyList()) }
                }
            }
        }
    }

    private fun activateSession(session: AuthUserSession) {
        _uiState.update { it.copy(session = session, authError = null, authLoading = false) }
        catalogueJob?.cancel()
        catalogueJob = viewModelScope.launch {
            repository.bootstrapCatalogue(session)
            repository.observeItems(session.uid).collectLatest { items ->
                _uiState.update { state ->
                    val prunedSelection = InventoryLogic.pruneSelectionIds(state.selectedIds, items)
                    state.copy(
                        allItems = items,
                        visibleItems = InventoryLogic.filterAndSortInventory(items, state.filters),
                        metrics = InventoryLogic.computeInventoryMetrics(items),
                        karigarDirectory = InventoryLogic.aggregateKarigarsDirectory(items),
                        knownKarigarNames = InventoryLogic.getKnownKarigarNames(items),
                        selectedIds = prunedSelection,
                        isOnline = repository.isOnline()
                    )
                }
            }
        }
    }

    fun enterOfflineAtelierMode() {
        val localSession = AuthUserSession(
            uid = "local-mumbai-atelier",
            email = "atelier@katalog.local",
            displayName = "Mumbai Atelier (Offline)",
            emailVerified = true,
            isOfflineLocalMode = true
        )
        activateSession(localSession)
        postSnackbar("Entered offline atelier workspace.")
    }

    fun signInWithEmail(email: String, password: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(authLoading = true, authError = null) }
            val result = authManager.signInWithEmail(email, password)
            result.onSuccess { activateSession(it) }
                .onFailure { err ->
                    _uiState.update { it.copy(authLoading = false, authError = err.message ?: "Sign-in failed.") }
                }
        }
    }

    fun registerWithEmail(displayName: String, email: String, password: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(authLoading = true, authError = null) }
            val result = authManager.registerWithEmail(displayName, email, password)
            result.onSuccess {
                activateSession(it)
                postSnackbar("Account created. Verify your email to enable cloud sync.")
            }.onFailure { err ->
                _uiState.update { it.copy(authLoading = false, authError = err.message ?: "Registration failed.") }
            }
        }
    }

    fun signInWithGoogle(activityContext: Context) {
        viewModelScope.launch {
            _uiState.update { it.copy(authLoading = true, authError = null) }
            val result = authManager.signInWithGoogle(activityContext)
            result.onSuccess { activateSession(it) }
                .onFailure { err ->
                    _uiState.update { it.copy(authLoading = false, authError = err.message ?: "Google Sign-In cancelled.") }
                }
        }
    }

    fun refreshEmailVerification() {
        viewModelScope.launch {
            val reloaded = authManager.reloadCurrentUser()
            if (reloaded != null) {
                _uiState.update { it.copy(session = reloaded) }
                repository.setActiveSession(reloaded)
                postSnackbar(
                    if (reloaded.emailVerified) "Email verified. Cloud sync enabled."
                    else "Email not yet verified."
                )
            }
        }
    }

    fun resendVerificationEmail() {
        viewModelScope.launch {
            authManager.sendVerificationEmail()
                .onSuccess { postSnackbar("Verification email sent.") }
                .onFailure { postSnackbar(it.message ?: "Could not send verification email.") }
        }
    }

    fun signOut() {
        authManager.signOut()
        catalogueJob?.cancel()
        repository.setActiveSession(null)
        _uiState.update {
            it.copy(
                session = null,
                allItems = emptyList(),
                visibleItems = emptyList(),
                selectionMode = false,
                selectedIds = emptySet()
            )
        }
    }

    // --- Filters & View Mode ---
    fun updateQuery(query: String) = updateFilters { it.copy(query = query) }
    fun updateCategoryFilter(category: InventoryCategory?) = updateFilters { it.copy(category = category) }
    fun updateStatusFilter(status: InventoryStatus?) = updateFilters { it.copy(status = status) }
    fun updateSort(sort: SortOption) = updateFilters { it.copy(sort = sort) }

    private fun updateFilters(transform: (InventoryFilterState) -> InventoryFilterState) {
        _uiState.update { state ->
            val nextFilters = transform(state.filters)
            state.copy(
                filters = nextFilters,
                visibleItems = InventoryLogic.filterAndSortInventory(state.allItems, nextFilters)
            )
        }
    }

    fun setViewMode(mode: ViewMode) {
        _uiState.update { it.copy(viewMode = mode) }
    }

    // --- Batch Selection Mode ---
    fun toggleSelectionMode() {
        _uiState.update { state ->
            val next = !state.selectionMode
            state.copy(
                selectionMode = next,
                selectedIds = if (next) state.selectedIds else emptySet()
            )
        }
    }

    fun toggleItemSelected(itemId: String) {
        _uiState.update { state ->
            state.copy(selectedIds = InventoryLogic.toggleSelectionId(state.selectedIds, itemId))
        }
    }

    fun toggleSelectAllVisible() {
        _uiState.update { state ->
            val visibleIds = state.visibleItems.map { it.id }
            state.copy(selectedIds = InventoryLogic.toggleSelectAllVisible(state.selectedIds, visibleIds))
        }
    }

    fun clearSelection() {
        _uiState.update { it.copy(selectedIds = emptySet()) }
    }

    fun batchUpdateStatus(nextStatus: InventoryStatus) {
        val session = _uiState.value.session ?: return
        val ids = _uiState.value.selectedIds
        if (ids.isEmpty()) return

        viewModelScope.launch {
            _uiState.update { it.copy(batchBusy = true) }
            val count = repository.batchUpdateStatus(session.uid, ids, nextStatus)
            _uiState.update { it.copy(batchBusy = false, selectedIds = emptySet(), selectionMode = false) }
            postSnackbar("Updated $count design(s) to ${nextStatus.displayLabel}.")
        }
    }

    fun batchDeleteSelected() {
        val session = _uiState.value.session ?: return
        val ids = _uiState.value.selectedIds
        if (ids.isEmpty()) return

        viewModelScope.launch {
            _uiState.update { it.copy(batchBusy = true) }
            val count = repository.batchDeleteItems(session.uid, ids)
            _uiState.update { it.copy(batchBusy = false, selectedIds = emptySet(), selectionMode = false) }
            postSnackbar("Deleted $count design(s) from catalogue.")
        }
    }

    // --- Single Item Operations & Design Details Updates ---
    fun markViewed(itemId: String) {
        viewModelScope.launch { repository.recordRecentlyViewed(itemId) }
    }

    fun saveItem(item: InventoryItem, isNew: Boolean, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            val syncedLive = repository.saveItem(item, isNew)
            postSnackbar(
                if (syncedLive) {
                    if (isNew) "Design added & synced to cloud." else "Design updated & synced."
                } else {
                    if (isNew) "Design saved offline (queued for sync)." else "Changes saved offline."
                }
            )
            onDone()
        }
    }

    fun updateSizeMatrix(item: InventoryItem, updatedSizes: List<SizeInventoryEntry>) {
        val sorted = InventoryLogic.sortSizesLogically(updatedSizes)
        val total = InventoryLogic.computeTotalStockFromSizes(sorted)
        val nextStatus = InventoryLogic.deriveDesignStatus(sorted, item.minThreshold, item.status)
        saveItem(item.copy(sizes = sorted, quantity = total, status = nextStatus), isNew = false)
    }

    fun logKarigarHandover(item: InventoryItem, entry: KarigarStageEntry) {
        val updatedLog = (listOf(entry) + item.karigars).take(10)
        saveItem(
            item.copy(
                lastKarigarName = entry.karigarName.trim(),
                lastKarigarStage = entry.stage.trim(),
                lastKarigarDate = entry.dateGiven.trim(),
                karigars = updatedLog
            ),
            isNew = false
        )
    }

    fun updateRawMaterials(item: InventoryItem, spec: RawMaterialSpec) {
        saveItem(item.copy(rawMaterials = spec), isNew = false)
    }

    fun deleteSingleItem(itemId: String, onDone: () -> Unit = {}) {
        val session = _uiState.value.session ?: return
        viewModelScope.launch {
            repository.batchDeleteItems(session.uid, setOf(itemId))
            postSnackbar("Design removed from catalogue.")
            onDone()
        }
    }

    fun syncNow() {
        viewModelScope.launch {
            val ok = repository.flushPendingSyncQueue()
            postSnackbar(
                if (ok) "All pending offline changes synced."
                else "Sync deferred — verify connection and cloud sign-in."
            )
        }
    }

    // --- Theme & Security Preferences ---
    fun setColorSeed(seed: MaterialColorSeed) = _uiState.update { it.copy(colorSeed = seed) }
    fun setDarkModeOverride(dark: Boolean?) = _uiState.update { it.copy(darkModeOverride = dark) }
    fun setDynamicColor(enabled: Boolean) = _uiState.update { it.copy(dynamicColorEnabled = enabled) }
    fun setAppLockEnabled(enabled: Boolean) = _uiState.update { it.copy(appLockEnabled = enabled) }
    fun lockApp() = _uiState.update { it.copy(isLocked = true) }
    fun unlockApp() = _uiState.update { it.copy(isLocked = false) }

    fun postSnackbar(message: String) {
        _uiState.update { it.copy(snackbarMessage = message) }
    }

    fun clearSnackbar() {
        _uiState.update { it.copy(snackbarMessage = null) }
    }

    companion object {
        fun factory(application: KatalogApplication): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return KatalogViewModel(
                        authManager = application.authManager,
                        repository = application.inventoryRepository
                    ) as T
                }
            }
    }
}
