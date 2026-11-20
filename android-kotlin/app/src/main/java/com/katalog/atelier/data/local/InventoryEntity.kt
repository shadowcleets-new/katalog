package com.katalog.atelier.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.katalog.atelier.domain.model.InventoryCategory
import com.katalog.atelier.domain.model.InventoryItem
import com.katalog.atelier.domain.model.InventoryStatus
import com.katalog.atelier.domain.model.KarigarStageEntry
import com.katalog.atelier.domain.model.PhotoAspectPreset
import com.katalog.atelier.domain.model.PhotoFilterPreset
import com.katalog.atelier.domain.model.RawMaterialSpec
import com.katalog.atelier.domain.model.SizeInventoryEntry
import com.katalog.atelier.domain.model.SyncState
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val entityJson = Json { ignoreUnknownKeys = true }

@Entity(tableName = "inventory_items")
data class InventoryItemEntity(
    @PrimaryKey val id: String,
    val ownerId: String,
    val sku: String,
    val title: String,
    val category: String,
    val location: String,
    val quantity: Int,
    val minThreshold: Int,
    val status: String,
    val sizesJson: String,
    val lastKarigarName: String,
    val lastKarigarStage: String,
    val lastKarigarDate: String,
    val karigarsJson: String,
    val rawMaterialsJson: String,
    val notes: String,
    val mediaKey: String,
    val photoFilter: String,
    val photoAspect: String,
    val createdAt: Long,
    val updatedAt: Long,
    val syncState: String,
    val cachedOffline: Boolean
) {
    fun toDomain(): InventoryItem = InventoryItem(
        id = id,
        ownerId = ownerId,
        sku = sku,
        title = title,
        category = InventoryCategory.fromWire(category),
        location = location,
        quantity = quantity,
        minThreshold = minThreshold,
        status = InventoryStatus.fromWire(status),
        sizes = runCatching {
            entityJson.decodeFromString<List<SizeInventoryEntry>>(sizesJson)
        }.getOrDefault(emptyList()),
        lastKarigarName = lastKarigarName,
        lastKarigarStage = lastKarigarStage,
        lastKarigarDate = lastKarigarDate,
        karigars = runCatching {
            entityJson.decodeFromString<List<KarigarStageEntry>>(karigarsJson)
        }.getOrDefault(emptyList()),
        rawMaterials = runCatching {
            entityJson.decodeFromString<RawMaterialSpec>(rawMaterialsJson)
        }.getOrDefault(RawMaterialSpec()),
        notes = notes,
        mediaKey = mediaKey,
        photoFilter = PhotoFilterPreset.fromWire(photoFilter),
        photoAspect = PhotoAspectPreset.fromWire(photoAspect),
        createdAt = createdAt,
        updatedAt = updatedAt,
        syncState = SyncState.fromWire(syncState),
        cachedOffline = cachedOffline
    )

    companion object {
        fun fromDomain(item: InventoryItem): InventoryItemEntity = InventoryItemEntity(
            id = item.id,
            ownerId = item.ownerId,
            sku = item.sku,
            title = item.title,
            category = item.category.wireValue,
            location = item.location,
            quantity = item.quantity,
            minThreshold = item.minThreshold,
            status = item.status.wireValue,
            sizesJson = entityJson.encodeToString(item.sizes),
            lastKarigarName = item.lastKarigarName,
            lastKarigarStage = item.lastKarigarStage,
            lastKarigarDate = item.lastKarigarDate,
            karigarsJson = entityJson.encodeToString(item.karigars),
            rawMaterialsJson = entityJson.encodeToString(item.rawMaterials),
            notes = item.notes,
            mediaKey = item.mediaKey,
            photoFilter = item.photoFilter.wireValue,
            photoAspect = item.photoAspect.wireValue,
            createdAt = item.createdAt,
            updatedAt = item.updatedAt,
            syncState = item.syncState.wireValue,
            cachedOffline = item.cachedOffline
        )
    }
}

@Entity(tableName = "sync_queue")
data class SyncQueueEntity(
    @PrimaryKey val itemId: String,
    val queueId: String,
    val operation: String, // "create" | "update" | "delete"
    val timestamp: Long,
    val itemTitle: String,
    val itemSku: String
)

@Entity(tableName = "recently_viewed")
data class RecentlyViewedEntity(
    @PrimaryKey val itemId: String,
    val viewedAt: Long
)
