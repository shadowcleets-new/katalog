import type { PhotoAspectPreset, PhotoEditParams, PhotoFilterPreset } from '../types/inventory';

export const DEFAULT_PHOTO_EDIT_PARAMS: PhotoEditParams = {
  aspect: '4:3',
  rotation: 0,
  straighten: 0,
  flipX: false,
  zoom: 1,
  panX: 0,
  panY: 0,
  filter: 'original',
  brightness: 100,
  contrast: 100,
  saturation: 100,
};

export interface FilterPresetMeta {
  id: PhotoFilterPreset;
  label: string;
  cssBase: string;
  /** Lightweight pixel-pipeline modifiers matching cssBase for fast CPU export */
  brightnessMul: number;
  contrastMul: number;
  saturationMul: number;
  sepiaAmount: number;
  coolShift: number;
  grayscale: boolean;
}

export const PHOTO_FILTER_PRESETS: readonly FilterPresetMeta[] = [
  {
    id: 'original',
    label: 'Original',
    cssBase: '',
    brightnessMul: 1,
    contrastMul: 1,
    saturationMul: 1,
    sepiaAmount: 0,
    coolShift: 0,
    grayscale: false,
  },
  {
    id: 'crisp',
    label: 'Studio Crisp',
    cssBase: 'contrast(1.12) brightness(1.04) saturate(1.06)',
    brightnessMul: 1.04,
    contrastMul: 1.12,
    saturationMul: 1.06,
    sepiaAmount: 0,
    coolShift: 0,
    grayscale: false,
  },
  {
    id: 'warm',
    label: 'Warm Daylight',
    cssBase: 'sepia(0.18) saturate(1.18) brightness(1.03)',
    brightnessMul: 1.03,
    contrastMul: 1.0,
    saturationMul: 1.18,
    sepiaAmount: 0.18,
    coolShift: 0,
    grayscale: false,
  },
  {
    id: 'cool',
    label: 'Cool Steel',
    cssBase: 'hue-rotate(-10deg) saturate(0.92) contrast(1.08)',
    brightnessMul: 1.0,
    contrastMul: 1.08,
    saturationMul: 0.92,
    sepiaAmount: 0,
    coolShift: 0.12,
    grayscale: false,
  },
  {
    id: 'mono',
    label: 'Monochrome',
    cssBase: 'grayscale(1) contrast(1.14)',
    brightnessMul: 1.0,
    contrastMul: 1.14,
    saturationMul: 0,
    sepiaAmount: 0,
    coolShift: 0,
    grayscale: true,
  },
  {
    id: 'contrast',
    label: 'High Contrast',
    cssBase: 'contrast(1.28) saturate(1.12)',
    brightnessMul: 1.0,
    contrastMul: 1.28,
    saturationMul: 1.12,
    sepiaAmount: 0,
    coolShift: 0,
    grayscale: false,
  },
] as const;

export const PHOTO_ASPECT_PRESETS: readonly { id: PhotoAspectPreset; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Original', ratio: null },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
] as const;

export function getAspectRatioNumeric(
  aspect: PhotoAspectPreset,
  sourceWidth: number,
  sourceHeight: number
): number {
  const safeW = Math.max(1, sourceWidth);
  const safeH = Math.max(1, sourceHeight);
  switch (aspect) {
    case '1:1':
      return 1;
    case '4:3':
      return 4 / 3;
    case '16:9':
      return 16 / 9;
    case '3:4':
      return 3 / 4;
    case 'free':
    default:
      return safeW / safeH;
  }
}

export function buildCanvasFilterString(
  params: Pick<PhotoEditParams, 'filter' | 'brightness' | 'contrast' | 'saturation'>
): string {
  const preset = PHOTO_FILTER_PRESETS.find((p) => p.id === params.filter);
  const parts: string[] = [];
  if (preset && preset.cssBase) {
    parts.push(preset.cssBase);
  }
  if (params.brightness !== 100) {
    parts.push(`brightness(${(params.brightness / 100).toFixed(2)})`);
  }
  if (params.contrast !== 100) {
    parts.push(`contrast(${(params.contrast / 100).toFixed(2)})`);
  }
  if (params.saturation !== 100) {
    parts.push(`saturate(${(params.saturation / 100).toFixed(2)})`);
  }
  return parts.length > 0 ? parts.join(' ') : 'none';
}

export interface OutputDimensions {
  width: number;
  height: number;
}

/** Computes bounded export canvas dimensions preserving target aspect ratio. */
export function computeExportDimensions(
  sourceWidth: number,
  sourceHeight: number,
  aspect: PhotoAspectPreset,
  rotation: number,
  maxEdge = 720
): OutputDimensions {
  const isQuarterTurn = Math.abs(rotation % 180) === 90;
  const effW = isQuarterTurn ? sourceHeight : sourceWidth;
  const effH = isQuarterTurn ? sourceWidth : sourceHeight;
  const targetRatio = getAspectRatioNumeric(aspect, effW, effH);

  if (targetRatio >= 1) {
    const width = Math.min(maxEdge, Math.max(240, Math.round(effW)));
    const height = Math.max(160, Math.round(width / targetRatio));
    return { width, height };
  }
  const height = Math.min(maxEdge, Math.max(240, Math.round(effH)));
  const width = Math.max(160, Math.round(height * targetRatio));
  return { width, height };
}

export function normalizeRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Fast deterministic CPU color-matrix pass avoiding slow software Skia ctx.filter stalls. */
function applyPixelFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: PhotoEditParams
): void {
  const preset = PHOTO_FILTER_PRESETS.find((p) => p.id === params.filter) ?? PHOTO_FILTER_PRESETS[0];
  const bright = preset.brightnessMul * (params.brightness / 100);
  const contrast = preset.contrastMul * (params.contrast / 100);
  const sat = preset.grayscale ? 0 : preset.saturationMul * (params.saturation / 100);
  const sepia = preset.sepiaAmount;
  const cool = preset.coolShift;

  if (
    Math.abs(bright - 1) < 0.005 &&
    Math.abs(contrast - 1) < 0.005 &&
    Math.abs(sat - 1) < 0.005 &&
    sepia === 0 &&
    cool === 0
  ) {
    return;
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    if (sepia > 0) {
      const sr = r * 0.393 + g * 0.769 + b * 0.189;
      const sg = r * 0.349 + g * 0.686 + b * 0.168;
      const sb = r * 0.272 + g * 0.534 + b * 0.131;
      r = r * (1 - sepia) + sr * sepia;
      g = g * (1 - sepia) + sg * sepia;
      b = b * (1 - sepia) + sb * sepia;
    }

    if (cool > 0) {
      r *= 1 - cool * 0.45;
      b *= 1 + cool * 0.55;
    }

    if (sat !== 1) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = lum + (r - lum) * sat;
      g = lum + (g - lum) * sat;
      b = lum + (b - lum) * sat;
    }

    if (contrast !== 1) {
      r = (r - 128) * contrast + 128;
      g = (g - 128) * contrast + 128;
      b = (b - 128) * contrast + 128;
    }

    if (bright !== 1) {
      r *= bright;
      g *= bright;
      b *= bright;
    }

    d[i] = clampByte(r);
    d[i + 1] = clampByte(g);
    d[i + 2] = clampByte(b);
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Renders an edited image onto a target HTMLCanvasElement with crop, rotation,
 * straighten, flip, zoom, pan, and fast pixel color pipeline (stripping EXIF metadata).
 */
export function renderEditedPhotoToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  params: PhotoEditParams,
  maxEdge = 720
): void {
  const natW = image.naturalWidth || image.width || 800;
  const natH = image.naturalHeight || image.height || 600;
  const { width, height } = computeExportDimensions(natW, natH, params.aspect, params.rotation, maxEdge);

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#12151c';
  ctx.fillRect(0, 0, width, height);

  const totalAngleRad = ((params.rotation + params.straighten) * Math.PI) / 180;
  const isQuarterTurn = Math.abs(params.rotation % 180) === 90;
  const rotW = isQuarterTurn ? natH : natW;
  const rotH = isQuarterTurn ? natW : natH;

  const coverScale = Math.max(width / rotW, height / rotH);
  const straightenBoost = 1 + Math.abs(Math.sin((params.straighten * Math.PI) / 180)) * 0.45;
  const finalScale = coverScale * straightenBoost * Math.max(1, params.zoom);

  const maxOffsetX = Math.max(0, (rotW * finalScale - width) / 2);
  const maxOffsetY = Math.max(0, (rotH * finalScale - height) / 2);
  const offsetX = params.panX * 2 * maxOffsetX;
  const offsetY = params.panY * 2 * maxOffsetY;

  ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
  ctx.rotate(totalAngleRad);
  ctx.scale(params.flipX ? -finalScale : finalScale, finalScale);
  ctx.drawImage(image, -natW / 2, -natH / 2, natW, natH);
  ctx.restore();

  applyPixelFilter(ctx, width, height, params);
}

export async function exportEditedPhotoDataUrl(
  image: HTMLImageElement,
  params: PhotoEditParams,
  maxEdge = 720,
  quality = 0.84
): Promise<string> {
  const canvas = document.createElement('canvas');
  renderEditedPhotoToCanvas(canvas, image, params, maxEdge);
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) {
    return webp;
  }
  return canvas.toDataURL('image/jpeg', quality);
}
