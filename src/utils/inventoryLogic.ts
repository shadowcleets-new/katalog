import {
  INVENTORY_CATEGORIES,
  SCHEMA_LIMITS,
  STANDARD_SIZES,
  type InventoryCategory,
  type InventoryFormValues,
  type InventoryItem,
  type InventoryStatus,
  type SizeInventoryEntry,
  type SyncQueueEntry,
} from '../types/inventory';

export type SortOption = 'updated_desc' | 'title_asc' | 'quantity_asc' | 'sku_asc';

export interface InventoryFilterState {
  query: string;
  category: InventoryCategory | 'All';
  status: InventoryStatus | 'All';
  sort: SortOption;
}

export interface ValidationErrors {
  sku?: string;
  title?: string;
  category?: string;
  location?: string;
  minThreshold?: string;
  sizes?: string;
  topFabric?: string;
  colorShade?: string;
  notes?: string;
}

/** Sorts sizes logically (XS -> S -> M -> L -> XL -> XXL -> 3XL), then custom sizes alphabetically. */
export function sortSizesLogically(sizes: readonly SizeInventoryEntry[]): SizeInventoryEntry[] {
  const rankMap = new Map<string, number>(
    STANDARD_SIZES.map((label, idx) => [label.toUpperCase(), idx])
  );

  return [...sizes].sort((a, b) => {
    const keyA = a.size.trim().toUpperCase();
    const keyB = b.size.trim().toUpperCase();
    const rankA = rankMap.get(keyA);
    const rankB = rankMap.get(keyB);

    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;
    return keyA.localeCompare(keyB, undefined, { numeric: true });
  });
}

/** Formats an INR whole-rupee price using Indian numbering (e.g. ₹1,850 or ₹1,25,000). */
export function formatInr(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return `₹${safe.toLocaleString('en-IN')}`;
}

/** Produces a clean price summary across all sizes (e.g. "₹1,850 – ₹2,300" or "₹1,650"). */
export function getPriceRangeLabel(sizes: readonly SizeInventoryEntry[]): string {
  const priced = sizes.map((s) => s.price).filter((p) => Number.isFinite(p) && p > 0);
  if (priced.length === 0) return 'Price not set';
  const min = Math.min(...priced);
  const max = Math.max(...priced);
  return min === max ? formatInr(min) : `${formatInr(min)} – ${formatInr(max)}`;
}

export function computeTotalStockFromSizes(sizes: readonly SizeInventoryEntry[]): number {
  return sizes.reduce((sum, entry) => sum + Math.max(0, Math.trunc(entry.stock || 0)), 0);
}

/**
 * Derives garment design stock status from the full size matrix:
 * - Preserves `audit_pending` when explicitly marked in Finishing / QC
 * - `out_of_stock` when total pieces across all sizes is 0
 * - `low_stock` when any size is at or below `minThreshold` (including 0-stock sizes)
 * - `in_stock` when every tracked size is healthy above threshold
 */
export function deriveDesignStatus(
  sizes: readonly SizeInventoryEntry[],
  minThreshold: number,
  currentStatus?: InventoryStatus
): InventoryStatus {
  if (currentStatus === 'audit_pending') {
    return 'audit_pending';
  }
  const total = computeTotalStockFromSizes(sizes);
  if (total <= 0) {
    return 'out_of_stock';
  }
  if (sizes.some((s) => s.stock <= minThreshold)) {
    return 'low_stock';
  }
  return 'in_stock';
}

export function deriveStockStatus(
  quantity: number,
  minThreshold: number,
  currentStatus?: InventoryStatus
): InventoryStatus {
  if (currentStatus === 'audit_pending') {
    return 'audit_pending';
  }
  if (quantity <= 0) {
    return 'out_of_stock';
  }
  if (quantity <= minThreshold) {
    return 'low_stock';
  }
  return 'in_stock';
}

export function normalizeSku(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '-');
}

export function validateInventoryForm(values: InventoryFormValues): ValidationErrors {
  const errors: ValidationErrors = {};
  const sku = normalizeSku(values.sku);
  const title = values.title.trim();
  const location = values.location.trim();
  const notes = values.notes.trim();

  if (sku.length < SCHEMA_LIMITS.SKU_MIN || sku.length > SCHEMA_LIMITS.SKU_MAX) {
    errors.sku = `Design code must be ${SCHEMA_LIMITS.SKU_MIN}–${SCHEMA_LIMITS.SKU_MAX} characters.`;
  } else if (!SCHEMA_LIMITS.SKU_REGEX.test(sku)) {
    errors.sku = 'Design code may contain only uppercase letters, digits, and hyphens.';
  }

  if (title.length < SCHEMA_LIMITS.TITLE_MIN || title.length > SCHEMA_LIMITS.TITLE_MAX) {
    errors.title = `Design name must be ${SCHEMA_LIMITS.TITLE_MIN}–${SCHEMA_LIMITS.TITLE_MAX} characters.`;
  }

  if (!INVENTORY_CATEGORIES.includes(values.category)) {
    errors.category = 'Select a valid collection category.';
  }

  if (location.length < SCHEMA_LIMITS.LOCATION_MIN || location.length > SCHEMA_LIMITS.LOCATION_MAX) {
    errors.location = `Rack / storage zone must be ${SCHEMA_LIMITS.LOCATION_MIN}–${SCHEMA_LIMITS.LOCATION_MAX} characters.`;
  }

  if (
    !Number.isInteger(values.minThreshold) ||
    values.minThreshold < 0 ||
    values.minThreshold > SCHEMA_LIMITS.THRESHOLD_MAX
  ) {
    errors.minThreshold = `Low-size threshold must be 0 to ${SCHEMA_LIMITS.THRESHOLD_MAX.toLocaleString()}.`;
  }

  if (!Array.isArray(values.sizes) || values.sizes.length < SCHEMA_LIMITS.SIZES_MIN) {
    errors.sizes = 'Add at least one garment size with stock and price.';
  } else if (values.sizes.length > SCHEMA_LIMITS.SIZES_MAX) {
    errors.sizes = `You can track up to ${SCHEMA_LIMITS.SIZES_MAX} sizes per design.`;
  } else {
    const seen = new Set<string>();
    for (const entry of values.sizes) {
      const label = entry.size.trim().toUpperCase();
      if (!label || label.length > SCHEMA_LIMITS.SIZE_LABEL_MAX) {
        errors.sizes = `Every size label must be 1–${SCHEMA_LIMITS.SIZE_LABEL_MAX} characters.`;
        break;
      }
      if (seen.has(label)) {
        errors.sizes = `Duplicate size "${label}" found. Keep one row per size.`;
        break;
      }
      seen.add(label);
      if (
        !Number.isInteger(entry.stock) ||
        entry.stock < 0 ||
        entry.stock > SCHEMA_LIMITS.SIZE_STOCK_MAX
      ) {
        errors.sizes = `Stock for size ${label} must be a whole number from 0 to ${SCHEMA_LIMITS.SIZE_STOCK_MAX.toLocaleString()}.`;
        break;
      }
      if (
        !Number.isInteger(entry.price) ||
        entry.price < 0 ||
        entry.price > SCHEMA_LIMITS.SIZE_PRICE_MAX
      ) {
        errors.sizes = `Price for size ${label} must be a valid INR amount (0 to ${SCHEMA_LIMITS.SIZE_PRICE_MAX.toLocaleString()}).`;
        break;
      }
    }
  }

  if (!values.rawMaterials.topFabric.trim()) {
    errors.topFabric = 'Specify the Kameez / top fabric so it is easy to reorder later.';
  } else if (values.rawMaterials.topFabric.trim().length > SCHEMA_LIMITS.FABRIC_MAX) {
    errors.topFabric = `Top fabric cannot exceed ${SCHEMA_LIMITS.FABRIC_MAX} characters.`;
  }

  if (!values.rawMaterials.colorShade.trim()) {
    errors.colorShade = 'Specify the garment colour or dye shade.';
  } else if (values.rawMaterials.colorShade.trim().length > SCHEMA_LIMITS.COLOR_MAX) {
    errors.colorShade = `Colour / shade cannot exceed ${SCHEMA_LIMITS.COLOR_MAX} characters.`;
  }

  if (notes.length > SCHEMA_LIMITS.NOTES_MAX) {
    errors.notes = `Notes cannot exceed ${SCHEMA_LIMITS.NOTES_MAX} characters.`;
  }

  return errors;
}

export function filterAndSortInventory(
  items: InventoryItem[],
  filters: InventoryFilterState
): InventoryItem[] {
  const q = filters.query.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (item.syncState === 'pending_delete') return false;
    if (filters.category !== 'All' && item.category !== filters.category) return false;
    if (filters.status !== 'All' && item.status !== filters.status) return false;
    if (!q) return true;

    const karigarMatch =
      item.lastKarigarName.toLowerCase().includes(q) ||
      item.lastKarigarStage.toLowerCase().includes(q) ||
      item.karigars.some(
        (k) =>
          k.karigarName.toLowerCase().includes(q) ||
          k.stage.toLowerCase().includes(q) ||
          k.unitOrNote.toLowerCase().includes(q)
      );

    const materialMatch =
      item.rawMaterials.topFabric.toLowerCase().includes(q) ||
      item.rawMaterials.colorShade.toLowerCase().includes(q) ||
      item.rawMaterials.bottomFabric.toLowerCase().includes(q) ||
      item.rawMaterials.dupattaFabric.toLowerCase().includes(q) ||
      item.rawMaterials.materialNotes.toLowerCase().includes(q);

    return (
      item.title.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q) ||
      item.notes.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      karigarMatch ||
      materialMatch
    );
  });

  return [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case 'title_asc':
        return a.title.localeCompare(b.title);
      case 'quantity_asc':
        return a.quantity - b.quantity;
      case 'sku_asc':
        return a.sku.localeCompare(b.sku);
      case 'updated_desc':
      default:
        return b.updatedAt - a.updatedAt;
    }
  });
}

export interface InventorySummaryMetrics {
  totalSkus: number;
  totalUnits: number;
  lowOrOutCount: number;
  auditPendingCount: number;
  cachedCount: number;
}

export function computeInventoryMetrics(items: InventoryItem[]): InventorySummaryMetrics {
  const active = items.filter((i) => i.syncState !== 'pending_delete');
  return {
    totalSkus: active.length,
    totalUnits: active.reduce((sum, i) => sum + i.quantity, 0),
    lowOrOutCount: active.filter((i) => i.status === 'low_stock' || i.status === 'out_of_stock')
      .length,
    auditPendingCount: active.filter((i) => i.status === 'audit_pending').length,
    cachedCount: active.filter((i) => i.cachedOffline).length,
  };
}

export interface KarigarDirectoryEntry {
  karigarName: string;
  stages: string[];
  unitNotes: string[];
  lastGivenCount: number;
  designs: { item: InventoryItem; stage: string; dateGiven: string; isLastKarigar: boolean }[];
}

/** Aggregates all Karigars referenced across designs so the manufacturer can look up every craftsperson's workload. */
export function aggregateKarigarsDirectory(items: InventoryItem[]): KarigarDirectoryEntry[] {
  const active = items.filter((i) => i.syncState !== 'pending_delete');
  const map = new Map<string, KarigarDirectoryEntry>();

  const ensureEntry = (name: string): KarigarDirectoryEntry => {
    const key = name.trim().toLowerCase();
    let entry = map.get(key);
    if (!entry) {
      entry = {
        karigarName: name.trim(),
        stages: [],
        unitNotes: [],
        lastGivenCount: 0,
        designs: [],
      };
      map.set(key, entry);
    }
    return entry;
  };

  for (const item of active) {
    const lastKey = item.lastKarigarName.trim().toLowerCase();

    if (item.lastKarigarName.trim()) {
      const lastEntry = ensureEntry(item.lastKarigarName);
      lastEntry.lastGivenCount += 1;
      if (item.lastKarigarStage && !lastEntry.stages.includes(item.lastKarigarStage)) {
        lastEntry.stages.push(item.lastKarigarStage);
      }
      if (!lastEntry.designs.some((d) => d.item.id === item.id)) {
        lastEntry.designs.push({
          item,
          stage: item.lastKarigarStage || 'Assigned',
          dateGiven: item.lastKarigarDate,
          isLastKarigar: true,
        });
      }
    }

    for (const log of item.karigars) {
      if (!log.karigarName.trim()) continue;
      const entry = ensureEntry(log.karigarName);
      if (log.stage && !entry.stages.includes(log.stage)) {
        entry.stages.push(log.stage);
      }
      if (log.unitOrNote.trim()) {
        const area = log.unitOrNote.split('·')[0]?.trim();
        if (area && !entry.unitNotes.includes(area)) {
          entry.unitNotes.push(area);
        }
      }
      const existingDesign = entry.designs.find((d) => d.item.id === item.id);
      if (!existingDesign) {
        entry.designs.push({
          item,
          stage: log.stage,
          dateGiven: log.dateGiven,
          isLastKarigar: log.karigarName.trim().toLowerCase() === lastKey,
        });
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      b.lastGivenCount - a.lastGivenCount ||
      b.designs.length - a.designs.length ||
      a.karigarName.localeCompare(b.karigarName)
  );
}

/** Collects sorted unique Karigar names across the catalogue for quick handover autocomplete. */
export function getKnownKarigarNames(items: InventoryItem[]): string[] {
  const names = new Set<string>();
  for (const item of items) {
    if (item.lastKarigarName.trim()) names.add(item.lastKarigarName.trim());
    for (const k of item.karigars) {
      if (k.karigarName.trim()) names.add(k.karigarName.trim());
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

/**
 * Coalesces offline mutations per itemId so offline create + update collapses into
 * a single create, create + delete removes the queued entry entirely, and update + update
 * keeps only the latest payload.
 */
export function enqueueSyncMutation(
  queue: SyncQueueEntry[],
  next: SyncQueueEntry
): SyncQueueEntry[] {
  const existingIdx = queue.findIndex((entry) => entry.itemId === next.itemId);
  if (existingIdx === -1) {
    return [...queue, next];
  }

  const prev = queue[existingIdx];
  const copy = [...queue];

  if (prev.operation === 'create' && next.operation === 'update') {
    copy[existingIdx] = {
      ...next,
      id: prev.id,
      operation: 'create',
    };
    return copy;
  }

  if (prev.operation === 'create' && next.operation === 'delete') {
    copy.splice(existingIdx, 1);
    return copy;
  }

  copy[existingIdx] = next;
  return copy;
}

export function formatStatusLabel(status: InventoryStatus): string {
  switch (status) {
    case 'in_stock':
      return 'Ready Stock';
    case 'low_stock':
      return 'Low Sizes';
    case 'out_of_stock':
      return 'Out of Stock';
    case 'audit_pending':
      return 'In Finishing / QC';
  }
}

export function toggleSelectionId(selectedIds: readonly string[], itemId: string): string[] {
  if (selectedIds.includes(itemId)) {
    return selectedIds.filter((id) => id !== itemId);
  }
  return [...selectedIds, itemId];
}

export function toggleSelectAllVisible(
  selectedIds: readonly string[],
  visibleIds: readonly string[]
): string[] {
  if (visibleIds.length === 0) return [...selectedIds];
  const allVisibleSelected = visibleIds.every((id) => selectedIds.includes(id));
  if (allVisibleSelected) {
    const visibleSet = new Set(visibleIds);
    return selectedIds.filter((id) => !visibleSet.has(id));
  }
  const merged = new Set(selectedIds);
  for (const id of visibleIds) {
    merged.add(id);
  }
  return Array.from(merged);
}

export function pruneSelectionIds(
  selectedIds: readonly string[],
  items: readonly InventoryItem[]
): string[] {
  const activeSet = new Set(
    items.filter((i) => i.syncState !== 'pending_delete').map((i) => i.id)
  );
  return selectedIds.filter((id) => activeSet.has(id));
}

export function evaluatePasswordStrength(password: string): {
  score: number;
  label: string;
} {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

  const labels = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  return { score, label: labels[score] };
}
