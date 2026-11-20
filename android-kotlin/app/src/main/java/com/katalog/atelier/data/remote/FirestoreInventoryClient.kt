package com.katalog.atelier.data.remote

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.katalog.atelier.BuildConfig
import com.katalog.atelier.domain.model.InventoryCategory
import com.katalog.atelier.domain.model.InventoryItem
import com.katalog.atelier.domain.model.InventoryStatus
import com.katalog.atelier.domain.model.KarigarStageEntry
import com.katalog.atelier.domain.model.PhotoAspectPreset
import com.katalog.atelier.domain.model.PhotoFilterPreset
import com.katalog.atelier.domain.model.RawMaterialSpec
import com.katalog.atelier.domain.model.SizeInventoryEntry
import com.katalog.atelier.domain.model.SyncState
import kotlinx.coroutines.tasks.await

/**
 * Firestore client strictly conforming to `/firestore.rules` schema validation
 * for `/users/{userId}` and `/users/{userId}/inventory/{itemId}`.
 */
class FirestoreInventoryClient(private val appContext: Context) {

    private val db: FirebaseFirestore?
        get() = if (FirebaseApp.getApps(appContext).isNotEmpty()) {
            FirebaseFirestore.getInstance(
                FirebaseApp.getInstance(),
                BuildConfig.FIRESTORE_DATABASE_ID
            )
        } else {
            null
        }

    val isAvailable: Boolean
        get() = db != null

    suspend fun ensureUserProfile(session: AuthUserSession) {
        val firestore = db ?: return
        if (!session.emailVerified || session.isOfflineLocalMode) return

        val docRef = firestore.collection("users").document(session.uid)
        val snap = docRef.get().await()
        if (!snap.exists()) {
            docRef.set(
                mapOf(
                    "uid" to session.uid,
                    "displayName" to session.displayName.take(80).ifBlank { "Atelier Staff" },
                    "email" to session.email.take(254),
                    "role" to "staff",
                    "department" to "Mumbai Atelier",
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
        }
    }

    suspend fun fetchUserInventory(ownerId: String): List<InventoryItem> {
        val firestore = db ?: return emptyList()
        val snap = firestore
            .collection("users")
            .document(ownerId)
            .collection("inventory")
            .whereEqualTo("ownerId", ownerId)
            .get()
            .await()

        return snap.documents.mapNotNull { it.toInventoryItem() }
    }

    suspend fun createItem(item: InventoryItem) {
        val firestore = db ?: return
        val docRef = firestore
            .collection("users")
            .document(item.ownerId)
            .collection("inventory")
            .document(item.id)

        val payload = item.toFirestoreMap(isCreate = true)
        docRef.set(payload).await()
    }

    suspend fun updateItem(item: InventoryItem) {
        val firestore = db ?: return
        val docRef = firestore
            .collection("users")
            .document(item.ownerId)
            .collection("inventory")
            .document(item.id)

        val payload = item.toFirestoreMap(isCreate = false)
        docRef.update(payload).await()
    }

    suspend fun deleteItem(ownerId: String, itemId: String) {
        val firestore = db ?: return
        firestore
            .collection("users")
            .document(ownerId)
            .collection("inventory")
            .document(itemId)
            .delete()
            .await()
    }

    private fun InventoryItem.toFirestoreMap(isCreate: Boolean): Map<String, Any> {
        val base = linkedMapOf<String, Any>(
            "sku" to sku,
            "title" to title,
            "category" to category.wireValue,
            "location" to location,
            "quantity" to quantity,
            "minThreshold" to minThreshold,
            "status" to status.wireValue,
            "sizes" to sizes.map {
                mapOf("size" to it.size, "stock" to it.stock, "price" to it.price)
            },
            "lastKarigarName" to lastKarigarName,
            "lastKarigarStage" to lastKarigarStage,
            "lastKarigarDate" to lastKarigarDate,
            "karigars" to karigars.map {
                mapOf(
                    "stage" to it.stage,
                    "karigarName" to it.karigarName,
                    "unitOrNote" to it.unitOrNote,
                    "dateGiven" to it.dateGiven
                )
            },
            "rawMaterials" to mapOf(
                "topFabric" to rawMaterials.topFabric,
                "colorShade" to rawMaterials.colorShade,
                "bottomFabric" to rawMaterials.bottomFabric,
                "dupattaFabric" to rawMaterials.dupattaFabric,
                "materialNotes" to rawMaterials.materialNotes
            ),
            "notes" to notes,
            "mediaKey" to mediaKey.take(200),
            "photoFilter" to photoFilter.wireValue,
            "photoAspect" to photoAspect.wireValue,
            "updatedAt" to FieldValue.serverTimestamp()
        )
        if (isCreate) {
            base["id"] = id
            base["ownerId"] = ownerId
            base["createdAt"] = FieldValue.serverTimestamp()
        }
        return base
    }

    @Suppress("UNCHECKED_CAST")
    private fun DocumentSnapshot.toInventoryItem(): InventoryItem? {
        val id = getString("id") ?: id
        val ownerId = getString("ownerId") ?: return null
        val sku = getString("sku") ?: return null
        val title = getString("title") ?: return null

        val sizesRaw = get("sizes") as? List<Map<String, Any?>> ?: emptyList()
        val sizes = sizesRaw.mapNotNull { entry ->
            val label = entry["size"] as? String ?: return@mapNotNull null
            val stock = (entry["stock"] as? Number)?.toInt() ?: 0
            val price = (entry["price"] as? Number)?.toInt() ?: 0
            SizeInventoryEntry(label, stock, price)
        }

        val karigarsRaw = get("karigars") as? List<Map<String, Any?>> ?: emptyList()
        val karigars = karigarsRaw.mapNotNull { entry ->
            val stage = entry["stage"] as? String ?: return@mapNotNull null
            val name = entry["karigarName"] as? String ?: return@mapNotNull null
            KarigarStageEntry(
                stage = stage,
                karigarName = name,
                unitOrNote = entry["unitOrNote"] as? String ?: "",
                dateGiven = entry["dateGiven"] as? String ?: ""
            )
        }

        val rmMap = get("rawMaterials") as? Map<String, Any?> ?: emptyMap()
        val rawMaterials = RawMaterialSpec(
            topFabric = rmMap["topFabric"] as? String ?: "",
            colorShade = rmMap["colorShade"] as? String ?: "",
            bottomFabric = rmMap["bottomFabric"] as? String ?: "",
            dupattaFabric = rmMap["dupattaFabric"] as? String ?: "",
            materialNotes = rmMap["materialNotes"] as? String ?: ""
        )

        val createdMs = (get("createdAt") as? Timestamp)?.toDate()?.time ?: System.currentTimeMillis()
        val updatedMs = (get("updatedAt") as? Timestamp)?.toDate()?.time ?: createdMs

        return InventoryItem(
            id = id,
            ownerId = ownerId,
            sku = sku,
            title = title,
            category = InventoryCategory.fromWire(getString("category") ?: ""),
            location = getString("location") ?: "",
            quantity = (getLong("quantity") ?: 0L).toInt(),
            minThreshold = (getLong("minThreshold") ?: 5L).toInt(),
            status = InventoryStatus.fromWire(getString("status") ?: ""),
            sizes = sizes,
            lastKarigarName = getString("lastKarigarName") ?: "",
            lastKarigarStage = getString("lastKarigarStage") ?: "",
            lastKarigarDate = getString("lastKarigarDate") ?: "",
            karigars = karigars,
            rawMaterials = rawMaterials,
            notes = getString("notes") ?: "",
            mediaKey = getString("mediaKey") ?: "",
            photoFilter = PhotoFilterPreset.fromWire(getString("photoFilter") ?: "original"),
            photoAspect = PhotoAspectPreset.fromWire(getString("photoAspect") ?: "4:3"),
            createdAt = createdMs,
            updatedAt = updatedMs,
            syncState = SyncState.SYNCED,
            cachedOffline = true
        )
    }
}
