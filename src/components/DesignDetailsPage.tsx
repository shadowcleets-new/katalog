import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CloudOff,
  Crop,
  Edit3,
  HardDrive,
  Minus,
  Pencil,
  Plus,
  Scissors,
  SwatchBook,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  KARIGAR_STAGES,
  SCHEMA_LIMITS,
  STANDARD_SIZES,
  type InventoryItem,
  type KarigarStageEntry,
  type PhotoAspectPreset,
  type PhotoFilterPreset,
  type RawMaterialSpec,
  type SizeInventoryEntry,
} from '../types/inventory';
import {
  computeTotalStockFromSizes,
  formatInr,
  formatStatusLabel,
  getPriceRangeLabel,
  sortSizesLogically,
} from '../utils/inventoryLogic';
import { ResilientImage } from './ResilientImage';
import { PhotoEditorModal } from './PhotoEditorModal';

interface DesignDetailsPageProps {
  item: InventoryItem;
  knownKarigars: string[];
  isOnline: boolean;
  onBack: () => void;
  onUpdateSizes: (item: InventoryItem, nextSizes: SizeInventoryEntry[]) => Promise<void>;
  onLogKarigarHandover: (
    item: InventoryItem,
    handover: KarigarStageEntry,
    nextRoster: KarigarStageEntry[]
  ) => Promise<void>;
  onRemoveKarigarLog: (item: InventoryItem, index: number) => Promise<void>;
  onUpdateRawMaterials: (item: InventoryItem, nextMaterials: RawMaterialSpec) => Promise<void>;
  onUpdatePhoto: (
    item: InventoryItem,
    photoDataUrl: string,
    aspect: PhotoAspectPreset,
    filter: PhotoFilterPreset
  ) => Promise<void>;
  onOpenFullEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => Promise<void>;
}

function getTodayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DesignDetailsPage: React.FC<DesignDetailsPageProps> = ({
  item,
  knownKarigars,
  isOnline,
  onBack,
  onUpdateSizes,
  onLogKarigarHandover,
  onRemoveKarigarLog,
  onUpdateRawMaterials,
  onUpdatePhoto,
  onOpenFullEdit,
  onDelete,
}) => {
  const sortedSizes = useMemo(() => sortSizesLogically(item.sizes), [item.sizes]);

  // Size Matrix & Per-Size Pricing Editor State
  const [editingMatrix, setEditingMatrix] = useState(false);
  const [draftSizes, setDraftSizes] = useState<SizeInventoryEntry[]>(sortedSizes);
  const [newSizeLabel, setNewSizeLabel] = useState('');
  const [newSizeStock, setNewSizeStock] = useState('6');
  const [newSizePrice, setNewSizePrice] = useState(() =>
    String(sortedSizes[sortedSizes.length - 1]?.price ?? 1800)
  );
  const [matrixError, setMatrixError] = useState<string | null>(null);
  const [savingMatrix, setSavingMatrix] = useState(false);

  // Karigar Handover State
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverStage, setHandoverStage] = useState<string>(KARIGAR_STAGES[0]);
  const [handoverName, setHandoverName] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverDate, setHandoverDate] = useState(getTodayIso);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [savingHandover, setSavingHandover] = useState(false);

  // Raw Materials Inline Edit State
  const [editingMaterials, setEditingMaterials] = useState(false);
  const [draftMaterials, setDraftMaterials] = useState<RawMaterialSpec>(item.rawMaterials);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [savingMaterials, setSavingMaterials] = useState(false);

  // Photo Editor & Delete Confirm
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const imgSrc = item.previewUrl || item.mediaKey;
  const totalPieces = computeTotalStockFromSizes(item.sizes);
  const priceRange = getPriceRangeLabel(item.sizes);
  const lowSizeCount = sortedSizes.filter((s) => s.stock > 0 && s.stock <= item.minThreshold).length;
  const outSizeCount = sortedSizes.filter((s) => s.stock === 0).length;

  const missingStandardSizes = STANDARD_SIZES.filter(
    (std) => !draftSizes.some((d) => d.size.toUpperCase() === std)
  );

  // Quick stock adjustment right on a size row
  const handleStepSizeStock = async (sizeLabel: string, delta: number) => {
    setBusyAction(true);
    try {
      const next = sortedSizes.map((entry) =>
        entry.size === sizeLabel
          ? { ...entry, stock: Math.max(0, Math.min(SCHEMA_LIMITS.SIZE_STOCK_MAX, entry.stock + delta)) }
          : entry
      );
      await onUpdateSizes(item, next);
    } finally {
      setBusyAction(false);
    }
  };

  const openMatrixEditor = () => {
    setDraftSizes(sortedSizes.map((s) => ({ ...s })));
    setNewSizeLabel('');
    setNewSizeStock('6');
    setNewSizePrice(String(sortedSizes[sortedSizes.length - 1]?.price ?? 1800));
    setMatrixError(null);
    setEditingMatrix(true);
  };

  const handleAddSizeRow = (presetLabel?: string) => {
    const label = (presetLabel ?? newSizeLabel).trim().toUpperCase();
    if (!label) {
      setMatrixError('Enter a size label (for example S, XL, 4XL, or Free).');
      return;
    }
    if (label.length > SCHEMA_LIMITS.SIZE_LABEL_MAX) {
      setMatrixError(`Size label cannot exceed ${SCHEMA_LIMITS.SIZE_LABEL_MAX} characters.`);
      return;
    }
    if (draftSizes.length >= SCHEMA_LIMITS.SIZES_MAX) {
      setMatrixError(`Maximum ${SCHEMA_LIMITS.SIZES_MAX} sizes allowed per design.`);
      return;
    }
    if (draftSizes.some((s) => s.size.toUpperCase() === label)) {
      setMatrixError(`Size "${label}" is already in the ledger.`);
      return;
    }
    const stock = Math.max(0, Number.parseInt(newSizeStock, 10) || 0);
    const price = Math.max(0, Number.parseInt(newSizePrice, 10) || 0);
    setDraftSizes((prev) => sortSizesLogically([...prev, { size: label, stock, price }]));
    setNewSizeLabel('');
    setMatrixError(null);
  };

  const handleSaveMatrix = async () => {
    if (draftSizes.length === 0) {
      setMatrixError('Keep at least one size in the garment ledger.');
      return;
    }
    for (const row of draftSizes) {
      if (!Number.isInteger(row.stock) || row.stock < 0) {
        setMatrixError(`Invalid stock value for size ${row.size}.`);
        return;
      }
      if (!Number.isInteger(row.price) || row.price < 0) {
        setMatrixError(`Invalid INR price for size ${row.size}.`);
        return;
      }
    }
    setSavingMatrix(true);
    try {
      await onUpdateSizes(item, sortSizesLogically(draftSizes));
      setEditingMatrix(false);
    } finally {
      setSavingMatrix(false);
    }
  };

  const handleSaveHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = handoverName.trim();
    const cleanStage = handoverStage.trim();
    const cleanNote = handoverNote.trim();
    const cleanDate = handoverDate.trim() || getTodayIso();

    if (cleanName.length < 2) {
      setHandoverError('Enter the Karigar or workshop name.');
      return;
    }
    if (cleanName.length > SCHEMA_LIMITS.KARIGAR_NAME_MAX) {
      setHandoverError(`Karigar name cannot exceed ${SCHEMA_LIMITS.KARIGAR_NAME_MAX} characters.`);
      return;
    }

    const entry: KarigarStageEntry = {
      stage: cleanStage.slice(0, SCHEMA_LIMITS.KARIGAR_STAGE_MAX),
      karigarName: cleanName,
      unitOrNote: cleanNote.slice(0, SCHEMA_LIMITS.KARIGAR_NOTE_MAX),
      dateGiven: cleanDate.slice(0, SCHEMA_LIMITS.KARIGAR_DATE_MAX),
    };

    // Place latest handover first and cap at SCHEMA_LIMITS.KARIGARS_MAX
    const nextRoster = [entry, ...item.karigars].slice(0, SCHEMA_LIMITS.KARIGARS_MAX);

    setSavingHandover(true);
    try {
      await onLogKarigarHandover(item, entry, nextRoster);
      setHandoverName('');
      setHandoverNote('');
      setHandoverDate(getTodayIso());
      setHandoverError(null);
      setHandoverOpen(false);
    } finally {
      setSavingHandover(false);
    }
  };

  const openMaterialsEditor = () => {
    setDraftMaterials({ ...item.rawMaterials });
    setMaterialsError(null);
    setEditingMaterials(true);
  };

  const handleSaveMaterials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftMaterials.topFabric.trim()) {
      setMaterialsError('Enter the Kameez / top fabric.');
      return;
    }
    if (!draftMaterials.colorShade.trim()) {
      setMaterialsError('Enter the colour or dye shade.');
      return;
    }
    setSavingMaterials(true);
    try {
      await onUpdateRawMaterials(item, {
        topFabric: draftMaterials.topFabric.trim().slice(0, SCHEMA_LIMITS.FABRIC_MAX),
        colorShade: draftMaterials.colorShade.trim().slice(0, SCHEMA_LIMITS.COLOR_MAX),
        bottomFabric: draftMaterials.bottomFabric.trim().slice(0, SCHEMA_LIMITS.FABRIC_MAX),
        dupattaFabric: draftMaterials.dupattaFabric.trim().slice(0, SCHEMA_LIMITS.FABRIC_MAX),
        materialNotes: draftMaterials.materialNotes.trim().slice(0, SCHEMA_LIMITS.MATERIAL_NOTES_MAX),
      });
      setEditingMaterials(false);
    } finally {
      setSavingMaterials(false);
    }
  };

  return (
    <div data-testid="design-details-page" className="space-y-6">
      {/* Page Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--m3-outline-variant)]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] px-4 text-sm font-semibold text-[var(--m3-on-surface)] hover:bg-[var(--m3-surface-container)] whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Catalogue
          </button>
          <div className="min-w-0 text-xs text-[var(--m3-on-surface-variant)] hidden sm:flex items-center gap-2">
            <span className="font-mono font-semibold text-[var(--m3-on-surface)]">{item.sku}</span>
            <span aria-hidden="true">·</span>
            <span>{item.category}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{item.location}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenFullEdit(item)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[var(--m3-primary-container)] px-4 text-sm font-semibold text-[var(--m3-on-primary-container)] hover:opacity-90 whitespace-nowrap"
          >
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            Edit Design
          </button>

          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label={`Delete ${item.title}`}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-2xl border border-red-300 bg-red-50 px-2.5 py-1 dark:border-red-900 dark:bg-red-950/40">
              <button
                type="button"
                disabled={busyAction}
                onClick={async () => {
                  setBusyAction(true);
                  await onDelete(item);
                  onBack();
                }}
                className="min-h-[36px] rounded-xl bg-red-700 px-3 text-xs font-semibold text-white whitespace-nowrap"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                aria-label="Cancel delete"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--m3-on-surface-variant)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main 2-Column Garment Details Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Garment Photography + Overview + Packing Notes */}
        <div className="lg:col-span-5 space-y-5">
          <div className="overflow-hidden rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)]">
            <div className="relative">
              <ResilientImage
                src={imgSrc}
                alt={item.title}
                aspectClassName="aspect-[4/3]"
                priority
              />
              <button
                type="button"
                onClick={() => setPhotoEditorOpen(true)}
                className="absolute right-3 bottom-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl bg-[var(--m3-surface-card)]/92 px-3.5 text-xs font-semibold text-[var(--m3-on-surface)] border border-[var(--m3-outline-variant)] shadow-sm backdrop-blur-xs hover:bg-[var(--m3-surface-card)] whitespace-nowrap"
              >
                <Crop className="h-3.5 w-3.5 text-[var(--m3-primary)]" aria-hidden="true" />
                Edit Photo
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--m3-on-surface-variant)]">
                  <span className="font-mono font-semibold text-[var(--m3-primary)]">{item.sku}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatStatusLabel(item.status)}</span>
                </div>
                <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--m3-on-surface)]">
                  {item.title}
                </h1>
                <p className="mt-1 text-sm text-[var(--m3-on-surface-variant)]">{item.location}</p>
              </div>

              {/* Clean 3-Stat Garment Ledger Summary */}
              <dl className="grid grid-cols-3 gap-3 pt-4 border-t border-[var(--m3-outline-variant)]">
                <div>
                  <dt className="text-xs text-[var(--m3-on-surface-variant)]">Ready Pieces</dt>
                  <dd
                    data-testid="design-total-stock"
                    className="mt-1 font-mono text-xl font-bold tabular-nums text-[var(--m3-on-surface)]"
                  >
                    {totalPieces}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-[var(--m3-on-surface-variant)]">Size Price Range</dt>
                  <dd className="mt-1 font-mono text-xl font-bold tabular-nums text-[var(--m3-primary)]">
                    {priceRange}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--m3-outline-variant)] text-xs text-[var(--m3-on-surface-variant)]">
                <span className="inline-flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-[var(--m3-primary)]" aria-hidden="true" />
                  {item.cachedOffline ? 'Cached offline on device' : 'Online media'}
                </span>
                {item.syncState !== 'synced' ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                    <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
                    Queued for sync
                  </span>
                ) : (
                  <span>
                    {isOnline ? 'Synced' : 'Local vault'} · Threshold ≤ {item.minThreshold}/size
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ironing, Packing & Dispatch Notes */}
          <section
            aria-labelledby="dispatch-notes-heading"
            className="rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-5 space-y-2"
          >
            <h2 id="dispatch-notes-heading" className="font-display text-base font-bold">
              Ironing, Packing & Dispatch Notes
            </h2>
            <p className="text-sm leading-relaxed text-[var(--m3-on-surface-variant)]">
              {item.notes || 'No packing or dispatch instructions recorded yet.'}
            </p>
          </section>
        </div>

        {/* Right Column: The 3 Core Manufacturing Sections */}
        <div className="lg:col-span-7 space-y-6">
          {/* SECTION 1: Full Size-Wise Stock & Distinct INR Pricing Ledger */}
          <section
            aria-labelledby="size-matrix-heading"
            className="rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="size-matrix-heading" className="font-display text-xl font-bold">
                  Size Stock & Pricing
                </h2>
                <p className="mt-0.5 text-xs text-[var(--m3-on-surface-variant)]">
                  All sizes visible together · Separate price per size in INR
                  {(lowSizeCount > 0 || outSizeCount > 0) && (
                    <>
                      {' · '}
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        {outSizeCount > 0 ? `${outSizeCount} out` : ''}
                        {outSizeCount > 0 && lowSizeCount > 0 ? ', ' : ''}
                        {lowSizeCount > 0 ? `${lowSizeCount} low` : ''}
                      </span>
                    </>
                  )}
                </p>
              </div>

              {!editingMatrix ? (
                <button
                  type="button"
                  onClick={openMatrixEditor}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 text-xs font-semibold text-[var(--m3-on-surface)] hover:bg-[var(--m3-surface-container-high)] whitespace-nowrap"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit Prices & Sizes
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMatrix(false);
                      setMatrixError(null);
                    }}
                    className="min-h-[40px] rounded-xl px-3 text-xs font-semibold text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingMatrix}
                    onClick={() => void handleSaveMatrix()}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--m3-primary)] px-4 text-xs font-semibold text-[var(--m3-on-primary)] whitespace-nowrap"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    {savingMatrix ? 'Saving...' : 'Save Ledger'}
                  </button>
                </div>
              )}
            </div>

            {!editingMatrix ? (
              <div className="divide-y divide-[var(--m3-outline-variant)] border-t border-[var(--m3-outline-variant)]">
                {/* Column Header */}
                <div className="grid grid-cols-12 items-center py-2.5 text-xs font-medium text-[var(--m3-on-surface-variant)]">
                  <span className="col-span-3 sm:col-span-3">Size</span>
                  <span className="col-span-6 sm:col-span-6">Ready Pieces</span>
                  <span className="col-span-3 sm:col-span-3 text-right">Rate (₹)</span>
                </div>

                {sortedSizes.map((entry) => {
                  const isOut = entry.stock === 0;
                  const isLow = entry.stock > 0 && entry.stock <= item.minThreshold;
                  return (
                    <div
                      key={entry.size}
                      data-testid={`size-row-${entry.size}`}
                      className="grid grid-cols-12 items-center gap-2 py-3"
                    >
                      {/* Signature Size Cell */}
                      <div className="col-span-3 sm:col-span-3 flex items-center gap-2">
                        <span
                          className={`inline-flex h-10 min-w-[44px] items-center justify-center px-2.5 font-mono text-sm font-bold tabular-nums ${
                            isOut
                              ? 'rounded-xl border border-dashed border-[var(--m3-outline)] text-[var(--m3-on-surface-variant)]'
                              : isLow
                              ? 'rounded-lg bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-200'
                              : 'rounded-2xl bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                          }`}
                        >
                          {entry.size}
                        </span>
                      </div>

                      {/* Quick Stock Stepper */}
                      <div className="col-span-6 sm:col-span-6 flex items-center gap-1.5 sm:gap-2">
                        <button
                          type="button"
                          disabled={busyAction || entry.stock <= 0}
                          onClick={() => void handleStepSizeStock(entry.size, -1)}
                          aria-label={`Decrease stock for size ${entry.size}`}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] hover:bg-[var(--m3-surface-container-high)] disabled:opacity-40"
                        >
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <span
                          data-testid={`size-stock-${entry.size}`}
                          className={`min-w-[36px] text-center font-mono text-base font-bold tabular-nums ${
                            isOut
                              ? 'text-[var(--m3-outline)]'
                              : isLow
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-[var(--m3-on-surface)]'
                          }`}
                        >
                          {isOut ? '—' : entry.stock}
                        </span>
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => void handleStepSizeStock(entry.size, 1)}
                          aria-label={`Increase stock for size ${entry.size}`}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)] hover:opacity-90 disabled:opacity-40"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => void handleStepSizeStock(entry.size, 5)}
                          aria-label={`Add 5 pieces to size ${entry.size}`}
                          className="hidden sm:inline-flex h-10 items-center justify-center rounded-xl border border-[var(--m3-outline-variant)] px-2.5 font-mono text-xs font-semibold text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container)]"
                        >
                          +5
                        </button>
                      </div>

                      {/* Right-Edge Aligned INR Price */}
                      <div className="col-span-3 sm:col-span-3 text-right">
                        <span
                          data-testid={`size-price-${entry.size}`}
                          className="font-mono text-sm sm:text-base font-bold tabular-nums text-[var(--m3-on-surface)]"
                        >
                          {formatInr(entry.price)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4 pt-2 border-t border-[var(--m3-outline-variant)]">
                <div className="space-y-2.5">
                  {draftSizes.map((row, idx) => (
                    <div
                      key={row.size}
                      className="grid grid-cols-12 items-center gap-2 rounded-2xl bg-[var(--m3-surface-container-low)] p-2.5"
                    >
                      <div className="col-span-3 sm:col-span-2 font-mono text-sm font-bold text-center">
                        {row.size}
                      </div>
                      <div className="col-span-4 sm:col-span-4">
                        <label htmlFor={`edit-stock-${row.size}`} className="sr-only">
                          Stock for size {row.size}
                        </label>
                        <input
                          id={`edit-stock-${row.size}`}
                          type="number"
                          min={0}
                          step={1}
                          value={row.stock}
                          onChange={(e) => {
                            const val = Math.max(0, Number.parseInt(e.target.value, 10) || 0);
                            setDraftSizes((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, stock: val } : r))
                            );
                          }}
                          className="min-h-[42px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] px-3 font-mono text-sm tabular-nums"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-4 relative">
                        <label htmlFor={`edit-price-${row.size}`} className="sr-only">
                          Price in rupees for size {row.size}
                        </label>
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[var(--m3-on-surface-variant)]">
                          ₹
                        </span>
                        <input
                          id={`edit-price-${row.size}`}
                          type="number"
                          min={0}
                          step={10}
                          value={row.price}
                          onChange={(e) => {
                            const val = Math.max(0, Number.parseInt(e.target.value, 10) || 0);
                            setDraftSizes((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, price: val } : r))
                            );
                          }}
                          className="min-h-[42px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] pl-7 pr-3 font-mono text-sm tabular-nums"
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-2 flex justify-end">
                        <button
                          type="button"
                          disabled={draftSizes.length <= 1}
                          onClick={() =>
                            setDraftSizes((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label={`Remove size ${row.size}`}
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--m3-on-surface-variant)] hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Another Size */}
                <div className="rounded-2xl border border-dashed border-[var(--m3-outline-variant)] p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--m3-on-surface)]">
                      Add Size to Ledger
                    </span>
                    {missingStandardSizes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {missingStandardSizes.map((std) => (
                          <button
                            key={std}
                            type="button"
                            onClick={() => handleAddSizeRow(std)}
                            className="min-h-[32px] rounded-lg border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] px-2.5 font-mono text-xs font-semibold hover:bg-[var(--m3-primary-container)]"
                          >
                            + {std}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-4">
                      <label htmlFor="new-size-label" className="sr-only">
                        Custom size label
                      </label>
                      <input
                        id="new-size-label"
                        type="text"
                        value={newSizeLabel}
                        onChange={(e) => setNewSizeLabel(e.target.value.toUpperCase())}
                        placeholder="Size (e.g. 4XL)"
                        className="min-h-[42px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] px-3 font-mono text-xs uppercase"
                      />
                    </div>
                    <div className="col-span-3">
                      <label htmlFor="new-size-stock" className="sr-only">
                        Initial stock
                      </label>
                      <input
                        id="new-size-stock"
                        type="number"
                        min={0}
                        value={newSizeStock}
                        onChange={(e) => setNewSizeStock(e.target.value)}
                        placeholder="Qty"
                        className="min-h-[42px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] px-3 font-mono text-xs tabular-nums"
                      />
                    </div>
                    <div className="col-span-3">
                      <label htmlFor="new-size-price" className="sr-only">
                        Price in INR
                      </label>
                      <input
                        id="new-size-price"
                        type="number"
                        min={0}
                        value={newSizePrice}
                        onChange={(e) => setNewSizePrice(e.target.value)}
                        placeholder="₹ Price"
                        className="min-h-[42px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] px-3 font-mono text-xs tabular-nums"
                      />
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => handleAddSizeRow()}
                        className="min-h-[42px] w-full rounded-xl bg-[var(--m3-primary-container)] text-xs font-semibold text-[var(--m3-on-primary-container)]"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {matrixError && (
                  <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                    {matrixError}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* SECTION 2: Karigar Assignment ("Last Given To" + Outsourced Craft Stages) */}
          <section
            aria-labelledby="karigar-section-heading"
            className="rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="karigar-section-heading" className="font-display text-xl font-bold">
                  Karigar & Craft Stages
                </h2>
                <p className="mt-0.5 text-xs text-[var(--m3-on-surface-variant)]">
                  Track who this garment was last given to and every outsourced craft stage.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHandoverOpen((open) => !open);
                  setHandoverError(null);
                }}
                aria-expanded={handoverOpen}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--m3-primary)] px-3.5 text-xs font-semibold text-[var(--m3-on-primary)] hover:opacity-95 whitespace-nowrap"
              >
                <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                {handoverOpen ? 'Close Handover' : 'Log Handover'}
              </button>
            </div>

            {/* Highlighted "Last Given To" Summary Card */}
            <div
              data-testid="last-karigar-card"
              className="rounded-2xl bg-[var(--m3-surface-container-low)] border border-[var(--m3-outline-variant)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]">
                  <UserCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--m3-on-surface-variant)]">
                    Last Given To
                  </p>
                  <p className="mt-0.5 text-base font-bold text-[var(--m3-on-surface)]">
                    {item.lastKarigarName || 'Not assigned yet'}
                  </p>
                  {item.lastKarigarStage && (
                    <p className="text-xs text-[var(--m3-on-surface-variant)]">
                      {item.lastKarigarStage}
                      {item.lastKarigarDate ? ` · ${item.lastKarigarDate}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <span className="font-mono text-xs text-[var(--m3-on-surface-variant)] tabular-nums shrink-0">
                {item.karigars.length} {item.karigars.length === 1 ? 'stage logged' : 'stages logged'}
              </span>
            </div>

            {/* Inline Log Karigar Handover Form */}
            {handoverOpen && (
              <form
                onSubmit={(e) => void handleSaveHandover(e)}
                className="rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] p-4 space-y-3"
              >
                <p className="text-xs font-semibold text-[var(--m3-on-surface)]">
                  Record Latest Karigar Handover
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="handover-stage" className="block text-xs font-medium mb-1">
                      Work Stage
                    </label>
                    <select
                      id="handover-stage"
                      value={handoverStage}
                      onChange={(e) => setHandoverStage(e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] px-3 text-sm"
                    >
                      {KARIGAR_STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="handover-name" className="block text-xs font-medium mb-1">
                      Karigar Name
                    </label>
                    <input
                      id="handover-name"
                      type="text"
                      list="known-karigars-list"
                      value={handoverName}
                      onChange={(e) => {
                        setHandoverName(e.target.value);
                        setHandoverError(null);
                      }}
                      placeholder="e.g., Imran Block Works"
                      className="min-h-[44px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] px-3 text-sm"
                    />
                    <datalist id="known-karigars-list">
                      {knownKarigars.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label htmlFor="handover-date" className="block text-xs font-medium mb-1">
                      Date Given
                    </label>
                    <input
                      id="handover-date"
                      type="date"
                      value={handoverDate}
                      onChange={(e) => setHandoverDate(e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] px-3 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="handover-note" className="block text-xs font-medium mb-1">
                      Workshop / Batch Note
                    </label>
                    <input
                      id="handover-note"
                      type="text"
                      value={handoverNote}
                      onChange={(e) => setHandoverNote(e.target.value)}
                      placeholder="e.g., Kurla · 20 pcs dupatta block print"
                      className="min-h-[44px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] px-3 text-sm"
                    />
                  </div>
                </div>

                {handoverError && (
                  <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                    {handoverError}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setHandoverOpen(false)}
                    className="min-h-[40px] rounded-xl px-4 text-xs font-semibold text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingHandover}
                    className="min-h-[40px] rounded-xl bg-[var(--m3-primary)] px-4 text-xs font-semibold text-[var(--m3-on-primary)] whitespace-nowrap"
                  >
                    {savingHandover ? 'Saving...' : 'Save Handover'}
                  </button>
                </div>
              </form>
            )}

            {/* Outsourced Stage Roster */}
            {item.karigars.length === 0 ? (
              <p className="text-sm text-[var(--m3-on-surface-variant)]">
                No craft stages logged yet. Tap Log Handover whenever pieces move between Karigars.
              </p>
            ) : (
              <ul
                data-testid="karigar-stage-list"
                className="divide-y divide-[var(--m3-outline-variant)] border-t border-[var(--m3-outline-variant)]"
              >
                {item.karigars.map((entry, idx) => (
                  <li
                    key={`${entry.karigarName}-${entry.stage}-${entry.dateGiven}-${idx}`}
                    className="flex items-start justify-between gap-3 py-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--m3-on-surface-variant)]">
                        <span className="font-semibold text-[var(--m3-primary)]">{entry.stage}</span>
                        {entry.dateGiven && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{entry.dateGiven}</span>
                          </>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm font-bold text-[var(--m3-on-surface)]">
                        {entry.karigarName}
                      </p>
                      {entry.unitOrNote && (
                        <p className="mt-0.5 text-xs text-[var(--m3-on-surface-variant)]">
                          {entry.unitOrNote}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void onRemoveKarigarLog(item, idx)}
                      aria-label={`Remove ${entry.karigarName} ${entry.stage} entry`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container)] hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* SECTION 3: Dedicated Raw Materials & Fabric Specifications */}
          <section
            aria-labelledby="raw-materials-heading"
            className="rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--m3-surface-container)] text-[var(--m3-primary)]">
                  <SwatchBook className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="raw-materials-heading" className="font-display text-xl font-bold">
                    Raw Materials & Fabric
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--m3-on-surface-variant)]">
                    Fabric quality, colour shade, dupatta craft, and market sourcing notes.
                  </p>
                </div>
              </div>

              {!editingMaterials && (
                <button
                  type="button"
                  onClick={openMaterialsEditor}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 text-xs font-semibold text-[var(--m3-on-surface)] hover:bg-[var(--m3-surface-container-high)] whitespace-nowrap"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit Materials
                </button>
              )}
            </div>

            {!editingMaterials ? (
              <dl
                data-testid="raw-materials-card"
                className="divide-y divide-[var(--m3-outline-variant)] border-t border-[var(--m3-outline-variant)] text-sm"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-4 py-3">
                  <dt className="sm:col-span-4 text-xs font-medium text-[var(--m3-on-surface-variant)]">
                    Top / Kameez Fabric
                  </dt>
                  <dd className="sm:col-span-8 font-medium text-[var(--m3-on-surface)]">
                    {item.rawMaterials.topFabric || 'Not specified'}
                  </dd>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-4 py-3">
                  <dt className="sm:col-span-4 text-xs font-medium text-[var(--m3-on-surface-variant)]">
                    Colour / Dye Shade
                  </dt>
                  <dd className="sm:col-span-8 font-medium text-[var(--m3-on-surface)]">
                    {item.rawMaterials.colorShade || 'Not specified'}
                  </dd>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-4 py-3">
                  <dt className="sm:col-span-4 text-xs font-medium text-[var(--m3-on-surface-variant)]">
                    Bottom / Salwar Fabric
                  </dt>
                  <dd className="sm:col-span-8 text-[var(--m3-on-surface)]">
                    {item.rawMaterials.bottomFabric || 'Not specified'}
                  </dd>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-4 py-3">
                  <dt className="sm:col-span-4 text-xs font-medium text-[var(--m3-on-surface-variant)]">
                    Dupatta Fabric & Craft
                  </dt>
                  <dd className="sm:col-span-8 text-[var(--m3-on-surface)]">
                    {item.rawMaterials.dupattaFabric || 'Not specified'}
                  </dd>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-4 py-3">
                  <dt className="sm:col-span-4 text-xs font-medium text-[var(--m3-on-surface-variant)]">
                    Additional Material Notes
                  </dt>
                  <dd className="sm:col-span-8 leading-relaxed text-[var(--m3-on-surface-variant)]">
                    {item.rawMaterials.materialNotes || 'No supplier, trim, or lining notes added yet.'}
                  </dd>
                </div>
              </dl>
            ) : (
              <form
                onSubmit={(e) => void handleSaveMaterials(e)}
                className="space-y-3 pt-3 border-t border-[var(--m3-outline-variant)]"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="rm-top-fabric" className="block text-xs font-medium mb-1">
                      Top / Kameez Fabric
                    </label>
                    <input
                      id="rm-top-fabric"
                      type="text"
                      value={draftMaterials.topFabric}
                      onChange={(e) =>
                        setDraftMaterials((m) => ({ ...m, topFabric: e.target.value }))
                      }
                      className="min-h-[44px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="rm-color-shade" className="block text-xs font-medium mb-1">
                      Colour / Dye Shade
                    </label>
                    <input
                      id="rm-color-shade"
                      type="text"
                      value={draftMaterials.colorShade}
                      onChange={(e) =>
                        setDraftMaterials((m) => ({ ...m, colorShade: e.target.value }))
                      }
                      className="min-h-[44px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="rm-bottom-fabric" className="block text-xs font-medium mb-1">
                      Bottom / Salwar Fabric
                    </label>
                    <input
                      id="rm-bottom-fabric"
                      type="text"
                      value={draftMaterials.bottomFabric}
                      onChange={(e) =>
                        setDraftMaterials((m) => ({ ...m, bottomFabric: e.target.value }))
                      }
                      className="min-h-[44px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="rm-dupatta-fabric" className="block text-xs font-medium mb-1">
                      Dupatta Fabric & Craft
                    </label>
                    <input
                      id="rm-dupatta-fabric"
                      type="text"
                      value={draftMaterials.dupattaFabric}
                      onChange={(e) =>
                        setDraftMaterials((m) => ({ ...m, dupattaFabric: e.target.value }))
                      }
                      className="min-h-[44px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 text-sm"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="rm-notes" className="block text-xs font-medium mb-1">
                      Additional Material Notes (Lining, Lace, Supplier, Dye Lot)
                    </label>
                    <textarea
                      id="rm-notes"
                      rows={3}
                      value={draftMaterials.materialNotes}
                      onChange={(e) =>
                        setDraftMaterials((m) => ({ ...m, materialNotes: e.target.value }))
                      }
                      className="w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] p-3 text-sm"
                    />
                  </div>
                </div>

                {materialsError && (
                  <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                    {materialsError}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingMaterials(false)}
                    className="min-h-[40px] rounded-xl px-4 text-xs font-semibold text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingMaterials}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--m3-primary)] px-4 text-xs font-semibold text-[var(--m3-on-primary)] whitespace-nowrap"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    {savingMaterials ? 'Saving...' : 'Save Materials'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>

      {/* Direct Photo Studio Editor triggered from Design Details */}
      {photoEditorOpen && imgSrc && (
        <PhotoEditorModal
          sourceUrl={imgSrc}
          initialParams={{ aspect: item.photoAspect, filter: item.photoFilter }}
          onCancel={() => setPhotoEditorOpen(false)}
          onApply={async (result) => {
            await onUpdatePhoto(item, result.dataUrl, result.aspect, result.filter);
            setPhotoEditorOpen(false);
          }}
        />
      )}
    </div>
  );
};
