import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Crop,
  FlipHorizontal2,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import type { PhotoAspectPreset, PhotoEditParams, PhotoFilterPreset } from '../types/inventory';
import {
  DEFAULT_PHOTO_EDIT_PARAMS,
  PHOTO_ASPECT_PRESETS,
  PHOTO_FILTER_PRESETS,
  buildCanvasFilterString,
  exportEditedPhotoDataUrl,
  getAspectRatioNumeric,
  normalizeRotation,
} from '../utils/imageTransform';

interface PhotoEditorModalProps {
  sourceUrl: string;
  initialParams?: Partial<PhotoEditParams>;
  onCancel: () => void;
  onApply: (result: {
    dataUrl: string;
    aspect: PhotoAspectPreset;
    filter: PhotoFilterPreset;
    params: PhotoEditParams;
  }) => void;
}

type EditorTab = 'crop' | 'rotate' | 'filters';

export const PhotoEditorModal: React.FC<PhotoEditorModalProps> = ({
  sourceUrl,
  initialParams,
  onCancel,
  onApply,
}) => {
  const [params, setParams] = useState<PhotoEditParams>({
    ...DEFAULT_PHOTO_EDIT_PARAMS,
    ...initialParams,
  });
  const [activeTab, setActiveTab] = useState<EditorTab>('crop');
  const [imageReady, setImageReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [natSize, setNatSize] = useState({ width: 800, height: 600 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setImageReady(false);
    setLoadError(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setNatSize({ width: img.naturalWidth || 800, height: img.naturalHeight || 600 });
      setImageReady(true);
    };
    img.onerror = () => {
      setLoadError('Unable to decode this image for editing. Try another photo.');
    };
    img.src = sourceUrl;
  }, [sourceUrl]);

  const handleApply = async () => {
    if (!imageRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await exportEditedPhotoDataUrl(imageRef.current, params, 720, 0.84);
      onApply({
        dataUrl,
        aspect: params.aspect,
        filter: params.filter,
        params,
      });
    } catch {
      setLoadError('Failed to export edited image.');
    } finally {
      setExporting(false);
    }
  };

  const handleReset = () => {
    setParams({ ...DEFAULT_PHOTO_EDIT_PARAMS });
  };

  const isQuarterTurn = Math.abs(params.rotation % 180) === 90;
  const effW = isQuarterTurn ? natSize.height : natSize.width;
  const effH = isQuarterTurn ? natSize.width : natSize.height;
  const aspectNumeric = getAspectRatioNumeric(params.aspect, effW, effH);
  const filterCss = buildCanvasFilterString(params);
  const straightenBoost = 1 + Math.abs(Math.sin((params.straighten * Math.PI) / 180)) * 0.35;
  const previewScale = params.zoom * straightenBoost * (isQuarterTurn ? 1.25 : 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-editor-heading"
    >
      <div className="flex h-full w-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl flex-col overflow-hidden sm:rounded-3xl bg-[var(--m3-surface-card)] text-[var(--m3-on-surface)] border border-[var(--m3-outline-variant)] shadow-2xl">
        {/* Top Editor App Bar */}
        <header className="flex items-center justify-between gap-4 border-b border-[var(--m3-outline-variant)] px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel photo editing"
              className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container)]"
            >
              <X className="h-5 w-5" />
            </button>
            <div>
              <h2 id="photo-editor-heading" className="font-display text-lg font-bold">
                Photo Studio Editor
              </h2>
              <p className="text-xs text-[var(--m3-on-surface-variant)]">
                Crop, rotate, and enhance before catalogue upload · EXIF stripped
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl px-3.5 text-sm font-medium text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container)] whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset
            </button>
            <button
              type="button"
              disabled={!imageReady || exporting}
              onClick={() => void handleApply()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[var(--m3-primary)] px-5 text-sm font-semibold text-[var(--m3-on-primary)] transition-transform duration-150 hover:opacity-95 active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {exporting ? 'Processing...' : 'Apply Edits'}
            </button>
          </div>
        </header>

        {/* Main Workspace Split */}
        <div className="flex flex-1 flex-col lg:flex-row overflow-y-auto">
          {/* Compositor-Accelerated Live Preview Stage */}
          <div className="relative flex flex-1 min-h-[260px] sm:min-h-[360px] items-center justify-center bg-[#12151c] p-6">
            {loadError ? (
              <div className="max-w-xs text-center text-sm text-red-300">{loadError}</div>
            ) : !imageReady ? (
              <div className="text-sm text-slate-300">Preparing image preview...</div>
            ) : (
              <div
                data-testid="photo-editor-canvas"
                style={{ aspectRatio: String(aspectNumeric) }}
                className="relative w-full max-w-[460px] max-h-[380px] overflow-hidden rounded-2xl border border-white/25 bg-[#0c0e13] shadow-xl flex items-center justify-center"
              >
                <img
                  src={sourceUrl}
                  alt="Live photo edit preview"
                  referrerPolicy="no-referrer"
                  style={{
                    filter: filterCss === 'none' ? undefined : filterCss,
                    transform: `translate(${params.panX * 40}%, ${params.panY * 40}%) rotate(${
                      params.rotation + params.straighten
                    }deg) scale(${params.flipX ? -previewScale : previewScale}, ${previewScale})`,
                  }}
                  className="h-full w-full object-cover transition-transform duration-100 select-none"
                />
                {/* Rule-of-thirds overlay visible on Crop & Rotate tabs */}
                {(activeTab === 'crop' || activeTab === 'rotate') && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-2xl border border-white/30"
                  >
                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/25" />
                    <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/25" />
                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white/25" />
                    <div className="absolute top-2/3 left-0 right-0 h-px bg-white/25" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tool Controls Sidebar */}
          <aside className="w-full lg:w-[340px] border-t lg:border-t-0 lg:border-l border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] flex flex-col">
            {/* Tool Mode Tabs */}
            <div
              role="tablist"
              aria-label="Photo editing tools"
              className="grid grid-cols-3 gap-1 p-2 border-b border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container)]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'crop'}
                onClick={() => setActiveTab('crop')}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors ${
                  activeTab === 'crop'
                    ? 'bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                    : 'text-[var(--m3-on-surface-variant)] hover:text-[var(--m3-on-surface)]'
                }`}
              >
                <Crop className="h-4 w-4" aria-hidden="true" />
                Crop
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'rotate'}
                onClick={() => setActiveTab('rotate')}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors ${
                  activeTab === 'rotate'
                    ? 'bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                    : 'text-[var(--m3-on-surface-variant)] hover:text-[var(--m3-on-surface)]'
                }`}
              >
                <RotateCw className="h-4 w-4" aria-hidden="true" />
                Rotate
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'filters'}
                onClick={() => setActiveTab('filters')}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors ${
                  activeTab === 'filters'
                    ? 'bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                    : 'text-[var(--m3-on-surface-variant)] hover:text-[var(--m3-on-surface)]'
                }`}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Filters
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {activeTab === 'crop' && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-[var(--m3-on-surface-variant)] mb-2.5">
                      Aspect Ratio Frame
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {PHOTO_ASPECT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setParams((p) => ({ ...p, aspect: preset.id }))}
                          className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold transition-colors ${
                            params.aspect === preset.id
                              ? 'border-[var(--m3-primary)] bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                              : 'border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] text-[var(--m3-on-surface)] hover:bg-[var(--m3-surface-container)]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <label htmlFor="editor-zoom" className="font-medium">
                        Crop Zoom
                      </label>
                      <span className="font-mono text-xs text-[var(--m3-on-surface-variant)] tabular-nums">
                        {params.zoom.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      id="editor-zoom"
                      type="range"
                      min={1}
                      max={2.4}
                      step={0.05}
                      value={params.zoom}
                      onChange={(e) => setParams((p) => ({ ...p, zoom: Number(e.target.value) }))}
                      className="w-full accent-[var(--m3-primary)] h-2 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <label htmlFor="editor-pan-x" className="font-medium">
                        Horizontal Framing
                      </label>
                      <span className="font-mono text-xs text-[var(--m3-on-surface-variant)] tabular-nums">
                        {Math.round(params.panX * 100)}%
                      </span>
                    </div>
                    <input
                      id="editor-pan-x"
                      type="range"
                      min={-0.5}
                      max={0.5}
                      step={0.02}
                      value={params.panX}
                      onChange={(e) => setParams((p) => ({ ...p, panX: Number(e.target.value) }))}
                      className="w-full accent-[var(--m3-primary)] h-2 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <label htmlFor="editor-pan-y" className="font-medium">
                        Vertical Framing
                      </label>
                      <span className="font-mono text-xs text-[var(--m3-on-surface-variant)] tabular-nums">
                        {Math.round(params.panY * 100)}%
                      </span>
                    </div>
                    <input
                      id="editor-pan-y"
                      type="range"
                      min={-0.5}
                      max={0.5}
                      step={0.02}
                      value={params.panY}
                      onChange={(e) => setParams((p) => ({ ...p, panY: Number(e.target.value) }))}
                      className="w-full accent-[var(--m3-primary)] h-2 cursor-pointer"
                    />
                  </div>
                </>
              )}

              {activeTab === 'rotate' && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-[var(--m3-on-surface-variant)] mb-2.5">
                      Orientation
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setParams((p) => ({ ...p, rotation: normalizeRotation(p.rotation - 90) }))
                        }
                        className="flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-2 text-xs font-semibold hover:bg-[var(--m3-surface-container)]"
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        Rotate Left
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setParams((p) => ({ ...p, rotation: normalizeRotation(p.rotation + 90) }))
                        }
                        className="flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-2 text-xs font-semibold hover:bg-[var(--m3-surface-container)]"
                      >
                        <RotateCw className="h-4 w-4" aria-hidden="true" />
                        Rotate Right
                      </button>
                      <button
                        type="button"
                        onClick={() => setParams((p) => ({ ...p, flipX: !p.flipX }))}
                        aria-pressed={params.flipX}
                        className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs font-semibold ${
                          params.flipX
                            ? 'border-[var(--m3-primary)] bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                            : 'border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] hover:bg-[var(--m3-surface-container)]'
                        }`}
                      >
                        <FlipHorizontal2 className="h-4 w-4" aria-hidden="true" />
                        Flip
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-[var(--m3-on-surface-variant)] font-mono tabular-nums">
                      Current turn: {params.rotation}° {params.flipX ? '· Mirrored' : ''}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <label htmlFor="editor-straighten" className="font-medium">
                        Fine Straighten
                      </label>
                      <span className="font-mono text-xs text-[var(--m3-on-surface-variant)] tabular-nums">
                        {params.straighten > 0 ? `+${params.straighten}°` : `${params.straighten}°`}
                      </span>
                    </div>
                    <input
                      id="editor-straighten"
                      type="range"
                      min={-45}
                      max={45}
                      step={1}
                      value={params.straighten}
                      onChange={(e) => setParams((p) => ({ ...p, straighten: Number(e.target.value) }))}
                      className="w-full accent-[var(--m3-primary)] h-2 cursor-pointer"
                    />
                  </div>
                </>
              )}

              {activeTab === 'filters' && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-[var(--m3-on-surface-variant)] mb-2.5">
                      Catalogue Presets
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {PHOTO_FILTER_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setParams((p) => ({ ...p, filter: preset.id }))}
                          className={`min-h-[44px] rounded-xl border px-3 text-left text-sm font-semibold transition-colors ${
                            params.filter === preset.id
                              ? 'border-[var(--m3-primary)] bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                              : 'border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] text-[var(--m3-on-surface)] hover:bg-[var(--m3-surface-container)]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-2 border-t border-[var(--m3-outline-variant)]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--m3-on-surface-variant)]">
                      <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                      Fine Adjustments
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <label htmlFor="editor-brightness" className="font-medium">
                          Brightness
                        </label>
                        <span className="font-mono text-xs text-[var(--m3-on-surface-variant)] tabular-nums">
                          {params.brightness}%
                        </span>
                      </div>
                      <input
                        id="editor-brightness"
                        type="range"
                        min={60}
                        max={140}
                        step={2}
                        value={params.brightness}
                        onChange={(e) => setParams((p) => ({ ...p, brightness: Number(e.target.value) }))}
                        className="w-full accent-[var(--m3-primary)] h-2 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <label htmlFor="editor-contrast" className="font-medium">
                          Contrast
                        </label>
                        <span className="font-mono text-xs text-[var(--m3-on-surface-variant)] tabular-nums">
                          {params.contrast}%
                        </span>
                      </div>
                      <input
                        id="editor-contrast"
                        type="range"
                        min={60}
                        max={150}
                        step={2}
                        value={params.contrast}
                        onChange={(e) => setParams((p) => ({ ...p, contrast: Number(e.target.value) }))}
                        className="w-full accent-[var(--m3-primary)] h-2 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <label htmlFor="editor-saturation" className="font-medium">
                          Saturation
                        </label>
                        <span className="font-mono text-xs text-[var(--m3-on-surface-variant)] tabular-nums">
                          {params.saturation}%
                        </span>
                      </div>
                      <input
                        id="editor-saturation"
                        type="range"
                        min={0}
                        max={180}
                        step={5}
                        value={params.saturation}
                        onChange={(e) => setParams((p) => ({ ...p, saturation: Number(e.target.value) }))}
                        className="w-full accent-[var(--m3-primary)] h-2 cursor-pointer"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
