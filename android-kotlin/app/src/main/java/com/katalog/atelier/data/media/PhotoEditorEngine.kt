package com.katalog.atelier.data.media

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.katalog.atelier.domain.model.PhotoEditParams
import com.katalog.atelier.domain.model.PhotoFilterPreset
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Native AndroidX image manipulation engine using ExifInterface, Matrix, Canvas, and ColorMatrix.
 * Decodes source media with EXIF orientation normalized, applies crop/rotate/straighten/flip/filters,
 * and exports a clean, EXIF-stripped JPEG into private app storage.
 */
object PhotoEditorEngine {

    private const val MAX_DECODE_DIMENSION = 1600
    private const val EXPORT_MAX_WIDTH = 1280

    suspend fun loadOrientedBitmap(context: Context, uri: Uri): Bitmap? = withContext(Dispatchers.IO) {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, bounds)
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return@withContext null

        var sampleSize = 1
        while (bounds.outWidth / sampleSize > MAX_DECODE_DIMENSION ||
            bounds.outHeight / sampleSize > MAX_DECODE_DIMENSION
        ) {
            sampleSize *= 2
        }

        val decoded = context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(
                it,
                null,
                BitmapFactory.Options().apply { inSampleSize = sampleSize }
            )
        } ?: return@withContext null

        val orientation = context.contentResolver.openInputStream(uri)?.use {
            ExifInterface(it).getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL
            )
        } ?: ExifInterface.ORIENTATION_NORMAL

        val matrix = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
            else -> return@withContext decoded
        }

        Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
    }

    fun buildColorMatrix(params: PhotoEditParams): ColorMatrix {
        val result = ColorMatrix()

        // Preset tonal matrix
        when (params.filter) {
            PhotoFilterPreset.ORIGINAL -> Unit
            PhotoFilterPreset.CRISP -> {
                result.postConcat(contrastMatrix(1.14f))
                val sat = ColorMatrix().apply { setSaturation(1.12f) }
                result.postConcat(sat)
            }
            PhotoFilterPreset.WARM -> {
                result.postConcat(
                    ColorMatrix(
                        floatArrayOf(
                            1.10f, 0f, 0f, 0f, 8f,
                            0f, 1.03f, 0f, 0f, 4f,
                            0f, 0f, 0.90f, 0f, -4f,
                            0f, 0f, 0f, 1f, 0f
                        )
                    )
                )
            }
            PhotoFilterPreset.COOL -> {
                result.postConcat(
                    ColorMatrix(
                        floatArrayOf(
                            0.92f, 0f, 0f, 0f, -4f,
                            0f, 1.01f, 0f, 0f, 2f,
                            0f, 0f, 1.12f, 0f, 8f,
                            0f, 0f, 0f, 1f, 0f
                        )
                    )
                )
            }
            PhotoFilterPreset.MONO -> {
                result.postConcat(ColorMatrix().apply { setSaturation(0f) })
                result.postConcat(contrastMatrix(1.08f))
            }
            PhotoFilterPreset.CONTRAST -> {
                result.postConcat(contrastMatrix(1.26f))
                result.postConcat(ColorMatrix().apply { setSaturation(1.08f) })
            }
        }

        // Manual fine adjustments
        if (params.brightness != 1f) {
            val b = (params.brightness - 1f) * 120f
            result.postConcat(
                ColorMatrix(
                    floatArrayOf(
                        1f, 0f, 0f, 0f, b,
                        0f, 1f, 0f, 0f, b,
                        0f, 0f, 1f, 0f, b,
                        0f, 0f, 0f, 1f, 0f
                    )
                )
            )
        }
        if (params.contrast != 1f) {
            result.postConcat(contrastMatrix(params.contrast))
        }
        if (params.saturation != 1f) {
            result.postConcat(ColorMatrix().apply { setSaturation(params.saturation) })
        }

        return result
    }

    private fun contrastMatrix(contrast: Float): ColorMatrix {
        val translate = (-0.5f * contrast + 0.5f) * 255f
        return ColorMatrix(
            floatArrayOf(
                contrast, 0f, 0f, 0f, translate,
                0f, contrast, 0f, 0f, translate,
                0f, 0f, contrast, 0f, translate,
                0f, 0f, 0f, 1f, 0f
            )
        )
    }

    fun renderEditedBitmap(source: Bitmap, params: PhotoEditParams, maxOutWidth: Int = EXPORT_MAX_WIDTH): Bitmap {
        val totalRotation = params.rotationDegrees.toFloat() + params.straightenDegrees
        val targetAspect = params.aspect.ratio ?: (source.width.toFloat() / source.height.toFloat())

        val outWidth = min(maxOutWidth, source.width.coerceAtLeast(600))
        val outHeight = (outWidth / targetAspect).roundToInt().coerceAtLeast(360)

        val output = Bitmap.createBitmap(outWidth, outHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
            colorFilter = ColorMatrixColorFilter(buildColorMatrix(params))
        }

        val scaleToFill = maxOf(
            outWidth.toFloat() / source.width.toFloat(),
            outHeight.toFloat() / source.height.toFloat()
        ) * params.zoom.coerceIn(1f, 2.5f)

        val matrix = Matrix().apply {
            postTranslate(-source.width / 2f, -source.height / 2f)
            postScale(if (params.flipHorizontal) -scaleToFill else scaleToFill, scaleToFill)
            postRotate(totalRotation)
            postTranslate(outWidth / 2f, outHeight / 2f)
        }

        canvas.drawBitmap(source, matrix, paint)
        return output
    }

    /**
     * Exports edited bitmap into private internal storage (`files/garment_photos/`) with EXIF stripped.
     * Returns the absolute file URI (`file://...`) suitable for Coil and offline persistence.
     */
    suspend fun saveEditedPhoto(
        context: Context,
        source: Bitmap,
        params: PhotoEditParams
    ): String = withContext(Dispatchers.IO) {
        val rendered = renderEditedBitmap(source, params)
        val dir = File(context.filesDir, "garment_photos").apply { mkdirs() }
        val file = File(dir, "garment_${UUID.randomUUID()}.jpg")
        FileOutputStream(file).use { out ->
            rendered.compress(Bitmap.CompressFormat.JPEG, 88, out)
        }
        if (rendered != source) rendered.recycle()
        file.toURI().toString()
    }
}
