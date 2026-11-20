package com.katalog.atelier.data.repository

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.katalog.atelier.data.local.InventoryItemEntity
import com.katalog.atelier.data.local.KatalogDao
import com.katalog.atelier.data.local.RecentlyViewedEntity
import com.katalog.atelier.data.local.SyncQueueEntity
import com.katalog.atelier.data.remote.AuthUserSession
import com.katalog.atelier.data.remote.FirestoreInventoryClient
import com.katalog.atelier.data.seed.SeedInventory
import com.katalog.atelier.data.sync.CatalogueSyncWorker
import com.katalog.atelier.domain.logic.InventoryLogic
import com.katalog.atelier.domain.logic.SyncQueueRecord
import com.katalog.atelier.domain.model.InventoryItem
import com.katalog.atelier.domain.model.InventoryStatus
import com.katalog.atelier.domain.model.SyncState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.UUID

/**
 * Offline-first Single Source of Truth repository backed by Room SQLite.
 * Writes persist immediately to Room and either sync live to Firestore or coalesce
 * into the offline sync queue scheduled via WorkManager.
 */
class InventoryRepository(
    private val context: Context,
    private val dao: KatalogDao,
    private val firestoreClient: FirestoreInventoryClient
) {
    private var currentSession: AuthUserSession? = null

    fun setActiveSession(session: AuthUserSession?) {
        currentSession = session
    }

    fun isOnline(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun canSyncCloud(): Boolean {
        val session = currentSession ?: return false
        return !session.isOfflineLocalMode &&
            session.emailVerified &&
            firestoreClient.isAvailable &&
            isOnline()
    }

    fun observeItems(ownerId: String): Flow<List<InventoryItem>> =
        dao.observeItems(ownerId).map { rows -> rows.map { it.toDomain() } }

    fun observeSyncQueue(): Flow<List<SyncQueueRecord>> =
        dao.observeSyncQueue().map { rows ->
            rows.map {
                SyncQueueRecord(
                    id = it.queueId,
                    itemId = it.itemId,
                    operation = it.operation,
                    timestamp = it.timestamp,
                    itemTitle = it.itemTitle,
                    itemSku = it.itemSku
                )
            }
        }

    fun observeRecentlyViewedIds(): Flow<List<String>> =
        dao.observeRecentlyViewed().map { list -> list.map { it.itemId } }

    suspend fun bootstrapCatalogue(session: AuthUserSession) {
        setActiveSession(session)
        val localItems = dao.getItemsOnce(session.uid)

        if (canSyncCloud()) {
            runCatching {
                firestoreClient.ensureUserProfile(session)
                val remoteItems = firestoreClient.fetchUserInventory(session.uid)
                if (remoteItems.isNotEmpty()) {
                    dao.upsertItems(remoteItems.map { InventoryItemEntity.fromDomain(it) })
                    return
                }
            }
        }

        if (localItems.isEmpty()) {
            val seed = SeedInventory.create(session.uid)
            dao.upsertItems(seed.map { InventoryItemEntity.fromDomain(it) })
        }
    }

    suspend fun recordRecentlyViewed(itemId: String) {
        dao.upsertRecentlyViewed(RecentlyViewedEntity(itemId, System.currentTimeMillis()))
    }

    suspend fun saveItem(item: InventoryItem, isNew: Boolean): Boolean {
        val now = System.currentTimeMillis()
        val stamped = item.copy(
            updatedAt = now,
            createdAt = if (isNew) now else item.createdAt,
            cachedOffline = true
        )

        if (canSyncCloud()) {
            val cloudResult = runCatching {
                if (isNew) firestoreClient.createItem(stamped) else firestoreClient.updateItem(stamped)
            }
            if (cloudResult.isSuccess) {
                dao.upsertItem(InventoryItemEntity.fromDomain(stamped.copy(syncState = SyncState.SYNCED)))
                dao.deleteSyncEntry(stamped.id)
                return true
            }
        }

        val pendingState = if (isNew) SyncState.PENDING_CREATE else SyncState.PENDING_UPDATE
        dao.upsertItem(InventoryItemEntity.fromDomain(stamped.copy(syncState = pendingState)))
        enqueueCoalescedMutation(
            itemId = stamped.id,
            operation = if (isNew) "create" else "update",
            title = stamped.title,
            sku = stamped.sku
        )
        CatalogueSyncWorker.schedule(context)
        return false
    }

    suspend fun batchUpdateStatus(ownerId: String, itemIds: Set<String>, nextStatus: InventoryStatus): Int {
        if (itemIds.isEmpty()) return 0
        var updatedCount = 0
        val now = System.currentTimeMillis()
        val syncNow = canSyncCloud()

        for (id in itemIds) {
            val existing = dao.getItemById(id)?.toDomain() ?: continue
            if (existing.ownerId != ownerId) continue
            val updated = existing.copy(status = nextStatus, updatedAt = now)

            if (syncNow) {
                val res = runCatching { firestoreClient.updateItem(updated) }
                if (res.isSuccess) {
                    dao.upsertItem(InventoryItemEntity.fromDomain(updated.copy(syncState = SyncState.SYNCED)))
                    dao.deleteSyncEntry(id)
                    updatedCount++
                    continue
                }
            }

            dao.upsertItem(InventoryItemEntity.fromDomain(updated.copy(syncState = SyncState.PENDING_UPDATE)))
            enqueueCoalescedMutation(id, "update", updated.title, updated.sku)
            updatedCount++
        }

        if (!syncNow && updatedCount > 0) {
            CatalogueSyncWorker.schedule(context)
        }
        return updatedCount
    }

    suspend fun batchDeleteItems(ownerId: String, itemIds: Set<String>): Int {
        if (itemIds.isEmpty()) return 0
        var deletedCount = 0
        val syncNow = canSyncCloud()

        for (id in itemIds) {
            val existing = dao.getItemById(id)?.toDomain() ?: continue
            if (existing.ownerId != ownerId) continue

            if (syncNow) {
                val res = runCatching { firestoreClient.deleteItem(ownerId, id) }
                if (res.isSuccess) {
                    dao.deleteItemById(id)
                    dao.deleteSyncEntry(id)
                    deletedCount++
                    continue
                }
            }

            if (existing.syncState == SyncState.PENDING_CREATE) {
                dao.deleteItemById(id)
                dao.deleteSyncEntry(id)
            } else {
                dao.upsertItem(
                    InventoryItemEntity.fromDomain(existing.copy(syncState = SyncState.PENDING_DELETE))
                )
                enqueueCoalescedMutation(id, "delete", existing.title, existing.sku)
            }
            deletedCount++
        }

        if (!syncNow && deletedCount > 0) {
            CatalogueSyncWorker.schedule(context)
        }
        return deletedCount
    }

    suspend fun flushPendingSyncQueue(): Boolean {
        val session = currentSession ?: return false
        if (!canSyncCloud()) return false

        val pending = dao.getSyncQueueOnce()
        if (pending.isEmpty()) return true

        var allSucceeded = true
        for (entry in pending) {
            val item = dao.getItemById(entry.itemId)?.toDomain()
            val result = runCatching {
                when (entry.operation) {
                    "create" -> if (item != null) {
                        firestoreClient.createItem(item)
                        dao.upsertItem(InventoryItemEntity.fromDomain(item.copy(syncState = SyncState.SYNCED)))
                    }
                    "update" -> if (item != null) {
                        firestoreClient.updateItem(item)
                        dao.upsertItem(InventoryItemEntity.fromDomain(item.copy(syncState = SyncState.SYNCED)))
                    }
                    "delete" -> {
                        firestoreClient.deleteItem(session.uid, entry.itemId)
                        dao.deleteItemById(entry.itemId)
                    }
                }
            }
            if (result.isSuccess) {
                dao.deleteSyncEntry(entry.itemId)
            } else {
                allSucceeded = false
            }
        }
        return allSucceeded
    }

    private suspend fun enqueueCoalescedMutation(
        itemId: String,
        operation: String,
        title: String,
        sku: String
    ) {
        val current = dao.getSyncQueueOnce().map {
            SyncQueueRecord(it.queueId, it.itemId, it.operation, it.timestamp, it.itemTitle, it.itemSku)
        }
        val next = SyncQueueRecord(
            id = UUID.randomUUID().toString(),
            itemId = itemId,
            operation = operation,
            timestamp = System.currentTimeMillis(),
            itemTitle = title,
            itemSku = sku
        )
        val merged = InventoryLogic.coalesceSyncQueue(current, next)
        dao.clearSyncQueue()
        merged.forEach { rec ->
            dao.upsertSyncEntry(
                SyncQueueEntity(
                    itemId = rec.itemId,
                    queueId = rec.id,
                    operation = rec.operation,
                    timestamp = rec.timestamp,
                    itemTitle = rec.itemTitle,
                    itemSku = rec.itemSku
                )
            )
        }
    }

    /**
     * Erases all locally persisted catalogue records, queued mutations, recently viewed logs,
     * private garment photos, and Coil disk cache on emergency lock reset or sign-out.
     */
    suspend fun wipeLocalVault() {
        dao.clearAllItems()
        dao.clearSyncQueue()
        dao.clearRecentlyViewed()
        runCatching {
            java.io.File(context.filesDir, "garment_photos").deleteRecursively()
        }
        runCatching {
            java.io.File(context.cacheDir, "coil_garment_cache").deleteRecursively()
        }
    }
}
