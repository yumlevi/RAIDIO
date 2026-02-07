import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';

export type AccentColor = 'blue' | 'pink' | 'purple' | 'green' | 'orange' | 'red' | 'cyan' | 'yellow' | 'dynamic';
export type NowPlayingScale = 'compact' | 'default' | 'large' | 'xlarge';

// CSS color values for each static accent
const accentColorValues: Record<Exclude<AccentColor, 'dynamic'>, { main: string; light: string; dark: string }> = {
  blue: { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
  cyan: { main: '#06b6d4', light: '#22d3ee', dark: '#0891b2' },
  purple: { main: '#a855f7', light: '#c084fc', dark: '#9333ea' },
  pink: { main: '#ec4899', light: '#f472b6', dark: '#db2777' },
  red: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
  orange: { main: '#f97316', light: '#fb923c', dark: '#ea580c' },
  yellow: { main: '#eab308', light: '#facc15', dark: '#ca8a04' },
  green: { main: '#22c55e', light: '#4ade80', dark: '#16a34a' },
};

// --- Color math utilities ---
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1/3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1/3) * 255),
  ];
}

function lerpColor(from: string, to: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  return rgbToHex(
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t,
  );
}

function colorsClose(a: string, b: string, threshold = 2): boolean {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.abs(r1 - r2) < threshold && Math.abs(g1 - g2) < threshold && Math.abs(b1 - b2) < threshold;
}

/** Derive main/light/dark from a hex color — no clamping, keep original character */
function deriveAccent(hex: string): { main: string; light: string; dark: string } {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);

  const [lr, lg, lb] = hslToRgb(h, s, l + 0.12);
  const [dr, dg, db] = hslToRgb(h, s, l - 0.12);

  return { main: hex, light: rgbToHex(lr, lg, lb), dark: rgbToHex(dr, dg, db) };
}

/** Perceived luminance (0-1) using sRGB coefficients */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

interface ThemeContextType {
  accent: AccentColor;
  setAccent: (color: AccentColor) => void;
  accentColor: string;
  accentColorLight: string;
  accentColorDark: string;
  /** Black or white — whichever contrasts best against accentColor */
  accentTextColor: string;
  /** Feed palette colors for dynamic mode — cycles through them smoothly */
  setDynamicPalette: (colors: string[]) => void;
  nowPlayingScale: NowPlayingScale;
  setNowPlayingScale: (s: NowPlayingScale) => void;
}

export const ACCENT_COLORS: { id: AccentColor; name: string; preview: string }[] = [
  { id: 'blue', name: 'Blue', preview: '#3b82f6' },
  { id: 'cyan', name: 'Cyan', preview: '#06b6d4' },
  { id: 'purple', name: 'Purple', preview: '#a855f7' },
  { id: 'pink', name: 'Pink', preview: '#ec4899' },
  { id: 'red', name: 'Red', preview: '#ef4444' },
  { id: 'orange', name: 'Orange', preview: '#f97316' },
  { id: 'yellow', name: 'Yellow', preview: '#eab308' },
  { id: 'green', name: 'Green', preview: '#22c55e' },
  { id: 'dynamic', name: 'Dynamic', preview: 'rainbow' },
];

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
}

const DEFAULT_DYNAMIC = { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb' };

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [accent, setAccentState] = useState<AccentColor>(() => {
    const stored = localStorage.getItem('theme_accent');
    return (stored as AccentColor) || 'blue';
  });

  const [nowPlayingScale, setNowPlayingScaleState] = useState<NowPlayingScale>(() => {
    const stored = localStorage.getItem('theme_nowplaying_scale');
    return (stored as NowPlayingScale) || 'default';
  });

  const setNowPlayingScale = (s: NowPlayingScale) => {
    setNowPlayingScaleState(s);
    localStorage.setItem('theme_nowplaying_scale', s);
  };

  // Dynamic accent: smoothly lerps to the dominant color of the current cover
  const [dynamicColors, setDynamicColors] = useState(DEFAULT_DYNAMIC);
  const targetRef = useRef(DEFAULT_DYNAMIC);
  const currentRef = useRef(DEFAULT_DYNAMIC);
  const animRef = useRef<number | null>(null);

  // Lerp animation loop — slow and smooth
  const animateColors = useCallback(() => {
    const speed = 0.012;
    const cur = currentRef.current;
    const tgt = targetRef.current;

    const newMain = lerpColor(cur.main, tgt.main, speed);
    const newLight = lerpColor(cur.light, tgt.light, speed);
    const newDark = lerpColor(cur.dark, tgt.dark, speed);

    currentRef.current = { main: newMain, light: newLight, dark: newDark };
    setDynamicColors({ main: newMain, light: newLight, dark: newDark });

    if (!colorsClose(newMain, tgt.main) || !colorsClose(newLight, tgt.light) || !colorsClose(newDark, tgt.dark)) {
      animRef.current = requestAnimationFrame(animateColors);
    } else {
      currentRef.current = tgt;
      setDynamicColors(tgt);
      animRef.current = null;
    }
  }, []);

  // Set the dominant color — smoothly lerps from current to new
  const setDynamicPalette = useCallback((colors: string[]) => {
    if (colors.length === 0) return;
    // Use only the most dominant color
    const target = deriveAccent(colors[0]);
    targetRef.current = target;
    if (!animRef.current) {
      animRef.current = requestAnimationFrame(animateColors);
    }
  }, [animateColors]);

  // Stop animation when accent changes away from dynamic
  useEffect(() => {
    if (accent !== 'dynamic' && animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, [accent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Resolve effective colors
  const colors = accent === 'dynamic'
    ? dynamicColors
    : accentColorValues[accent];

  // Apply CSS variables when colors change
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', colors.main);
    document.documentElement.style.setProperty('--accent-color-light', colors.light);
    document.documentElement.style.setProperty('--accent-color-dark', colors.dark);
  }, [colors.main, colors.light, colors.dark]);

  const setAccent = (color: AccentColor) => {
    setAccentState(color);
    localStorage.setItem('theme_accent', color);
  };

  return (
    <ThemeContext.Provider value={{
      accent,
      setAccent,
      accentColor: colors.main,
      accentColorLight: colors.light,
      accentColorDark: colors.dark,
      accentTextColor: luminance(colors.main) > 0.55 ? '#000000' : '#ffffff',
      setDynamicPalette,
      nowPlayingScale,
      setNowPlayingScale,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}
