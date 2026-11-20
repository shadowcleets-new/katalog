export type InventoryCategory =
  | 'Cotton Daily'
  | 'Festive Silk'
  | 'Chanderi'
  | 'Anarkali'
  | 'Co-ord Sets';

export type InventoryStatus =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'audit_pending';

export type PhotoFilterPreset =
  | 'original'
  | 'crisp'
  | 'warm'
  | 'cool'
  | 'mono'
  | 'contrast';

export type PhotoAspectPreset = 'free' | '1:1' | '4:3' | '16:9' | '3:4';

export type SyncState = 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';

export type MaterialColorSeed = 'ochre' | 'indigo' | 'sage' | 'slate';

export type NavTab = 'catalogue' | 'collections' | 'offline' | 'security';

export interface SizeInventoryEntry {
  /** Garment size label, e.g. S, M, L, XL, XXL, 3XL, or custom */
  size: string;
  /** Ready pieces in stock for this size (whole integer >= 0) */
  stock: number;
  /** Distinct wholesale/manufacturing price in INR rupees (whole integer >= 0) */
  price: number;
}

export interface KarigarStageEntry {
  /** Craft stage, e.g. Cutting & Stitching, Katha / Handwork, Dupatta Dyeing, Block Print */
  stage: string;
  /** Karigar or workshop name */
  karigarName: string;
  /** Mumbai area, workshop unit, or batch note */
  unitOrNote: string;
  /** ISO date YYYY-MM-DD when pieces were handed over */
  dateGiven: string;
}

export interface RawMaterialSpec {
  topFabric: string;
  colorShade: string;
  bottomFabric: string;
  dupattaFabric: string;
  materialNotes: string;
}

export interface InventoryItem {
  id: string;
  ownerId: string;
  sku: string;
  title: string;
  category: InventoryCategory;
  location: string;
  /** Computed total pieces across all sizes */
  quantity: number;
  /** Per-size low-stock alert threshold (default 5) */
  minThreshold: number;
  status: InventoryStatus;
  /** Full per-size stock & distinct INR price ledger */
  sizes: SizeInventoryEntry[];
  /** Most recent Karigar this garment design was given to */
  lastKarigarName: string;
  lastKarigarStage: string;
  lastKarigarDate: string;
  /** Chronological outsourced Karigar craft roster for this design */
  karigars: KarigarStageEntry[];
  /** Dedicated raw material & fabric specification */
  rawMaterials: RawMaterialSpec;
  /** Ironing, packing, or dispatch notes */
  notes: string;
  /** Either static path (/src/assets/images/...) or IndexedDB key (local-media://...) */
  mediaKey: string;
  /** Resolved preview URL (dataURL or static path) for instant client rendering */
  previewUrl?: string;
  photoFilter: PhotoFilterPreset;
  photoAspect: PhotoAspectPreset;
  createdAt: number;
  updatedAt: number;
  syncState: SyncState;
  cachedOffline: boolean;
}

export interface SyncQueueEntry {
  id: string;
  itemId: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: number;
  payload?: Omit<InventoryItem, 'previewUrl' | 'syncState' | 'cachedOffline'>;
  itemTitle: string;
  itemSku: string;
}

export interface RecentlyViewedEntry {
  itemId: string;
  viewedAt: number;
}

export interface PhotoEditParams {
  aspect: PhotoAspectPreset;
  rotation: number; // 0, 90, 180, 270
  straighten: number; // -45 to 45
  flipX: boolean;
  zoom: number; // 1.0 to 2.5
  panX: number; // -0.5 to 0.5
  panY: number; // -0.5 to 0.5
  filter: PhotoFilterPreset;
  brightness: number; // 50 to 150 (100 default)
  contrast: number; // 50 to 150 (100 default)
  saturation: number; // 0 to 180 (100 default)
}

export interface InventoryFormValues {
  sku: string;
  title: string;
  category: InventoryCategory;
  location: string;
  minThreshold: number;
  status: InventoryStatus;
  sizes: SizeInventoryEntry[];
  lastKarigarName: string;
  lastKarigarStage: string;
  lastKarigarDate: string;
  karigars: KarigarStageEntry[];
  rawMaterials: RawMaterialSpec;
  notes: string;
}

export const INVENTORY_CATEGORIES: readonly InventoryCategory[] = [
  'Cotton Daily',
  'Festive Silk',
  'Chanderi',
  'Anarkali',
  'Co-ord Sets',
] as const;

export const INVENTORY_STATUSES: readonly { value: InventoryStatus; label: string }[] = [
  { value: 'in_stock', label: 'Ready Stock' },
  { value: 'low_stock', label: 'Low Sizes' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'audit_pending', label: 'In Finishing / QC' },
] as const;

export const STANDARD_SIZES: readonly string[] = [
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  '3XL',
] as const;

export const KARIGAR_STAGES: readonly string[] = [
  'Cutting & Stitching',
  'Katha / Handwork',
  'Dupatta Dyeing',
  'Block Print',
  'Embroidery / Zari',
  'Finishing & Ironing',
] as const;

/** Schema boundaries mirrored verbatim from firebase-blueprint.json */
export const SCHEMA_LIMITS = {
  ID_MAX: 64,
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  SKU_MIN: 2,
  SKU_MAX: 32,
  SKU_REGEX: /^[A-Z0-9-]+$/,
  TITLE_MIN: 2,
  TITLE_MAX: 120,
  LOCATION_MIN: 1,
  LOCATION_MAX: 60,
  NOTES_MAX: 600,
  MEDIA_KEY_MAX: 200,
  QTY_MAX: 1_000_000,
  THRESHOLD_MAX: 100_000,
  SIZES_MIN: 1,
  SIZES_MAX: 12,
  SIZE_LABEL_MAX: 16,
  SIZE_STOCK_MAX: 100_000,
  SIZE_PRICE_MAX: 1_000_000,
  KARIGARS_MAX: 10,
  KARIGAR_NAME_MAX: 80,
  KARIGAR_STAGE_MAX: 60,
  KARIGAR_NOTE_MAX: 120,
  KARIGAR_DATE_MAX: 20,
  FABRIC_MAX: 120,
  COLOR_MAX: 100,
  MATERIAL_NOTES_MAX: 600,
} as const;
