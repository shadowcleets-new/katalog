package com.katalog.atelier.data.seed

import com.katalog.atelier.domain.model.InventoryCategory
import com.katalog.atelier.domain.model.InventoryItem
import com.katalog.atelier.domain.model.InventoryStatus
import com.katalog.atelier.domain.model.KarigarStageEntry
import com.katalog.atelier.domain.model.PhotoAspectPreset
import com.katalog.atelier.domain.model.PhotoFilterPreset
import com.katalog.atelier.domain.model.RawMaterialSpec
import com.katalog.atelier.domain.model.SizeInventoryEntry
import com.katalog.atelier.domain.model.SyncState

object SeedInventory {
    const val ASSET_PREFIX = "file:///android_asset/images/"

    val sampleMediaPaths = listOf(
        "${ASSET_PREFIX}sk_chanderi_rose_1795113021551.jpg" to "Dusty Rose Chanderi Suit",
        "${ASSET_PREFIX}sk_indigo_block_1795113014941.jpg" to "Indigo Block-Print Mulmul",
        "${ASSET_PREFIX}sk_mustard_katha_1795113017500.jpg" to "Mustard Hand-Katha Cotton",
        "${ASSET_PREFIX}sk_sage_festive_1795113020778.jpg" to "Pistachio Sage Modal Satin",
        "${ASSET_PREFIX}sk_ivory_anarkali_1795113019929.jpg" to "Ivory Zari Handloom Anarkali",
        "${ASSET_PREFIX}sk_plum_silk_1795113019649.jpg" to "Mulberry Plum Festive Silk"
    )

    fun create(ownerId: String): List<InventoryItem> {
        val now = System.currentTimeMillis()
        val hour = 3_600_000L

        return listOf(
            InventoryItem(
                id = "sk-chanderi-rose-104",
                ownerId = ownerId,
                sku = "SK-104-CHR",
                title = "Rosewood Chanderi Silk Straight Suit",
                category = InventoryCategory.CHANDERI,
                location = "Rack A · Packing Unit 1",
                quantity = 44,
                minThreshold = 5,
                status = InventoryStatus.LOW_STOCK,
                sizes = listOf(
                    SizeInventoryEntry("M", 12, 1850),
                    SizeInventoryEntry("L", 14, 1900),
                    SizeInventoryEntry("XL", 10, 2000),
                    SizeInventoryEntry("XXL", 5, 2150),
                    SizeInventoryEntry("3XL", 3, 2300)
                ),
                lastKarigarName = "Salim Master",
                lastKarigarStage = "Cutting & Stitching",
                lastKarigarDate = "2026-11-16",
                karigars = listOf(
                    KarigarStageEntry(
                        stage = "Cutting & Stitching",
                        karigarName = "Salim Master",
                        unitOrNote = "Dadar West Unit · Princess cut with cotton lining",
                        dateGiven = "2026-11-16"
                    ),
                    KarigarStageEntry(
                        stage = "Embroidery / Zari",
                        karigarName = "Javed Zari Works",
                        unitOrNote = "Bhendi Bazaar · Antique gold neckline & sleeve patti",
                        dateGiven = "2026-11-11"
                    ),
                    KarigarStageEntry(
                        stage = "Dupatta Dyeing",
                        karigarName = "Farooq Dye House",
                        unitOrNote = "Byculla · Dusty rose tonal match to Kameez lot #42",
                        dateGiven = "2026-11-08"
                    )
                ),
                rawMaterials = RawMaterialSpec(
                    topFabric = "Pure Chanderi Silk-Cotton (80×80 count) + 100% Cotton Malmal Lining",
                    colorShade = "Dusty Rosewood Pink (Dye Lot #RW-42)",
                    bottomFabric = "Shantoon Tapered Pant (2.25m per piece)",
                    dupattaFabric = "Sheer Tissue Organza with antique zari border (2.4m)",
                    materialNotes = "Source top fabric from Mangaldass Market Lane 3 (Ramesh Textiles). Steam press on reverse side only before poly-packing."
                ),
                notes = "Include spare antique gold button pouch inside collar tag before dispatch.",
                mediaKey = "${ASSET_PREFIX}sk_chanderi_rose_1795113021551.jpg",
                photoFilter = PhotoFilterPreset.ORIGINAL,
                photoAspect = PhotoAspectPreset.STANDARD,
                createdAt = now - 72 * hour,
                updatedAt = now - 2 * hour,
                syncState = SyncState.SYNCED,
                cachedOffline = true
            ),
            InventoryItem(
                id = "sk-indigo-block-208",
                ownerId = ownerId,
                sku = "SK-208-IND",
                title = "Neelam Indigo Hand Block-Print Mulmul Set",
                category = InventoryCategory.COTTON_DAILY,
                location = "Rack B · Daily Dispatch",
                quantity = 54,
                minThreshold = 5,
                status = InventoryStatus.IN_STOCK,
                sizes = listOf(
                    SizeInventoryEntry("S", 10, 1150),
                    SizeInventoryEntry("M", 14, 1200),
                    SizeInventoryEntry("L", 12, 1250),
                    SizeInventoryEntry("XL", 11, 1350),
                    SizeInventoryEntry("XXL", 7, 1450)
                ),
                lastKarigarName = "Imran Block Works",
                lastKarigarStage = "Block Print",
                lastKarigarDate = "2026-11-15",
                karigars = listOf(
                    KarigarStageEntry(
                        stage = "Block Print",
                        karigarName = "Imran Block Works",
                        unitOrNote = "Kurla Workshop · Hand woodblock floral jaal on dupatta",
                        dateGiven = "2026-11-15"
                    ),
                    KarigarStageEntry(
                        stage = "Cutting & Stitching",
                        karigarName = "Salim Master",
                        unitOrNote = "Dadar West Unit · Straight kurta with side pocket",
                        dateGiven = "2026-11-12"
                    ),
                    KarigarStageEntry(
                        stage = "Dupatta Dyeing",
                        karigarName = "Farooq Dye House",
                        unitOrNote = "Byculla · Indigo vat base wash (color-fast fixed)",
                        dateGiven = "2026-11-09"
                    )
                ),
                rawMaterials = RawMaterialSpec(
                    topFabric = "Jaipur 60×60 Pure Cambric Cotton (pre-shrunk)",
                    colorShade = "Deep Neelam Indigo & Unbleached Ivory",
                    bottomFabric = "Ivory Cotton Straight Salwar with indigo hem patti",
                    dupattaFabric = "Hand Block-Printed Mulmul Cotton (2.35m) with cotton tassels",
                    materialNotes = "Always run 1-piece cold water bleed check per dye batch before releasing to Salim Master for cutting."
                ),
                notes = "Fast-moving Mumbai boutique reorder. Fold flat with tissue paper between indigo top and ivory salwar.",
                mediaKey = "${ASSET_PREFIX}sk_indigo_block_1795113014941.jpg",
                photoFilter = PhotoFilterPreset.ORIGINAL,
                photoAspect = PhotoAspectPreset.STANDARD,
                createdAt = now - 96 * hour,
                updatedAt = now - 5 * hour,
                syncState = SyncState.SYNCED,
                cachedOffline = true
            ),
            InventoryItem(
                id = "sk-mustard-katha-312",
                ownerId = ownerId,
                sku = "SK-312-KTH",
                title = "Haldi Mustard Hand-Katha Yoke Suit",
                category = InventoryCategory.COTTON_DAILY,
                location = "Rack B · Katha Lot 3",
                quantity = 23,
                minThreshold = 5,
                status = InventoryStatus.LOW_STOCK,
                sizes = listOf(
                    SizeInventoryEntry("M", 8, 1450),
                    SizeInventoryEntry("L", 6, 1500),
                    SizeInventoryEntry("XL", 4, 1600),
                    SizeInventoryEntry("XXL", 5, 1700),
                    SizeInventoryEntry("3XL", 0, 1850)
                ),
                lastKarigarName = "Ruksana Karigar",
                lastKarigarStage = "Katha / Handwork",
                lastKarigarDate = "2026-11-17",
                karigars = listOf(
                    KarigarStageEntry(
                        stage = "Katha / Handwork",
                        karigarName = "Ruksana Karigar",
                        unitOrNote = "Madanpura · Ivory anchor-thread running katha on yoke & cuffs",
                        dateGiven = "2026-11-17"
                    ),
                    KarigarStageEntry(
                        stage = "Cutting & Stitching",
                        karigarName = "Rafiq Tailors",
                        unitOrNote = "Mahim · Relaxed A-line kurta with loop buttons",
                        dateGiven = "2026-11-13"
                    ),
                    KarigarStageEntry(
                        stage = "Block Print",
                        karigarName = "Imran Block Works",
                        unitOrNote = "Kurla Workshop · Geometric border print on dupatta",
                        dateGiven = "2026-11-10"
                    )
                ),
                rawMaterials = RawMaterialSpec(
                    topFabric = "Slub Cotton-Linen Blend (145 GSM)",
                    colorShade = "Haldi Ochre Mustard with Ivory Katha Thread",
                    bottomFabric = "Matching Mustard Cambric Cotton Cigarette Pant",
                    dupattaFabric = "Chanderi-Cotton Blend with hand block-printed pallu",
                    materialNotes = "Anchor #001 ivory cotton thread (6-strand split to 3) supplied to Ruksana Karigar — 2 skeins per garment."
                ),
                notes = "3XL sold out on last Pune wholesale order; prioritize 10 pcs 3XL in next cutting lot.",
                mediaKey = "${ASSET_PREFIX}sk_mustard_katha_1795113017500.jpg",
                photoFilter = PhotoFilterPreset.ORIGINAL,
                photoAspect = PhotoAspectPreset.STANDARD,
                createdAt = now - 110 * hour,
                updatedAt = now - 1 * hour,
                syncState = SyncState.SYNCED,
                cachedOffline = true
            ),
            InventoryItem(
                id = "sk-sage-festive-415",
                ownerId = ownerId,
                sku = "SK-415-SAG",
                title = "Pista Sage Modal Satin Resham Suit",
                category = InventoryCategory.FESTIVE_SILK,
                location = "Rack C · Festive Section",
                quantity = 34,
                minThreshold = 5,
                status = InventoryStatus.AUDIT_PENDING,
                sizes = listOf(
                    SizeInventoryEntry("M", 9, 2250),
                    SizeInventoryEntry("L", 10, 2350),
                    SizeInventoryEntry("XL", 8, 2450),
                    SizeInventoryEntry("XXL", 7, 2600)
                ),
                lastKarigarName = "Farooq Dye House",
                lastKarigarStage = "Dupatta Dyeing",
                lastKarigarDate = "2026-11-18",
                karigars = listOf(
                    KarigarStageEntry(
                        stage = "Dupatta Dyeing",
                        karigarName = "Farooq Dye House",
                        unitOrNote = "Byculla · Two-tone pistachio-to-ivory ombre dip dye",
                        dateGiven = "2026-11-18"
                    ),
                    KarigarStageEntry(
                        stage = "Embroidery / Zari",
                        karigarName = "Javed Zari Works",
                        unitOrNote = "Bhendi Bazaar · Tonal resham floral bootis on front panel",
                        dateGiven = "2026-11-14"
                    ),
                    KarigarStageEntry(
                        stage = "Cutting & Stitching",
                        karigarName = "Salim Master",
                        unitOrNote = "Dadar West Unit · Side slit finish with concealed piping",
                        dateGiven = "2026-11-12"
                    )
                ),
                rawMaterials = RawMaterialSpec(
                    topFabric = "Heavy Modal Satin (60g sheen) with full cotton voile lining",
                    colorShade = "Pistachio Sage Green (Pantone-matched Lot #PG-19)",
                    bottomFabric = "Modal Satin Comfort Salwar with elasticated back waistband",
                    dupattaFabric = "Pure Crinkle Chiffon ombre-dyed with silver micro-edging",
                    materialNotes = "Delicate fabric — check for needle snags during steam ironing table QC before final packing."
                ),
                notes = "12 dupattas returning from Farooq Dye House tomorrow morning for pairing and steam press.",
                mediaKey = "${ASSET_PREFIX}sk_sage_festive_1795113020778.jpg",
                photoFilter = PhotoFilterPreset.ORIGINAL,
                photoAspect = PhotoAspectPreset.STANDARD,
                createdAt = now - 54 * hour,
                updatedAt = now - 4 * hour,
                syncState = SyncState.SYNCED,
                cachedOffline = true
            ),
            InventoryItem(
                id = "sk-ivory-anarkali-501",
                ownerId = ownerId,
                sku = "SK-501-ANK",
                title = "Kora Ivory Handloom Kali Anarkali Set",
                category = InventoryCategory.ANARKALI,
                location = "Rack D · Bridal & Festive",
                quantity = 19,
                minThreshold = 5,
                status = InventoryStatus.LOW_STOCK,
                sizes = listOf(
                    SizeInventoryEntry("S", 3, 2750),
                    SizeInventoryEntry("M", 6, 2850),
                    SizeInventoryEntry("L", 5, 2950),
                    SizeInventoryEntry("XL", 3, 3100),
                    SizeInventoryEntry("XXL", 2, 3250)
                ),
                lastKarigarName = "Rafiq Tailors",
                lastKarigarStage = "Cutting & Stitching",
                lastKarigarDate = "2026-11-14",
                karigars = listOf(
                    KarigarStageEntry(
                        stage = "Cutting & Stitching",
                        karigarName = "Rafiq Tailors",
                        unitOrNote = "Mahim · 12-panel kali flare with cotton mul lining",
                        dateGiven = "2026-11-14"
                    ),
                    KarigarStageEntry(
                        stage = "Dupatta Dyeing",
                        karigarName = "Farooq Dye House",
                        unitOrNote = "Byculla · Muted terracotta contrast dupatta dye",
                        dateGiven = "2026-11-10"
                    )
                ),
                rawMaterials = RawMaterialSpec(
                    topFabric = "Bhagalpuri Handloom Cotton-Silk (4.2m consumption per Anarkali)",
                    colorShade = "Natural Kora Ivory with Muted Terracotta Dupatta",
                    bottomFabric = "Ivory Cotton Churidar (2.5m)",
                    dupattaFabric = "Chanderi Silk with antique bronze zari woven border",
                    materialNotes = "Requires 4.2m top fabric + 3.5m lining per kali piece; confirm bolt yardage at Kalbadevi supplier before cutting."
                ),
                notes = "Pack in rigid white kraft garment boxes for showroom buyers.",
                mediaKey = "${ASSET_PREFIX}sk_ivory_anarkali_1795113019929.jpg",
                photoFilter = PhotoFilterPreset.ORIGINAL,
                photoAspect = PhotoAspectPreset.STANDARD,
                createdAt = now - 140 * hour,
                updatedAt = now - 9 * hour,
                syncState = SyncState.SYNCED,
                cachedOffline = true
            ),
            InventoryItem(
                id = "sk-plum-silk-609",
                ownerId = ownerId,
                sku = "SK-609-PLM",
                title = "Jamun Mulberry Silk Gota-Patti Suit",
                category = InventoryCategory.FESTIVE_SILK,
                location = "Rack C · Festive Section",
                quantity = 0,
                minThreshold = 5,
                status = InventoryStatus.OUT_OF_STOCK,
                sizes = listOf(
                    SizeInventoryEntry("M", 0, 2400),
                    SizeInventoryEntry("L", 0, 2500),
                    SizeInventoryEntry("XL", 0, 2650),
                    SizeInventoryEntry("XXL", 0, 2800)
                ),
                lastKarigarName = "Ruksana Karigar",
                lastKarigarStage = "Katha / Handwork",
                lastKarigarDate = "2026-11-18",
                karigars = listOf(
                    KarigarStageEntry(
                        stage = "Katha / Handwork",
                        karigarName = "Ruksana Karigar",
                        unitOrNote = "Madanpura · Fine antique gold gota patti & hand tacking (25 pcs in progress)",
                        dateGiven = "2026-11-18"
                    ),
                    KarigarStageEntry(
                        stage = "Cutting & Stitching",
                        karigarName = "Salim Master",
                        unitOrNote = "Dadar West Unit · Batch cut & stitched (25 pcs)",
                        dateGiven = "2026-11-15"
                    )
                ),
                rawMaterials = RawMaterialSpec(
                    topFabric = "Dola Silk Blend with soft crepe lining",
                    colorShade = "Deep Jamun Mulberry Plum",
                    bottomFabric = "Plum Shantoon Straight Pant with gold gota ankle trim",
                    dupattaFabric = "Woven Chanderi Silk in tonal plum with scalloped gota lace",
                    materialNotes = "Use dull matte antique gold gota (6mm width from Bhuleshwar Lace House) — never bright yellow gota."
                ),
                notes = "Current ready stock depleted; 25 fresh pieces due back from Ruksana Karigar on Friday for ironing & packing.",
                mediaKey = "${ASSET_PREFIX}sk_plum_silk_1795113019649.jpg",
                photoFilter = PhotoFilterPreset.ORIGINAL,
                photoAspect = PhotoAspectPreset.STANDARD,
                createdAt = now - 168 * hour,
                updatedAt = now - 14 * hour,
                syncState = SyncState.SYNCED,
                cachedOffline = true
            )
        )
    }
}
