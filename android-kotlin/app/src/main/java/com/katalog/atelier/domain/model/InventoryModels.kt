package com.katalog.atelier.domain.model

import kotlinx.serialization.Serializable

enum class InventoryCategory(val wireValue: String) {
    COTTON_DAILY("Cotton Daily"),
    FESTIVE_SILK("Festive Silk"),
    CHANDERI("Chanderi"),
    ANARKALI("Anarkali"),
    COORD_SETS("Co-ord Sets");

    companion object {
        fun fromWire(value: String): InventoryCategory =
            entries.firstOrNull { it.wireValue == value } ?: COTTON_DAILY
    }
}

enum class InventoryStatus(val wireValue: String, val displayLabel: String) {
    IN_STOCK("in_stock", "Ready Stock"),
    LOW_STOCK("low_stock", "Low Sizes"),
    OUT_OF_STOCK("out_of_stock", "Out of Stock"),
    AUDIT_PENDING("audit_pending", "In Finishing / QC");

    companion object {
        fun fromWire(value: String): InventoryStatus =
            entries.firstOrNull { it.wireValue == value } ?: IN_STOCK
    }
}

enum class PhotoFilterPreset(val wireValue: String, val label: String) {
    ORIGINAL("original", "Original"),
    CRISP("crisp", "Crisp"),
    WARM("warm", "Warm"),
    COOL("cool", "Cool"),
    MONO("mono", "Mono"),
    CONTRAST("contrast", "Contrast");

    companion object {
        fun fromWire(value: String): PhotoFilterPreset =
            entries.firstOrNull { it.wireValue == value } ?: ORIGINAL
    }
}

enum class PhotoAspectPreset(val wireValue: String, val label: String, val ratio: Float?) {
    FREE("free", "Free", null),
    SQUARE("1:1", "1:1", 1f),
    STANDARD("4:3", "4:3", 4f / 3f),
    PORTRAIT("3:4", "3:4", 3f / 4f),
    WIDE("16:9", "16:9", 16f / 9f);

    companion object {
        fun fromWire(value: String): PhotoAspectPreset =
            entries.firstOrNull { it.wireValue == value } ?: STANDARD
    }
}

enum class SyncState(val wireValue: String) {
    SYNCED("synced"),
    PENDING_CREATE("pending_create"),
    PENDING_UPDATE("pending_update"),
    PENDING_DELETE("pending_delete");

    companion object {
        fun fromWire(value: String): SyncState =
            entries.firstOrNull { it.wireValue == value } ?: SYNCED
    }
}

enum class MaterialColorSeed(val label: String) {
    OCHRE("Atelier Bronze"),
    INDIGO("Indigo Dye"),
    SAGE("Pista Sage"),
    SLATE("Monsoon Slate")
}

@Serializable
data class SizeInventoryEntry(
    val size: String,
    val stock: Int,
    val price: Int
)

@Serializable
data class KarigarStageEntry(
    val stage: String,
    val karigarName: String,
    val unitOrNote: String = "",
    val dateGiven: String = ""
)

@Serializable
data class RawMaterialSpec(
    val topFabric: String = "",
    val colorShade: String = "",
    val bottomFabric: String = "",
    val dupattaFabric: String = "",
    val materialNotes: String = ""
)

data class InventoryItem(
    val id: String,
    val ownerId: String,
    val sku: String,
    val title: String,
    val category: InventoryCategory,
    val location: String,
    val quantity: Int,
    val minThreshold: Int,
    val status: InventoryStatus,
    val sizes: List<SizeInventoryEntry>,
    val lastKarigarName: String,
    val lastKarigarStage: String,
    val lastKarigarDate: String,
    val karigars: List<KarigarStageEntry>,
    val rawMaterials: RawMaterialSpec,
    val notes: String,
    val mediaKey: String,
    val photoFilter: PhotoFilterPreset = PhotoFilterPreset.ORIGINAL,
    val photoAspect: PhotoAspectPreset = PhotoAspectPreset.STANDARD,
    val createdAt: Long,
    val updatedAt: Long,
    val syncState: SyncState = SyncState.SYNCED,
    val cachedOffline: Boolean = true
)

data class PhotoEditParams(
    val aspect: PhotoAspectPreset = PhotoAspectPreset.STANDARD,
    val rotationDegrees: Int = 0, // 0, 90, 180, 270
    val straightenDegrees: Float = 0f, // -45f..45f
    val flipHorizontal: Boolean = false,
    val zoom: Float = 1f, // 1f..2.5f
    val filter: PhotoFilterPreset = PhotoFilterPreset.ORIGINAL,
    val brightness: Float = 1f, // 0.5f..1.5f
    val contrast: Float = 1f, // 0.5f..1.5f
    val saturation: Float = 1f // 0f..1.8f
)

data class InventoryFormValues(
    val sku: String = "",
    val title: String = "",
    val category: InventoryCategory = InventoryCategory.COTTON_DAILY,
    val location: String = "Rack A · Packing Unit 1",
    val minThreshold: Int = 5,
    val status: InventoryStatus = InventoryStatus.IN_STOCK,
    val sizes: List<SizeInventoryEntry> = listOf(
        SizeInventoryEntry("M", 0, 1500),
        SizeInventoryEntry("L", 0, 1600),
        SizeInventoryEntry("XL", 0, 1700),
        SizeInventoryEntry("XXL", 0, 1850)
    ),
    val lastKarigarName: String = "",
    val lastKarigarStage: String = "Cutting & Stitching",
    val lastKarigarDate: String = "",
    val karigars: List<KarigarStageEntry> = emptyList(),
    val rawMaterials: RawMaterialSpec = RawMaterialSpec(),
    val notes: String = ""
)

object SchemaLimits {
    const val ID_MAX = 64
    val ID_REGEX = Regex("^[a-zA-Z0-9_\\-]+$")
    const val SKU_MIN = 2
    const val SKU_MAX = 32
    val SKU_REGEX = Regex("^[A-Z0-9\\-]+$")
    const val TITLE_MIN = 2
    const val TITLE_MAX = 120
    const val LOCATION_MIN = 1
    const val LOCATION_MAX = 60
    const val NOTES_MAX = 600
    const val MEDIA_KEY_MAX = 200
    const val QTY_MAX = 1_000_000
    const val THRESHOLD_MAX = 100_000
    const val SIZES_MIN = 1
    const val SIZES_MAX = 12
    const val SIZE_LABEL_MAX = 16
    const val SIZE_STOCK_MAX = 100_000
    const val SIZE_PRICE_MAX = 1_000_000
    const val KARIGARS_MAX = 10
    const val KARIGAR_NAME_MAX = 80
    const val KARIGAR_STAGE_MAX = 60
    const val KARIGAR_NOTE_MAX = 120
    const val KARIGAR_DATE_MAX = 20
    const val FABRIC_MAX = 120
    const val COLOR_MAX = 100
    const val MATERIAL_NOTES_MAX = 600

    val STANDARD_SIZES = listOf("XS", "S", "M", "L", "XL", "XXL", "3XL")
    val KARIGAR_STAGES = listOf(
        "Cutting & Stitching",
        "Katha / Handwork",
        "Dupatta Dyeing",
        "Block Print",
        "Embroidery / Zari",
        "Finishing & Ironing"
    )
}
