import { resolveImageExportSize, sanitizePhotoRemixRecipe } from './nexoraLogic';
import type { PhotoRemixRecipe } from '../types/nexora';

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load reference image for rendering.'));
    img.src = src;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export async function renderPhotoRemixCanvas(params: {
  referenceDataUrls: string[];
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3';
  recipe: PhotoRemixRecipe;
  prompt?: string;
  style?: string;
}): Promise<string> {
  const safeRecipe = sanitizePhotoRemixRecipe(
    params.recipe as unknown as Record<string, unknown>,
    params.prompt || '',
    params.style || ''
  );

  const [width, height] = resolveImageExportSize(params.aspectRatio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create canvas context for photo remix.');
  }

  const images = await Promise.all(params.referenceDataUrls.slice(0, 3).map(loadHtmlImage));
  if (images.length === 0) {
    throw new Error('At least one reference image is required for Photo Remix.');
  }

  // Draw base image(s) into offscreen buffer first so multi-pass bloom & grading stay crisp
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = width;
  baseCanvas.height = height;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) {
    throw new Error('Could not create offscreen buffer.');
  }

  baseCtx.fillStyle = '#090D16';
  baseCtx.fillRect(0, 0, width, height);

  if (images.length === 1) {
    drawCoverImage(baseCtx, images[0], 0, 0, width, height);
  } else if (images.length === 2) {
    const gap = 8;
    if (width >= height) {
      const panelW = (width - gap) / 2;
      drawCoverImage(baseCtx, images[0], 0, 0, panelW, height);
      drawCoverImage(baseCtx, images[1], panelW + gap, 0, panelW, height);
    } else {
      const panelH = (height - gap) / 2;
      drawCoverImage(baseCtx, images[0], 0, 0, width, panelH);
      drawCoverImage(baseCtx, images[1], 0, panelH + gap, width, panelH);
    }
  } else {
    const gap = 8;
    const leftW = Math.round(width * 0.56);
    const rightW = width - leftW - gap;
    const rightH = (height - gap) / 2;
    drawCoverImage(baseCtx, images[0], 0, 0, leftW, height);
    drawCoverImage(baseCtx, images[1], leftW + gap, 0, rightW, rightH);
    drawCoverImage(baseCtx, images[2], leftW + gap, rightH + gap, rightW, rightH);
  }

  // Pass 1: Graded subject render
  ctx.save();
  ctx.filter = [
    `brightness(${safeRecipe.brightness})`,
    `contrast(${safeRecipe.contrast})`,
    `saturate(${safeRecipe.saturate})`,
    `hue-rotate(${safeRecipe.hueRotate}deg)`,
    `sepia(${safeRecipe.sepia})`,
  ].join(' ');
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.restore();

  // Pass 2: Soft atmospheric bloom
  if (safeRecipe.bloom > 0.02) {
    ctx.save();
    ctx.globalAlpha = safeRecipe.bloom;
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = `blur(${Math.round(Math.min(width, height) * 0.022)}px) brightness(1.15) saturate(1.25)`;
    ctx.drawImage(baseCanvas, 0, 0);
    ctx.restore();
  }

  // Pass 3: Directional mood & color grading gradient wash
  if (safeRecipe.tintOpacity > 0.01) {
    ctx.save();
    ctx.globalAlpha = safeRecipe.tintOpacity;
    ctx.globalCompositeOperation = safeRecipe.blendMode;
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, safeRecipe.tintTopColor);
    grad.addColorStop(1, safeRecipe.tintBottomColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Pass 4: Edge stylization overlays
  if (safeRecipe.edgeStyle === 'cyber-scan') {
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = safeRecipe.tintBottomColor;
    for (let y = 0; y < height; y += 6) {
      ctx.fillRect(0, y, width, 1);
    }
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = safeRecipe.tintTopColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 18, width - 36, height - 36);
    ctx.restore();
  } else if (safeRecipe.edgeStyle === 'comic-ink') {
    ctx.save();
    ctx.strokeStyle = '#090D16';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, width - 10, height - 10);
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, width - 28, height - 28);
    ctx.restore();
  } else if (safeRecipe.edgeStyle === 'film-noir') {
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Pass 5: Atmospheric particles (rain, neon sparks, bokeh, sunbeams, grain)
  const rand = seededRandom(safeRecipe.title.length * 1337 + width + height);
  if (safeRecipe.particleEffect === 'rain') {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 160; i++) {
      const x = rand() * width;
      const y = rand() * height;
      const len = 18 + rand() * 38;
      ctx.strokeStyle = i % 3 === 0 ? safeRecipe.tintTopColor : 'rgba(224, 242, 254, 0.55)';
      ctx.globalAlpha = 0.25 + rand() * 0.4;
      ctx.lineWidth = 1 + rand() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * 0.24, y + len);
      ctx.stroke();
    }
    ctx.restore();
  } else if (safeRecipe.particleEffect === 'neon-sparks') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 85; i++) {
      const x = rand() * width;
      const y = rand() * height;
      const r = 1.5 + rand() * 4.5;
      const color = i % 2 === 0 ? safeRecipe.tintTopColor : safeRecipe.tintBottomColor;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      glow.addColorStop(0, color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.5 + rand() * 0.45;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (safeRecipe.particleEffect === 'bokeh') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 36; i++) {
      const x = rand() * width;
      const y = rand() * height;
      const r = 14 + rand() * 44;
      ctx.globalAlpha = 0.1 + rand() * 0.16;
      ctx.fillStyle = i % 2 === 0 ? safeRecipe.tintTopColor : safeRecipe.tintBottomColor;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (safeRecipe.particleEffect === 'sunbeams') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const sunGrad = ctx.createRadialGradient(
      width * 0.15,
      height * 0.1,
      10,
      width * 0.15,
      height * 0.1,
      Math.max(width, height) * 0.85
    );
    sunGrad.addColorStop(0, 'rgba(254, 243, 199, 0.36)');
    sunGrad.addColorStop(0.45, 'rgba(251, 191, 36, 0.12)');
    sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } else if (safeRecipe.particleEffect === 'grain') {
    ctx.save();
    for (let i = 0; i < 2400; i++) {
      const x = rand() * width;
      const y = rand() * height;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  }

  // Pass 6: Cinematic vignette
  if (safeRecipe.vignette > 0.02) {
    ctx.save();
    const cx = width / 2;
    const cy = height / 2;
    const outerR = Math.hypot(cx, cy);
    const vig = ctx.createRadialGradient(cx, cy, outerR * 0.42, cx, cy, outerR);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, `rgba(4, 7, 15, ${safeRecipe.vignette})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  return canvas.toDataURL('image/png', 0.94);
}
