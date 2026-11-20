package com.katalog.atelier.data.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.katalog.atelier.KatalogApplication

/**
 * WorkManager background sync worker that automatically flushes queued offline changes
 * once device network connectivity is restored.
 */
class CatalogueSyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as? KatalogApplication ?: return Result.failure()
        val synced = app.inventoryRepository.flushPendingSyncQueue()
        return if (synced) Result.success() else Result.retry()
    }

    companion object {
        private const val UNIQUE_WORK_NAME = "katalog_offline_sync"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<CatalogueSyncWorker>()
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                request
            )
        }
    }
}
