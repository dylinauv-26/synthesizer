import { useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../audio/engine.js';
import { MAX_HARMONICS } from '../math/analysis.js';
import { Control, Hit, svgPoint } from './svg.jsx';

const INK = 'var(--ink)';
const BLUE = 'var(--blue)';
const P = 256;
const GX0 = 30;
const GW = 360;
const GY = 250;
const GA = 105;
const X = (x) => GX0 + ((x + Math.PI) / (2 * Math.PI)) * GW;

const fmt = (v) => (Number.isFinite(v) ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)).replace('-', '−') : '—');

// круг гармоник
const CX = 210;
const CY = 572;
const CR = 92;

function useFrame() {
  const [, setT] = useState(0);
  useEffect(() => {
    let raf;
    const loop = () => {
      setT(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

export default function GeometryPanel({ fn, harmonics, setHarmonics, crossfade, setCrossfade }) {
  useFrame();
  const hover = useRef(null);

  const data = useMemo(() => {
    const xs = [];
    const f = [];
    for (let j = 0; j <= P; j++) {
      xs.push(-Math.PI + (2 * Math.PI * j) / P);
      f.push(fn(xs[j]));
    }
    const h = (2 * Math.PI) / P;
    const df = f.map((_, j) => {
      const a = Math.max(0, j - 1);
      const b = Math.min(P, j + 1);
      return (f[b] - f[a]) / ((b - a) * h);
    });
    const F = [0];
    for (let j = 1; j <= P; j++) F.push(F[j - 1] + ((f[j - 1] + f[j]) / 2) * h);
    const peak = Math.max(1e-9, ...f.map(Math.abs));
    return { xs, f, df, F, peak };
  }, [fn]);

  const Y = (v) => GY - (v / data.peak) * GA;

  // x₀: во время игры — фаза такта, при наведении — курсор, иначе медленный обход
  const phase = engine.barPhase();
  let t = phase ?? hover.current ?? (performance.now() / 8000) % 1;
  const j = Math.round(t * P);
  const x0 = X(data.xs[j]);
  const y0 = Y(data.f[j]);

  const curve = data.xs.map((x, k) => `${k ? 'L' : 'M'}${X(x).toFixed(1)},${Y(data.f[k]).toFixed(1)}`).join(' ');
  const passed = data.xs.slice(0, j + 1).map((x, k) => `${k ? 'L' : 'M'}${X(x).toFixed(1)},${Y(data.f[k]).toFixed(1)}`).join(' ');
  const area = `${passed} L${x0},${GY} L${X(-Math.PI)},${GY} Z`;

  // касательная в экранных координатах и угол φ к горизонтали
  const slope = -(data.df[j] / data.peak) * GA / (GW / (2 * Math.PI));
  const phi = Math.atan(-slope);
  const R = 46;
  const arcEnd = [x0 + R * Math.cos(phi), y0 - R * Math.sin(phi)];
  const labelPos = [x0 + (R + 16) * Math.cos(phi / 2), y0 - (R + 16) * Math.sin(phi / 2) + 6];

  // дуга гармоник
  const a = (harmonics / MAX_HARMONICS) * 2 * Math.PI * 0.9999;
  const end = [CX + CR * Math.sin(a), CY - CR * Math.cos(a)];
  const arc = `M${CX},${CY - CR} A${CR},${CR} 0 ${a > Math.PI ? 1 : 0} 1 ${end[0]},${end[1]}`;

  const fadeX = 70 + crossfade * 280;

  return (
    <svg className="poster" viewBox="0 0 420 800" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke={INK} strokeWidth="0.9" />
        </pattern>
        <clipPath id="graph-clip">
          <rect x="0" y="80" width="420" height="330" />
        </clipPath>
      </defs>

      <text className="label caps" x="24" y="40" fill={INK}>02 / геометрия</text>

      {/* график f, площадь и касательная */}
      <g
        onPointerMove={(e) => {
          const pt = svgPoint(e.currentTarget, e);
          hover.current = Math.min(1, Math.max(0, (pt.x - GX0) / GW));
        }}
        onPointerLeave={() => (hover.current = null)}
      >
        <Hit x="0" y="80" width="420" height="330" />
        <line x1={GX0} x2={GX0 + GW} y1={GY} y2={GY} stroke={INK} strokeWidth="1" strokeDasharray="3 4" />
        <path d={area} fill="url(#hatch)" />
        <path d={curve} fill="none" stroke={INK} strokeWidth="1.4" />
        <path d={passed} fill="none" stroke={BLUE} strokeWidth="7" strokeLinecap="round" />
        <g clipPath="url(#graph-clip)">
          <line x1={x0 - 180} y1={y0 - slope * 180} x2={x0 + 180} y2={y0 + slope * 180} stroke={INK} strokeWidth="1.2" />
        </g>
        <line x1={x0} x2={x0 + 70} y1={y0} y2={y0} stroke={INK} strokeWidth="1" strokeDasharray="3 4" />
        <path d={`M${x0 + R},${y0} A${R},${R} 0 0 ${phi > 0 ? 0 : 1} ${arcEnd[0]},${arcEnd[1]}`} fill="none" stroke={INK} strokeWidth="1" />
        <text className="glyph" x={labelPos[0]} y={labelPos[1]} fontSize="22" fill={INK}>φ</text>
        <circle cx={x0} cy={y0} r="10" fill={BLUE} />
        <text className="glyph" x={X(-Math.PI)} y={GY + GA + 32} fontSize="18" fill={INK} textAnchor="middle">−π</text>
        <text className="glyph" x={X(Math.PI)} y={GY + GA + 32} fontSize="18" fill={INK} textAnchor="middle">π</text>
      </g>
      <text className="glyph" x="24" y="436" fontSize="24" fill={INK}>tg φ ∼ f′(x₀) = {fmt(data.df[j])}</text>
      <text className="glyph" x="396" y="436" fontSize="24" fill={INK} textAnchor="end">∫ f dx = {fmt(data.F[j])}</text>

      {/* гармоники — дуга на окружности */}
      <circle cx={CX} cy={CY} r={CR} fill="none" stroke={INK} strokeWidth="1.2" />
      <Control
        label="Число гармоник ряда Фурье"
        valueText={`${harmonics}`}
        value={harmonics}
        min={1}
        max={MAX_HARMONICS}
        onChange={setHarmonics}
        fromPoint={(pt, s) => {
          let ang = Math.atan2(pt.x - CX, -(pt.y - CY));
          if (ang < 0) ang += 2 * Math.PI;
          const n = Math.max(1, Math.round((ang / (2 * Math.PI)) * MAX_HARMONICS));
          // не перескакиваем через верх окружности 64 → 1
          if (s.value > 48 && n < 16) return MAX_HARMONICS;
          if (s.value < 16 && n > 48) return 1;
          return n;
        }}
      >
        <Hit x={CX - CR - 30} y={CY - CR - 30} width={2 * CR + 60} height={2 * CR + 60} />
        <path d={arc} fill="none" stroke={BLUE} strokeWidth="7" />
        <circle cx={end[0]} cy={end[1]} r="13" fill={BLUE} className="handle" />
      </Control>
      <circle cx={CX} cy={CY - CR} r="3.5" fill={INK} />
      <text className="glyph" x={CX - 16} y={CY - CR - 12} fontSize="22" fill={INK}>n=1</text>
      <text className="glyph" x={CX} y={CY + 20} fontSize="72" fill={INK} textAnchor="middle">{harmonics}</text>
      <text className="label" x={CX} y={CY + 46} fill={INK} textAnchor="middle">гармоник</text>

      {/* кроссфейдер между голосами */}
      <text className="label" x="210" y="704" textAnchor="middle" fill={INK}>кроссфейдер</text>
      <Control
        label="Кроссфейдер: f(x) ↔ ритм"
        valueText={`${Math.round((1 - crossfade) * 100)} / ${Math.round(crossfade * 100)}`}
        value={crossfade}
        min={0}
        max={1}
        step={0.01}
        onChange={setCrossfade}
        fromPoint={(pt) => (pt.x - 70) / 280}
      >
        <Hit x="50" y="712" width="320" height="44" />
        <line x1="70" x2="350" y1="734" y2="734" stroke={INK} strokeWidth="2" />
        <line x1="210" x2="210" y1="726" y2="742" stroke={INK} strokeWidth="1" />
        <rect x={fadeX - 12} y="722" width="24" height="24" fill={BLUE} className="handle" />
      </Control>
      <text className="glyph" x="24" y="742" fontSize="26" fill={INK}>f</text>
      <text className="glyph" x="396" y="742" fontSize="26" fill={INK} textAnchor="end">Δ</text>
      <text className="label" x="210" y="782" textAnchor="middle" fill={INK}>cos θ · f + sin θ · Δ</text>
    </svg>
  );
}
