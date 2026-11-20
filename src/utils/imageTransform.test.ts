import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCanvasFilterString,
  computeExportDimensions,
  getAspectRatioNumeric,
  normalizeRotation,
} from './imageTransform';

test('getAspectRatioNumeric returns expected ratios across presets', () => {
  assert.equal(getAspectRatioNumeric('1:1', 1200, 900), 1);
  assert.equal(getAspectRatioNumeric('4:3', 1200, 900), 4 / 3);
  assert.equal(getAspectRatioNumeric('16:9', 1200, 900), 16 / 9);
  assert.equal(getAspectRatioNumeric('3:4', 1200, 900), 3 / 4);
  assert.equal(getAspectRatioNumeric('free', 1600, 800), 2);
});

test('computeExportDimensions respects 90-degree rotation and maxEdge limit', () => {
  const square = computeExportDimensions(2000, 1500, '1:1', 0, 960);
  assert.equal(square.width, 960);
  assert.equal(square.height, 960);

  const rotatedFree = computeExportDimensions(1600, 800, 'free', 90, 960);
  // Swapped aspect ratio: 800/1600 = 0.5 -> height capped at 960, width = 480
  assert.equal(rotatedFree.height, 960);
  assert.equal(rotatedFree.width, 480);
});

test('normalizeRotation wraps negative and overflow angles into [0, 360)', () => {
  assert.equal(normalizeRotation(-90), 270);
  assert.equal(normalizeRotation(450), 90);
  assert.equal(normalizeRotation(360), 0);
});

test('buildCanvasFilterString returns none for neutral original and composes sliders', () => {
  assert.equal(
    buildCanvasFilterString({ filter: 'original', brightness: 100, contrast: 100, saturation: 100 }),
    'none'
  );
  const combined = buildCanvasFilterString({
    filter: 'mono',
    brightness: 110,
    contrast: 100,
    saturation: 90,
  });
  assert.ok(combined.includes('grayscale(1)'));
  assert.ok(combined.includes('brightness(1.10)'));
  assert.ok(combined.includes('saturate(0.90)'));
});
