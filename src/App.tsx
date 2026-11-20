import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import {
  CloudOff,
  Images,
  Moon,
  Plus,
  RefreshCw,
  Scissors,
  Shield,
  Sun,
} from 'lucide-react';
import {
  auth,
  createInventoryDoc,
  deleteInventoryDoc,
  ensureUserProfileDoc,
  registerWithEmail,
  resendVerificationEmail,
  signInWithEmail,
  signInWithGooglePopup,
  signOutUser,
  subscribeUserInventory,
  updateInventoryDoc,
} from './lib/firebase';
import { createSeedInventory } from './data/seedInventory';
import type {
  InventoryCategory,
  InventoryFormValues,
  InventoryItem,
  InventoryStatus,
  KarigarStageEntry,
  MaterialColorSeed,
  NavTab,
  PhotoAspectPreset,
  PhotoFilterPreset,
  RawMaterialSpec,
  RecentlyViewedEntry,
  SizeInventoryEntry,
  SyncQueueEntry,
} from './types/inventory';
import {
  computeTotalStockFromSizes,
  deriveDesignStatus,
  enqueueSyncMutation,
  filterAndSortInventory,
  formatStatusLabel,
  getKnownKarigarNames,
  sortSizesLogically,
  type InventoryFilterState,
} from './utils/inventoryLogic';
import {
  cacheStaticImageUrl,
  clearOfflineVaultCache,
  getAllCachedMediaMap,
  getCachedMediaStats,
  hashDevicePin,
  loadCachedItems,
  loadRecentlyViewed,
  loadSyncQueue,
  putCachedItem,
  recordRecentlyViewed,
  removeCachedItem,
  replaceSyncQueue,
  saveCachedItems,
  saveMediaDataUrl,
} from './utils/offlineDb';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { AuthGate } from './components/AuthGate';
import { CatalogueGrid } from './components/CatalogueGrid';
import { CollectionsView } from './components/CollectionsView';
import { OfflineSyncView } from './components/OfflineSyncView';
import { SecuritySettingsView } from './components/SecuritySettingsView';
import { ItemFormSheet } from './components/ItemFormSheet';
import { DesignDetailsPage } from './components/DesignDetailsPage';
import { AppLockOverlay } from './components/AppLockOverlay';
import { PWAInstallButton } from './components/PWAInstallButton';

const DEMO_OWNER_ID = 'demo-local-workspace';
const THEME_KEY = 'katalog_dark_mode';
const SEED_KEY = 'katalog_color_seed_v2';
const PIN_HASH_KEY = 'katalog_pin_hash';

function mapFirebaseAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not yet enabled in your Firebase Console. Use Continue with Google, or enable Email/Password under Firebase Console → Authentication → Sign-in method.';
  }
  if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
    return 'Incorrect email or password. Double-check your credentials and try again.';
  }
  if (raw.includes('auth/user-not-found')) {
    return 'No staff account found for this email. Switch to Create Account to register.';
  }
  if (raw.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Switch to Sign In instead.';
  }
  if (raw.includes('auth/popup-closed-by-user')) {
    return 'Google Sign-In popup was closed before completing.';
  }
  if (raw.includes('auth/network-request-failed')) {
    return 'Network unavailable. Open Demo Workspace for offline access.';
  }
  return 'Authentication failed. Please try again or use Google Sign-In.';
}

export default function App() {
  const { isOnline, browserOnline, simulatedOffline, toggleSimulatedOffline } = useOnlineStatus();

  // Auth & Workspace Session
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [demoMode, setDemoMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return true;
    try {
      return localStorage.getItem('katalog_demo_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Appearance (Material 3 Expressive Dynamic Color + Light/Dark)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [colorSeed, setColorSeed] = useState<MaterialColorSeed>(() => {
    try {
      const saved = localStorage.getItem(SEED_KEY) as MaterialColorSeed | null;
      return saved && ['ochre', 'indigo', 'sage', 'slate'].includes(saved) ? saved : 'ochre';
    } catch {
      return 'ochre';
    }
  });

  // Device PIN Lock
  const [pinHash, setPinHash] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PIN_HASH_KEY);
    } catch {
      return null;
    }
  });
  const [isLocked, setIsLocked] = useState<boolean>(() => Boolean(pinHash));

  // Navigation & UI Modals
  const [activeTab, setActiveTab] = useState<NavTab>('catalogue');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<InventoryFilterState>({
    query: '',
    category: 'All',
    status: 'All',
    sort: 'updated_desc',
  });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Inventory Data, Offline Cache & Sync Queue
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncQueue, setSyncQueue] = useState<SyncQueueEntry[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedEntry[]>([]);
  const [cacheStats, setCacheStats] = useState({ count: 0, totalBytes: 0 });
  const [syncing, setSyncing] = useState(false);

  const activeOwnerId = user ? user.uid : demoMode ? DEMO_OWNER_ID : null;

  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Apply Material 3 Expressive theme classes and data-seed
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', darkMode);
    root.setAttribute('data-seed', colorSeed);
    try {
      localStorage.setItem(THEME_KEY, String(darkMode));
      localStorage.setItem(SEED_KEY, colorSeed);
    } catch {
      // ignore storage errors
    }
  }, [darkMode, colorSeed]);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        setDemoMode(false);
        void ensureUserProfileDoc(nextUser, 'Mumbai Production').catch(() => {
          // handled gracefully if offline
        });
      }
    });
    return () => unsub();
  }, []);

  const refreshCacheStats = useCallback(async () => {
    const stats = await getCachedMediaStats();
    setCacheStats(stats);
  }, []);

  // Hydrate designs, local media previews, recently viewed, and sync queue from IndexedDB
  useEffect(() => {
    if (!activeOwnerId) return;
    let cancelled = false;

    const hydrate = async () => {
      const [cachedItems, mediaMap, recent, queued] = await Promise.all([
        loadCachedItems(activeOwnerId),
        getAllCachedMediaMap(),
        loadRecentlyViewed(),
        loadSyncQueue(),
      ]);

      if (cancelled) return;

      let resolvedItems = cachedItems;
      if (resolvedItems.length === 0) {
        resolvedItems = createSeedInventory(activeOwnerId);
        await saveCachedItems(resolvedItems);
      }

      const withPreviews = resolvedItems.map((item) => ({
        ...item,
        previewUrl: mediaMap[item.mediaKey] ?? item.previewUrl ?? item.mediaKey,
        cachedOffline: Boolean(mediaMap[item.mediaKey]) || item.mediaKey.startsWith('/src/assets/'),
      }));

      setItems(withPreviews);
      setRecentlyViewed(recent);
      setSyncQueue(queued);
      setHydrated(true);
      await refreshCacheStats();
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [activeOwnerId, refreshCacheStats]);

  // Live Firestore subscription when authenticated & online
  useEffect(() => {
    if (!user || !isOnline) return;
    const unsub = subscribeUserInventory(
      user.uid,
      async (remoteItems) => {
        if (remoteItems.length === 0) return;
        const mediaMap = await getAllCachedMediaMap();
        setItems((prev) => {
          const pendingMap = new Map(
            prev.filter((i) => i.syncState !== 'synced').map((i) => [i.id, i])
          );
          const merged: InventoryItem[] = remoteItems.map((remote) => {
            const pendingOverride = pendingMap.get(remote.id);
            if (pendingOverride) return pendingOverride;
            return {
              ...remote,
              previewUrl: mediaMap[remote.mediaKey] ?? remote.mediaKey,
              cachedOffline: Boolean(mediaMap[remote.mediaKey]),
            };
          });
          for (const localPending of pendingMap.values()) {
            if (!merged.some((m) => m.id === localPending.id)) {
              merged.unshift(localPending);
            }
          }
          void saveCachedItems(merged);
          return merged;
        });
      },
      () => {
        // Offline or rules fallback handled seamlessly by local IndexedDB cache
      }
    );
    return () => unsub();
  }, [user, isOnline]);

  // Flush pending offline sync queue automatically when connectivity returns
  const flushSyncQueue = useCallback(async () => {
    if (!isOnline || syncQueue.length === 0 || syncing) return;
    setSyncing(true);
    try {
      const remaining: SyncQueueEntry[] = [];
      let syncedCount = 0;

      for (const entry of syncQueue) {
        try {
          if (user && user.emailVerified) {
            await ensureUserProfileDoc(user, 'Mumbai Production');
            if (entry.operation === 'create' && entry.payload) {
              await createInventoryDoc(user.uid, entry.payload);
            } else if (entry.operation === 'update' && entry.payload) {
              await updateInventoryDoc(user.uid, entry.payload);
            } else if (entry.operation === 'delete') {
              await deleteInventoryDoc(user.uid, entry.itemId);
            }
          }
          syncedCount += 1;
        } catch {
          remaining.push(entry);
        }
      }

      await replaceSyncQueue(remaining);
      setSyncQueue(remaining);

      setItems((prev) => {
        const updated = prev
          .filter((item) => {
            const wasDeleted =
              item.syncState === 'pending_delete' &&
              !remaining.some((r) => r.itemId === item.id);
            return !wasDeleted;
          })
          .map((item) => {
            if (remaining.some((r) => r.itemId === item.id)) return item;
            return { ...item, syncState: 'synced' as const };
          });
        void saveCachedItems(updated);
        return updated;
      });

      if (syncedCount > 0) {
        notify(`Synced ${syncedCount} queued ${syncedCount === 1 ? 'change' : 'changes'}.`);
      }
    } finally {
      setSyncing(false);
    }
  }, [isOnline, syncQueue, syncing, user, notify]);

  useEffect(() => {
    if (isOnline && syncQueue.length > 0 && !syncing) {
      void flushSyncQueue();
    }
  }, [isOnline, syncQueue.length, syncing, flushSyncQueue]);

  // Auth Handlers
  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithGooglePopup();
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailSignIn = async (email: string, password: string) => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailRegister = async (name: string, email: string, password: string) => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await registerWithEmail(name, email, password);
      notify('Account created. Verification email sent.');
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEnterDemoWorkspace = () => {
    setDemoMode(true);
    setAuthError(null);
    try {
      localStorage.setItem('katalog_demo_mode', 'true');
    } catch {
      // ignore
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setDemoMode(false);
    setSelectedItemId(null);
    try {
      localStorage.removeItem('katalog_demo_mode');
    } catch {
      // ignore
    }
    setActiveTab('catalogue');
  };

  // Core Design Persistence (Offline-First + Auto Cloud Sync)
  const handleSaveItem = async (
    payload: {
      id?: string;
      values: InventoryFormValues;
      photoDataUrl?: string;
      mediaKey: string;
      photoFilter: PhotoFilterPreset;
      photoAspect: PhotoAspectPreset;
    },
    customToast?: string
  ) => {
    if (!activeOwnerId) return;
    const now = Date.now();
    const isEdit = Boolean(payload.id);
    const id = payload.id ?? `design-${now}-${Math.random().toString(36).slice(2, 6)}`;
    const existing = items.find((i) => i.id === id);

    if (payload.photoDataUrl) {
      await saveMediaDataUrl(payload.mediaKey, payload.photoDataUrl);
      await refreshCacheStats();
    }

    const sortedSizes = sortSizesLogically(payload.values.sizes);
    const totalQty = computeTotalStockFromSizes(sortedSizes);
    const computedStatus = deriveDesignStatus(
      sortedSizes,
      Math.trunc(payload.values.minThreshold),
      payload.values.status
    );

    const canSyncNow = isOnline && (!user || user.emailVerified);
    const baseRecord: Omit<InventoryItem, 'previewUrl' | 'syncState' | 'cachedOffline'> = {
      id,
      ownerId: activeOwnerId,
      sku: payload.values.sku,
      title: payload.values.title,
      category: payload.values.category,
      location: payload.values.location,
      quantity: totalQty,
      minThreshold: Math.trunc(payload.values.minThreshold),
      status: computedStatus,
      sizes: sortedSizes,
      lastKarigarName: payload.values.lastKarigarName,
      lastKarigarStage: payload.values.lastKarigarStage,
      lastKarigarDate: payload.values.lastKarigarDate,
      karigars: payload.values.karigars,
      rawMaterials: payload.values.rawMaterials,
      notes: payload.values.notes,
      mediaKey: payload.mediaKey,
      photoFilter: payload.photoFilter,
      photoAspect: payload.photoAspect,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    let syncedToCloud = false;
    if (canSyncNow && user && user.emailVerified) {
      try {
        await ensureUserProfileDoc(user, 'Mumbai Production');
        if (isEdit) {
          await updateInventoryDoc(user.uid, baseRecord);
        } else {
          await createInventoryDoc(user.uid, baseRecord);
        }
        syncedToCloud = true;
      } catch {
        syncedToCloud = false;
      }
    } else if (canSyncNow && demoMode) {
      syncedToCloud = true;
    }

    const nextItem: InventoryItem = {
      ...baseRecord,
      previewUrl: payload.photoDataUrl ?? existing?.previewUrl ?? payload.mediaKey,
      syncState: syncedToCloud ? 'synced' : isEdit ? 'pending_update' : 'pending_create',
      cachedOffline: true,
    };

    await putCachedItem(nextItem);
    setItems((prev) => {
      if (isEdit) {
        return prev.map((i) => (i.id === id ? nextItem : i));
      }
      return [nextItem, ...prev];
    });

    if (!syncedToCloud) {
      const nextQueue = enqueueSyncMutation(syncQueue, {
        id: `q-${now}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: id,
        operation: isEdit ? 'update' : 'create',
        timestamp: now,
        payload: baseRecord,
        itemTitle: baseRecord.title,
        itemSku: baseRecord.sku,
      });
      await replaceSyncQueue(nextQueue);
      setSyncQueue(nextQueue);
      notify(`${baseRecord.sku} saved locally and queued for sync.`);
    } else {
      notify(
        customToast ??
          (isEdit ? `Updated ${baseRecord.sku}.` : `Added ${baseRecord.sku} to catalogue.`)
      );
    }
  };

  const toFormValues = (item: InventoryItem): InventoryFormValues => ({
    sku: item.sku,
    title: item.title,
    category: item.category,
    location: item.location,
    minThreshold: item.minThreshold,
    status: item.status,
    sizes: item.sizes,
    lastKarigarName: item.lastKarigarName,
    lastKarigarStage: item.lastKarigarStage,
    lastKarigarDate: item.lastKarigarDate,
    karigars: item.karigars,
    rawMaterials: item.rawMaterials,
    notes: item.notes,
  });

  // Dedicated Design Details inline mutations
  const handleUpdateDesignSizes = async (
    item: InventoryItem,
    nextSizes: SizeInventoryEntry[]
  ) => {
    const nextStatus = deriveDesignStatus(nextSizes, item.minThreshold, item.status);
    await handleSaveItem(
      {
        id: item.id,
        values: {
          ...toFormValues(item),
          sizes: nextSizes,
          status: nextStatus,
        },
        mediaKey: item.mediaKey,
        photoFilter: item.photoFilter,
        photoAspect: item.photoAspect,
      },
      `Updated size stock & rates for ${item.sku}.`
    );
  };

  const handleLogKarigarHandover = async (
    item: InventoryItem,
    handover: KarigarStageEntry,
    nextRoster: KarigarStageEntry[]
  ) => {
    await handleSaveItem(
      {
        id: item.id,
        values: {
          ...toFormValues(item),
          lastKarigarName: handover.karigarName,
          lastKarigarStage: handover.stage,
          lastKarigarDate: handover.dateGiven,
          karigars: nextRoster,
        },
        mediaKey: item.mediaKey,
        photoFilter: item.photoFilter,
        photoAspect: item.photoAspect,
      },
      `Logged ${handover.karigarName} (${handover.stage}).`
    );
  };

  const handleRemoveKarigarLog = async (item: InventoryItem, removeIndex: number) => {
    const nextRoster = item.karigars.filter((_, i) => i !== removeIndex);
    const latest = nextRoster[0];
    await handleSaveItem(
      {
        id: item.id,
        values: {
          ...toFormValues(item),
          lastKarigarName: latest?.karigarName ?? '',
          lastKarigarStage: latest?.stage ?? '',
          lastKarigarDate: latest?.dateGiven ?? '',
          karigars: nextRoster,
        },
        mediaKey: item.mediaKey,
        photoFilter: item.photoFilter,
        photoAspect: item.photoAspect,
      },
      `Updated Karigar log for ${item.sku}.`
    );
  };

  const handleUpdateRawMaterials = async (
    item: InventoryItem,
    nextMaterials: RawMaterialSpec
  ) => {
    await handleSaveItem(
      {
        id: item.id,
        values: {
          ...toFormValues(item),
          rawMaterials: nextMaterials,
        },
        mediaKey: item.mediaKey,
        photoFilter: item.photoFilter,
        photoAspect: item.photoAspect,
      },
      `Saved raw materials for ${item.sku}.`
    );
  };

  const handleUpdateDesignPhoto = async (
    item: InventoryItem,
    photoDataUrl: string,
    aspect: PhotoAspectPreset,
    filter: PhotoFilterPreset
  ) => {
    const mediaKey = `local-media://photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await handleSaveItem(
      {
        id: item.id,
        values: toFormValues(item),
        photoDataUrl,
        mediaKey,
        photoFilter: filter,
        photoAspect: aspect,
      },
      `Updated photograph for ${item.sku}.`
    );
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    const now = Date.now();
    const canSyncNow = isOnline && (!user || user.emailVerified);
    let deletedRemote = false;

    if (canSyncNow && user && user.emailVerified) {
      try {
        await deleteInventoryDoc(user.uid, item.id);
        deletedRemote = true;
      } catch {
        deletedRemote = false;
      }
    } else if (canSyncNow && demoMode) {
      deletedRemote = true;
    }

    if (deletedRemote) {
      await removeCachedItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      notify(`Removed ${item.sku}.`);
    } else {
      const marked: InventoryItem = { ...item, syncState: 'pending_delete', updatedAt: now };
      await putCachedItem(marked);
      setItems((prev) => prev.map((i) => (i.id === item.id ? marked : i)));
      const nextQueue = enqueueSyncMutation(syncQueue, {
        id: `q-${now}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: item.id,
        operation: 'delete',
        timestamp: now,
        itemTitle: item.title,
        itemSku: item.sku,
      });
      await replaceSyncQueue(nextQueue);
      setSyncQueue(nextQueue);
      notify(`${item.sku} marked for deletion on next sync.`);
    }
  };

  const handleBatchUpdateStatus = async (itemIds: string[], nextStatus: InventoryStatus) => {
    if (itemIds.length === 0) return;
    const idSet = new Set(itemIds);
    const targets = items.filter((i) => idSet.has(i.id) && i.syncState !== 'pending_delete');
    if (targets.length === 0) return;

    const now = Date.now();
    const canSyncNow = isOnline && (!user || user.emailVerified);
    let nextQueue = [...syncQueue];
    const updatedMap = new Map<string, InventoryItem>();
    let queuedCount = 0;

    if (canSyncNow && user && user.emailVerified) {
      try {
        await ensureUserProfileDoc(user, 'Mumbai Production');
      } catch {
        // per-item fallback handles offline queue
      }
    }

    for (const item of targets) {
      const baseRecord: Omit<InventoryItem, 'previewUrl' | 'syncState' | 'cachedOffline'> = {
        id: item.id,
        ownerId: item.ownerId,
        sku: item.sku,
        title: item.title,
        category: item.category,
        location: item.location,
        quantity: item.quantity,
        minThreshold: item.minThreshold,
        status: nextStatus,
        sizes: item.sizes,
        lastKarigarName: item.lastKarigarName,
        lastKarigarStage: item.lastKarigarStage,
        lastKarigarDate: item.lastKarigarDate,
        karigars: item.karigars,
        rawMaterials: item.rawMaterials,
        notes: item.notes,
        mediaKey: item.mediaKey,
        photoFilter: item.photoFilter,
        photoAspect: item.photoAspect,
        createdAt: item.createdAt,
        updatedAt: now,
      };

      let syncedToCloud = false;
      if (canSyncNow && user && user.emailVerified) {
        try {
          await updateInventoryDoc(user.uid, baseRecord);
          syncedToCloud = true;
        } catch {
          syncedToCloud = false;
        }
      } else if (canSyncNow && demoMode) {
        syncedToCloud = true;
      }

      const nextItem: InventoryItem = {
        ...baseRecord,
        previewUrl: item.previewUrl,
        cachedOffline: item.cachedOffline,
        syncState: syncedToCloud ? 'synced' : 'pending_update',
      };
      updatedMap.set(item.id, nextItem);

      if (!syncedToCloud) {
        queuedCount += 1;
        nextQueue = enqueueSyncMutation(nextQueue, {
          id: `q-${now}-${Math.random().toString(36).slice(2, 6)}`,
          itemId: item.id,
          operation: 'update',
          timestamp: now,
          payload: baseRecord,
          itemTitle: baseRecord.title,
          itemSku: baseRecord.sku,
        });
      }
    }

    const updatedItems = Array.from(updatedMap.values());
    await saveCachedItems(updatedItems);
    setItems((prev) => prev.map((i) => updatedMap.get(i.id) ?? i));

    if (queuedCount > 0) {
      await replaceSyncQueue(nextQueue);
      setSyncQueue(nextQueue);
      notify(
        `Updated ${targets.length} ${targets.length === 1 ? 'design' : 'designs'} to ${formatStatusLabel(nextStatus)} (queued for sync).`
      );
    } else {
      notify(
        `Updated ${targets.length} ${targets.length === 1 ? 'design' : 'designs'} to ${formatStatusLabel(nextStatus)}.`
      );
    }
  };

  const handleBatchDeleteItems = async (itemIds: string[]) => {
    if (itemIds.length === 0) return;
    const idSet = new Set(itemIds);
    const targets = items.filter((i) => idSet.has(i.id) && i.syncState !== 'pending_delete');
    if (targets.length === 0) return;

    const now = Date.now();
    const canSyncNow = isOnline && (!user || user.emailVerified);
    let nextQueue = [...syncQueue];
    const removedIds = new Set<string>();
    const markedMap = new Map<string, InventoryItem>();

    for (const item of targets) {
      let deletedRemote = false;
      if (canSyncNow && user && user.emailVerified) {
        try {
          await deleteInventoryDoc(user.uid, item.id);
          deletedRemote = true;
        } catch {
          deletedRemote = false;
        }
      } else if (canSyncNow && demoMode) {
        deletedRemote = true;
      }

      if (deletedRemote) {
        await removeCachedItem(item.id);
        removedIds.add(item.id);
      } else {
        const marked: InventoryItem = { ...item, syncState: 'pending_delete', updatedAt: now };
        await putCachedItem(marked);
        markedMap.set(item.id, marked);
        nextQueue = enqueueSyncMutation(nextQueue, {
          id: `q-${now}-${Math.random().toString(36).slice(2, 6)}`,
          itemId: item.id,
          operation: 'delete',
          timestamp: now,
          itemTitle: item.title,
          itemSku: item.sku,
        });
      }
    }

    setItems((prev) =>
      prev
        .filter((i) => !removedIds.has(i.id))
        .map((i) => markedMap.get(i.id) ?? i)
    );

    if (selectedItemId && (removedIds.has(selectedItemId) || markedMap.has(selectedItemId))) {
      setSelectedItemId(null);
    }

    if (markedMap.size > 0) {
      await replaceSyncQueue(nextQueue);
      setSyncQueue(nextQueue);
      notify(
        `Marked ${markedMap.size} ${markedMap.size === 1 ? 'design' : 'designs'} for deletion on next sync.`
      );
    } else if (removedIds.size > 0) {
      notify(`Deleted ${removedIds.size} ${removedIds.size === 1 ? 'design' : 'designs'}.`);
    }
  };

  const handleSelectItem = async (item: InventoryItem) => {
    setSelectedItemId(item.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const updatedRecent = await recordRecentlyViewed(item.id);
    setRecentlyViewed(updatedRecent);

    if (isOnline && !item.mediaKey.startsWith('local-media://')) {
      const cached = await cacheStaticImageUrl(item.mediaKey);
      if (cached) {
        await refreshCacheStats();
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, cachedOffline: true } : i))
        );
      }
    }
  };

  const handleSwitchTab = (tab: NavTab) => {
    setSelectedItemId(null);
    setActiveTab(tab);
  };

  const handleCacheAllPhotos = async () => {
    for (const item of items) {
      if (item.syncState !== 'pending_delete' && !item.mediaKey.startsWith('local-media://')) {
        await cacheStaticImageUrl(item.mediaKey);
      }
    }
    await refreshCacheStats();
    setItems((prev) => prev.map((i) => ({ ...i, cachedOffline: true })));
    notify('All design photographs cached locally for offline use.');
  };

  const handleClearMediaCache = async () => {
    await clearOfflineVaultCache();
    setRecentlyViewed([]);
    await refreshCacheStats();
    notify('Cleared cached photo copies.');
  };

  const handleSetPinLock = async (pin: string) => {
    const hashed = await hashDevicePin(pin);
    setPinHash(hashed);
    try {
      localStorage.setItem(PIN_HASH_KEY, hashed);
    } catch {
      // ignore
    }
  };

  const handleRemovePinLock = () => {
    setPinHash(null);
    setIsLocked(false);
    try {
      localStorage.removeItem(PIN_HASH_KEY);
    } catch {
      // ignore
    }
  };

  const filteredItems = useMemo(() => filterAndSortInventory(items, filters), [items, filters]);
  const knownKarigars = useMemo(() => getKnownKarigarNames(items), [items]);
  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId && i.syncState !== 'pending_delete') ?? null,
    [items, selectedItemId]
  );

  if (!authReady && !demoMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--m3-surface)] text-[var(--m3-on-surface)]">
        <div className="text-center space-y-3">
          <img src="/icon.svg" alt="" className="mx-auto h-12 w-12 rounded-2xl" />
          <p className="text-sm font-medium text-[var(--m3-on-surface-variant)]">
            Opening Katalog workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!user && !demoMode) {
    return (
      <AuthGate
        onGoogleSignIn={handleGoogleSignIn}
        onEmailSignIn={handleEmailSignIn}
        onEmailRegister={handleEmailRegister}
        onEnterDemoWorkspace={handleEnterDemoWorkspace}
        authError={authError}
        busy={authBusy}
      />
    );
  }

  if (isLocked && pinHash) {
    return <AppLockOverlay expectedHash={pinHash} onUnlock={() => setIsLocked(false)} />;
  }

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'catalogue', label: 'Catalogue', icon: Images },
    { id: 'collections', label: 'Karigars', icon: Scissors },
    { id: 'offline', label: 'Offline', icon: RefreshCw },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const pageMeta: Record<NavTab, { title: string; subtitle: string }> = {
    catalogue: {
      title: 'Salwar Kameez Catalogue',
      subtitle: 'Mumbai garment designs with size-wise stock, INR pricing, Karigars, and fabric specs',
    },
    collections: {
      title: 'Karigars & Collections',
      subtitle: 'Track outsourced cutting, katha, dyeing, and block-print units across every design',
    },
    offline: {
      title: 'Offline Vault & Sync Queue',
      subtitle: 'Local photo caching and queued changes for workshops and textile markets',
    },
    security: {
      title: 'Security & Appearance',
      subtitle: 'Firebase authentication, device PIN lock, and Material 3 Dynamic Color',
    },
  };

  return (
    <div className="min-h-screen bg-[var(--m3-surface)] text-[var(--m3-on-surface)] flex">
      {/* Desktop Material 3 Expressive Navigation Rail */}
      <aside
        aria-label="Primary workspace navigation"
        className="hidden lg:flex w-[92px] shrink-0 flex-col items-center justify-between border-r border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] py-5 sticky top-0 h-screen z-30"
      >
        <div className="flex flex-col items-center gap-5 w-full px-2">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              handleSwitchTab('catalogue');
            }}
            aria-label="Katalog home"
            className="flex h-11 w-11 items-center justify-center rounded-2xl overflow-hidden"
          >
            <img src="/icon.svg" alt="" className="h-11 w-11" />
          </a>

          <nav className="mt-4 flex flex-col items-center gap-2.5 w-full">
            {navItems.map((nav) => {
              const Icon = nav.icon;
              const active = !selectedItem && activeTab === nav.id;
              return (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => handleSwitchTab(nav.id)}
                  aria-current={active ? 'page' : undefined}
                  className="group flex flex-col items-center justify-center w-full py-1.5 gap-1"
                >
                  <span
                    className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                      active
                        ? 'bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                        : 'text-[var(--m3-on-surface-variant)] group-hover:bg-[var(--m3-surface-container-high)]'
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {nav.id === 'offline' && syncQueue.length > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-600 px-1 font-mono text-[10px] font-bold text-white">
                        {syncQueue.length}
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[11px] font-semibold whitespace-nowrap ${
                      active ? 'text-[var(--m3-on-surface)]' : 'text-[var(--m3-on-surface-variant)]'
                    }`}
                  >
                    {nav.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={() => setDarkMode((d) => !d)}
          aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container-high)]"
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Compact Sticky Top App Bar (56px mobile height to respect 15% mobile sticky cap) */}
        <header className="sticky top-0 z-20 flex h-14 lg:h-16 items-center justify-between gap-4 border-b border-[var(--m3-outline-variant)] bg-[var(--m3-surface)]/92 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/icon.svg" alt="" className="h-8 w-8 rounded-xl lg:hidden shrink-0" />
            <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
              Katalog
            </span>
            {!isOnline && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
                Offline
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:block">
              <PWAInstallButton variant="compact" />
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setFormOpen(true);
              }}
              className="hidden sm:inline-flex min-h-[42px] items-center gap-2 rounded-2xl bg-[var(--m3-primary)] px-4 text-sm font-semibold text-[var(--m3-on-primary)] transition-transform duration-150 hover:opacity-95 active:scale-[0.98] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Design
            </button>
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              className="flex lg:hidden h-11 w-11 items-center justify-center rounded-2xl text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container)]"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Body */}
        <main
          id="top"
          className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-28 lg:pb-10"
        >
          <AnimatePresence mode="wait">
            {selectedItem ? (
              <motion.div
                key={`detail-${selectedItem.id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                <DesignDetailsPage
                  item={selectedItem}
                  knownKarigars={knownKarigars}
                  isOnline={isOnline}
                  onBack={() => setSelectedItemId(null)}
                  onUpdateSizes={handleUpdateDesignSizes}
                  onLogKarigarHandover={handleLogKarigarHandover}
                  onRemoveKarigarLog={handleRemoveKarigarLog}
                  onUpdateRawMaterials={handleUpdateRawMaterials}
                  onUpdatePhoto={handleUpdateDesignPhoto}
                  onOpenFullEdit={(item) => {
                    setEditingItem(item);
                    setFormOpen(true);
                  }}
                  onDelete={handleDeleteItem}
                />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Expressive Page Headline */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div>
                    <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                      {pageMeta[activeTab].title}
                    </h1>
                    <p className="mt-1 text-sm text-[var(--m3-on-surface-variant)]">
                      {pageMeta[activeTab].subtitle}
                    </p>
                  </div>
                  {syncQueue.length > 0 && activeTab !== 'offline' && (
                    <button
                      type="button"
                      onClick={() => handleSwitchTab('offline')}
                      className="inline-flex min-h-[40px] items-center gap-2 self-start sm:self-auto rounded-2xl bg-amber-100 px-3.5 text-xs font-semibold text-amber-950 dark:bg-amber-950/60 dark:text-amber-200 whitespace-nowrap"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      {syncQueue.length} queued for sync
                    </button>
                  )}
                </div>

                {activeTab === 'catalogue' && (
                  <CatalogueGrid
                    items={items}
                    filteredItems={filteredItems}
                    loading={!hydrated}
                    filters={filters}
                    viewMode={viewMode}
                    onFiltersChange={setFilters}
                    onViewModeChange={setViewMode}
                    onSelectItem={(item) => void handleSelectItem(item)}
                    onOpenAdd={() => {
                      setEditingItem(null);
                      setFormOpen(true);
                    }}
                    onBatchUpdateStatus={handleBatchUpdateStatus}
                    onBatchDelete={handleBatchDeleteItems}
                  />
                )}

                {activeTab === 'collections' && (
                  <CollectionsView
                    items={items}
                    onOpenCategory={(cat: InventoryCategory) => {
                      setFilters((f) => ({ ...f, category: cat }));
                      handleSwitchTab('catalogue');
                    }}
                    onSelectItem={(item) => void handleSelectItem(item)}
                  />
                )}

                {activeTab === 'offline' && (
                  <OfflineSyncView
                    isOnline={isOnline}
                    browserOnline={browserOnline}
                    simulatedOffline={simulatedOffline}
                    onToggleSimulatedOffline={toggleSimulatedOffline}
                    syncQueue={syncQueue}
                    syncing={syncing}
                    onSyncNow={flushSyncQueue}
                    items={items}
                    recentlyViewed={recentlyViewed}
                    cacheStats={cacheStats}
                    onCacheAllPhotos={handleCacheAllPhotos}
                    onClearMediaCache={handleClearMediaCache}
                    onSelectItem={(item) => void handleSelectItem(item)}
                  />
                )}

                {activeTab === 'security' && (
                  <SecuritySettingsView
                    user={user}
                    demoMode={demoMode}
                    darkMode={darkMode}
                    colorSeed={colorSeed}
                    hasPinLock={Boolean(pinHash)}
                    onToggleDarkMode={() => setDarkMode((d) => !d)}
                    onChangeColorSeed={setColorSeed}
                    onSetPinLock={handleSetPinLock}
                    onRemovePinLock={handleRemovePinLock}
                    onTriggerLockNow={() => setIsLocked(true)}
                    onResendVerification={async () => {
                      if (user) {
                        await resendVerificationEmail(user);
                        notify('Verification email sent.');
                      }
                    }}
                    onRefreshVerification={async () => {
                      if (user) {
                        await user.reload();
                        setUser(auth.currentUser);
                        if (auth.currentUser?.emailVerified) {
                          await ensureUserProfileDoc(auth.currentUser, 'Mumbai Production');
                          notify('Email verified. Cloud sync enabled.');
                        } else {
                          notify('Email is not verified yet. Check your inbox.');
                        }
                      }
                    }}
                    onSignOut={handleSignOut}
                    onOpenAuthGate={() => {
                      setDemoMode(false);
                      setSelectedItemId(null);
                      try {
                        localStorage.removeItem('katalog_demo_mode');
                      } catch {
                        // ignore
                      }
                    }}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Expressive Floating Action Button (Thumb Zone on Catalogue/List) */}
      {!selectedItem && (
        <button
          type="button"
          onClick={() => {
            setEditingItem(null);
            setFormOpen(true);
          }}
          aria-label="Add Salwar Kameez design"
          className="sm:hidden fixed right-4 bottom-20 z-30 flex h-14 w-14 items-center justify-center rounded-[20px] bg-[var(--m3-primary)] text-[var(--m3-on-primary)] shadow-lg transition-transform active:scale-95"
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {/* Mobile Material 3 Bottom Navigation Bar (64px height) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)]/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-4 h-16 items-center">
          {navItems.map((nav) => {
            const Icon = nav.icon;
            const active = !selectedItem && activeTab === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => handleSwitchTab(nav.id)}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center justify-center h-full gap-0.5"
              >
                <span
                  className={`relative flex h-7 w-14 items-center justify-center rounded-full transition-colors ${
                    active
                      ? 'bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                      : 'text-[var(--m3-on-surface-variant)]'
                  }`}
                >
                  <Icon className="h-[20px] w-[20px]" aria-hidden="true" />
                  {nav.id === 'offline' && syncQueue.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-600 px-1 font-mono text-[10px] font-bold text-white">
                      {syncQueue.length}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[11px] font-semibold tracking-tight ${
                    active ? 'text-[var(--m3-on-surface)]' : 'text-[var(--m3-on-surface-variant)]'
                  }`}
                >
                  {nav.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Add / Edit Design & Photo Studio Sheet */}
      {formOpen && (
        <ItemFormSheet
          existingItem={editingItem}
          knownKarigars={knownKarigars}
          isOnline={isOnline}
          onClose={() => {
            setFormOpen(false);
            setEditingItem(null);
          }}
          onSave={(payload) => handleSaveItem(payload)}
        />
      )}

      {/* Accessible Snackbar / Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-[var(--m3-on-surface)] px-5 py-3 text-sm font-medium text-[var(--m3-surface)] shadow-xl max-w-[90vw] truncate"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
