import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateKarigarsDirectory,
  computeInventoryMetrics,
  computeTotalStockFromSizes,
  deriveDesignStatus,
  deriveStockStatus,
  enqueueSyncMutation,
  evaluatePasswordStrength,
  filterAndSortInventory,
  formatInr,
  getPriceRangeLabel,
  normalizeSku,
  pruneSelectionIds,
  sortSizesLogically,
  toggleSelectAllVisible,
  toggleSelectionId,
  validateInventoryForm,
} from './inventoryLogic';
import { createSeedInventory } from '../data/seedInventory';
import type { SyncQueueEntry } from '../types/inventory';

test('normalizeSku trims, uppercases, and hyphenates spaces', () => {
  assert.equal(normalizeSku('  sk 104 chr '), 'SK-104-CHR');
});

test('sortSizesLogically orders standard apparel sizes XS through 3XL before custom sizes', () => {
  const sorted = sortSizesLogically([
    { size: 'XXL', stock: 4, price: 2100 },
    { size: 'Custom-44', stock: 2, price: 2400 },
    { size: 'S', stock: 10, price: 1750 },
    { size: '3XL', stock: 1, price: 2300 },
    { size: 'L', stock: 12, price: 1850 },
    { size: 'M', stock: 8, price: 1800 },
    { size: 'XL', stock: 6, price: 1950 },
  ]);
  assert.deepEqual(
    sorted.map((s) => s.size),
    ['S', 'M', 'L', 'XL', 'XXL', '3XL', 'Custom-44']
  );
});

test('formatInr and getPriceRangeLabel format whole Indian rupees cleanly', () => {
  assert.equal(formatInr(1850), '₹1,850');
  assert.equal(formatInr(125000), '₹1,25,000');
  assert.equal(
    getPriceRangeLabel([
      { size: 'M', stock: 10, price: 1850 },
      { size: '3XL', stock: 3, price: 2300 },
    ]),
    '₹1,850 – ₹2,300'
  );
  assert.equal(
    getPriceRangeLabel([
      { size: 'M', stock: 10, price: 1500 },
      { size: 'L', stock: 10, price: 1500 },
    ]),
    '₹1,500'
  );
});

test('computeTotalStockFromSizes and deriveDesignStatus inspect the full size matrix', () => {
  const healthy = [
    { size: 'M', stock: 10, price: 1200 },
    { size: 'L', stock: 12, price: 1250 },
  ];
  assert.equal(computeTotalStockFromSizes(healthy), 22);
  assert.equal(deriveDesignStatus(healthy, 5), 'in_stock');

  const partialLow = [
    { size: 'M', stock: 10, price: 1200 },
    { size: '3XL', stock: 0, price: 1500 },
  ];
  assert.equal(deriveDesignStatus(partialLow, 5), 'low_stock');

  const allZero = [
    { size: 'M', stock: 0, price: 1200 },
    { size: 'L', stock: 0, price: 1250 },
  ];
  assert.equal(deriveDesignStatus(allZero, 5), 'out_of_stock');
  assert.equal(deriveDesignStatus(allZero, 5, 'audit_pending'), 'audit_pending');
});

test('deriveStockStatus transitions accurately while preserving audit_pending', () => {
  assert.equal(deriveStockStatus(0, 5), 'out_of_stock');
  assert.equal(deriveStockStatus(4, 5), 'low_stock');
  assert.equal(deriveStockStatus(12, 5), 'in_stock');
  assert.equal(deriveStockStatus(12, 5, 'audit_pending'), 'audit_pending');
});

test('validateInventoryForm rejects invalid SKU, duplicate sizes, negative price, and missing fabric', () => {
  const errors = validateInventoryForm({
    sku: 'bad sku!',
    title: 'A',
    category: 'Chanderi',
    location: '',
    minThreshold: 5,
    status: 'in_stock',
    sizes: [
      { size: 'L', stock: 5, price: 1500 },
      { size: 'l', stock: 3, price: 1600 },
    ],
    lastKarigarName: '',
    lastKarigarStage: '',
    lastKarigarDate: '',
    karigars: [],
    rawMaterials: {
      topFabric: '',
      colorShade: '',
      bottomFabric: '',
      dupattaFabric: '',
      materialNotes: '',
    },
    notes: '',
  });
  assert.ok(errors.sku);
  assert.ok(errors.title);
  assert.ok(errors.location);
  assert.ok(errors.sizes);
  assert.ok(errors.topFabric);
  assert.ok(errors.colorShade);
});

test('validateInventoryForm accepts clean Salwar Kameez design values', () => {
  const errors = validateInventoryForm({
    sku: 'SK-710-CHND',
    title: 'Lotus Chanderi Festive Suit',
    category: 'Chanderi',
    location: 'Rack A · Packing Unit 2',
    minThreshold: 5,
    status: 'in_stock',
    sizes: [
      { size: 'M', stock: 12, price: 1950 },
      { size: 'L', stock: 10, price: 2050 },
      { size: 'XL', stock: 8, price: 2150 },
    ],
    lastKarigarName: 'Salim Master',
    lastKarigarStage: 'Cutting & Stitching',
    lastKarigarDate: '2026-11-19',
    karigars: [
      {
        stage: 'Cutting & Stitching',
        karigarName: 'Salim Master',
        unitOrNote: 'Dadar West Unit',
        dateGiven: '2026-11-19',
      },
    ],
    rawMaterials: {
      topFabric: 'Pure Chanderi Silk-Cotton',
      colorShade: 'Lotus Pink',
      bottomFabric: 'Shantoon Pant',
      dupattaFabric: 'Tissue Organza',
      materialNotes: 'Mangaldass Market Lot 12',
    },
    notes: 'Steam iron before dispatch.',
  });
  assert.deepEqual(errors, {});
});

test('filterAndSortInventory searches by Karigar name, fabric, and excludes pending_delete', () => {
  const items = createSeedInventory('user-1');
  items[0].syncState = 'pending_delete';

  const kathaKarigar = filterAndSortInventory(items, {
    query: 'ruksana',
    category: 'All',
    status: 'All',
    sort: 'quantity_asc',
  });
  assert.equal(kathaKarigar.length, 2);
  assert.equal(kathaKarigar[0].sku, 'SK-609-PLM');

  const fabricResult = filterAndSortInventory(items, {
    query: 'bhagalpuri',
    category: 'All',
    status: 'All',
    sort: 'updated_desc',
  });
  assert.equal(fabricResult.length, 1);
  assert.equal(fabricResult[0].sku, 'SK-501-ANK');
});

test('aggregateKarigarsDirectory groups designs and counts last-given assignments per Karigar', () => {
  const items = createSeedInventory('user-1');
  const directory = aggregateKarigarsDirectory(items);
  assert.ok(directory.length >= 5);

  const ruksana = directory.find((d) => d.karigarName === 'Ruksana Karigar');
  assert.ok(ruksana);
  assert.equal(ruksana.lastGivenCount, 2);
  assert.ok(ruksana.stages.includes('Katha / Handwork'));

  const farooq = directory.find((d) => d.karigarName === 'Farooq Dye House');
  assert.ok(farooq);
  assert.ok(farooq.designs.length >= 4);
});

test('computeInventoryMetrics totals active designs, ready pieces, and alerts', () => {
  const items = createSeedInventory('user-1');
  const metrics = computeInventoryMetrics(items);
  assert.equal(metrics.totalSkus, 6);
  assert.equal(metrics.totalUnits, 44 + 54 + 23 + 34 + 19 + 0);
  assert.equal(metrics.lowOrOutCount, 4);
  assert.equal(metrics.auditPendingCount, 1);
});

test('enqueueSyncMutation coalesces create+update into create and cancels create+delete', () => {
  const createEntry: SyncQueueEntry = {
    id: 'q1',
    itemId: 'item-new',
    operation: 'create',
    timestamp: 100,
    itemTitle: 'New Chanderi Suit',
    itemSku: 'SK-900',
  };
  const updateEntry: SyncQueueEntry = {
    id: 'q2',
    itemId: 'item-new',
    operation: 'update',
    timestamp: 200,
    itemTitle: 'New Chanderi Suit Revised',
    itemSku: 'SK-900',
  };
  const deleteEntry: SyncQueueEntry = {
    id: 'q3',
    itemId: 'item-new',
    operation: 'delete',
    timestamp: 300,
    itemTitle: 'New Chanderi Suit Revised',
    itemSku: 'SK-900',
  };

  const q1 = enqueueSyncMutation([], createEntry);
  assert.equal(q1.length, 1);
  assert.equal(q1[0].operation, 'create');

  const q2 = enqueueSyncMutation(q1, updateEntry);
  assert.equal(q2.length, 1);
  assert.equal(q2[0].operation, 'create');
  assert.equal(q2[0].itemTitle, 'New Chanderi Suit Revised');

  const q3 = enqueueSyncMutation(q2, deleteEntry);
  assert.equal(q3.length, 0);
});

test('evaluatePasswordStrength distinguishes weak and strong passwords', () => {
  assert.equal(evaluatePasswordStrength('abc').score, 0);
  assert.equal(evaluatePasswordStrength('MumbaiAtelier#2026!').score, 4);
});

test('batch selection helpers toggle items, select/deselect visible sets, and prune deleted ids', () => {
  const s1 = toggleSelectionId([], 'a');
  assert.deepEqual(s1, ['a']);
  const s2 = toggleSelectionId(s1, 'b');
  assert.deepEqual(s2, ['a', 'b']);
  const s3 = toggleSelectionId(s2, 'a');
  assert.deepEqual(s3, ['b']);

  const allSelected = toggleSelectAllVisible(['b'], ['a', 'b', 'c']);
  assert.deepEqual(allSelected, ['b', 'a', 'c']);

  const noneVisibleSelected = toggleSelectAllVisible(['x', 'a', 'b'], ['a', 'b']);
  assert.deepEqual(noneVisibleSelected, ['x']);

  const items = createSeedInventory('user-1');
  items[1].syncState = 'pending_delete';
  const pruned = pruneSelectionIds([items[0].id, items[1].id, 'missing-id'], items);
  assert.deepEqual(pruned, [items[0].id]);
});
