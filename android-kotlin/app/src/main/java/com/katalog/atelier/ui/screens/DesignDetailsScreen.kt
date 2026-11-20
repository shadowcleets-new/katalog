package com.katalog.atelier.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import com.katalog.atelier.domain.logic.InventoryLogic
import com.katalog.atelier.domain.model.InventoryItem
import com.katalog.atelier.domain.model.KarigarStageEntry
import com.katalog.atelier.domain.model.RawMaterialSpec
import com.katalog.atelier.domain.model.SchemaLimits
import com.katalog.atelier.domain.model.SizeInventoryEntry
import java.time.LocalDate

/**
 * Full-page Salwar Kameez Design Details screen:
 * 1. Hero Garment Photograph & Summary
 * 2. Per-Size Stock & Separate INR Pricing Matrix
 * 3. Outsourced Karigars & Craft Stages ("Last Given To" + Quick Handover Log)
 * 4. Raw Materials, Fabric & Dye Shade Specification
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DesignDetailsScreen(
    item: InventoryItem,
    onBack: () -> Unit,
    onEditFullDesign: () -> Unit,
    onUpdateSizeMatrix: (List<SizeInventoryEntry>) -> Unit,
    onLogKarigarHandover: (KarigarStageEntry) -> Unit,
    onUpdateRawMaterials: (RawMaterialSpec) -> Unit,
    onDeleteDesign: () -> Unit
) {
    var draftSizes by remember(item.id, item.updatedAt) {
        mutableStateOf(InventoryLogic.sortSizesLogically(item.sizes))
    }
    var sizesDirty by remember(item.id, item.updatedAt) { mutableStateOf(false) }

    var showHandoverForm by remember { mutableStateOf(false) }
    var handoverKarigar by remember { mutableStateOf(item.lastKarigarName) }
    var handoverStage by remember { mutableStateOf(SchemaLimits.KARIGAR_STAGES.first()) }
    var handoverNote by remember { mutableStateOf("") }

    var editingMaterials by remember { mutableStateOf(false) }
    var draftMaterials by remember(item.id, item.updatedAt) { mutableStateOf(item.rawMaterials) }

    var confirmDelete by remember { mutableStateOf(false) }

    LaunchedEffect(item.id, item.updatedAt) {
        draftSizes = InventoryLogic.sortSizesLogically(item.sizes)
        draftMaterials = item.rawMaterials
        sizesDirty = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(item.sku, style = MaterialTheme.typography.titleMedium) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back to catalogue")
                    }
                },
                actions = {
                    IconButton(onClick = onEditFullDesign) {
                        Icon(Icons.Rounded.Edit, contentDescription = "Edit full design")
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
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            // 1. Hero Garment Image & Headline
            AsyncImage(
                model = item.mediaKey,
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 3f)
                    .clip(RoundedCornerShape(24.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            )

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = "${item.category.wireValue} · ${item.status.displayLabel} · ${item.location}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = item.title,
                    style = MaterialTheme.typography.headlineMedium
                )
                Text(
                    text = "${InventoryLogic.getPriceRangeLabel(draftSizes)} · ${InventoryLogic.computeTotalStockFromSizes(draftSizes)} total pieces across ${draftSizes.size} sizes",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // 2. Per-Size Stock & Separate INR Pricing Ledger
            SectionCard(title = "Size Stock & Per-Size Pricing (INR)") {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    draftSizes.forEachIndexed { idx, entry ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = entry.size,
                                style = MaterialTheme.typography.titleMedium,
                                modifier = Modifier.width(44.dp)
                            )

                            IconButton(
                                onClick = {
                                    val next = draftSizes.toMutableList()
                                    next[idx] = entry.copy(stock = (entry.stock - 1).coerceAtLeast(0))
                                    draftSizes = next
                                    sizesDirty = true
                                }
                            ) {
                                Icon(Icons.Rounded.Remove, contentDescription = "Decrease ${entry.size} stock")
                            }

                            Text(
                                text = "${entry.stock} pcs",
                                style = MaterialTheme.typography.labelLarge,
                                color = if (entry.stock <= item.minThreshold) MaterialTheme.colorScheme.error
                                else MaterialTheme.colorScheme.onSurface,
                                modifier = Modifier.width(58.dp)
                            )

                            IconButton(
                                onClick = {
                                    val next = draftSizes.toMutableList()
                                    next[idx] = entry.copy(stock = entry.stock + 1)
                                    draftSizes = next
                                    sizesDirty = true
                                }
                            ) {
                                Icon(Icons.Rounded.Add, contentDescription = "Increase ${entry.size} stock")
                            }

                            OutlinedTextField(
                                value = entry.price.toString(),
                                onValueChange = { raw ->
                                    val parsed = raw.filter { it.isDigit() }.toIntOrNull() ?: 0
                                    val next = draftSizes.toMutableList()
                                    next[idx] = entry.copy(price = parsed)
                                    draftSizes = next
                                    sizesDirty = true
                                },
                                label = { Text("₹ Price") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.weight(1f)
                            )
                        }
                        if (idx < draftSizes.lastIndex) HorizontalDivider()
                    }

                    if (sizesDirty) {
                        Button(
                            onClick = {
                                onUpdateSizeMatrix(draftSizes)
                                sizesDirty = false
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Save Size Stock & Prices")
                        }
                    }
                }
            }

            // 3. Outsourced Karigars & Craft Stages
            SectionCard(title = "Outsourced Karigars & Craft Stages") {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Last Given To",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = if (item.lastKarigarName.isNotBlank()) {
                            "${item.lastKarigarName} · ${item.lastKarigarStage}" +
                                if (item.lastKarigarDate.isNotBlank()) " (${item.lastKarigarDate})" else ""
                        } else {
                            "No Karigar handover recorded yet"
                        },
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary
                    )

                    if (item.karigars.isNotEmpty()) {
                        HorizontalDivider()
                        item.karigars.forEach { stage ->
                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(
                                    text = "${stage.stage} — ${stage.karigarName}",
                                    style = MaterialTheme.typography.titleSmall
                                )
                                val sub = listOf(stage.dateGiven, stage.unitOrNote)
                                    .filter { it.isNotBlank() }
                                    .joinToString(" · ")
                                if (sub.isNotBlank()) {
                                    Text(
                                        text = sub,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }

                    if (showHandoverForm) {
                        HorizontalDivider()
                        OutlinedTextField(
                            value = handoverKarigar,
                            onValueChange = { handoverKarigar = it },
                            label = { Text("Karigar / Workshop Name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = handoverStage,
                            onValueChange = { handoverStage = it },
                            label = { Text("Craft Stage (e.g. Katha, Dupatta Dyeing, Block Print)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = handoverNote,
                            onValueChange = { handoverNote = it },
                            label = { Text("Workshop Area / Batch Note") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { showHandoverForm = false }) {
                                Text("Cancel")
                            }
                            Button(
                                enabled = handoverKarigar.isNotBlank() && handoverStage.isNotBlank(),
                                onClick = {
                                    onLogKarigarHandover(
                                        KarigarStageEntry(
                                            stage = handoverStage.trim(),
                                            karigarName = handoverKarigar.trim(),
                                            unitOrNote = handoverNote.trim(),
                                            dateGiven = LocalDate.now().toString()
                                        )
                                    )
                                    handoverNote = ""
                                    showHandoverForm = false
                                }
                            ) {
                                Text("Log Handover")
                            }
                        }
                    } else {
                        OutlinedButton(onClick = { showHandoverForm = true }) {
                            Text("Log New Karigar Handover")
                        }
                    }
                }
            }

            // 4. Raw Materials & Fabric Specification
            SectionCard(title = "Raw Materials & Fabric Notes") {
                if (editingMaterials) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = draftMaterials.topFabric,
                            onValueChange = { draftMaterials = draftMaterials.copy(topFabric = it) },
                            label = { Text("Kameez / Top Fabric") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = draftMaterials.colorShade,
                            onValueChange = { draftMaterials = draftMaterials.copy(colorShade = it) },
                            label = { Text("Colour & Dye Shade") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = draftMaterials.bottomFabric,
                            onValueChange = { draftMaterials = draftMaterials.copy(bottomFabric = it) },
                            label = { Text("Salwar / Bottom Fabric") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = draftMaterials.dupattaFabric,
                            onValueChange = { draftMaterials = draftMaterials.copy(dupattaFabric = it) },
                            label = { Text("Dupatta Fabric & Border") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = draftMaterials.materialNotes,
                            onValueChange = { draftMaterials = draftMaterials.copy(materialNotes = it) },
                            label = { Text("Supplier / Thread / Care Notes") },
                            minLines = 3,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = {
                                draftMaterials = item.rawMaterials
                                editingMaterials = false
                            }) { Text("Cancel") }
                            Button(onClick = {
                                onUpdateRawMaterials(draftMaterials)
                                editingMaterials = false
                            }) { Text("Save Materials") }
                        }
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        MaterialSpecRow("Kameez / Top Fabric", item.rawMaterials.topFabric)
                        MaterialSpecRow("Colour / Dye Shade", item.rawMaterials.colorShade)
                        MaterialSpecRow("Salwar / Bottom", item.rawMaterials.bottomFabric)
                        MaterialSpecRow("Dupatta", item.rawMaterials.dupattaFabric)
                        if (item.rawMaterials.materialNotes.isNotBlank()) {
                            MaterialSpecRow("Additional Material Notes", item.rawMaterials.materialNotes)
                        }
                        if (item.notes.isNotBlank()) {
                            HorizontalDivider()
                            MaterialSpecRow("Ironing, Packing & Dispatch Notes", item.notes)
                        }
                        OutlinedButton(onClick = { editingMaterials = true }) {
                            Text("Edit Fabric & Raw Materials")
                        }
                    }
                }
            }

            // Inline-confirmed Delete Design
            if (confirmDelete) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = { confirmDelete = false }) { Text("Cancel") }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                        onClick = onDeleteDesign
                    ) {
                        Text("Confirm Delete Design")
                    }
                }
            } else {
                OutlinedButton(
                    onClick = { confirmDelete = true },
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Rounded.Delete, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("Delete Design from Catalogue")
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SectionCard(
    title: String,
    content: @Composable () -> Unit
) {
    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(text = title, style = MaterialTheme.typography.titleLarge)
            content()
        }
    }
}

@Composable
private fun MaterialSpecRow(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value.ifBlank { "Not specified" },
            style = MaterialTheme.typography.bodyMedium
        )
    }
}
