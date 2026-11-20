import React, { useRef, useState } from 'react';
import { Camera, Crop, ImagePlus, Plus, Upload, X } from 'lucide-react';
import {
  INVENTORY_CATEGORIES,
  INVENTORY_STATUSES,
  KARIGAR_STAGES,
  SCHEMA_LIMITS,
  STANDARD_SIZES,
  type InventoryCategory,
  type InventoryFormValues,
  type InventoryItem,
  type InventoryStatus,
  type KarigarStageEntry,
  type PhotoAspectPreset,
  type PhotoFilterPreset,
  type SizeInventoryEntry,
} from '../types/inventory';
import {
  deriveDesignStatus,
  normalizeSku,
  sortSizesLogically,
  validateInventoryForm,
  type ValidationErrors,
} from '../utils/inventoryLogic';
import { SEED_MEDIA_SAMPLES } from '../data/seedInventory';
import { PhotoEditorModal } from './PhotoEditorModal';
import { ResilientImage } from './ResilientImage';

interface ItemFormSheetProps {
  existingItem?: InventoryItem | null;
  knownKarigars: string[];
  isOnline: boolean;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    values: InventoryFormValues;
    photoDataUrl?: string;
    mediaKey: string;
    photoFilter: PhotoFilterPreset;
    photoAspect: PhotoAspectPreset;
  }) => Promise<void>;
}

const DEFAULT_SIZES: SizeInventoryEntry[] = [
  { size: 'M', stock: 10, price: 1650 },
  { size: 'L', stock: 10, price: 1750 },
  { size: 'XL', stock: 8, price: 1850 },
  { size: 'XXL', stock: 6, price: 1950 },
];

function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const ItemFormSheet: React.FC<ItemFormSheetProps> = ({
  existingItem,
  knownKarigars,
  isOnline,
  onClose,
  onSave,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [sku, setSku] = useState(existingItem?.sku ?? '');
  const [title, setTitle] = useState(existingItem?.title ?? '');
  const [category, setCategory] = useState<InventoryCategory>(
    existingItem?.category ?? 'Chanderi'
  );
  const [location, setLocation] = useState(existingItem?.location ?? 'Rack A · Packing Unit 1');
  const [minThreshold, setMinThreshold] = useState(String(existingItem?.minThreshold ?? 5));
  const [status, setStatus] = useState<InventoryStatus>(existingItem?.status ?? 'in_stock');
  const [notes, setNotes] = useState(existingItem?.notes ?? '');

  // Per-Size Stock & Price Matrix
  const [sizes, setSizes] = useState<SizeInventoryEntry[]>(() =>
    existingItem ? sortSizesLogically(existingItem.sizes) : DEFAULT_SIZES
  );
  const [customSizeLabel, setCustomSizeLabel] = useState('');

  // Karigar Assignment
  const [lastKarigarName, setLastKarigarName] = useState(existingItem?.lastKarigarName ?? '');
  const [lastKarigarStage, setLastKarigarStage] = useState(
    existingItem?.lastKarigarStage || KARIGAR_STAGES[0]
  );
  const [lastKarigarDate, setLastKarigarDate] = useState(
    existingItem?.lastKarigarDate || getTodayIso()
  );
  const [karigarUnitNote, setKarigarUnitNote] = useState(
    existingItem?.karigars[0]?.unitOrNote ?? ''
  );

  // Raw Materials
  const [topFabric, setTopFabric] = useState(existingItem?.rawMaterials.topFabric ?? '');
  const [colorShade, setColorShade] = useState(existingItem?.rawMaterials.colorShade ?? '');
  const [bottomFabric, setBottomFabric] = useState(existingItem?.rawMaterials.bottomFabric ?? '');
  const [dupattaFabric, setDupattaFabric] = useState(
    existingItem?.rawMaterials.dupattaFabric ?? ''
  );
  const [materialNotes, setMaterialNotes] = useState(
    existingItem?.rawMaterials.materialNotes ?? ''
  );

  // Photography
  const [photoSourceUrl, setPhotoSourceUrl] = useState<string>(
    existingItem?.previewUrl || existingItem?.mediaKey || ''
  );
  const [editedDataUrl, setEditedDataUrl] = useState<string | undefined>(undefined);
  const [photoFilter, setPhotoFilter] = useState<PhotoFilterPreset>(
    existingItem?.photoFilter ?? 'original'
  );
  const [photoAspect, setPhotoAspect] = useState<PhotoAspectPreset>(
    existingItem?.photoAspect ?? '4:3'
  );
  const [editorOpen, setEditorOpen] = useState(false);

  const [errors, setErrors] = useState<ValidationErrors & { photo?: string }>({});
  const [saving, setSaving] = useState(false);

  const missingStandardSizes = STANDARD_SIZES.filter(
    (std) => !sizes.some((s) => s.size.toUpperCase() === std)
  );

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({
        ...prev,
        photo: 'Please select a valid image file (JPEG, PNG, or WebP).',
      }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      setPhotoSourceUrl(result);
      setEditedDataUrl(result);
      setErrors((prev) => ({ ...prev, photo: undefined }));
      setEditorOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handlePickSample = (path: string) => {
    setPhotoSourceUrl(path);
    setEditedDataUrl(undefined);
    setPhotoFilter('original');
    setPhotoAspect('4:3');
    setErrors((prev) => ({ ...prev, photo: undefined }));
  };

  const handleAddSize = (labelRaw: string) => {
    const label = labelRaw.trim().toUpperCase();
    if (!label || sizes.length >= SCHEMA_LIMITS.SIZES_MAX) return;
    if (sizes.some((s) => s.size.toUpperCase() === label)) {
      setErrors((prev) => ({ ...prev, sizes: `Size "${label}" is already added.` }));
      return;
    }
    const lastPrice = sizes[sizes.length - 1]?.price ?? 1750;
    setSizes((prev) => sortSizesLogically([...prev, { size: label, stock: 6, price: lastPrice }]));
    setCustomSizeLabel('');
    setErrors((prev) => ({ ...prev, sizes: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedThresh = Number.parseInt(minThreshold, 10);
    const cleanSizes = sortSizesLogically(sizes);
    const derivedStatus = deriveDesignStatus(
      cleanSizes,
      Number.isFinite(parsedThresh) ? parsedThresh : 5,
      status
    );

    const existingKarigars = existingItem?.karigars ?? [];
    const trimmedKarigar = lastKarigarName.trim();
    let nextKarigars: KarigarStageEntry[] = existingKarigars;
    if (trimmedKarigar) {
      const topMatches =
        existingKarigars[0]?.karigarName.toLowerCase() === trimmedKarigar.toLowerCase() &&
        existingKarigars[0]?.stage === lastKarigarStage;
      if (!topMatches) {
        nextKarigars = [
          {
            stage: lastKarigarStage,
            karigarName: trimmedKarigar,
            unitOrNote: karigarUnitNote.trim(),
            dateGiven: lastKarigarDate.trim() || getTodayIso(),
          },
          ...existingKarigars,
        ].slice(0, SCHEMA_LIMITS.KARIGARS_MAX);
      } else if (existingKarigars[0]) {
        nextKarigars = [
          {
            ...existingKarigars[0],
            unitOrNote: karigarUnitNote.trim(),
            dateGiven: lastKarigarDate.trim() || existingKarigars[0].dateGiven,
          },
          ...existingKarigars.slice(1),
        ];
      }
    }

    const formValues: InventoryFormValues = {
      sku: normalizeSku(sku),
      title: title.trim(),
      category,
      location: location.trim(),
      minThreshold: Number.isFinite(parsedThresh) ? parsedThresh : -1,
      status: derivedStatus,
      sizes: cleanSizes,
      lastKarigarName: trimmedKarigar,
      lastKarigarStage: trimmedKarigar ? lastKarigarStage : '',
      lastKarigarDate: trimmedKarigar ? lastKarigarDate.trim() : '',
      karigars: nextKarigars,
      rawMaterials: {
        topFabric: topFabric.trim(),
        colorShade: colorShade.trim(),
        bottomFabric: bottomFabric.trim(),
        dupattaFabric: dupattaFabric.trim(),
        materialNotes: materialNotes.trim(),
      },
      notes: notes.trim(),
    };

    const nextErrors: ValidationErrors & { photo?: string } = validateInventoryForm(formValues);
    if (!photoSourceUrl && !editedDataUrl) {
      nextErrors.photo = 'Upload a garment photo or pick a studio sample before saving.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const finalPreview = editedDataUrl ?? photoSourceUrl;
      const isCustomDataUrl = finalPreview.startsWith('data:');
      const mediaKey = isCustomDataUrl
        ? `local-media://photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        : finalPreview;

      await onSave({
        id: existingItem?.id,
        values: formValues,
        photoDataUrl: isCustomDataUrl ? finalPreview : undefined,
        mediaKey,
        photoFilter,
        photoAspect,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const activePreview = editedDataUrl ?? photoSourceUrl;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4 ${
          editorOpen ? '' : 'backdrop-blur-xs'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-form-heading"
      >
        <div className="flex max-h-[92vh] w-full sm:max-w-3xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-[var(--m3-surface-card)] text-[var(--m3-on-surface)] border border-[var(--m3-outline-variant)] shadow-2xl">
          <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
            <div className="h-1.5 w-10 rounded-full bg-[var(--m3-outline-variant)]" />
          </div>

          <header className="flex items-center justify-between gap-4 border-b border-[var(--m3-outline-variant)] px-5 py-3.5">
            <div>
              <h2 id="item-form-heading" className="font-display text-lg font-bold">
                {existingItem ? 'Edit Garment Design' : 'Add Salwar Kameez Design'}
              </h2>
              <p className="text-xs text-[var(--m3-on-surface-variant)]">
                {isOnline
                  ? 'Saves locally and syncs to Firestore'
                  : 'Offline mode · Saves locally and queues for automatic sync'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close design form"
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container)]"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            noValidate
            className="flex-1 overflow-y-auto p-5 space-y-6"
          >
            {/* 1. Garment Photograph */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Garment Photograph</span>
                {activePreview && (
                  <button
                    type="button"
                    onClick={() => setEditorOpen(true)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--m3-primary-container)] px-3.5 text-xs font-semibold text-[var(--m3-on-primary-container)] hover:opacity-90"
                  >
                    <Crop className="h-3.5 w-3.5" aria-hidden="true" />
                    Crop, Rotate & Filter
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelected}
                className="sr-only"
                aria-label="Upload garment photograph"
              />

              {activePreview ? (
                <div className="relative overflow-hidden rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container)]">
                  <ResilientImage
                    src={activePreview}
                    alt={title || 'Selected garment design preview'}
                    aspectClassName="aspect-[16/9]"
                    priority
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--m3-surface-container-low)] px-4 py-2.5 text-xs text-[var(--m3-on-surface-variant)]">
                    <span>
                      Frame: {photoAspect} · Filter: {photoFilter}
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="font-semibold text-[var(--m3-primary)] hover:underline"
                    >
                      Replace photo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] p-6 text-center">
                  <ImagePlus
                    className="mx-auto h-8 w-8 text-[var(--m3-primary)]"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-sm font-semibold">Upload or capture a garment photo</p>
                  <p className="mt-1 text-xs text-[var(--m3-on-surface-variant)]">
                    Opens in Photo Studio Editor for cropping, rotation, and lighting filters.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[var(--m3-primary)] px-4 text-sm font-semibold text-[var(--m3-on-primary)]"
                    >
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      Choose Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] px-4 text-sm font-semibold"
                    >
                      <Camera className="h-4 w-4" aria-hidden="true" />
                      Camera
                    </button>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-[var(--m3-on-surface-variant)] mb-2">
                  Or pick a studio Salwar Kameez sample photo:
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {SEED_MEDIA_SAMPLES.map((sample) => (
                    <button
                      key={sample.path}
                      type="button"
                      onClick={() => handlePickSample(sample.path)}
                      aria-label={`Use sample photo: ${sample.label}`}
                      className={`overflow-hidden rounded-xl border-2 transition-transform active:scale-95 ${
                        activePreview === sample.path
                          ? 'border-[var(--m3-primary)]'
                          : 'border-transparent hover:border-[var(--m3-outline-variant)]'
                      }`}
                    >
                      <ResilientImage
                        src={sample.path}
                        alt={sample.label}
                        aspectClassName="aspect-[4/3]"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {errors.photo && (
                <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                  {errors.photo}
                </p>
              )}
            </div>

            {/* 2. Design Identity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--m3-outline-variant)]">
              <div className="sm:col-span-2">
                <label htmlFor="item-title" className="block text-sm font-medium mb-1">
                  Design Name
                </label>
                <input
                  id="item-title"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                  placeholder="e.g., Rosewood Chanderi Silk Straight Suit"
                  className="min-h-[46px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-4 text-sm"
                />
                {errors.title && (
                  <p role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    {errors.title}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="item-sku" className="block text-sm font-medium mb-1">
                  Design Code (SKU)
                </label>
                <input
                  id="item-sku"
                  type="text"
                  value={sku}
                  onChange={(e) => {
                    setSku(e.target.value.toUpperCase());
                    setErrors((prev) => ({ ...prev, sku: undefined }));
                  }}
                  placeholder="SK-710-CHR"
                  className="min-h-[46px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-4 font-mono text-sm uppercase"
                />
                {errors.sku && (
                  <p role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    {errors.sku}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="item-category" className="block text-sm font-medium mb-1">
                  Collection Category
                </label>
                <select
                  id="item-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as InventoryCategory)}
                  className="min-h-[46px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-4 text-sm"
                >
                  {INVENTORY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="item-location" className="block text-sm font-medium mb-1">
                  Workshop Rack / Packing Shelf
                </label>
                <input
                  id="item-location"
                  type="text"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setErrors((prev) => ({ ...prev, location: undefined }));
                  }}
                  placeholder="Rack A · Packing Unit 1"
                  className="min-h-[46px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-4 text-sm"
                />
                {errors.location && (
                  <p role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    {errors.location}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="item-status" className="block text-sm font-medium mb-1">
                    Status
                  </label>
                  <select
                    id="item-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as InventoryStatus)}
                    className="min-h-[46px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3 text-sm"
                  >
                    {INVENTORY_STATUSES.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="item-threshold" className="block text-sm font-medium mb-1">
                    Low/Size Alert
                  </label>
                  <input
                    id="item-threshold"
                    type="number"
                    min={0}
                    step={1}
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(e.target.value)}
                    className="min-h-[46px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3 font-mono text-sm tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* 3. Per-Size Stock & Separate INR Prices */}
            <div className="space-y-3 pt-4 border-t border-[var(--m3-outline-variant)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Size Stock & Per-Size Pricing (₹)</h3>
                  <p className="text-xs text-[var(--m3-on-surface-variant)]">
                    Set ready quantity and distinct rate for each size.
                  </p>
                </div>
                {missingStandardSizes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {missingStandardSizes.map((std) => (
                      <button
                        key={std}
                        type="button"
                        onClick={() => handleAddSize(std)}
                        className="min-h-[32px] rounded-lg border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-2.5 font-mono text-xs font-semibold hover:bg-[var(--m3-primary-container)]"
                      >
                        + {std}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {sizes.map((row, idx) => (
                  <div
                    key={row.size}
                    className="grid grid-cols-12 items-center gap-2 rounded-2xl bg-[var(--m3-surface-container-low)] p-2.5"
                  >
                    <span className="col-span-2 text-center font-mono text-sm font-bold">
                      {row.size}
                    </span>
                    <div className="col-span-4">
                      <label htmlFor={`form-stock-${row.size}`} className="sr-only">
                        Pieces for size {row.size}
                      </label>
                      <input
                        id={`form-stock-${row.size}`}
                        type="number"
                        min={0}
                        step={1}
                        value={row.stock}
                        onChange={(e) => {
                          const val = Math.max(0, Number.parseInt(e.target.value, 10) || 0);
                          setSizes((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, stock: val } : r))
                          );
                        }}
                        placeholder="Qty"
                        className="min-h-[42px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] px-3 font-mono text-sm tabular-nums"
                      />
                    </div>
                    <div className="col-span-5 relative">
                      <label htmlFor={`form-price-${row.size}`} className="sr-only">
                        INR price for size {row.size}
                      </label>
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[var(--m3-on-surface-variant)]">
                        ₹
                      </span>
                      <input
                        id={`form-price-${row.size}`}
                        type="number"
                        min={0}
                        step={10}
                        value={row.price}
                        onChange={(e) => {
                          const val = Math.max(0, Number.parseInt(e.target.value, 10) || 0);
                          setSizes((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, price: val } : r))
                          );
                        }}
                        placeholder="Price"
                        className="min-h-[42px] w-full rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] pl-7 pr-3 font-mono text-sm tabular-nums"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        disabled={sizes.length <= 1}
                        onClick={() => setSizes((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label={`Remove size ${row.size}`}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--m3-on-surface-variant)] hover:text-red-700 disabled:opacity-30"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customSizeLabel}
                  onChange={(e) => setCustomSizeLabel(e.target.value.toUpperCase())}
                  placeholder="Add custom size (e.g. 4XL or Free)"
                  aria-label="Add custom size"
                  className="min-h-[42px] flex-1 rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 font-mono text-xs uppercase"
                />
                <button
                  type="button"
                  onClick={() => handleAddSize(customSizeLabel)}
                  className="inline-flex min-h-[42px] items-center gap-1 rounded-xl bg-[var(--m3-primary-container)] px-3.5 text-xs font-semibold text-[var(--m3-on-primary-container)] whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add Size
                </button>
              </div>

              {errors.sizes && (
                <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                  {errors.sizes}
                </p>
              )}
            </div>

            {/* 4. Last Given To (Karigar) */}
            <div className="space-y-3 pt-4 border-t border-[var(--m3-outline-variant)]">
              <h3 className="text-sm font-semibold">Last Karigar Assignment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="form-karigar-name" className="block text-xs font-medium mb-1">
                    Last Given To (Karigar Name)
                  </label>
                  <input
                    id="form-karigar-name"
                    type="text"
                    list="form-known-karigars"
                    value={lastKarigarName}
                    onChange={(e) => setLastKarigarName(e.target.value)}
                    placeholder="e.g., Salim Master"
                    className="min-h-[44px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 text-sm"
                  />
                  <datalist id="form-known-karigars">
                    {knownKarigars.map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label htmlFor="form-karigar-stage" className="block text-xs font-medium mb-1">
                    Craft Stage
                  </label>
                  <select
                    id="form-karigar-stage"
                    value={lastKarigarStage}
                    onChange={(e) => setLastKarigarStage(e.target.value)}
                    className="min-h-[44px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 text-sm"
                  >
                    {KARIGAR_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="form-karigar-date" className="block text-xs font-medium mb-1">
                    Date Given
                  </label>
                  <input
                    id="form-karigar-date"
                    type="date"
                    value={lastKarigarDate}
                    onChange={(e) => setLastKarigarDate(e.target.value)}
                    className="min-h-[44px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 font-mono text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="form-karigar-note" className="block text-xs font-medium mb-1">
                    Workshop / Batch Note
                  </label>
                  <input
                    id="form-karigar-note"
                    type="text"
                    value={karigarUnitNote}
                    onChange={(e) => setKarigarUnitNote(e.target.value)}
                    placeholder="e.g., Dadar West Unit · Princess cut"
                    className="min-h-[44px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 5. Raw Materials & Fabric */}
            <div className="space-y-3 pt-4 border-t border-[var(--m3-outline-variant)]">
              <h3 className="text-sm font-semibold">Raw Materials & Fabric</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="form-top-fabric" className="block text-xs font-medium mb-1">
                    Top / Kameez Fabric
                  </label>
                  <input
                    id="form-top-fabric"
                    type="text"
                    value={topFabric}
                    onChange={(e) => {
                      setTopFabric(e.target.value);
                      setErrors((prev) => ({ ...prev, topFabric: undefined }));
                    }}
                    placeholder="e.g., Pure Chanderi Silk-Cotton 80×80"
                    className="min-h-[44px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 text-sm"
                  />
                  {errors.topFabric && (
                    <p role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                      {errors.topFabric}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="form-color-shade" className="block text-xs font-medium mb-1">
                    Colour / Dye Shade
                  </label>
                  <input
                    id="form-color-shade"
                    type="text"
                    value={colorShade}
                    onChange={(e) => {
                      setColorShade(e.target.value);
                      setErrors((prev) => ({ ...prev, colorShade: undefined }));
                    }}
                    placeholder="e.g., Dusty Rosewood Pink (Lot #RW-42)"
                    className="min-h-[44px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 text-sm"
                  />
                  {errors.colorShade && (
                    <p role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                      {errors.colorShade}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="form-bottom-fabric" className="block text-xs font-medium mb-1">
                    Bottom / Salwar Fabric
                  </label>
                  <input
                    id="form-bottom-fabric"
                    type="text"
                    value={bottomFabric}
                    onChange={(e) => setBottomFabric(e.target.value)}
                    placeholder="e.g., Shantoon Tapered Pant (2.25m)"
                    className="min-h-[44px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="form-dupatta-fabric" className="block text-xs font-medium mb-1">
                    Dupatta Fabric & Craft
                  </label>
                  <input
                    id="form-dupatta-fabric"
                    type="text"
                    value={dupattaFabric}
                    onChange={(e) => setDupattaFabric(e.target.value)}
                    placeholder="e.g., Tissue Organza with zari border"
                    className="min-h-[44px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="form-material-notes" className="block text-xs font-medium mb-1">
                    Additional Raw Material Notes
                  </label>
                  <textarea
                    id="form-material-notes"
                    rows={2}
                    value={materialNotes}
                    onChange={(e) => setMaterialNotes(e.target.value)}
                    placeholder="Lining, gota/lace width, thread code, Mangaldass/Kalbadevi supplier..."
                    className="w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] p-3 text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="item-notes" className="block text-xs font-medium mb-1">
                    Ironing, Packing & Dispatch Notes
                  </label>
                  <textarea
                    id="item-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Steam press instructions, box packing, wholesale buyer notes..."
                    className="w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] p-3 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--m3-outline-variant)]">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-2xl px-5 text-sm font-semibold text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] rounded-2xl bg-[var(--m3-primary)] px-6 text-sm font-semibold text-[var(--m3-on-primary)] transition-transform duration-150 hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
              >
                {saving
                  ? 'Saving...'
                  : existingItem
                  ? 'Save Design'
                  : isOnline
                  ? 'Save to Catalogue'
                  : 'Save Offline'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {editorOpen && activePreview && (
        <PhotoEditorModal
          sourceUrl={photoSourceUrl || activePreview}
          initialParams={{ aspect: photoAspect, filter: photoFilter }}
          onCancel={() => setEditorOpen(false)}
          onApply={(res) => {
            setEditedDataUrl(res.dataUrl);
            setPhotoAspect(res.aspect);
            setPhotoFilter(res.filter);
            setEditorOpen(false);
          }}
        />
      )}
    </>
  );
};
