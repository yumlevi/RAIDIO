import React, { useRef, useEffect, useState } from 'react';
import { getAlbumAccentColors } from './AlbumCover';

export type ColorScheme = 'dynamic' | 'rainbow' | 'neonPink' | 'ocean' | 'fire' | 'matrix' | 'vaporwave' | 'sunset' | 'ice';
export type VisualizerShape = 'ascii' | 'bars' | 'circles' | 'particles' | 'grid' | 'waveform';

export const COLOR_SCHEMES: { id: ColorScheme; name: string; preview: string[]; isDynamic?: boolean }[] = [
  { id: 'dynamic', name: 'Album', preview: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'], isDynamic: true },
  { id: 'rainbow', name: 'Rainbow', preview: ['#ff0080', '#00ffff', '#ffff00', '#00ff88'] },
  { id: 'neonPink', name: 'Neon Pink', preview: ['#ff0080', '#ff00ff', '#ff1493', '#ff69b4'] },
  { id: 'ocean', name: 'Ocean', preview: ['#0077be', '#00bfff', '#00ffff', '#40e0d0'] },
  { id: 'fire', name: 'Fire', preview: ['#ff0000', '#ff4500', '#ff8c00', '#ffd700'] },
  { id: 'matrix', name: 'Matrix', preview: ['#00ff00', '#00dd00', '#00bb00', '#009900'] },
  { id: 'vaporwave', name: 'Vaporwave', preview: ['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff'] },
  { id: 'sunset', name: 'Sunset', preview: ['#ff6b6b', '#ffa07a', '#ff1493', '#9932cc'] },
  { id: 'ice', name: 'Ice', preview: ['#e0ffff', '#87ceeb', '#00bfff', '#ffffff'] },
];

export const VISUALIZER_SHAPES: { id: VisualizerShape; name: string; icon: string }[] = [
  { id: 'ascii', name: 'ASCII', icon: '@' },
  { id: 'bars', name: 'Bars', icon: '▮' },
  { id: 'circles', name: 'Rings', icon: '◎' },
  { id: 'particles', name: 'Particles', icon: '✦' },
  { id: 'waveform', name: 'Wave', icon: '∿' },
  { id: 'grid', name: 'Grid', icon: '▦' },
];

// Extract dominant colors from an image
export function extractColorsFromImage(imageUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const FALLBACK: string[] = [];

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(FALLBACK); return; }

        const size = 50;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const imageData = ctx.getImageData(0, 0, size, size);
        const pixels = imageData.data;

        const colorBuckets: Map<string, { r: number; g: number; b: number; count: number }> = new Map();

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          if (a < 128) continue;

          const brightness = (r + g + b) / 3;
          if (brightness < 30 || brightness > 240) continue;

          const qr = Math.round(r / 32) * 32;
          const qg = Math.round(g / 32) * 32;
          const qb = Math.round(b / 32) * 32;
          const key = `${qr},${qg},${qb}`;

          const existing = colorBuckets.get(key);
          if (existing) {
            existing.r += r;
            existing.g += g;
            existing.b += b;
            existing.count++;
          } else {
            colorBuckets.set(key, { r, g, b, count: 1 });
          }
        }

        const sortedColors = Array.from(colorBuckets.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
          .map(c => {
            const r = Math.round(c.r / c.count);
            const g = Math.round(c.g / c.count);
            const b = Math.round(c.b / c.count);
            return `rgb(${r},${g},${b})`;
          });

        resolve(sortedColors.length >= 2 ? sortedColors : FALLBACK);
      } catch {
        // Canvas tainted by CORS — can't read pixels
        resolve(FALLBACK);
      }
    };

    img.onerror = () => {
      resolve(FALLBACK);
    };

    img.src = imageUrl;
  });
}

function rgbToHsl(colorStr: string): { h: number; s: number; l: number } {
  let r: number, g: number, b: number;

  // Handle hex format (#RRGGBB)
  const hexMatch = colorStr.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/);
  // Handle rgb() format
  const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

  if (hexMatch) {
    r = parseInt(hexMatch[1], 16) / 255;
    g = parseInt(hexMatch[2], 16) / 255;
    b = parseInt(hexMatch[3], 16) / 255;
  } else if (rgbMatch) {
    r = parseInt(rgbMatch[1]) / 255;
    g = parseInt(rgbMatch[2]) / 255;
    b = parseInt(rgbMatch[3]) / 255;
  } else {
    return { h: 0, s: 50, l: 50 };
  }

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  colorScheme?: ColorScheme;
  shape?: VisualizerShape;
  coverUrl?: string;
  /** Song ID used as seed for AlbumCover — used to extract actual cover colors */
  coverSeed?: string;
}

export const audioNodeCache = new WeakMap<HTMLAudioElement, {
  context: AudioContext;
  analyser: AnalyserNode;
  dataArray: Uint8Array;
}>();

// Particle system for particle mode
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  hue: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioElement,
  isPlaying,
  colorScheme = 'rainbow',
  shape = 'grid',
  coverUrl,
  coverSeed
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  // For smooth color transitions
  const [targetColors, setTargetColors] = useState<{ h: number; s: number; l: number }[]>([]);
  const currentColorsRef = useRef<{ h: number; s: number; l: number }[]>([]);
  const [dynamicColors, setDynamicColors] = useState<{ h: number; s: number; l: number }[]>([]);

  // Extract colors from cover image when it changes (for dynamic mode)
  useEffect(() => {
    if (colorScheme !== 'dynamic') return;

    const applyColors = (hslColors: { h: number; s: number; l: number }[]) => {
      setTargetColors(hslColors);
      if (currentColorsRef.current.length === 0) {
        currentColorsRef.current = hslColors;
        setDynamicColors(hslColors);
      }
    };

    const useSeedFallback = () => {
      if (coverSeed) {
        applyColors(getAlbumAccentColors(coverSeed).map(hex => rgbToHsl(hex)));
      }
    };

    // Try image extraction first (matches what user actually sees)
    if (coverUrl) {
      extractColorsFromImage(coverUrl).then((colors) => {
        if (colors.length === 0) { useSeedFallback(); return; }
        applyColors(colors.map(c => rgbToHsl(c)));
      });
    } else {
      useSeedFallback();
    }
  }, [coverUrl, coverSeed, colorScheme]);

  // Smoothly interpolate colors towards target
  useEffect(() => {
    if (targetColors.length === 0) return;

    const interpolateColors = () => {
      const current = currentColorsRef.current;
      if (current.length === 0) {
        currentColorsRef.current = [...targetColors];
        setDynamicColors([...targetColors]);
        return;
      }

      let needsUpdate = false;
      const newColors = targetColors.map((target, i) => {
        const curr = current[i] || target;
        const lerpSpeed = 0.03; // Adjust for faster/slower transitions

        // Handle hue wrapping (e.g., 350 -> 10 should go through 0, not 180)
        let hDiff = target.h - curr.h;
        if (hDiff > 180) hDiff -= 360;
        if (hDiff < -180) hDiff += 360;

        const newH = curr.h + hDiff * lerpSpeed;
        const newS = curr.s + (target.s - curr.s) * lerpSpeed;
        const newL = curr.l + (target.l - curr.l) * lerpSpeed;

        // Check if we're close enough to stop updating
        if (Math.abs(hDiff) > 0.5 || Math.abs(target.s - curr.s) > 0.5 || Math.abs(target.l - curr.l) > 0.5) {
          needsUpdate = true;
        }

        return { h: (newH + 360) % 360, s: newS, l: newL };
      });

      currentColorsRef.current = newColors;
      setDynamicColors(newColors);

      if (needsUpdate) {
        requestAnimationFrame(interpolateColors);
      }
    };

    interpolateColors();
  }, [targetColors]);

  // Helper to get color based on scheme
  const getColor = (ratio: number, value: number, t: number): string => {
    const timeOffset = t * 15;

    switch (colorScheme) {
      case 'dynamic': {
        if (dynamicColors.length > 0) {
          const colorIndex = Math.floor((ratio * dynamicColors.length + t * 0.5) % dynamicColors.length);
          const nextIndex = (colorIndex + 1) % dynamicColors.length;
          const blend = ((ratio * dynamicColors.length + t * 0.5) % 1);
          const c1 = dynamicColors[colorIndex];
          const c2 = dynamicColors[nextIndex];
          const hue = c1.h + (c2.h - c1.h) * blend + Math.sin(t + ratio * Math.PI) * 15;
          const sat = Math.min(100, (c1.s + c2.s) / 2 + value * 20);
          const light = 35 + value * 45;
          return `hsl(${hue}, ${sat}%, ${light}%)`;
        }
        const hue = (ratio * 360 + timeOffset) % 360;
        return `hsl(${hue}, ${80 + value * 20}%, ${40 + value * 40}%)`;
      }
      case 'neonPink': {
        const hue = 320 + Math.sin(ratio * Math.PI + t) * 30;
        return `hsl(${hue}, ${85 + value * 15}%, ${45 + value * 40}%)`;
      }
      case 'ocean': {
        const hue = 180 + Math.sin(ratio * Math.PI * 2 + t) * 40;
        return `hsl(${hue}, ${70 + value * 30}%, ${35 + value * 45}%)`;
      }
      case 'fire': {
        const hue = 10 + Math.sin(ratio * Math.PI + t * 2) * 30;
        return `hsl(${hue}, ${90 + value * 10}%, ${40 + value * 45}%)`;
      }
      case 'matrix': {
        const lightness = 30 + value * 55;
        return `hsl(120, 100%, ${lightness}%)`;
      }
      case 'vaporwave': {
        const hues = [320, 190, 280, 160];
        const hueIndex = Math.floor((ratio * 4 + t * 0.3) % 4);
        const hue = hues[hueIndex] + Math.sin(t + ratio * Math.PI) * 20;
        return `hsl(${hue}, ${80 + value * 20}%, ${50 + value * 35}%)`;
      }
      case 'sunset': {
        const hue = 350 + ratio * 60 + Math.sin(t) * 20;
        return `hsl(${hue % 360}, ${85 + value * 15}%, ${45 + value * 40}%)`;
      }
      case 'ice': {
        const hue = 190 + Math.sin(ratio * Math.PI + t) * 20;
        const sat = 60 + value * 40;
        const light = 60 + value * 35;
        return `hsl(${hue}, ${sat}%, ${light}%)`;
      }
      case 'rainbow':
      default: {
        const hue = (ratio * 360 + timeOffset) % 360;
        return `hsl(${hue}, ${80 + value * 20}%, ${40 + value * 40}%)`;
      }
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    const setupAudio = () => {
      if (!audioElement) return;

      const cached = audioNodeCache.get(audioElement);
      if (cached) {
        audioContextRef.current = cached.context;
        analyserRef.current = cached.analyser;
        dataArrayRef.current = cached.dataArray;
        return;
      }

      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        const source = audioContext.createMediaElementSource(audioElement);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        audioNodeCache.set(audioElement, { context: audioContext, analyser, dataArray });

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        dataArrayRef.current = dataArray;
      } catch (e) {
        console.log('[Visualizer] Setup error:', e);
      }
    };

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const chars = ' .·:;+*#%@';
    const fontSize = 14;
    let t = 0;

    // Initialize particles
    const initParticles = (count: number) => {
      particlesRef.current = [];
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: Math.random() * 3 + 1,
          life: Math.random() * 100,
          maxLife: 100 + Math.random() * 100,
          hue: Math.random() * 360,
        });
      }
    };

    if (shape === 'particles') {
      initParticles(200);
    }

    const animate = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Clear canvas - use semi-transparent for trail effects, fully clear for others
      if (shape === 'particles' || shape === 'waveform') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }

      // Get audio data
      let bass = 0, mid = 0, high = 0, overall = 0;
      const freqData: number[] = [];

      if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const d = dataArrayRef.current;
        const len = d.length;

        for (let i = 0; i < len; i++) {
          freqData.push(d[i] / 255);
        }

        for (let i = 0; i < len * 0.15; i++) bass += d[i];
        for (let i = Math.floor(len * 0.15); i < len * 0.5; i++) mid += d[i];
        for (let i = Math.floor(len * 0.5); i < len; i++) high += d[i];

        bass = bass / (len * 0.15 * 255);
        mid = mid / (len * 0.35 * 255);
        high = high / (len * 0.5 * 255);
        overall = (bass * 0.5 + mid * 0.35 + high * 0.15);
      }

      t += 0.008;

      // Render based on shape
      switch (shape) {
        case 'bars': {
          // Rounded bars at bottom of screen - full width
          const barCount = 64;
          const barWidth = w / barCount;
          const maxHeight = h * 0.5;
          const baseY = h;
          const gap = 2;
          const radius = (barWidth - gap * 2) / 2;

          // Smoothed frequency data
          const smoothed: number[] = [];
          for (let i = 0; i < barCount; i++) {
            const freqIndex = Math.floor((i / barCount) * freqData.length * 0.75);
            const raw = freqData[freqIndex] || 0;
            const prev = smoothed[i - 1] || raw;
            smoothed.push(prev * 0.4 + raw * 0.6);
          }

          for (let i = 0; i < barCount; i++) {
            const value = smoothed[i];
            const barHeight = Math.max(value * maxHeight + 4, radius * 2 + 4);
            const x = i * barWidth + gap;
            const y = baseY - barHeight;
            const ratio = i / barCount;
            const bw = barWidth - gap * 2;

            // Main bar gradient
            const gradient = ctx.createLinearGradient(x, baseY, x, y);
            gradient.addColorStop(0, getColor(ratio, 0.3, t));
            gradient.addColorStop(0.3, getColor(ratio, 0.7, t));
            gradient.addColorStop(1, getColor(ratio, 1, t));

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, y, bw, barHeight, [radius, radius, 0, 0]);
            ctx.fill();

            // Glow for active bars
            if (value > 0.25) {
              ctx.shadowColor = getColor(ratio, 1, t);
              ctx.shadowBlur = 12 + value * 15;
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          }
          break;
        }

        case 'circles': {
          // Expanding sonar/pulse rings
          const centerX = w / 2;
          const centerY = h / 2;
          const maxRadius = Math.max(w, h) * 0.7;
          const ringCount = 6;
          const ringSpacing = maxRadius / ringCount;

          // Draw expanding rings
          for (let ring = 0; ring < ringCount; ring++) {
            // Each ring expands over time
            const ringPhase = (t * 0.5 + ring / ringCount) % 1;
            const radius = ringPhase * maxRadius;
            const alpha = 1 - ringPhase;

            // Ring gets frequency data based on its size
            const freqIndex = Math.floor(ringPhase * freqData.length * 0.5);
            const value = freqData[freqIndex] || 0;
            const thickness = 2 + value * 15 + overall * 5;

            if (radius > 10) {
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
              ctx.strokeStyle = getColor(ringPhase, 0.7 + value * 0.3, t);
              ctx.lineWidth = thickness;
              ctx.globalAlpha = alpha * (0.4 + value * 0.6);

              // Glow
              ctx.shadowColor = getColor(ringPhase, 1, t);
              ctx.shadowBlur = 20 + value * 30;
              ctx.stroke();
              ctx.shadowBlur = 0;
            }
          }
          ctx.globalAlpha = 1;

          // Inner pulsing core
          const coreSize = 30 + overall * 50 + bass * 30;
          const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreSize);
          coreGradient.addColorStop(0, getColor(t % 1, 1, t));
          coreGradient.addColorStop(0.3, getColor((t + 0.2) % 1, 0.7, t));
          coreGradient.addColorStop(0.7, getColor((t + 0.4) % 1, 0.3, t));
          coreGradient.addColorStop(1, 'transparent');

          ctx.beginPath();
          ctx.arc(centerX, centerY, coreSize, 0, Math.PI * 2);
          ctx.fillStyle = coreGradient;
          ctx.fill();

          // Bright center
          ctx.beginPath();
          ctx.arc(centerX, centerY, 8 + bass * 10, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.shadowColor = getColor(0.5, 1, t);
          ctx.shadowBlur = 30;
          ctx.fill();
          ctx.shadowBlur = 0;
          break;
        }

        case 'particles': {
          // Starfield/nebula effect with depth
          const particles = particlesRef.current;
          const centerX = w / 2;
          const centerY = h / 2;

          // Update and draw particles as stars with depth
          for (const p of particles) {
            // Z-depth simulation (stored in life as depth)
            const z = (p.life % 100) / 100; // 0 = far, 1 = close
            const scale = 0.3 + z * 0.7;
            const speed = 0.5 + z * 2;

            // Move towards edges (zoom effect)
            const dx = p.x - centerX;
            const dy = p.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            // Accelerate outward, more at edges
            const accel = (0.01 + overall * 0.05) * speed;
            p.vx += (dx / dist) * accel;
            p.vy += (dy / dist) * accel;

            // Apply velocity
            p.x += p.vx * (1 + bass);
            p.y += p.vy * (1 + bass);

            // Add slight rotation
            const angle = Math.atan2(dy, dx);
            p.x += Math.cos(angle + Math.PI / 2) * mid * 0.5;
            p.y += Math.sin(angle + Math.PI / 2) * mid * 0.5;

            p.life += 0.3 + overall * 0.5;

            // Reset if out of bounds
            if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20 || p.life > 150) {
              // Respawn near center
              const spawnAngle = Math.random() * Math.PI * 2;
              const spawnDist = Math.random() * 50;
              p.x = centerX + Math.cos(spawnAngle) * spawnDist;
              p.y = centerY + Math.sin(spawnAngle) * spawnDist;
              p.vx = 0;
              p.vy = 0;
              p.life = Math.random() * 50;
              p.hue = Math.random() * 360;
              p.size = 1 + Math.random() * 2;
            }

            // Draw star with trail
            const size = p.size * scale * (1 + overall);
            const alpha = 0.3 + z * 0.7;

            // Trail
            const trailLength = 3 + dist * 0.02;
            const trailGradient = ctx.createLinearGradient(
              p.x, p.y,
              p.x - p.vx * trailLength, p.y - p.vy * trailLength
            );
            trailGradient.addColorStop(0, getColor(p.hue / 360, 0.8, t));
            trailGradient.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * trailLength, p.y - p.vy * trailLength);
            ctx.strokeStyle = trailGradient;
            ctx.lineWidth = size;
            ctx.lineCap = 'round';
            ctx.globalAlpha = alpha * 0.6;
            ctx.stroke();

            // Star point
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            ctx.fillStyle = getColor(p.hue / 360, 0.9, t);
            ctx.globalAlpha = alpha;
            ctx.shadowColor = getColor(p.hue / 360, 1, t);
            ctx.shadowBlur = 5 + size * 2;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          ctx.globalAlpha = 1;

          // Nebula glow in center
          const nebulaSize = 100 + overall * 100;
          const nebula = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, nebulaSize);
          nebula.addColorStop(0, getColor(t % 1, 0.4, t));
          nebula.addColorStop(0.4, getColor((t + 0.3) % 1, 0.2, t));
          nebula.addColorStop(1, 'transparent');

          ctx.beginPath();
          ctx.arc(centerX, centerY, nebulaSize, 0, Math.PI * 2);
          ctx.fillStyle = nebula;
          ctx.globalAlpha = 0.4 + overall * 0.3;
          ctx.fill();
          ctx.globalAlpha = 1;

          // Bright center star
          const centerSize = 3 + bass * 8;
          ctx.beginPath();
          ctx.arc(centerX, centerY, centerSize, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.shadowColor = getColor(0.5, 1, t);
          ctx.shadowBlur = 30 + bass * 20;
          ctx.fill();
          ctx.shadowBlur = 0;
          break;
        }

        case 'waveform': {
          // Smooth mirrored flowing waves
          const centerY = h / 2;
          const points = 64;

          // Create heavily smoothed wave data
          const rawData: number[] = [];
          for (let i = 0; i < points; i++) {
            const freqIndex = Math.floor((i / points) * freqData.length * 0.6);
            rawData.push(freqData[freqIndex] || 0);
          }

          // Multiple smoothing passes
          const waveData: number[] = [...rawData];
          for (let pass = 0; pass < 3; pass++) {
            for (let i = 1; i < waveData.length - 1; i++) {
              waveData[i] = waveData[i - 1] * 0.25 + waveData[i] * 0.5 + waveData[i + 1] * 0.25;
            }
          }

          // Helper to get smooth Y position
          const getWaveY = (i: number, amplitude: number, phaseOffset: number, timeSpeed: number, mirror: boolean) => {
            const idx = Math.max(0, Math.min(Math.floor(i), waveData.length - 1));
            const nextIdx = Math.min(idx + 1, waveData.length - 1);
            const frac = i - idx;
            const value = waveData[idx] * (1 - frac) + waveData[nextIdx] * frac;
            const wave = Math.sin(i * 0.08 + t * timeSpeed + phaseOffset) * 15;
            const offset = value * amplitude + wave + overall * 25;
            return mirror ? centerY + offset : centerY - offset;
          };

          // Draw multiple mirrored wave layers
          for (let layer = 0; layer < 3; layer++) {
            const amplitude = (h * 0.32) * (1 - layer * 0.2);
            const phaseOffset = layer * 0.8;
            const timeSpeed = 0.8 + layer * 0.2;

            // Top wave with bezier curves
            ctx.beginPath();
            let startY = getWaveY(0, amplitude, phaseOffset, timeSpeed, false);
            ctx.moveTo(0, startY);

            for (let i = 0; i < points - 1; i++) {
              const x1 = (i / points) * w;
              const x2 = ((i + 1) / points) * w;
              const y1 = getWaveY(i, amplitude, phaseOffset, timeSpeed, false);
              const y2 = getWaveY(i + 1, amplitude, phaseOffset, timeSpeed, false);

              // Control points for smooth bezier
              const cpX1 = x1 + (x2 - x1) / 2;
              const cpX2 = x1 + (x2 - x1) / 2;

              ctx.bezierCurveTo(cpX1, y1, cpX2, y2, x2, y2);
            }

            // Complete shape
            ctx.lineTo(w, centerY);
            ctx.lineTo(0, centerY);
            ctx.closePath();

            // Gradient fill
            const gradientUp = ctx.createLinearGradient(0, centerY - amplitude, 0, centerY);
            gradientUp.addColorStop(0, getColor((layer * 0.25 + t * 0.05) % 1, 0.7, t));
            gradientUp.addColorStop(1, 'transparent');
            ctx.fillStyle = gradientUp;
            ctx.globalAlpha = 0.5 - layer * 0.12;
            ctx.fill();

            // Smooth stroke on top
            ctx.beginPath();
            startY = getWaveY(0, amplitude, phaseOffset, timeSpeed, false);
            ctx.moveTo(0, startY);
            for (let i = 0; i < points - 1; i++) {
              const x1 = (i / points) * w;
              const x2 = ((i + 1) / points) * w;
              const y1 = getWaveY(i, amplitude, phaseOffset, timeSpeed, false);
              const y2 = getWaveY(i + 1, amplitude, phaseOffset, timeSpeed, false);
              const cpX = x1 + (x2 - x1) / 2;
              ctx.bezierCurveTo(cpX, y1, cpX, y2, x2, y2);
            }
            ctx.strokeStyle = getColor((layer * 0.25 + t * 0.05) % 1, 0.9, t);
            ctx.lineWidth = 2.5 - layer * 0.6;
            ctx.globalAlpha = 0.7 - layer * 0.15;
            ctx.stroke();

            // Bottom wave (mirror)
            ctx.beginPath();
            startY = getWaveY(0, amplitude, phaseOffset, timeSpeed, true);
            ctx.moveTo(0, startY);

            for (let i = 0; i < points - 1; i++) {
              const x1 = (i / points) * w;
              const x2 = ((i + 1) / points) * w;
              const y1 = getWaveY(i, amplitude, phaseOffset, timeSpeed, true);
              const y2 = getWaveY(i + 1, amplitude, phaseOffset, timeSpeed, true);
              const cpX = x1 + (x2 - x1) / 2;
              ctx.bezierCurveTo(cpX, y1, cpX, y2, x2, y2);
            }

            ctx.lineTo(w, centerY);
            ctx.lineTo(0, centerY);
            ctx.closePath();

            const gradientDown = ctx.createLinearGradient(0, centerY, 0, centerY + amplitude);
            gradientDown.addColorStop(0, 'transparent');
            gradientDown.addColorStop(1, getColor((layer * 0.25 + 0.5 + t * 0.05) % 1, 0.5, t));
            ctx.fillStyle = gradientDown;
            ctx.globalAlpha = 0.35 - layer * 0.08;
            ctx.fill();
          }

          ctx.globalAlpha = 1;

          // Subtle center line
          ctx.beginPath();
          ctx.moveTo(0, centerY);
          ctx.lineTo(w, centerY);
          ctx.strokeStyle = getColor(0.5, 0.4, t);
          ctx.lineWidth = 1;
          ctx.shadowColor = getColor(0.5, 1, t);
          ctx.shadowBlur = 8 + overall * 15;
          ctx.globalAlpha = 0.3;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
          break;
        }

        case 'grid': {
          const gridSize = 20;
          const cols = Math.ceil(w / gridSize);
          const rows = Math.ceil(h / gridSize);

          for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
              const x = col * gridSize + gridSize / 2;
              const y = row * gridSize + gridSize / 2;

              const colNorm = col / cols;
              const rowNorm = row / rows;

              // Map position to frequency
              const freqIndex = Math.floor(colNorm * freqData.length * 0.5);
              const value = freqData[freqIndex] || 0;

              // Distance from center affects intensity
              const centerDist = Math.sqrt(
                Math.pow(colNorm - 0.5, 2) + Math.pow(rowNorm - 0.5, 2)
              );
              const distFactor = 1 - centerDist;

              // Animated wave effect
              const wave = Math.sin(col * 0.3 + row * 0.3 + t * 2) * 0.5 + 0.5;
              const intensity = (value * distFactor + wave * 0.3 + overall * 0.5) * distFactor;

              if (intensity > 0.1) {
                const size = gridSize * 0.4 * intensity;

                ctx.fillStyle = getColor(colNorm, intensity, t);
                ctx.globalAlpha = intensity;

                // Draw rounded square
                ctx.beginPath();
                ctx.roundRect(x - size / 2, y - size / 2, size, size, size * 0.2);
                ctx.fill();
              }
            }
          }
          ctx.globalAlpha = 1;
          break;
        }

        case 'ascii':
        default: {
          const asciiCols = Math.floor(w / (fontSize * 0.6));
          const asciiRows = Math.floor(h / fontSize);

          ctx.font = `${fontSize}px "Courier New", monospace`;
          ctx.textBaseline = 'top';

          for (let row = 0; row < asciiRows; row++) {
            for (let col = 0; col < asciiCols; col++) {
              const x = col * fontSize * 0.6;
              const y = row * fontSize;

              const rowFactor = 1 - Math.abs(row / asciiRows - 0.5) * 2;
              const colNorm = col / asciiCols;
              const rowNorm = row / asciiRows;

              let value = (
                Math.sin(col * 0.2 + t) * 0.5 +
                Math.sin(row * 0.3 + t * 0.7) * 0.3 +
                Math.sin((col + row) * 0.1 + t * 0.5) * 0.2
              ) * 0.5 + 0.3;

              if (overall > 0) {
                const audioBoost =
                  bass * Math.sin(colNorm * Math.PI) +
                  mid * Math.cos(rowNorm * Math.PI * 2 + t) * 0.8 +
                  high * Math.sin((colNorm + rowNorm) * Math.PI * 3) * 0.5;

                value = value * 0.3 + audioBoost * 0.7 + overall * 0.5;
              }

              value *= rowFactor;

              const wave = Math.sin(col * 0.15 + row * 0.1 + t) * 0.1;
              value = Math.max(0, Math.min(1, value + wave));

              const charIndex = Math.floor(value * (chars.length - 1));
              const char = chars[charIndex];

              if (char === ' ') continue;

              ctx.fillStyle = getColor(colNorm, value, t);
              ctx.fillText(char, x, y);
            }
          }
          break;
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying && audioElement) {
      setupAudio();
      audioContextRef.current?.resume();
    }

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [audioElement, isPlaying, colorScheme, shape, dynamicColors]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[1] w-full h-full pointer-events-none"
    />
  );
};
