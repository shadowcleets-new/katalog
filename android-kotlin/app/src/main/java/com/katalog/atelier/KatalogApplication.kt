package com.katalog.atelier

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.katalog.atelier.data.local.KatalogDatabase
import com.katalog.atelier.data.remote.FirebaseAuthManager
import com.katalog.atelier.data.remote.FirestoreInventoryClient
import com.katalog.atelier.data.repository.InventoryRepository

class KatalogApplication : Application(), ImageLoaderFactory {

    lateinit var database: KatalogDatabase
        private set
    lateinit var authManager: FirebaseAuthManager
        private set
    lateinit var firestoreClient: FirestoreInventoryClient
        private set
    lateinit var inventoryRepository: InventoryRepository
        private set

    override fun onCreate() {
        super.onCreate()
        database = KatalogDatabase.getInstance(this)
        authManager = FirebaseAuthManager(this)
        firestoreClient = FirestoreInventoryClient(this)
        inventoryRepository = InventoryRepository(
            context = this,
            dao = database.katalogDao(),
            firestoreClient = firestoreClient
        )
    }

    /**
     * Configures Coil for fast offline-friendly garment catalogue media loading:
     * 25% of available heap for MemoryCache + 120 MB persistent DiskCache.
     */
    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.25)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("coil_garment_cache"))
                    .maxSizeBytes(120L * 1024L * 1024L)
                    .build()
            }
            .respectCacheHeaders(false)
            .crossfade(true)
            .build()
    }
}
