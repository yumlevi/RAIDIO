import React, { useRef, useEffect } from 'react';

interface DiffusionPlaceholderProps {
  className?: string;
}

/**
 * Animated ASCII-art placeholder driven by domain-warped fractal noise.
 * Characters flow organically in purple / cyan / pink with bloom,
 * scanlines and occasional math-symbol glitches.
 */
const DiffusionPlaceholder: React.FC<DiffusionPlaceholderProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId = 0;
    let running = true;

    // --- Layout state (recalculated on resize) ---
    const BASE_FONT = 10;
    let dpR = 1;
    let cw = 0, ch = 0, cols = 0, rows = 0, charW = 0, charH = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = cw = Math.round(rect.width * dpR);
      canvas.height = ch = Math.round(rect.height * dpR);
      const fs = BASE_FONT * dpR;
      ctx.font = `${fs}px "Courier New",Courier,monospace`;
      charW = ctx.measureText('M').width;
      charH = fs * 1.2;
      cols = Math.ceil(cw / charW) + 1;
      rows = Math.ceil(ch / charH) + 1;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // --- Character sets ---
    const RAMP = ' .:+*#░▒▓█';
    const RLEN = RAMP.length;
    const GLITCH = 'θΣλφ∂∇πΩ{}[]01<>';

    // --- Noise primitives ---
    const hash = (n: number): number => {
      n = ((n >> 13) ^ n) | 0;
      n = (n * (n * n * 60493 + 19990303) + 1376312589) | 0;
      return ((n >> 16) & 0x7fff) / 0x7fff;
    };

    const sn = (x: number, y: number, z: number): number => {
      const ix = ~~x, iy = ~~y;
      const fx = x - ix, fy = y - iy;
      const u = fx * fx * (3 - 2 * fx);
      const v = fy * fy * (3 - 2 * fy);
      const s = ~~z;
      const a = hash(ix * 1087 + iy * 2083 + s);
      const b = hash((ix + 1) * 1087 + iy * 2083 + s);
      const c = hash(ix * 1087 + (iy + 1) * 2083 + s);
      const d = hash((ix + 1) * 1087 + (iy + 1) * 2083 + s);
      return a + u * (b - a) + v * (c - a) + u * v * (d - b - c + a);
    };

    const fbm = (x: number, y: number, z: number, oct: number): number => {
      let v = 0, a = 0.5, f = 1, tot = 0;
      for (let i = 0; i < oct; i++) {
        v += a * sn(x * f, y * f, z + i * 137);
        tot += a; a *= 0.5; f *= 2;
      }
      return v / tot;
    };

    // --- Bloom buffer (same size as display) ---
    const bloomBuf = document.createElement('canvas');
    const bloomCtx = bloomBuf.getContext('2d')!;

    let t = 0;

    const frame = () => {
      if (!running) return;
      t += 0.008;

      // Sync bloom buffer size
      if (bloomBuf.width !== cw || bloomBuf.height !== ch) {
        bloomBuf.width = cw;
        bloomBuf.height = ch;
      }

      const fs = BASE_FONT * dpR;

      // --- Draw ASCII to bloom buffer first ---
      bloomCtx.fillStyle = '#06000f';
      bloomCtx.fillRect(0, 0, cw, ch);
      bloomCtx.font = `${fs}px "Courier New",Courier,monospace`;
      bloomCtx.textBaseline = 'top';

      const scale = 5;
      const oct = 3;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const nx = (c / cols) * scale;
          const ny = (r / rows) * scale;

          // Domain warping — noise warps itself for organic flow
          const qx = fbm(nx + t * 0.12, ny + t * 0.09, 0, oct);
          const qy = fbm(nx + 5.2 - t * 0.07, ny + 1.3 + t * 0.11, 0, oct);
          const n = fbm(nx + 2.5 * qx, ny + 2.5 * qy, 0, oct);

          // Character from density ramp
          const ci = Math.min(RLEN - 1, Math.max(0, Math.floor(n * RLEN)));
          let char = RAMP[ci];

          // Rare glitch: swap in a math / code symbol
          if (Math.random() < 0.004) {
            char = GLITCH[~~(Math.random() * GLITCH.length)];
          }

          // Colour: purple → cyan → pink (blended from final value + warp)
          const warpAmt = (qx + qy) * 0.5;
          const cv = n * 0.65 + warpAmt * 0.35;

          let red: number, grn: number, blu: number;
          if (cv < 0.35) {
            const p = cv / 0.35;
            red = 80 + p * 40;
            grn = 15 + p * 35;
            blu = 130 + p * 90;
          } else if (cv < 0.6) {
            const p = (cv - 0.35) / 0.25;
            red = 120 - p * 80;
            grn = 50 + p * 180;
            blu = 220;
          } else {
            const p = (cv - 0.6) / 0.4;
            red = 40 + p * 200;
            grn = 230 - p * 190;
            blu = 220 - p * 40;
          }

          // Brightness tracks density so sparse chars stay dim
          const bri = 0.2 + 0.8 * (ci / (RLEN - 1));
          bloomCtx.fillStyle = `rgb(${~~(red * bri)},${~~(grn * bri)},${~~(blu * bri)})`;
          bloomCtx.fillText(char, c * charW, r * charH);
        }
      }

      // --- Composite to display canvas ---
      // Base layer (sharp)
      ctx.drawImage(bloomBuf, 0, 0);

      // Bloom layer (blurred, additive)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.18;
      ctx.filter = 'blur(10px)';
      ctx.drawImage(bloomBuf, 0, 0);
      ctx.restore();

      // --- Scanlines (CRT feel) ---
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      const step = Math.max(2, 3 * dpR);
      for (let y = 0; y < ch; y += step) {
        ctx.fillRect(0, y, cw, 1);
      }

      // --- Vignette ---
      const rad = Math.min(cw, ch);
      const vg = ctx.createRadialGradient(cw / 2, ch / 2, rad * 0.15, cw / 2, ch / 2, rad * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(6,0,15,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, cw, ch);

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: '#06000f' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

export default DiffusionPlaceholder;
