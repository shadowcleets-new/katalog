import type {
  InventoryItem,
  RecentlyViewedEntry,
  SyncQueueEntry,
} from '../types/inventory';

const DB_NAME = 'katalog-offline-vault-v2';
const DB_VERSION = 1;

const STORE_ITEMS = 'items';
const STORE_MEDIA = 'media';
const STORE_RECENT = 'recent';
const STORE_QUEUE = 'syncQueue';

interface MediaRecord {
  key: string;
  dataUrl: string;
  byteLength: number;
  cachedAt: number;
}

let cachedDbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (cachedDbPromise) {
    return cachedDbPromise;
  }
  cachedDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      cachedDbPromise = null;
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_RECENT)) {
        db.createObjectStore(STORE_RECENT, { keyPath: 'itemId' });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        cachedDbPromise = null;
      };
      db.onclose = () => {
        cachedDbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      cachedDbPromise = null;
      reject(req.error);
    };
  });
  return cachedDbPromise;
}

async function txPromise<T>(
  storeName: string,
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = executor(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadCachedItems(ownerId: string): Promise<InventoryItem[]> {
  try {
    const all = await txPromise<InventoryItem[]>(STORE_ITEMS, 'readonly', (s) => s.getAll());
    return all.filter((i) => i.ownerId === ownerId);
  } catch {
    return [];
  }
}

export async function saveCachedItems(items: InventoryItem[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      const store = tx.objectStore(STORE_ITEMS);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful degradation if storage quota is restricted
  }
}

export async function putCachedItem(item: InventoryItem): Promise<void> {
  try {
    await txPromise(STORE_ITEMS, 'readwrite', (s) => s.put(item));
  } catch {
    // ignore storage restriction
  }
}

export async function removeCachedItem(itemId: string): Promise<void> {
  try {
    await txPromise(STORE_ITEMS, 'readwrite', (s) => s.delete(itemId));
  } catch {
    // ignore
  }
}

export async function saveMediaDataUrl(key: string, dataUrl: string): Promise<void> {
  try {
    const record: MediaRecord = {
      key,
      dataUrl,
      byteLength: dataUrl.length,
      cachedAt: Date.now(),
    };
    await txPromise(STORE_MEDIA, 'readwrite', (s) => s.put(record));
  } catch {
    // ignore
  }
}

export async function getMediaDataUrl(key: string): Promise<string | null> {
  try {
    const rec = await txPromise<MediaRecord | undefined>(STORE_MEDIA, 'readonly', (s) => s.get(key));
    return rec?.dataUrl ?? null;
  } catch {
    return null;
  }
}

export async function getAllCachedMediaMap(): Promise<Record<string, string>> {
  try {
    const records = await txPromise<MediaRecord[]>(STORE_MEDIA, 'readonly', (s) => s.getAll());
    const map: Record<string, string> = {};
    for (const r of records) {
      map[r.key] = r.dataUrl;
    }
    return map;
  } catch {
    return {};
  }
}

export async function getCachedMediaStats(): Promise<{ count: number; totalBytes: number }> {
  try {
    const records = await txPromise<MediaRecord[]>(STORE_MEDIA, 'readonly', (s) => s.getAll());
    return {
      count: records.length,
      totalBytes: records.reduce((sum, r) => sum + r.byteLength, 0),
    };
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}

export async function cacheStaticImageUrl(url: string): Promise<boolean> {
  if (!url || url.startsWith('data:') || url.startsWith('local-media://')) return true;
  try {
    const existing = await getMediaDataUrl(url);
    if (existing) return true;
    const response = await fetch(url);
    if (!response.ok) return false;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    await saveMediaDataUrl(url, dataUrl);
    return true;
  } catch {
    return false;
  }
}

export async function loadRecentlyViewed(): Promise<RecentlyViewedEntry[]> {
  try {
    const rows = await txPromise<RecentlyViewedEntry[]>(STORE_RECENT, 'readonly', (s) => s.getAll());
    return rows.sort((a, b) => b.viewedAt - a.viewedAt).slice(0, 12);
  } catch {
    return [];
  }
}

export async function recordRecentlyViewed(itemId: string): Promise<RecentlyViewedEntry[]> {
  try {
    await txPromise(STORE_RECENT, 'readwrite', (s) => s.put({ itemId, viewedAt: Date.now() }));
    return loadRecentlyViewed();
  } catch {
    return [];
  }
}

export async function loadSyncQueue(): Promise<SyncQueueEntry[]> {
  try {
    const rows = await txPromise<SyncQueueEntry[]>(STORE_QUEUE, 'readonly', (s) => s.getAll());
    return rows.sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return [];
  }
}

export async function replaceSyncQueue(entries: SyncQueueEntry[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE);
      store.clear();
      for (const entry of entries) {
        store.put(entry);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function clearOfflineVaultCache(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_MEDIA, STORE_RECENT], 'readwrite');
      tx.objectStore(STORE_MEDIA).clear();
      tx.objectStore(STORE_RECENT).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

/** Securely hashes a device PIN using Web Crypto API SHA-256 with a static app salt. */
export async function hashDevicePin(pin: string): Promise<string> {
  const enc = new TextEncoder().encode(`katalog-vault-salt-v1::${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
