import React, { useState } from 'react';
import {
  CheckCircle2,
  CloudOff,
  HardDrive,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { InventoryItem, RecentlyViewedEntry, SyncQueueEntry } from '../types/inventory';
import { ResilientImage } from './ResilientImage';

interface OfflineSyncViewProps {
  isOnline: boolean;
  browserOnline: boolean;
  simulatedOffline: boolean;
  onToggleSimulatedOffline: (next: boolean) => void;
  syncQueue: SyncQueueEntry[];
  syncing: boolean;
  onSyncNow: () => Promise<void>;
  items: InventoryItem[];
  recentlyViewed: RecentlyViewedEntry[];
  cacheStats: { count: number; totalBytes: number };
  onCacheAllPhotos: () => Promise<void>;
  onClearMediaCache: () => Promise<void>;
  onSelectItem: (item: InventoryItem) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const OfflineSyncView: React.FC<OfflineSyncViewProps> = ({
  isOnline,
  browserOnline,
  simulatedOffline,
  onToggleSimulatedOffline,
  syncQueue,
  syncing,
  onSyncNow,
  items,
  recentlyViewed,
  cacheStats,
  onCacheAllPhotos,
  onClearMediaCache,
  onSelectItem,
}) => {
  const [cachingAll, setCachingAll] = useState(false);

  const recentItems = recentlyViewed
    .map((entry) => ({
      entry,
      item: items.find((i) => i.id === entry.itemId && i.syncState !== 'pending_delete'),
    }))
    .filter((pair): pair is { entry: RecentlyViewedEntry; item: InventoryItem } => Boolean(pair.item));

  const handleCacheAll = async () => {
    setCachingAll(true);
    try {
      await onCacheAllPhotos();
    } finally {
      setCachingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connectivity & Sync Status Card */}
      <section className="rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                isOnline
                  ? 'bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                  : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
              }`}
            >
              {isOnline ? <Wifi className="h-6 w-6" /> : <WifiOff className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">
                {isOnline ? 'Connected & Ready to Sync' : 'Working Offline from Local Vault'}
              </h2>
              <p className="mt-1 text-sm text-[var(--m3-on-surface-variant)]">
                {isOnline
                  ? 'Changes sync automatically. Toggle offline mode below to test warehouse floor access without connectivity.'
                  : !browserOnline
                  ? 'Device network is disconnected. New uploads and stock edits are queued locally in IndexedDB.'
                  : 'Simulated offline mode is active. New uploads and edits will wait in the sync queue until reconnected.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={simulatedOffline}
              onClick={() => onToggleSimulatedOffline(!simulatedOffline)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                simulatedOffline
                  ? 'border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-200'
                  : 'border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] text-[var(--m3-on-surface)] hover:bg-[var(--m3-surface-container-high)]'
              }`}
            >
              <CloudOff className="h-4 w-4" aria-hidden="true" />
              {simulatedOffline ? 'Go Back Online' : 'Simulate Offline Mode'}
            </button>

            <button
              type="button"
              disabled={!isOnline || syncing || syncQueue.length === 0}
              onClick={() => void onSyncNow()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[var(--m3-primary)] px-5 text-sm font-semibold text-[var(--m3-on-primary)] transition-transform active:scale-[0.98] disabled:opacity-45 whitespace-nowrap"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />
              {syncing ? 'Syncing...' : `Sync Now (${syncQueue.length})`}
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pending Sync Queue */}
        <section
          aria-labelledby="sync-queue-heading"
          className="lg:col-span-7 rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 id="sync-queue-heading" className="font-display text-base font-bold">
                Pending Upload & Edit Queue
              </h3>
              <p className="text-xs text-[var(--m3-on-surface-variant)]">
                Coalesced offline mutations waiting to reconcile when online.
              </p>
            </div>
            <span
              data-testid="sync-queue-count"
              className="font-mono text-sm font-semibold text-[var(--m3-on-surface-variant)] tabular-nums"
            >
              {syncQueue.length} pending
            </span>
          </div>

          {syncQueue.length === 0 ? (
            <div className="rounded-2xl bg-[var(--m3-surface-container-low)] p-6 text-center">
              <CheckCircle2
                className="mx-auto h-7 w-7 text-emerald-700 dark:text-emerald-400"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-semibold">All catalogue records are up to date</p>
              <p className="mt-1 text-xs text-[var(--m3-on-surface-variant)]">
                Any photos uploaded or stock adjustments made while offline will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--m3-outline-variant)]">
              {syncQueue.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{entry.itemTitle}</p>
                    <p className="text-xs font-mono text-[var(--m3-on-surface-variant)]">
                      {entry.itemSku} · {entry.operation.toUpperCase()} ·{' '}
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 shrink-0">
                    Queued
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Device Local Cache Storage */}
        <section
          aria-labelledby="device-cache-heading"
          className="lg:col-span-5 rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-5 sm:p-6 flex flex-col justify-between gap-5"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--m3-surface-container)] text-[var(--m3-primary)]">
                <HardDrive className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 id="device-cache-heading" className="font-display text-base font-bold">
                  Local Device Media Cache
                </h3>
                <p className="text-xs text-[var(--m3-on-surface-variant)]">
                  IndexedDB + Service Worker asset storage
                </p>
              </div>
            </div>

            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between border-b border-[var(--m3-outline-variant)] pb-2">
                <dt className="text-[var(--m3-on-surface-variant)]">Cached Photos</dt>
                <dd className="font-mono font-semibold tabular-nums">{cacheStats.count} files</dd>
              </div>
              <div className="flex justify-between border-b border-[var(--m3-outline-variant)] pb-2">
                <dt className="text-[var(--m3-on-surface-variant)]">Local Footprint</dt>
                <dd className="font-mono font-semibold tabular-nums">
                  {formatBytes(cacheStats.totalBytes)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--m3-on-surface-variant)]">Catalogue Records</dt>
                <dd className="font-mono font-semibold tabular-nums">
                  {items.filter((i) => i.syncState !== 'pending_delete').length} items
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={!isOnline || cachingAll}
              onClick={() => void handleCacheAll()}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--m3-primary-container)] px-4 text-sm font-semibold text-[var(--m3-on-primary-container)] hover:opacity-90 disabled:opacity-50"
            >
              {cachingAll ? 'Caching Catalogue Photos...' : 'Pre-Cache All Photos for Offline'}
            </button>
            <button
              type="button"
              onClick={() => void onClearMediaCache()}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-[var(--m3-outline-variant)] px-4 text-sm font-medium text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container)]"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear Cached Photo Copies
            </button>
          </div>
        </section>
      </div>

      {/* Recently Viewed Cached Photos */}
      <section aria-labelledby="recently-viewed-heading" className="space-y-3">
        <div>
          <h3 id="recently-viewed-heading" className="font-display text-lg font-bold">
            Recently Viewed (Available Offline)
          </h3>
          <p className="text-sm text-[var(--m3-on-surface-variant)]">
            Every item you inspect is automatically retained locally for instant offline recall.
          </p>
        </div>

        {recentItems.length === 0 ? (
          <div className="rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-6 text-sm text-[var(--m3-on-surface-variant)]">
            Open any item from the Catalogue to automatically pin it to your recently viewed offline history.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentItems.map(({ entry, item }) => (
              <button
                key={entry.itemId}
                type="button"
                onClick={() => onSelectItem(item)}
                className="text-left overflow-hidden rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] hover:-translate-y-0.5 transition-transform"
              >
                <ResilientImage
                  src={item.previewUrl || item.mediaKey}
                  alt={item.title}
                  aspectClassName="aspect-[4/3]"
                />
                <div className="p-3.5">
                  <p className="text-xs font-mono text-[var(--m3-on-surface-variant)]">{item.sku}</p>
                  <p className="mt-0.5 text-sm font-semibold truncate">{item.title}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
