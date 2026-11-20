import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckSquare,
  ChevronDown,
  CloudOff,
  LayoutGrid,
  List,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  INVENTORY_CATEGORIES,
  INVENTORY_STATUSES,
  type InventoryCategory,
  type InventoryItem,
  type InventoryStatus,
} from '../types/inventory';
import {
  computeInventoryMetrics,
  formatStatusLabel,
  getPriceRangeLabel,
  pruneSelectionIds,
  sortSizesLogically,
  toggleSelectAllVisible,
  toggleSelectionId,
  type InventoryFilterState,
  type SortOption,
} from '../utils/inventoryLogic';
import { ResilientImage } from './ResilientImage';

interface CatalogueGridProps {
  items: InventoryItem[];
  filteredItems: InventoryItem[];
  loading?: boolean;
  filters: InventoryFilterState;
  viewMode: 'grid' | 'list';
  onFiltersChange: (next: InventoryFilterState) => void;
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onSelectItem: (item: InventoryItem) => void;
  onOpenAdd: () => void;
  onBatchUpdateStatus: (itemIds: string[], status: InventoryStatus) => Promise<void>;
  onBatchDelete: (itemIds: string[]) => Promise<void>;
}

function statusTextClass(status: InventoryStatus): string {
  switch (status) {
    case 'out_of_stock':
      return 'text-red-700 dark:text-red-300 font-semibold';
    case 'low_stock':
      return 'text-amber-700 dark:text-amber-300 font-semibold';
    case 'audit_pending':
      return 'text-[var(--m3-primary)] font-semibold';
    case 'in_stock':
    default:
      return 'text-emerald-700 dark:text-emerald-300 font-medium';
  }
}

export const CatalogueGrid: React.FC<CatalogueGridProps> = ({
  items,
  filteredItems,
  loading = false,
  filters,
  viewMode,
  onFiltersChange,
  onViewModeChange,
  onSelectItem,
  onOpenAdd,
  onBatchUpdateStatus,
  onBatchDelete,
}) => {
  const metrics = computeInventoryMetrics(items);

  // Batch Checkbox Selection Mode State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchStatus, setBatchStatus] = useState<InventoryStatus>('audit_pending');
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);

  // Keep selectedIds pruned if items are removed or marked pending_delete
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = pruneSelectionIds(prev, items);
      return next.length === prev.length ? prev : next;
    });
  }, [items]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIds = useMemo(() => filteredItems.map((i) => i.id), [filteredItems]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  const toggleSelectionMode = () => {
    setSelectionMode((active) => {
      if (active) {
        setSelectedIds([]);
        setConfirmBatchDelete(false);
      }
      return !active;
    });
  };

  const handleToggleItem = (itemId: string) => {
    setSelectedIds((prev) => toggleSelectionId(prev, itemId));
    setConfirmBatchDelete(false);
  };

  const handleToggleSelectAllVisible = () => {
    setSelectedIds((prev) => toggleSelectAllVisible(prev, visibleIds));
    setConfirmBatchDelete(false);
  };

  const handleApplyBatchStatus = async () => {
    if (selectedIds.length === 0 || batchBusy) return;
    setBatchBusy(true);
    try {
      await onBatchUpdateStatus(selectedIds, batchStatus);
      setSelectedIds([]);
      setConfirmBatchDelete(false);
      setSelectionMode(false);
    } finally {
      setBatchBusy(false);
    }
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedIds.length === 0 || batchBusy) return;
    setBatchBusy(true);
    try {
      await onBatchDelete(selectedIds);
      setSelectedIds([]);
      setConfirmBatchDelete(false);
      setSelectionMode(false);
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Expressive Summary Strip */}
      <section
        aria-label="Catalogue summary metrics"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        <div className="rounded-3xl bg-[var(--m3-surface-card)] border border-[var(--m3-outline-variant)] p-4 sm:p-5">
          <p className="text-xs font-medium text-[var(--m3-on-surface-variant)]">Active Designs</p>
          <p className="mt-1.5 font-mono text-2xl sm:text-3xl font-semibold tabular-nums">
            {metrics.totalSkus}
          </p>
        </div>
        <div className="rounded-3xl bg-[var(--m3-surface-card)] border border-[var(--m3-outline-variant)] p-4 sm:p-5">
          <p className="text-xs font-medium text-[var(--m3-on-surface-variant)]">Ready Pieces</p>
          <p className="mt-1.5 font-mono text-2xl sm:text-3xl font-semibold tabular-nums">
            {metrics.totalUnits.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="rounded-3xl bg-[var(--m3-surface-card)] border border-[var(--m3-outline-variant)] p-4 sm:p-5">
          <p className="text-xs font-medium text-[var(--m3-on-surface-variant)]">Low / Out Designs</p>
          <p className="mt-1.5 font-mono text-2xl sm:text-3xl font-semibold tabular-nums">
            {metrics.lowOrOutCount}
          </p>
        </div>
        <div className="rounded-3xl bg-[var(--m3-surface-card)] border border-[var(--m3-outline-variant)] p-4 sm:p-5">
          <p className="text-xs font-medium text-[var(--m3-on-surface-variant)]">Cached Offline</p>
          <p className="mt-1.5 font-mono text-2xl sm:text-3xl font-semibold tabular-nums">
            {metrics.cachedCount}/{metrics.totalSkus}
          </p>
        </div>
      </section>

      {/* Search, Filter, Selection Mode & View Controls */}
      <section aria-label="Catalogue search and filters" className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--m3-on-surface-variant)]"
              aria-hidden="true"
            />
            <label htmlFor="catalogue-search" className="sr-only">
              Search designs by name, code, fabric, colour, or Karigar
            </label>
            <input
              id="catalogue-search"
              type="search"
              value={filters.query}
              onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
              placeholder="Search design, code, fabric, colour, or Karigar..."
              className="min-h-[48px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] pl-11 pr-11 text-sm text-[var(--m3-on-surface)] placeholder:text-[var(--m3-outline)]"
            />
            {filters.query && (
              <button
                type="button"
                onClick={() => onFiltersChange({ ...filters, query: '' })}
                aria-label="Clear search query"
                className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            <div className="relative flex-1 sm:flex-none">
              <label htmlFor="status-filter" className="sr-only">
                Filter by stock status
              </label>
              <select
                id="status-filter"
                value={filters.status}
                onChange={(e) =>
                  onFiltersChange({ ...filters, status: e.target.value as InventoryStatus | 'All' })
                }
                className="min-h-[48px] w-full appearance-none rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] pl-4 pr-10 text-sm font-medium text-[var(--m3-on-surface)] cursor-pointer"
              >
                <option value="All">All Statuses</option>
                {INVENTORY_STATUSES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--m3-on-surface-variant)]"
                aria-hidden="true"
              />
            </div>

            <div className="relative flex-1 sm:flex-none">
              <label htmlFor="sort-order" className="sr-only">
                Sort designs
              </label>
              <select
                id="sort-order"
                value={filters.sort}
                onChange={(e) => onFiltersChange({ ...filters, sort: e.target.value as SortOption })}
                className="min-h-[48px] w-full appearance-none rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] pl-4 pr-10 text-sm font-medium text-[var(--m3-on-surface)] cursor-pointer"
              >
                <option value="updated_desc">Recently Updated</option>
                <option value="title_asc">Design Name (A–Z)</option>
                <option value="quantity_asc">Lowest Stock First</option>
                <option value="sku_asc">Design Code</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--m3-on-surface-variant)]"
                aria-hidden="true"
              />
            </div>

            <button
              type="button"
              onClick={toggleSelectionMode}
              aria-pressed={selectionMode}
              className={`inline-flex min-h-[48px] items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                selectionMode
                  ? 'border-[var(--m3-primary)] bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                  : 'border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] text-[var(--m3-on-surface)] hover:bg-[var(--m3-surface-container-low)]'
              }`}
            >
              <CheckSquare className="h-4 w-4" aria-hidden="true" />
              {selectionMode ? 'Cancel Select' : 'Select'}
            </button>

            <div
              role="group"
              aria-label="Layout view mode"
              className="flex items-center rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container)] p-1 shrink-0"
            >
              <button
                type="button"
                onClick={() => onViewModeChange('grid')}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-[var(--m3-surface-card)] text-[var(--m3-primary)] shadow-xs'
                    : 'text-[var(--m3-on-surface-variant)] hover:text-[var(--m3-on-surface)]'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('list')}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[var(--m3-surface-card)] text-[var(--m3-primary)] shadow-xs'
                    : 'text-[var(--m3-on-surface-variant)] hover:text-[var(--m3-on-surface)]'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Collection Category Segmented Filter Bar */}
        <div
          role="tablist"
          aria-label="Filter by collection category"
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
        >
          {(['All', ...INVENTORY_CATEGORIES] as const).map((cat) => {
            const active = filters.category === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() =>
                  onFiltersChange({ ...filters, category: cat as InventoryCategory | 'All' })
                }
                className={`min-h-[40px] rounded-xl px-4 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                    : 'bg-[var(--m3-surface-container-low)] text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container-high)] hover:text-[var(--m3-on-surface)]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Contextual Batch Action Bar (shown when checkbox selection mode is active) */}
        {selectionMode && (
          <div
            role="region"
            aria-label="Batch selection actions"
            data-testid="batch-action-bar"
            className="rounded-3xl border border-[var(--m3-primary)]/40 bg-[var(--m3-surface-container-low)] p-3.5 sm:px-5 sm:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
          >
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex min-h-[44px] items-center gap-2.5 cursor-pointer select-none pr-1">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={handleToggleSelectAllVisible}
                  disabled={visibleIds.length === 0}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                    allVisibleSelected
                      ? 'border-[var(--m3-primary)] bg-[var(--m3-primary)] text-[var(--m3-on-primary)]'
                      : 'border-[var(--m3-outline)] bg-[var(--m3-surface-card)]'
                  }`}
                >
                  {allVisibleSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </span>
                <span className="text-sm font-semibold text-[var(--m3-on-surface)] whitespace-nowrap">
                  {allVisibleSelected ? 'Deselect All' : `Select All (${visibleIds.length})`}
                </span>
              </label>

              <span aria-hidden="true" className="text-[var(--m3-outline)]">
                ·
              </span>

              <span
                data-testid="selected-count"
                className="font-mono text-sm font-semibold text-[var(--m3-primary)] tabular-nums whitespace-nowrap"
              >
                {selectedIds.length} selected
              </span>

              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds([]);
                    setConfirmBatchDelete(false);
                  }}
                  className="text-xs font-semibold text-[var(--m3-on-surface-variant)] hover:text-[var(--m3-on-surface)] underline underline-offset-2 whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Batch Status Update Control */}
              <div className="flex items-center gap-2 flex-1 sm:flex-none">
                <label htmlFor="batch-status-select" className="sr-only">
                  Target status for selected designs
                </label>
                <div className="relative flex-1 sm:flex-none">
                  <select
                    id="batch-status-select"
                    value={batchStatus}
                    onChange={(e) => setBatchStatus(e.target.value as InventoryStatus)}
                    disabled={batchBusy}
                    className="min-h-[44px] w-full appearance-none rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] pl-3.5 pr-9 text-sm font-medium text-[var(--m3-on-surface)] cursor-pointer"
                  >
                    {INVENTORY_STATUSES.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--m3-on-surface-variant)]"
                    aria-hidden="true"
                  />
                </div>

                <button
                  type="button"
                  disabled={selectedIds.length === 0 || batchBusy}
                  onClick={() => void handleApplyBatchStatus()}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[var(--m3-primary)] px-4 text-sm font-semibold text-[var(--m3-on-primary)] transition-transform active:scale-[0.98] disabled:opacity-45 whitespace-nowrap shrink-0"
                >
                  {batchBusy ? 'Updating...' : 'Update Status'}
                </button>
              </div>

              {/* Batch Delete Control with Inline Confirmation */}
              {!confirmBatchDelete ? (
                <button
                  type="button"
                  disabled={selectedIds.length === 0 || batchBusy}
                  onClick={() => setConfirmBatchDelete(true)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl border border-red-300 bg-red-50 px-4 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-45 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </button>
              ) : (
                <div className="flex items-center gap-1.5 rounded-2xl border border-red-300 bg-red-50 px-2.5 py-1 dark:border-red-900 dark:bg-red-950/40">
                  <button
                    type="button"
                    disabled={batchBusy}
                    onClick={() => void handleConfirmBatchDelete()}
                    className="min-h-[36px] rounded-xl bg-red-700 px-3 text-xs font-semibold text-white whitespace-nowrap"
                  >
                    Confirm Delete ({selectedIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmBatchDelete(false)}
                    aria-label="Cancel batch delete"
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--m3-on-surface-variant)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Catalogue Items */}
      {loading ? (
        <section
          aria-label="Loading design catalogue"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          {[0, 1, 2].map((n) => (
            <div
              key={n}
              className="overflow-hidden rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)]"
            >
              <div className="aspect-[4/3] bg-[var(--m3-surface-container)] animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="h-3.5 w-28 rounded bg-[var(--m3-surface-container)] animate-pulse" />
                <div className="h-5 w-3/4 rounded bg-[var(--m3-surface-container)] animate-pulse" />
              </div>
            </div>
          ))}
        </section>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-10 text-center">
          <p className="font-display text-lg font-bold">No matching garment designs</p>
          <p className="mt-1.5 text-sm text-[var(--m3-on-surface-variant)]">
            Try clearing your search or category filter, or upload a new Salwar Kameez design.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {(filters.query || filters.category !== 'All' || filters.status !== 'All') && (
              <button
                type="button"
                onClick={() =>
                  onFiltersChange({
                    query: '',
                    category: 'All',
                    status: 'All',
                    sort: filters.sort,
                  })
                }
                className="min-h-[44px] rounded-2xl border border-[var(--m3-outline-variant)] px-5 text-sm font-semibold"
              >
                Reset Filters
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAdd}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[var(--m3-primary)] px-5 text-sm font-semibold text-[var(--m3-on-primary)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Design
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <section
          aria-label="Salwar Kameez design catalogue"
          data-testid="catalogue-grid"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          {filteredItems.map((item, idx) => {
            const imgSrc = item.previewUrl || item.mediaKey;
            const isPending = item.syncState !== 'synced';
            const sizes = sortSizesLogically(item.sizes);
            const priceLabel = getPriceRangeLabel(sizes);
            const isSelected = selectedSet.has(item.id);

            const cardInner = (
              <>
                <div className="relative w-full overflow-hidden">
                  <ResilientImage
                    src={imgSrc}
                    alt={item.title}
                    aspectClassName="aspect-[4/3]"
                    priority={idx < 3}
                    className="transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  {selectionMode && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-xl border-2 shadow-sm transition-colors ${
                        isSelected
                          ? 'border-[var(--m3-primary)] bg-[var(--m3-primary)] text-[var(--m3-on-primary)]'
                          : 'border-white/90 bg-black/35 text-transparent backdrop-blur-xs'
                      }`}
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between p-4 sm:p-5 gap-3.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-[var(--m3-on-surface-variant)]">
                      <span className="truncate">
                        <span className="font-mono font-medium">{item.sku}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{item.category}</span>
                        <span aria-hidden="true"> · </span>
                        <span className={statusTextClass(item.status)}>
                          {formatStatusLabel(item.status)}
                        </span>
                      </span>
                      {isPending && (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-semibold shrink-0">
                          <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
                          Queued
                        </span>
                      )}
                    </div>

                    <h3 className="font-display text-lg font-bold leading-snug text-[var(--m3-on-surface)] line-clamp-2">
                      {item.title}
                    </h3>

                    <p className="text-xs text-[var(--m3-on-surface-variant)] truncate">
                      {item.rawMaterials.colorShade || item.rawMaterials.topFabric}
                    </p>
                  </div>

                  {/* Compact Size-Stock Cells Strip */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap gap-1.5" aria-label="Stock by size">
                      {sizes.map((s) => {
                        const isOut = s.stock === 0;
                        const isLow = s.stock > 0 && s.stock <= item.minThreshold;
                        return (
                          <span
                            key={s.size}
                            className={`inline-flex items-center gap-1 px-2 py-1 font-mono text-[11px] tabular-nums ${
                              isOut
                                ? 'rounded-md border border-dashed border-[var(--m3-outline)] text-[var(--m3-on-surface-variant)]'
                                : isLow
                                ? 'rounded-md bg-amber-100 text-amber-950 font-semibold dark:bg-amber-950/60 dark:text-amber-200'
                                : 'rounded-lg bg-[var(--m3-surface-container)] text-[var(--m3-on-surface)] font-medium'
                            }`}
                          >
                            <span>{s.size}</span>
                            <span className="opacity-75">{isOut ? '—' : s.stock}</span>
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--m3-outline-variant)] text-xs">
                      <span className="text-[var(--m3-on-surface-variant)] truncate">
                        {item.lastKarigarName ? `Last: ${item.lastKarigarName}` : item.location}
                      </span>
                      <span className="font-mono font-bold text-sm text-[var(--m3-primary)] tabular-nums shrink-0">
                        {priceLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            );

            if (selectionMode) {
              return (
                <label
                  key={item.id}
                  data-testid={`catalogue-card-${item.sku}`}
                  className={`group cursor-pointer select-none text-left overflow-hidden rounded-3xl border bg-[var(--m3-surface-card)] transition-transform duration-150 active:scale-[0.99] focus-within:ring-2 focus-within:ring-[var(--m3-primary)] flex flex-col ${
                    isSelected
                      ? 'border-[var(--m3-primary)] ring-2 ring-[var(--m3-primary)]/40'
                      : 'border-[var(--m3-outline-variant)] hover:-translate-y-0.5'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleItem(item.id)}
                    aria-label={`Select ${item.title}`}
                    className="sr-only"
                  />
                  {cardInner}
                </label>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                data-testid={`catalogue-card-${item.sku}`}
                onClick={() => onSelectItem(item)}
                className="group text-left overflow-hidden rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[var(--m3-primary)] flex flex-col"
              >
                {cardInner}
              </button>
            );
          })}
        </section>
      ) : (
        <section
          aria-label="Design list view"
          data-testid="catalogue-list"
          className="overflow-hidden rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] divide-y divide-[var(--m3-outline-variant)]"
        >
          {filteredItems.map((item) => {
            const imgSrc = item.previewUrl || item.mediaKey;
            const isPending = item.syncState !== 'synced';
            const isSelected = selectedSet.has(item.id);

            const rowInner = (
              <>
                {selectionMode && (
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                      isSelected
                        ? 'border-[var(--m3-primary)] bg-[var(--m3-primary)] text-[var(--m3-on-primary)]'
                        : 'border-[var(--m3-outline)] bg-[var(--m3-surface-card)] text-transparent'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                )}
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--m3-outline-variant)]">
                  <ResilientImage src={imgSrc} alt={item.title} aspectClassName="h-full w-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-[var(--m3-on-surface-variant)]">
                    <span className="font-mono">{item.sku}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.category}</span>
                    {item.lastKarigarName && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">Last: {item.lastKarigarName}</span>
                      </>
                    )}
                  </div>
                  <p className="mt-0.5 font-display text-sm sm:text-base font-bold truncate">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--m3-on-surface-variant)] truncate">
                    {item.rawMaterials.topFabric}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm font-bold tabular-nums text-[var(--m3-primary)]">
                    {getPriceRangeLabel(item.sizes)}
                  </div>
                  <div className={`text-xs font-mono tabular-nums ${statusTextClass(item.status)}`}>
                    {item.quantity} pcs · {isPending ? 'Queued' : formatStatusLabel(item.status)}
                  </div>
                </div>
              </>
            );

            if (selectionMode) {
              return (
                <label
                  key={item.id}
                  data-testid={`catalogue-row-${item.sku}`}
                  className={`flex w-full cursor-pointer select-none items-center gap-4 p-3.5 sm:px-5 text-left transition-colors ${
                    isSelected
                      ? 'bg-[var(--m3-primary-container)]/35'
                      : 'hover:bg-[var(--m3-surface-container-low)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleItem(item.id)}
                    aria-label={`Select ${item.title}`}
                    className="sr-only"
                  />
                  {rowInner}
                </label>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                data-testid={`catalogue-row-${item.sku}`}
                onClick={() => onSelectItem(item)}
                className="flex w-full items-center gap-4 p-3.5 sm:px-5 text-left transition-colors hover:bg-[var(--m3-surface-container-low)]"
              >
                {rowInner}
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
};
