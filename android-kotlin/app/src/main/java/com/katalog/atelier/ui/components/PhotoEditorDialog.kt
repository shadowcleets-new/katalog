package com.katalog.atelier.ui.components

import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Flip
import androidx.compose.material.icons.rounded.PhotoLibrary
import androidx.compose.material.icons.rounded.Rotate90DegreesCw
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.katalog.atelier.data.media.PhotoEditorEngine
import com.katalog.atelier.domain.model.PhotoAspectPreset
import com.katalog.atelier.domain.model.PhotoEditParams
import com.katalog.atelier.domain.model.PhotoFilterPreset
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PhotoEditorDialog(
    initialUri: Uri?,
    initialFilter: PhotoFilterPreset,
    initialAspect: PhotoAspectPreset,
    onDismiss: () -> Unit,
    onExportComplete: (savedUri: String, filter: PhotoFilterPreset, aspect: PhotoAspectPreset) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var selectedUri by remember { mutableStateOf(initialUri) }
    var sourceBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var previewBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var saving by remember { mutableStateOf(false) }

    var params by remember {
        mutableStateOf(
            PhotoEditParams(
                aspect = initialAspect,
                filter = initialFilter
            )
        )
    }

    val photoPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            selectedUri = uri
        }
    }

    LaunchedEffect(selectedUri) {
        val uri = selectedUri ?: return@LaunchedEffect
        sourceBitmap = PhotoEditorEngine.loadOrientedBitmap(context, uri)
    }

    LaunchedEffect(sourceBitmap, params) {
        val bmp = sourceBitmap ?: return@LaunchedEffect
        previewBitmap = withContext(Dispatchers.Default) {
            PhotoEditorEngine.renderEditedBitmap(bmp, params, maxOutWidth = 720)
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Photo Studio") },
                    navigationIcon = {
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Rounded.Close, contentDescription = "Close editor")
                        }
                    },
                    actions = {
                        Button(
                            enabled = sourceBitmap != null && !saving,
                            onClick = {
                                val bmp = sourceBitmap ?: return@Button
                                scope.launch {
                                    saving = true
                                    val savedPath = PhotoEditorEngine.saveEditedPhoto(context, bmp, params)
                                    saving = false
                                    onExportComplete(savedPath, params.filter, params.aspect)
                                }
                            },
                            modifier = Modifier.padding(end = 12.dp)
                        ) {
                            Icon(Icons.Rounded.Check, contentDescription = null)
                            Spacer(Modifier.padding(horizontal = 4.dp))
                            Text(if (saving) "Saving…" else "Apply")
                        }
                    }
                )
            }
        ) { innerPadding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(params.aspect.ratio ?: (4f / 3f))
                        .clip(RoundedCornerShape(24.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center
                ) {
                    when {
                        previewBitmap != null -> {
                            Image(
                                bitmap = previewBitmap!!.asImageBitmap(),
                                contentDescription = "Edited garment photo preview",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                        selectedUri != null -> CircularProgressIndicator()
                        else -> {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    "Pick a garment photo to crop, rotate & filter",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                OutlinedButton(
                                    onClick = {
                                        photoPicker.launch(
                                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                        )
                                    }
                                ) {
                                    Icon(Icons.Rounded.PhotoLibrary, contentDescription = null)
                                    Spacer(Modifier.padding(horizontal = 4.dp))
                                    Text("Choose Photo")
                                }
                            }
                        }
                    }
                }

                // Quick Actions Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            photoPicker.launch(
                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                            )
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Rounded.PhotoLibrary, contentDescription = null)
                        Spacer(Modifier.padding(horizontal = 3.dp))
                        Text("Pick Photo")
                    }
                    OutlinedButton(
                        onClick = {
                            params = params.copy(rotationDegrees = (params.rotationDegrees + 90) % 360)
                        }
                    ) {
                        Icon(Icons.Rounded.Rotate90DegreesCw, contentDescription = "Rotate 90 degrees")
                    }
                    OutlinedButton(
                        onClick = {
                            params = params.copy(flipHorizontal = !params.flipHorizontal)
                        }
                    ) {
                        Icon(Icons.Rounded.Flip, contentDescription = "Flip horizontal")
                    }
                }

                // Aspect Crop Presets
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Crop Aspect", style = MaterialTheme.typography.titleSmall)
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        PhotoAspectPreset.entries.forEach { preset ->
                            FilterChip(
                                selected = params.aspect == preset,
                                onClick = { params = params.copy(aspect = preset) },
                                label = { Text(preset.label) }
                            )
                        }
                    }
                }

                // Filter Presets
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Color Filter", style = MaterialTheme.typography.titleSmall)
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        PhotoFilterPreset.entries.forEach { preset ->
                            FilterChip(
                                selected = params.filter == preset,
                                onClick = { params = params.copy(filter = preset) },
                                label = { Text(preset.label) }
                            )
                        }
                    }
                }

                // Fine Sliders
                LabeledSlider(
                    label = "Straighten (${params.straightenDegrees.toInt()}°)",
                    value = params.straightenDegrees,
                    range = -30f..30f,
                    onValueChange = { params = params.copy(straightenDegrees = it) }
                )
                LabeledSlider(
                    label = "Zoom (${"%.1f".format(params.zoom)}x)",
                    value = params.zoom,
                    range = 1f..2.5f,
                    onValueChange = { params = params.copy(zoom = it) }
                )
                LabeledSlider(
                    label = "Brightness (${(params.brightness * 100).toInt()}%)",
                    value = params.brightness,
                    range = 0.6f..1.4f,
                    onValueChange = { params = params.copy(brightness = it) }
                )
                LabeledSlider(
                    label = "Contrast (${(params.contrast * 100).toInt()}%)",
                    value = params.contrast,
                    range = 0.6f..1.5f,
                    onValueChange = { params = params.copy(contrast = it) }
                )
                LabeledSlider(
                    label = "Saturation (${(params.saturation * 100).toInt()}%)",
                    value = params.saturation,
                    range = 0f..1.8f,
                    onValueChange = { params = params.copy(saturation = it) }
                )

                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun LabeledSlider(
    label: String,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    onValueChange: (Float) -> Unit
) {
    Column {
        Text(label, style = MaterialTheme.typography.labelLarge)
        Slider(value = value, onValueChange = onValueChange, valueRange = range)
    }
}
