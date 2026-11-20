package com.katalog.atelier.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        InventoryItemEntity::class,
        SyncQueueEntity::class,
        RecentlyViewedEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class KatalogDatabase : RoomDatabase() {
    abstract fun katalogDao(): KatalogDao

    companion object {
        @Volatile
        private var INSTANCE: KatalogDatabase? = null

        fun getInstance(context: Context): KatalogDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    KatalogDatabase::class.java,
                    "katalog_offline_vault.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
