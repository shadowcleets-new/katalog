package com.katalog.atelier

import com.katalog.atelier.data.seed.SeedInventory
import com.katalog.atelier.domain.logic.InventoryLogic
import com.katalog.atelier.domain.logic.SyncQueueRecord
import com.katalog.atelier.domain.model.InventoryStatus
import com.katalog.atelier.domain.model.SizeInventoryEntry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class InventoryLogicTest {

    @Test
    fun sortSizesLogicallyOrdersStandardThenCustom() {
        val unsorted = listOf(
            SizeInventoryEntry("XXL", 3, 2100),
            SizeInventoryEntry("M", 10, 1800),
            SizeInventoryEntry("4XL", 1, 2400),
            SizeInventoryEntry("L", 8, 1900)
        )
        val sorted = InventoryLogic.sortSizesLogically(unsorted)
        assertEquals(listOf("M", "L", "XXL", "4XL"), sorted.map { it.size })
    }

    @Test
    fun formatInrUsesIndianNumbering() {
        assertEquals("₹1,850", InventoryLogic.formatInr(1850))
        assertEquals("₹1,25,000", InventoryLogic.formatInr(125000))
    }

    @Test
    fun deriveDesignStatusRespectsAuditAndThresholds() {
        val healthy = listOf(SizeInventoryEntry("M", 10, 1500), SizeInventoryEntry("L", 8, 1600))
        assertEquals(InventoryStatus.IN_STOCK, InventoryLogic.deriveDesignStatus(healthy, 5))

        val low = listOf(SizeInventoryEntry("M", 10, 1500), SizeInventoryEntry("L", 3, 1600))
        assertEquals(InventoryStatus.LOW_STOCK, InventoryLogic.deriveDesignStatus(low, 5))

        val empty = listOf(SizeInventoryEntry("M", 0, 1500), SizeInventoryEntry("L", 0, 1600))
        assertEquals(InventoryStatus.OUT_OF_STOCK, InventoryLogic.deriveDesignStatus(empty, 5))

        assertEquals(
            InventoryStatus.AUDIT_PENDING,
            InventoryLogic.deriveDesignStatus(healthy, 5, InventoryStatus.AUDIT_PENDING)
        )
    }

    @Test
    fun batchSelectionHelpersToggleSelectAllAndPrune() {
        val seed = SeedInventory.create("owner-1")
        val ids = seed.map { it.id }

        val toggled = InventoryLogic.toggleSelectionId(emptySet(), ids[0])
        assertEquals(setOf(ids[0]), toggled)

        val allSelected = InventoryLogic.toggleSelectAllVisible(toggled, ids.take(3))
        assertEquals(ids.take(3).toSet(), allSelected)

        val deselected = InventoryLogic.toggleSelectAllVisible(allSelected, ids.take(3))
        assertTrue(deselected.isEmpty())

        val pruned = InventoryLogic.pruneSelectionIds(setOf(ids[0], "deleted-id"), seed)
        assertEquals(setOf(ids[0]), pruned)
    }

    @Test
    fun coalesceSyncQueueMergesCreateUpdateAndDelete() {
        val created = SyncQueueRecord("q1", "item-1", "create", 100L, "Suit A", "SK-1")
        val updated = SyncQueueRecord("q2", "item-1", "update", 200L, "Suit A v2", "SK-1")
        val deleted = SyncQueueRecord("q3", "item-1", "delete", 300L, "Suit A v2", "SK-1")

        val afterUpdate = InventoryLogic.coalesceSyncQueue(listOf(created), updated)
        assertEquals(1, afterUpdate.size)
        assertEquals("create", afterUpdate.first().operation)
        assertEquals("Suit A v2", afterUpdate.first().itemTitle)

        val afterDelete = InventoryLogic.coalesceSyncQueue(afterUpdate, deleted)
        assertTrue(afterDelete.isEmpty())
    }
}
