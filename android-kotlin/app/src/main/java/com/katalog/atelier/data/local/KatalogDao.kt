package com.katalog.atelier.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface KatalogDao {
    @Query("SELECT * FROM inventory_items WHERE ownerId = :ownerId ORDER BY updatedAt DESC")
    fun observeItems(ownerId: String): Flow<List<InventoryItemEntity>>

    @Query("SELECT * FROM inventory_items WHERE ownerId = :ownerId ORDER BY updatedAt DESC")
    suspend fun getItemsOnce(ownerId: String): List<InventoryItemEntity>

    @Query("SELECT * FROM inventory_items WHERE id = :itemId LIMIT 1")
    suspend fun getItemById(itemId: String): InventoryItemEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertItem(item: InventoryItemEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertItems(items: List<InventoryItemEntity>)

    @Query("DELETE FROM inventory_items WHERE id = :itemId")
    suspend fun deleteItemById(itemId: String)

    @Query("DELETE FROM inventory_items WHERE id IN (:itemIds)")
    suspend fun deleteItemsByIds(itemIds: List<String>)

    @Query("SELECT * FROM sync_queue ORDER BY timestamp ASC")
    fun observeSyncQueue(): Flow<List<SyncQueueEntity>>

    @Query("SELECT * FROM sync_queue ORDER BY timestamp ASC")
    suspend fun getSyncQueueOnce(): List<SyncQueueEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSyncEntry(entry: SyncQueueEntity)

    @Query("DELETE FROM sync_queue WHERE itemId = :itemId")
    suspend fun deleteSyncEntry(itemId: String)

    @Query("DELETE FROM sync_queue")
    suspend fun clearSyncQueue()

    @Query("SELECT * FROM recently_viewed ORDER BY viewedAt DESC LIMIT 12")
    fun observeRecentlyViewed(): Flow<List<RecentlyViewedEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertRecentlyViewed(entry: RecentlyViewedEntity)

    @Query("DELETE FROM inventory_items")
    suspend fun clearAllItems()

    @Query("DELETE FROM recently_viewed")
    suspend fun clearRecentlyViewed()
}
