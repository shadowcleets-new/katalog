package com.katalog.atelier.ui.screens

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.PhotoCamera
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.katalog.atelier.data.seed.SeedInventory
import com.katalog.atelier.domain.logic.InventoryLogic
import com.katalog.atelier.domain.logic.ValidationErrors
import com.katalog.atelier.domain.model.InventoryCategory
import com.katalog.atelier.domain.model.InventoryFormValues
import com.katalog.atelier.domain.model.InventoryItem
import com.katalog.atelier.domain.model.InventoryStatus
import com.katalog.atelier.domain.model.KarigarStageEntry
import com.katalog.atelier.domain.model.PhotoAspectPreset
import com.katalog.atelier.domain.model.PhotoFilterPreset
import com.katalog.atelier.domain.model.RawMaterialSpec
import com.katalog.atelier.domain.model.SizeInventoryEntry
import com.katalog.atelier.ui.components.PhotoEditorDialog
import java.time.LocalDate
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ItemEditorScreen(
    ownerId: String,
    existingItem: InventoryItem?,
    onBack: () -> Unit,
    onSave: (InventoryItem, Boolean) -> Unit
) {
    val isNew = existingItem == null

    var sku by remember { mutableStateOf(existingItem?.sku ?: "SK-${(700..999).random()}-MUM") }
    var title by remember { mutableStateOf(existingItem?.title ?: "") }
    var category by remember { mutableStateOf(existingItem?.category ?: InventoryCategory.COTTON_DAILY) }
    var location by remember { mutableStateOf(existingItem?.location ?: "Rack A · Packing Unit 1") }
    var status by remember { mutableStateOf(existingItem?.status ?: InventoryStatus.IN_STOCK) }
    var sizes by remember {
        mutableStateOf(
            existingItem?.sizes ?: listOf(
                SizeInventoryEntry("M", 10, 1550),
                SizeInventoryEntry("L", 12, 1650),
                SizeInventoryEntry("XL", 8, 1750),
                SizeInventoryEntry("XXL", 5, 1900)
            )
        )
    }
    var lastKarigarName by remember { mutableStateOf(existingItem?.lastKarigarName ?: "") }
    var lastKarigarStage by remember { mutableStateOf(existingItem?.lastKarigarStage ?: "Cutting & Stitching") }
    var topFabric by remember { mutableStateOf(existingItem?.rawMaterials?.topFabric ?: "") }
    var colorShade by remember { mutableStateOf(existingItem?.rawMaterials?.colorShade ?: "") }
    var bottomFabric by remember { mutableStateOf(existingItem?.rawMaterials?.bottomFabric ?: "") }
    var dupattaFabric by remember { mutableStateOf(existingItem?.rawMaterials?.dupattaFabric ?: "") }
    var materialNotes by remember { mutableStateOf(existingItem?.rawMaterials?.materialNotes ?: "") }
    var notes by remember { mutableStateOf(existingItem?.notes ?: "") }
    var mediaKey by remember {
        mutableStateOf(existingItem?.mediaKey ?: SeedInventory.sampleMediaPaths.first().first)
    }
    var photoFilter by remember { mutableStateOf(existingItem?.photoFilter ?: PhotoFilterPreset.ORIGINAL) }
    var photoAspect by remember { mutableStateOf(existingItem?.photoAspect ?: PhotoAspectPreset.STANDARD) }

    var showPhotoStudio by remember { mutableStateOf(false) }
    var errors by remember { mutableStateOf(ValidationErrors()) }

    if (showPhotoStudio) {
        PhotoEditorDialog(
            initialUri = mediaKey.takeIf { it.startsWith("content://") || it.startsWith("file://") }?.let(Uri::parse),
            initialFilter = photoFilter,
            initialAspect = photoAspect,
            onDismiss = { showPhotoStudio = false },
            onExportComplete = { savedUri, filter, aspect ->
                mediaKey = savedUri
                photoFilter = filter
                photoAspect = aspect
                showPhotoStudio = false
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isNew) "New Garment Design" else "Edit Design") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Cancel")
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
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            AsyncImage(
                model = mediaKey,
                contentDescription = "Garment photo preview",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 3f)
                    .clip(RoundedCornerShape(22.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            )

            OutlinedButton(
                onClick = { showPhotoStudio = true },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Rounded.PhotoCamera, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Upload & Edit Photo (Crop, Rotate, Filters)")
            }

            OutlinedTextField(
                value = sku,
                onValueChange = { sku = it },
                label = { Text("Design Code / SKU *") },
                isError = errors.sku != null,
                supportingText = errors.sku?.let { { Text(it) } },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Garment Design Name *") },
                isError = errors.title != null,
                supportingText = errors.title?.let { { Text(it) } },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Text("Collection Category", style = MaterialTheme.typography.titleSmall)
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                InventoryCategory.entries.forEach { cat ->
                    FilterChip(
                        selected = category == cat,
                        onClick = { category = cat },
                        label = { Text(cat.wireValue) }
                    )
                }
            }

            OutlinedTextField(
                value = location,
                onValueChange = { location = it },
                label = { Text("Rack / Storage Zone *") },
                isError = errors.location != null,
                supportingText = errors.location?.let { { Text(it) } },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            // Size & Separate Price Matrix
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Sizes, Stock & Separate INR Prices", style = MaterialTheme.typography.titleMedium)
                OutlinedButton(
                    onClick = {
                        sizes = sizes + SizeInventoryEntry(size = "3XL", stock = 0, price = 2000)
                    }
                ) {
                    Icon(Icons.Rounded.Add, contentDescription = null)
                    Text("Size")
                }
            }
            if (errors.sizes != null) {
                Text(errors.sizes!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            sizes.forEachIndexed { idx, row ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = row.size,
                        onValueChange = { v ->
                            sizes = sizes.toMutableList().also { it[idx] = row.copy(size = v.uppercase()) }
                        },
                        label = { Text("Size") },
                        singleLine = true,
                        modifier = Modifier.width(74.dp)
                    )
                    OutlinedTextField(
                        value = row.stock.toString(),
                        onValueChange = { v ->
                            sizes = sizes.toMutableList().also {
                                it[idx] = row.copy(stock = v.filter(Char::isDigit).toIntOrNull() ?: 0)
                            }
                        },
                        label = { Text("Qty") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = row.price.toString(),
                        onValueChange = { v ->
                            sizes = sizes.toMutableList().also {
                                it[idx] = row.copy(price = v.filter(Char::isDigit).toIntOrNull() ?: 0)
                            }
                        },
                        label = { Text("₹ Price") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1.2f)
                    )
                    if (sizes.size > 1) {
                        IconButton(onClick = {
                            sizes = sizes.toMutableList().also { it.removeAt(idx) }
                        }) {
                            Icon(Icons.Rounded.Delete, contentDescription = "Remove size")
                        }
                    }
                }
            }

            // Karigar Assignment
            Text("Outsourced Karigar", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = lastKarigarName,
                onValueChange = { lastKarigarName = it },
                label = { Text("Last Given To (Karigar Name)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = lastKarigarStage,
                onValueChange = { lastKarigarStage = it },
                label = { Text("Craft Stage (Cutting, Katha, Dyeing, Block Print)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            // Raw Materials & Fabric
            Text("Raw Materials & Fabrics", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = topFabric,
                onValueChange = { topFabric = it },
                label = { Text("Kameez / Top Fabric *") },
                isError = errors.topFabric != null,
                supportingText = errors.topFabric?.let { { Text(it) } },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = colorShade,
                onValueChange = { colorShade = it },
                label = { Text("Colour / Dye Shade *") },
                isError = errors.colorShade != null,
                supportingText = errors.colorShade?.let { { Text(it) } },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = bottomFabric,
                onValueChange = { bottomFabric = it },
                label = { Text("Salwar / Bottom Fabric") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = dupattaFabric,
                onValueChange = { dupattaFabric = it },
                label = { Text("Dupatta Fabric & Print") },
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = materialNotes,
                onValueChange = { materialNotes = it },
                label = { Text("Raw Material Supplier / Thread Notes") },
                minLines = 2,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Ironing, Packing & Dispatch Notes") },
                minLines = 2,
                modifier = Modifier.fillMaxWidth()
            )

            Button(
                onClick = {
                    val form = InventoryFormValues(
                        sku = sku,
                        title = title,
                        category = category,
                        location = location,
                        status = status,
                        sizes = sizes,
                        lastKarigarName = lastKarigarName,
                        lastKarigarStage = lastKarigarStage,
                        rawMaterials = RawMaterialSpec(
                            topFabric = topFabric.trim(),
                            colorShade = colorShade.trim(),
                            bottomFabric = bottomFabric.trim(),
                            dupattaFabric = dupattaFabric.trim(),
                            materialNotes = materialNotes.trim()
                        ),
                        notes = notes.trim()
                    )
                    val validation = InventoryLogic.validateInventoryForm(form)
                    if (validation.hasErrors) {
                        errors = validation
                        return@Button
                    }

                    val sortedSizes = InventoryLogic.sortSizesLogically(sizes)
                    val totalQty = InventoryLogic.computeTotalStockFromSizes(sortedSizes)
                    val derivedStatus = InventoryLogic.deriveDesignStatus(sortedSizes, form.minThreshold, status)
                    val today = LocalDate.now().toString()
                    val existingKarigars = existingItem?.karigars ?: emptyList()
                    val updatedKarigars = if (lastKarigarName.isNotBlank() && existingKarigars.isEmpty()) {
                        listOf(
                            KarigarStageEntry(
                                stage = lastKarigarStage.trim().ifBlank { "Cutting & Stitching" },
                                karigarName = lastKarigarName.trim(),
                                dateGiven = today
                            )
                        )
                    } else existingKarigars

                    val now = System.currentTimeMillis()
                    val item = InventoryItem(
                        id = existingItem?.id ?: "sk-${UUID.randomUUID().toString().take(12)}",
                        ownerId = ownerId,
                        sku = InventoryLogic.normalizeSku(sku),
                        title = title.trim(),
                        category = category,
                        location = location.trim(),
                        quantity = totalQty,
                        minThreshold = existingItem?.minThreshold ?: 5,
                        status = derivedStatus,
                        sizes = sortedSizes,
                        lastKarigarName = lastKarigarName.trim(),
                        lastKarigarStage = lastKarigarStage.trim(),
                        lastKarigarDate = existingItem?.lastKarigarDate?.ifBlank { today } ?: today,
                        karigars = updatedKarigars,
                        rawMaterials = form.rawMaterials,
                        notes = notes.trim(),
                        mediaKey = mediaKey,
                        photoFilter = photoFilter,
                        photoAspect = photoAspect,
                        createdAt = existingItem?.createdAt ?: now,
                        updatedAt = now
                    )
                    onSave(item, isNew)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
            ) {
                Text(if (isNew) "Save Design to Catalogue" else "Update Garment Design")
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}
