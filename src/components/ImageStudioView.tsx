import React, { useRef, useState } from 'react';
import {
  Download,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { generateVectorArtwork } from '../utils/apiClient';
import { renderPhotoRemixCanvas } from '../utils/imageRemixRenderer';
import {
  resolveImageExportSize,
  sanitizePhotoRemixRecipe,
  sanitizeSvgMarkup,
} from '../utils/nexoraLogic';
import type {
  GeneratedArtwork,
  ImageGenerationMode,
  ReferenceImageInput,
} from '../types/nexora';

const IMAGE_STYLES = [
  'Futuristic Illustration',
  'Realistic Illustration',
  'Isometric 3D Vector',
  'Cyberpunk Neon Minimal',
  'Anime Cel-Shaded',
  'Editorial Geometric',
  'Watercolor & Ink',
  'Scientific Diagram',
];

const ASPECT_RATIOS: Array<'1:1' | '16:9' | '9:16' | '4:3'> = [
  '1:1',
  '16:9',
  '9:16',
  '4:3',
];

function injectSvgExportDimensions(svgMarkup: string, width: number, height: number): string {
  const cleaned = svgMarkup.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    const stripped = attrs
      .replace(/\s+width\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+height\s*=\s*["'][^"']*["']/gi, '');
    return `<svg${stripped} width="${width}" height="${height}">`;
  });
  return cleaned;
}

async function rasterizeSvgToPng(
  svgMarkup: string,
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3'
): Promise<string> {
  const [w, h] = resolveImageExportSize(aspectRatio);
  const sizedSvg = injectSvgExportDimensions(svgMarkup, w, h);
  const svgBlob = new Blob([sizedSvg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not allocate canvas for PNG export.'));
          return;
        }
        ctx.fillStyle = '#090D16';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not rasterize SVG for PNG download.'));
    };
    img.src = url;
  });
}

async function readAndResizeImageFile(file: File): Promise<ReferenceImageInput> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read "${file.name}".`));
    reader.readAsDataURL(file);
  });

  // Resize large photos up to 1280px max edge for fast multimodal uploads & sharp remixing
  const resized = await new Promise<{ dataUrl: string; mimeType: string }>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxEdge = 1280;
      const scale = Math.min(1, maxEdge / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl, mimeType: file.type || 'image/jpeg' });
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const outMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      resolve({
        dataUrl: canvas.toDataURL(outMime, 0.9),
        mimeType: outMime,
      });
    };
    img.onerror = () => resolve({ dataUrl, mimeType: file.type || 'image/jpeg' });
    img.src = dataUrl;
  });

  const commaIdx = resized.dataUrl.indexOf(',');
  const dataBase64 = commaIdx >= 0 ? resized.dataUrl.slice(commaIdx + 1) : resized.dataUrl;

  return {
    id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: file.name || 'reference-image.png',
    mimeType: resized.mimeType,
    dataBase64,
    previewUrl: resized.dataUrl,
  };
}

export const ImageStudioView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<ImageGenerationMode>('vector');
  const [style, setStyle] = useState(IMAGE_STYLES[0]);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3'>('1:1');
  const [referenceImages, setReferenceImages] = useState<ReferenceImageInput[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentArtwork, setCurrentArtwork] = useState<GeneratedArtwork | null>(null);
  const [gallery, setGallery] = useState<GeneratedArtwork[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (files: FileList | File[]) => {
    const incoming = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (incoming.length === 0) {
      setError('Please select valid image files (PNG, JPG, WebP, GIF).');
      return;
    }
    setError(null);
    const availableSlots = Math.max(0, 3 - referenceImages.length);
    if (availableSlots === 0) {
      setError('Maximum 3 reference images allowed. Remove one to upload another.');
      return;
    }

    try {
      const processed = await Promise.all(
        incoming.slice(0, availableSlots).map((f) => readAndResizeImageFile(f))
      );
      if (processed.length > 0) {
        setReferenceImages((prev) => [...prev, ...processed].slice(0, 3));
        if (mode === 'vector') {
          setMode('remix');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reference image.');
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      handleFilesSelected(files);
    }
  };

  const removeReferenceImage = (id: string) => {
    const remaining = referenceImages.filter((img) => img.id !== id);
    setReferenceImages(remaining);
    if (remaining.length === 0 && mode === 'remix') {
      setMode('vector');
    }
  };

  const clearAllReferences = () => {
    setReferenceImages([]);
    if (mode === 'remix') {
      setMode('vector');
    }
  };

  const handleUseCurrentAsReference = async () => {
    if (!currentArtwork) return;
    if (referenceImages.length >= 3) {
      setError('Maximum 3 reference images allowed. Remove one first.');
      return;
    }

    if (currentArtwork.imageUrl) {
      const commaIdx = currentArtwork.imageUrl.indexOf(',');
      const dataBase64 =
        commaIdx >= 0 ? currentArtwork.imageUrl.slice(commaIdx + 1) : '';
      const mimeMatch = currentArtwork.imageUrl.match(/^data:([^;]+);/);
      if (dataBase64) {
        setReferenceImages((prev) => [
          ...prev,
          {
            id: `ref_${Date.now()}`,
            name: `${currentArtwork.title.slice(0, 20) || 'output'}.png`,
            mimeType: mimeMatch?.[1] || 'image/png',
            dataBase64,
            previewUrl: currentArtwork.imageUrl!,
          },
        ]);
        if (mode === 'vector') setMode('remix');
        return;
      }
    }

    if (currentArtwork.svgMarkup) {
      try {
        const pngUrl = await rasterizeSvgToPng(
          currentArtwork.svgMarkup,
          currentArtwork.aspectRatio
        );
        const dataBase64 = pngUrl.split(',')[1] || '';
        setReferenceImages((prev) => [
          ...prev,
          {
            id: `ref_${Date.now()}`,
            name: `${currentArtwork.title.slice(0, 20) || 'artwork'}.png`,
            mimeType: 'image/png',
            dataBase64,
            previewUrl: pngUrl,
          },
        ]);
        if (mode === 'vector') setMode('remix');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to prepare reference image.');
      }
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!prompt.trim() && referenceImages.length === 0) || isLoading) return;
    if (mode === 'remix' && referenceImages.length === 0) {
      setError('Upload at least one photo for Photo Remix, or switch to Vector Studio / Pixel AI for text-only prompts.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const previousImageDataUrl =
        editMode && currentArtwork?.imageUrl ? currentArtwork.imageUrl : undefined;
      const prevComma = previousImageDataUrl?.indexOf(',') ?? -1;
      const previousImageBase64 =
        prevComma >= 0 ? previousImageDataUrl!.slice(prevComma + 1) : undefined;
      const prevMimeMatch = previousImageDataUrl?.match(/^data:([^;]+);/);

      const activeMode: ImageGenerationMode =
        mode === 'remix' && referenceImages.length === 0 ? 'vector' : mode;

      const res = await generateVectorArtwork({
        prompt,
        style,
        aspectRatio,
        mode: activeMode,
        previousSvg:
          editMode && currentArtwork?.svgMarkup && activeMode === 'vector'
            ? currentArtwork.svgMarkup
            : undefined,
        previousImageBase64,
        previousImageMimeType: prevMimeMatch?.[1],
        referenceImages: referenceImages.map((img) => ({
          name: img.name,
          mimeType: img.mimeType,
          dataBase64: img.dataBase64,
        })),
      });

      let renderedImageUrl = res.imageUrl;
      let cleanRecipe = res.remixRecipe;
      let resolvedNotes = res.artDirectionNotes || '';
      let resolvedPalette = Array.isArray(res.palette) ? res.palette : [];

      if ((res.mode || activeMode) === 'remix' && referenceImages.length > 0) {
        const sanitizedRecipe = sanitizePhotoRemixRecipe(
          (res.remixRecipe as unknown as Record<string, unknown>) || {},
          prompt,
          style
        );
        cleanRecipe = sanitizedRecipe;
        renderedImageUrl = await renderPhotoRemixCanvas({
          referenceDataUrls: referenceImages.map((r) => r.previewUrl),
          aspectRatio,
          recipe: sanitizedRecipe,
          prompt,
          style,
        });
        if (!resolvedNotes) resolvedNotes = sanitizedRecipe.artDirectionNotes;
        if (resolvedPalette.length === 0) resolvedPalette = sanitizedRecipe.palette;
      }

      const art: GeneratedArtwork = {
        id: `img_${Date.now()}`,
        prompt:
          prompt.trim() || `Styled from ${referenceImages.length} reference image(s)`,
        style,
        aspectRatio,
        mode: res.mode || activeMode,
        referenceCount: referenceImages.length,
        remixRecipe: cleanRecipe,
        title: res.title || cleanRecipe?.title || 'Generated Artwork',
        svgMarkup: res.svgMarkup ? sanitizeSvgMarkup(res.svgMarkup, aspectRatio) : '',
        imageUrl: renderedImageUrl,
        palette: resolvedPalette,
        artDirectionNotes: resolvedNotes,
        createdAt: Date.now(),
      };
      setCurrentArtwork(art);
      setGallery((prev) => [art, ...prev].slice(0, 8));
      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadSvg = () => {
    if (!currentArtwork?.svgMarkup) return;
    const [w, h] = resolveImageExportSize(currentArtwork.aspectRatio);
    const sized = injectSvgExportDimensions(currentArtwork.svgMarkup, w, h);
    const blob = new Blob([sized], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentArtwork.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'nexora-art'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = async () => {
    if (!currentArtwork) return;

    if (currentArtwork.imageUrl) {
      const a = document.createElement('a');
      a.href = currentArtwork.imageUrl;
      a.download = `${currentArtwork.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'nexora-image'}.png`;
      a.click();
      return;
    }

    if (!currentArtwork.svgMarkup) return;
    try {
      const pngUrl = await rasterizeSvgToPng(
        currentArtwork.svgMarkup,
        currentArtwork.aspectRatio
      );
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${currentArtwork.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'nexora-art'}.png`;
      a.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PNG.');
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-6" onPaste={handlePaste}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            AI Image Generator
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Generate detailed vector illustrations from text, or upload photos to transform and remix them in high resolution.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleGenerate}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726] lg:col-span-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Image Engine
              </label>
              <div
                role="group"
                aria-label="Image generation engine"
                className="mt-1.5 grid grid-cols-3 gap-1.5"
              >
                <button
                  type="button"
                  aria-pressed={mode === 'remix'}
                  onClick={() => setMode('remix')}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    mode === 'remix'
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-cyan-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60'
                  }`}
                >
                  Photo Remix
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'vector'}
                  onClick={() => setMode('vector')}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    mode === 'vector'
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-cyan-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60'
                  }`}
                >
                  Vector Studio
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'pixel'}
                  onClick={() => setMode('pixel')}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    mode === 'pixel'
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-cyan-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60'
                  }`}
                >
                  Pixel AI
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {mode === 'remix'
                  ? 'Preserves your real photo(s) with AI-directed color grading, lighting bloom, and atmospheric effects (PNG).'
                  : mode === 'pixel'
                    ? 'Uses gemini-3.1-flash-lite-image (or OpenAI gpt-image-1 if OPENAI_API_KEY is configured in Secrets).'
                    : 'Generates layered multi-gradient SVG artwork with crisp export to PNG or SVG.'}
              </p>
            </div>

            {/* Reference Image Upload Dropzone */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Your Reference Images ({referenceImages.length}/3)
                </label>
                {referenceImages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllReferences}
                    className="text-[11px] font-medium text-slate-500 hover:text-red-500 dark:text-slate-400"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                aria-label="Upload reference images"
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleFilesSelected(e.target.files);
                  }
                  e.target.value = '';
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.length) {
                    handleFilesSelected(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-3 py-3 text-center transition-colors ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-300 bg-slate-50 hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-indigo-500'
                }`}
              >
                <Upload className="h-4 w-4 text-indigo-500" />
                <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                  Upload or drop your image(s)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  PNG, JPG, WebP or paste screenshot (up to 3)
                </p>
              </div>

              {referenceImages.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {referenceImages.map((img) => (
                    <div
                      key={img.id}
                      className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700"
                    >
                      <img
                        src={img.previewUrl}
                        alt={img.name}
                        className="h-16 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeReferenceImage(img.id);
                        }}
                        aria-label={`Remove ${img.name}`}
                        className="absolute top-1 right-1 rounded-full bg-slate-950/80 p-0.5 text-white hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="image-prompt"
                className="block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                {editMode
                  ? 'Edit Current Artwork'
                  : referenceImages.length > 0
                    ? 'Instructions for Your Image(s)'
                    : 'Describe Your Image'}
              </label>
              <textarea
                id="image-prompt"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  editMode
                    ? 'e.g., Add glowing rings and shift the sky to deep emerald...'
                    : referenceImages.length > 0
                      ? 'e.g., Cyberpunk neon rain mood with dramatic cyan glow...'
                      : 'e.g., Futuristic mountain observatory above glowing aurora clouds...'
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="image-style"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Art Style
              </label>
              <select
                id="image-style"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                {IMAGE_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Aspect Ratio
              </label>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                      aspectRatio === ratio
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-cyan-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {currentArtwork && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Refine previous image
                </span>
                <button
                  type="button"
                  onClick={() => setEditMode((v) => !v)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                    editMode
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {editMode ? 'Editing' : 'Off'}
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={(!prompt.trim() && referenceImages.length === 0) || isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-45"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {mode === 'remix' && referenceImages.length > 0
                      ? 'Remixing Your Photo...'
                      : 'Generating Artwork...'}
                  </span>
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  <span>
                    {editMode
                      ? 'Apply Edit'
                      : referenceImages.length > 0
                        ? mode === 'remix'
                          ? 'Remix Photo'
                          : 'Generate from Image'
                        : 'Generate Image'}
                  </span>
                </>
              )}
            </button>
          </form>

          <div className="space-y-4 lg:col-span-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#101726]">
              {currentArtwork ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                          {currentArtwork.title}
                        </h2>
                        <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-cyan-300">
                          {currentArtwork.mode === 'remix'
                            ? 'Photo Remix'
                            : currentArtwork.mode === 'pixel'
                              ? 'Pixel AI'
                              : 'Vector SVG'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {currentArtwork.style} · {currentArtwork.aspectRatio}
                        {currentArtwork.referenceCount
                          ? ` · From ${currentArtwork.referenceCount} reference image${currentArtwork.referenceCount > 1 ? 's' : ''}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUseCurrentAsReference}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <ImagePlus className="h-3.5 w-3.5 text-cyan-500" />
                        <span>Use as Reference</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadPng}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-500 whitespace-nowrap"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download PNG</span>
                      </button>
                      {currentArtwork.svgMarkup && (
                        <button
                          type="button"
                          onClick={handleDownloadSvg}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>SVG</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {currentArtwork.imageUrl ? (
                    <div className="flex max-h-[460px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-[#090D16] p-3 dark:border-slate-800">
                      <img
                        src={currentArtwork.imageUrl}
                        alt={currentArtwork.title}
                        className="max-h-[430px] max-w-full rounded-lg object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      data-testid="svg-artwork-stage"
                      className="flex max-h-[460px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-[#090D16] p-3 dark:border-slate-800 [&>svg]:h-auto [&>svg]:max-h-[430px] [&>svg]:w-full [&>svg]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: currentArtwork.svgMarkup }}
                    />
                  )}

                  {currentArtwork.palette.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>Palette:</span>
                      {currentArtwork.palette.map((hex) => (
                        <span key={hex} className="inline-flex items-center gap-1.5 font-mono">
                          <span
                            className="inline-block h-3.5 w-3.5 rounded-sm border border-white/20"
                            style={{ backgroundColor: hex }}
                          />
                          {hex}
                        </span>
                      ))}
                    </div>
                  )}

                  {currentArtwork.artDirectionNotes && (
                    <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                      <span>{currentArtwork.artDirectionNotes}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                  <ImageIcon className="h-10 w-10 text-slate-400 dark:text-slate-600" />
                  <p className="mt-3 font-display text-base font-semibold text-slate-900 dark:text-slate-200">
                    Your generated artwork will appear here
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                    Upload your photo to use Photo Remix with AI lighting and effects, or switch to Vector Studio / Pixel AI to generate from text.
                  </p>
                </div>
              )}
            </div>

            {gallery.length > 1 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#101726]">
                <h3 className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Recent Creations
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {gallery.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCurrentArtwork(item)}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-[#090D16] p-1 text-left transition-colors hover:border-indigo-500 dark:border-slate-800"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="aspect-square w-full rounded-lg object-cover"
                        />
                      ) : (
                        <div
                          className="aspect-square overflow-hidden rounded-lg [&>svg]:h-full [&>svg]:w-full"
                          dangerouslySetInnerHTML={{ __html: item.svgMarkup }}
                        />
                      )}
                      <p className="truncate px-1 py-1 text-xs font-medium text-slate-200">
                        {item.title}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
