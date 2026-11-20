package com.katalog.atelier.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CheckBox
import androidx.compose.material.icons.rounded.CheckBoxOutlineBlank
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.GridView
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.ViewAgenda
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.katalog.atelier.domain.logic.InventoryLogic
import com.katalog.atelier.domain.model.InventoryCategory
import com.katalog.atelier.domain.model.InventoryItem
import com.katalog.atelier.domain.model.InventoryStatus
import com.katalog.atelier.ui.state.KatalogUiState
import com.katalog.atelier.ui.state.ViewMode

@Composable
fun CatalogueScreen(
    uiState: KatalogUiState,
    onQueryChange: (String) -> Unit,
    onCategorySelected: (InventoryCategory?) -> Unit,
    onStatusSelected: (InventoryStatus?) -> Unit,
    onViewModeChange: (ViewMode) -> Unit,
    onToggleSelectionMode: () -> Unit,
    onToggleItemSelected: (String) -> Unit,
    onToggleSelectAll: () -> Unit,
    onClearSelection: () -> Unit,
    onBatchUpdateStatus: (InventoryStatus) -> Unit,
    onBatchDelete: () -> Unit,
    onOpenDesign: (String) -> Unit,
    onCreateDesign: () -> Unit
) {
    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header + Search + Controls
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Garment Catalogue",
                            style = MaterialTheme.typography.headlineMedium
                        )
                        Text(
                            text = "${uiState.metrics.totalDesigns} designs · ${uiState.metrics.totalPieces} ready pcs",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        OutlinedButton(
                            onClick = onToggleSelectionMode,
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Icon(
                                imageVector = if (uiState.selectionMode) Icons.Rounded.CheckBox else Icons.Rounded.CheckBoxOutlineBlank,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(if (uiState.selectionMode) "Cancel" else "Select")
                        }

                        IconButton(
                            onClick = {
                                onViewModeChange(
                                    if (uiState.viewMode == ViewMode.GRID) ViewMode.LIST else ViewMode.GRID
                                )
                            }
                        ) {
                            Icon(
                                imageVector = if (uiState.viewMode == ViewMode.GRID) Icons.Rounded.ViewAgenda else Icons.Rounded.GridView,
                                contentDescription = "Toggle grid or list view"
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = uiState.filters.query,
                    onValueChange = onQueryChange,
                    placeholder = { Text("Search SKU, design, karigar, fabric…") },
                    leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                    singleLine = true,
                    shape = RoundedCornerShape(18.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                // Collection Filter Row
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = uiState.filters.category == null,
                        onClick = { onCategorySelected(null) },
                        label = { Text("All Collections") }
                    )
                    InventoryCategory.entries.forEach { category ->
                        FilterChip(
                            selected = uiState.filters.category == category,
                            onClick = {
                                onCategorySelected(if (uiState.filters.category == category) null else category)
                            },
                            label = { Text(category.wireValue) }
                        )
                    }
                }

                // Status Filter Row
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = uiState.filters.status == null,
                        onClick = { onStatusSelected(null) },
                        label = { Text("All Statuses") }
                    )
                    InventoryStatus.entries.forEach { status ->
                        FilterChip(
                            selected = uiState.filters.status == status,
                            onClick = {
                                onStatusSelected(if (uiState.filters.status == status) null else status)
                            },
                            label = { Text(status.displayLabel) }
                        )
                    }
                }

                // Inline Batch Action Bar (non-sticky, appears when selectionMode is active)
                if (uiState.selectionMode) {
                    BatchActionBar(
                        selectedCount = uiState.selectedIds.size,
                        visibleCount = uiState.visibleItems.size,
                        allVisibleSelected = uiState.visibleItems.isNotEmpty() &&
                            uiState.visibleItems.all { it.id in uiState.selectedIds },
                        busy = uiState.batchBusy,
                        onToggleSelectAll = onToggleSelectAll,
                        onClear = onClearSelection,
                        onBatchUpdateStatus = onBatchUpdateStatus,
                        onBatchDelete = onBatchDelete
                    )
                }
            }

            if (uiState.visibleItems.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No garment designs match the current filter.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else if (uiState.viewMode == ViewMode.GRID) {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 172.dp),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 96.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(uiState.visibleItems, key = { it.id }) { item ->
                        CatalogueGridCard(
                            item = item,
                            selectionMode = uiState.selectionMode,
                            selected = item.id in uiState.selectedIds,
                            onClick = {
                                if (uiState.selectionMode) onToggleItemSelected(item.id)
                                else onOpenDesign(item.id)
                            }
                        )
                    }
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        Spacer(Modifier.height(16.dp))
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 96.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(uiState.visibleItems, key = { it.id }) { item ->
                        CatalogueListRow(
                            item = item,
                            selectionMode = uiState.selectionMode,
                            selected = item.id in uiState.selectedIds,
                            onClick = {
                                if (uiState.selectionMode) onToggleItemSelected(item.id)
                                else onOpenDesign(item.id)
                            }
                        )
                    }
                }
            }
        }

        if (!uiState.selectionMode) {
            ExtendedFloatingActionButton(
                onClick = onCreateDesign,
                icon = { Icon(Icons.Rounded.Add, contentDescription = null) },
                text = { Text("Add Design") },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(16.dp)
            )
        }
    }
}

@Composable
private fun BatchActionBar(
    selectedCount: Int,
    visibleCount: Int,
    allVisibleSelected: Boolean,
    busy: Boolean,
    onToggleSelectAll: () -> Unit,
    onClear: () -> Unit,
    onBatchUpdateStatus: (InventoryStatus) -> Unit,
    onBatchDelete: () -> Unit
) {
    var targetStatus by remember { mutableStateOf(InventoryStatus.AUDIT_PENDING) }
    var statusMenuExpanded by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }

    Surface(
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.65f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable(onClick = onToggleSelectAll)
                ) {
                    Checkbox(
                        checked = allVisibleSelected,
                        onCheckedChange = { onToggleSelectAll() }
                    )
                    Text(
                        text = if (allVisibleSelected) "Deselect All" else "Select All ($visibleCount)",
                        style = MaterialTheme.typography.labelLarge
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "$selectedCount selected",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary
                    )
                    if (selectedCount > 0) {
                        TextButton(onClick = {
                            confirmDelete = false
                            onClear()
                        }) {
                            Text("Clear")
                        }
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(modifier = Modifier.weight(1f)) {
                    OutlinedButton(
                        onClick = { statusMenuExpanded = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(targetStatus.displayLabel, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    DropdownMenu(
                        expanded = statusMenuExpanded,
                        onDismissRequest = { statusMenuExpanded = false }
                    ) {
                        InventoryStatus.entries.forEach { status ->
                            DropdownMenuItem(
                                text = { Text(status.displayLabel) },
                                onClick = {
                                    targetStatus = status
                                    statusMenuExpanded = false
                                }
                            )
                        }
                    }
                }

                Button(
                    enabled = selectedCount > 0 && !busy,
                    onClick = {
                        confirmDelete = false
                        onBatchUpdateStatus(targetStatus)
                    }
                ) {
                    Text("Update Status")
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (confirmDelete && selectedCount > 0) {
                    TextButton(onClick = { confirmDelete = false }) {
                        Text("Cancel")
                    }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        enabled = !busy,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                        onClick = {
                            confirmDelete = false
                            onBatchDelete()
                        }
                    ) {
                        Text("Confirm Delete ($selectedCount)")
                    }
                } else {
                    OutlinedButton(
                        enabled = selectedCount > 0 && !busy,
                        onClick = { confirmDelete = true },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                    ) {
                        Icon(Icons.Rounded.Delete, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Delete Selected")
                    }
                }
            }
        }
    }
}

@Composable
private fun CatalogueGridCard(
    item: InventoryItem,
    selectionMode: Boolean,
    selected: Boolean,
    onClick: () -> Unit
) {
    Card(
        shape = MaterialTheme.shapes.large,
        border = if (selected) BorderStroke(2.dp, MaterialTheme.colorScheme.primary)
        else BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f)),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
            else MaterialTheme.colorScheme.surface
        ),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(role = if (selectionMode) Role.Checkbox else Role.Button, onClick = onClick)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 3f)
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            ) {
                AsyncImage(
                    model = item.mediaKey,
                    contentDescription = item.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
                if (selectionMode) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.9f),
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(8.dp)
                    ) {
                        Checkbox(
                            checked = selected,
                            onCheckedChange = { onClick() }
                        )
                    }
                }
            }

            Column(
                modifier = Modifier.padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "${item.sku} · ${item.category.wireValue} · ${item.status.displayLabel}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = item.title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${InventoryLogic.getPriceRangeLabel(item.sizes)} · ${item.quantity} pcs",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary
                )
                if (item.lastKarigarName.isNotBlank()) {
                    Text(
                        text = "Last: ${item.lastKarigarName} (${item.lastKarigarStage})",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

@Composable
private fun CatalogueListRow(
    item: InventoryItem,
    selectionMode: Boolean,
    selected: Boolean,
    onClick: () -> Unit
) {
    Card(
        shape = MaterialTheme.shapes.medium,
        border = if (selected) BorderStroke(2.dp, MaterialTheme.colorScheme.primary)
        else BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f)),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.28f)
            else MaterialTheme.colorScheme.surface
        ),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(role = if (selectionMode) Role.Checkbox else Role.Button, onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (selectionMode) {
                Checkbox(checked = selected, onCheckedChange = { onClick() })
            }

            AsyncImage(
                model = item.mediaKey,
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            )

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    text = "${item.sku} · ${item.status.displayLabel}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = item.title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${InventoryLogic.getPriceRangeLabel(item.sizes)} · ${item.quantity} pcs · ${item.lastKarigarName}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}
