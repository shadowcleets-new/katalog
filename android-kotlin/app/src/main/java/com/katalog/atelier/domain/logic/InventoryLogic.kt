package com.katalog.atelier.domain.logic

import com.katalog.atelier.domain.model.InventoryCategory
import com.katalog.atelier.domain.model.InventoryFormValues
import com.katalog.atelier.domain.model.InventoryItem
import com.katalog.atelier.domain.model.InventoryStatus
import com.katalog.atelier.domain.model.SchemaLimits
import com.katalog.atelier.domain.model.SizeInventoryEntry
import com.katalog.atelier.domain.model.SyncState
import java.text.NumberFormat
import java.util.Locale

enum class SortOption(val label: String) {
    UPDATED_DESC("Recently Updated"),
    TITLE_ASC("Design Name A–Z"),
    QUANTITY_ASC("Lowest Stock First"),
    SKU_ASC("Design Code A–Z")
}

data class InventoryFilterState(
    val query: String = "",
    val category: InventoryCategory? = null,
    val status: InventoryStatus? = null,
    val sort: SortOption = SortOption.UPDATED_DESC
)

data class ValidationErrors(
    val sku: String? = null,
    val title: String? = null,
    val location: String? = null,
    val minThreshold: String? = null,
    val sizes: String? = null,
    val topFabric: String? = null,
    val colorShade: String? = null,
    val notes: String? = null
) {
    val hasErrors: Boolean
        get() = listOf(sku, title, location, minThreshold, sizes, topFabric, colorShade, notes)
            .any { it != null }
}

data class InventorySummaryMetrics(
    val totalDesigns: Int,
    val totalPieces: Int,
    val lowOrOutCount: Int,
    val auditPendingCount: Int,
    val cachedCount: Int
)

data class KarigarDesignRef(
    val item: InventoryItem,
    val stage: String,
    val dateGiven: String,
    val isLastKarigar: Boolean
)

data class KarigarDirectoryEntry(
    val karigarName: String,
    val stages: List<String>,
    val unitNotes: List<String>,
    val lastGivenCount: Int,
    val designs: List<KarigarDesignRef>
)

data class SyncQueueRecord(
    val id: String,
    val itemId: String,
    val operation: String, // "create" | "update" | "delete"
    val timestamp: Long,
    val itemTitle: String,
    val itemSku: String
)

object InventoryLogic {
    private val indianLocale = Locale("en", "IN")

    fun sortSizesLogically(sizes: List<SizeInventoryEntry>): List<SizeInventoryEntry> {
        val rankMap = SchemaLimits.STANDARD_SIZES
            .withIndex()
            .associate { (idx, label) -> label.uppercase(Locale.US) to idx }

        return sizes.sortedWith { a, b ->
            val keyA = a.size.trim().uppercase(Locale.US)
            val keyB = b.size.trim().uppercase(Locale.US)
            val rankA = rankMap[keyA]
            val rankB = rankMap[keyB]
            when {
                rankA != null && rankB != null -> rankA.compareTo(rankB)
                rankA != null -> -1
                rankB != null -> 1
                else -> keyA.compareTo(keyB)
            }
        }
    }

    fun formatInr(amount: Int): String {
        val safe = amount.coerceAtLeast(0)
        val formatter = NumberFormat.getNumberInstance(indianLocale)
        return "₹${formatter.format(safe)}"
    }

    fun getPriceRangeLabel(sizes: List<SizeInventoryEntry>): String {
        val priced = sizes.map { it.price }.filter { it > 0 }
        if (priced.isEmpty()) return "Price not set"
        val min = priced.min()
        val max = priced.max()
        return if (min == max) formatInr(min) else "${formatInr(min)} – ${formatInr(max)}"
    }

    fun computeTotalStockFromSizes(sizes: List<SizeInventoryEntry>): Int =
        sizes.sumOf { it.stock.coerceAtLeast(0) }

    fun deriveDesignStatus(
        sizes: List<SizeInventoryEntry>,
        minThreshold: Int,
        currentStatus: InventoryStatus? = null
    ): InventoryStatus {
        if (currentStatus == InventoryStatus.AUDIT_PENDING) {
            return InventoryStatus.AUDIT_PENDING
        }
        val total = computeTotalStockFromSizes(sizes)
        if (total <= 0) return InventoryStatus.OUT_OF_STOCK
        if (sizes.any { it.stock <= minThreshold }) return InventoryStatus.LOW_STOCK
        return InventoryStatus.IN_STOCK
    }

    fun normalizeSku(raw: String): String =
        raw.trim().uppercase(Locale.US).replace(Regex("\\s+"), "-")

    fun validateInventoryForm(values: InventoryFormValues): ValidationErrors {
        val sku = normalizeSku(values.sku)
        val title = values.title.trim()
        val location = values.location.trim()
        val notes = values.notes.trim()

        val skuErr = when {
            sku.length !in SchemaLimits.SKU_MIN..SchemaLimits.SKU_MAX ->
                "Design code must be ${SchemaLimits.SKU_MIN}–${SchemaLimits.SKU_MAX} characters."
            !SchemaLimits.SKU_REGEX.matches(sku) ->
                "Design code may contain only uppercase letters, digits, and hyphens."
            else -> null
        }

        val titleErr = if (title.length !in SchemaLimits.TITLE_MIN..SchemaLimits.TITLE_MAX) {
            "Design name must be ${SchemaLimits.TITLE_MIN}–${SchemaLimits.TITLE_MAX} characters."
        } else null

        val locationErr = if (location.length !in SchemaLimits.LOCATION_MIN..SchemaLimits.LOCATION_MAX) {
            "Rack / storage zone must be ${SchemaLimits.LOCATION_MIN}–${SchemaLimits.LOCATION_MAX} characters."
        } else null

        val thresholdErr = if (values.minThreshold !in 0..SchemaLimits.THRESHOLD_MAX) {
            "Low-size threshold must be 0 to ${SchemaLimits.THRESHOLD_MAX}."
        } else null

        val sizesErr = validateSizes(values.sizes)

        val topFabricErr = when {
            values.rawMaterials.topFabric.isBlank() ->
                "Specify the Kameez / top fabric so it is easy to reorder later."
            values.rawMaterials.topFabric.trim().length > SchemaLimits.FABRIC_MAX ->
                "Top fabric cannot exceed ${SchemaLimits.FABRIC_MAX} characters."
            else -> null
        }

        val colorShadeErr = when {
            values.rawMaterials.colorShade.isBlank() ->
                "Specify the garment colour or dye shade."
            values.rawMaterials.colorShade.trim().length > SchemaLimits.COLOR_MAX ->
                "Colour / shade cannot exceed ${SchemaLimits.COLOR_MAX} characters."
            else -> null
        }

        val notesErr = if (notes.length > SchemaLimits.NOTES_MAX) {
            "Notes cannot exceed ${SchemaLimits.NOTES_MAX} characters."
        } else null

        return ValidationErrors(
            sku = skuErr,
            title = titleErr,
            location = locationErr,
            minThreshold = thresholdErr,
            sizes = sizesErr,
            topFabric = topFabricErr,
            colorShade = colorShadeErr,
            notes = notesErr
        )
    }

    private fun validateSizes(sizes: List<SizeInventoryEntry>): String? {
        if (sizes.size < SchemaLimits.SIZES_MIN) {
            return "Add at least one garment size with stock and price."
        }
        if (sizes.size > SchemaLimits.SIZES_MAX) {
            return "You can track up to ${SchemaLimits.SIZES_MAX} sizes per design."
        }
        val seen = mutableSetOf<String>()
        for (entry in sizes) {
            val label = entry.size.trim().uppercase(Locale.US)
            if (label.isEmpty() || label.length > SchemaLimits.SIZE_LABEL_MAX) {
                return "Every size label must be 1–${SchemaLimits.SIZE_LABEL_MAX} characters."
            }
            if (!seen.add(label)) {
                return "Duplicate size \"$label\" found. Keep one row per size."
            }
            if (entry.stock !in 0..SchemaLimits.SIZE_STOCK_MAX) {
                return "Stock for size $label must be 0 to ${SchemaLimits.SIZE_STOCK_MAX}."
            }
            if (entry.price !in 0..SchemaLimits.SIZE_PRICE_MAX) {
                return "Price for size $label must be 0 to ${SchemaLimits.SIZE_PRICE_MAX}."
            }
        }
        return null
    }

    fun filterAndSortInventory(
        items: List<InventoryItem>,
        filters: InventoryFilterState
    ): List<InventoryItem> {
        val q = filters.query.trim().lowercase(Locale.US)
        val filtered = items.filter { item ->
            if (item.syncState == SyncState.PENDING_DELETE) return@filter false
            if (filters.category != null && item.category != filters.category) return@filter false
            if (filters.status != null && item.status != filters.status) return@filter false
            if (q.isEmpty()) return@filter true

            val karigarMatch = item.lastKarigarName.lowercase(Locale.US).contains(q) ||
                item.lastKarigarStage.lowercase(Locale.US).contains(q) ||
                item.karigars.any {
                    it.karigarName.lowercase(Locale.US).contains(q) ||
                        it.stage.lowercase(Locale.US).contains(q) ||
                        it.unitOrNote.lowercase(Locale.US).contains(q)
                }

            val materialMatch = item.rawMaterials.topFabric.lowercase(Locale.US).contains(q) ||
                item.rawMaterials.colorShade.lowercase(Locale.US).contains(q) ||
                item.rawMaterials.bottomFabric.lowercase(Locale.US).contains(q) ||
                item.rawMaterials.dupattaFabric.lowercase(Locale.US).contains(q) ||
                item.rawMaterials.materialNotes.lowercase(Locale.US).contains(q)

            item.title.lowercase(Locale.US).contains(q) ||
                item.sku.lowercase(Locale.US).contains(q) ||
                item.location.lowercase(Locale.US).contains(q) ||
                item.notes.lowercase(Locale.US).contains(q) ||
                item.category.wireValue.lowercase(Locale.US).contains(q) ||
                karigarMatch ||
                materialMatch
        }

        return when (filters.sort) {
            SortOption.TITLE_ASC -> filtered.sortedBy { it.title.lowercase(Locale.US) }
            SortOption.QUANTITY_ASC -> filtered.sortedBy { it.quantity }
            SortOption.SKU_ASC -> filtered.sortedBy { it.sku }
            SortOption.UPDATED_DESC -> filtered.sortedByDescending { it.updatedAt }
        }
    }

    fun computeInventoryMetrics(items: List<InventoryItem>): InventorySummaryMetrics {
        val active = items.filter { it.syncState != SyncState.PENDING_DELETE }
        return InventorySummaryMetrics(
            totalDesigns = active.size,
            totalPieces = active.sumOf { it.quantity },
            lowOrOutCount = active.count {
                it.status == InventoryStatus.LOW_STOCK || it.status == InventoryStatus.OUT_OF_STOCK
            },
            auditPendingCount = active.count { it.status == InventoryStatus.AUDIT_PENDING },
            cachedCount = active.count { it.cachedOffline }
        )
    }

    fun aggregateKarigarsDirectory(items: List<InventoryItem>): List<KarigarDirectoryEntry> {
        val active = items.filter { it.syncState != SyncState.PENDING_DELETE }
        val map = linkedMapOf<String, MutableKarigarBucket>()

        fun ensure(name: String): MutableKarigarBucket {
            val key = name.trim().lowercase(Locale.US)
            return map.getOrPut(key) { MutableKarigarBucket(name.trim()) }
        }

        for (item in active) {
            val lastKey = item.lastKarigarName.trim().lowercase(Locale.US)
            if (item.lastKarigarName.isNotBlank()) {
                val bucket = ensure(item.lastKarigarName)
                bucket.lastGivenCount += 1
                if (item.lastKarigarStage.isNotBlank()) {
                    bucket.stages.add(item.lastKarigarStage)
                }
                if (bucket.designs.none { it.item.id == item.id }) {
                    bucket.designs.add(
                        KarigarDesignRef(
                            item = item,
                            stage = item.lastKarigarStage.ifBlank { "Assigned" },
                            dateGiven = item.lastKarigarDate,
                            isLastKarigar = true
                        )
                    )
                }
            }

            for (log in item.karigars) {
                if (log.karigarName.isBlank()) continue
                val bucket = ensure(log.karigarName)
                if (log.stage.isNotBlank()) bucket.stages.add(log.stage)
                val area = log.unitOrNote.split("·").firstOrNull()?.trim().orEmpty()
                if (area.isNotEmpty()) bucket.unitNotes.add(area)

                if (bucket.designs.none { it.item.id == item.id }) {
                    bucket.designs.add(
                        KarigarDesignRef(
                            item = item,
                            stage = log.stage,
                            dateGiven = log.dateGiven,
                            isLastKarigar = log.karigarName.trim().lowercase(Locale.US) == lastKey
                        )
                    )
                }
            }
        }

        return map.values
            .map {
                KarigarDirectoryEntry(
                    karigarName = it.karigarName,
                    stages = it.stages.toList(),
                    unitNotes = it.unitNotes.toList(),
                    lastGivenCount = it.lastGivenCount,
                    designs = it.designs.toList()
                )
            }
            .sortedWith(
                compareByDescending<KarigarDirectoryEntry> { it.lastGivenCount }
                    .thenByDescending { it.designs.size }
                    .thenBy { it.karigarName.lowercase(Locale.US) }
            )
    }

    fun getKnownKarigarNames(items: List<InventoryItem>): List<String> =
        buildSet {
            items.forEach { item ->
                if (item.lastKarigarName.isNotBlank()) add(item.lastKarigarName.trim())
                item.karigars.forEach { k ->
                    if (k.karigarName.isNotBlank()) add(k.karigarName.trim())
                }
            }
        }.sortedBy { it.lowercase(Locale.US) }

    fun toggleSelectionId(selectedIds: Set<String>, itemId: String): Set<String> =
        if (itemId in selectedIds) selectedIds - itemId else selectedIds + itemId

    fun toggleSelectAllVisible(selectedIds: Set<String>, visibleIds: List<String>): Set<String> {
        if (visibleIds.isEmpty()) return selectedIds
        val visibleSet = visibleIds.toSet()
        return if (visibleSet.all { it in selectedIds }) {
            selectedIds - visibleSet
        } else {
            selectedIds + visibleSet
        }
    }

    fun pruneSelectionIds(selectedIds: Set<String>, items: List<InventoryItem>): Set<String> {
        val activeIds = items.filter { it.syncState != SyncState.PENDING_DELETE }.map { it.id }.toSet()
        return selectedIds.intersect(activeIds)
    }

    /**
     * Coalesces offline mutations per itemId:
     * create + update -> single create
     * create + delete -> removes entry completely
     * update + update -> keeps latest update
     */
    fun coalesceSyncQueue(
        queue: List<SyncQueueRecord>,
        next: SyncQueueRecord
    ): List<SyncQueueRecord> {
        val index = queue.indexOfFirst { it.itemId == next.itemId }
        if (index == -1) return queue + next

        val prev = queue[index]
        val mutable = queue.toMutableList()
        return when {
            prev.operation == "create" && next.operation == "update" -> {
                mutable[index] = next.copy(id = prev.id, operation = "create")
                mutable
            }
            prev.operation == "create" && next.operation == "delete" -> {
                mutable.removeAt(index)
                mutable
            }
            else -> {
                mutable[index] = next
                mutable
            }
        }
    }

    private class MutableKarigarBucket(val karigarName: String) {
        val stages = linkedSetOf<String>()
        val unitNotes = linkedSetOf<String>()
        var lastGivenCount: Int = 0
        val designs = mutableListOf<KarigarDesignRef>()
    }
}
