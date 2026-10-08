import { useRef } from 'react';

/** Координаты указателя в системе viewBox того SVG, где лежит элемент. */
export function svgPoint(el, e) {
  const svg = el.ownerSVGElement || el;
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Любая ручка на плакате. fromPoint(pt, start) переводит точку указателя в значение;
 * start = { pt, value } — где началось перетаскивание (для «относительных» ручек).
 * С клавиатуры — паттерн Slider из WAI-ARIA (как в Radix): стрелки, Shift/PageUp/PageDown, Home/End.
 */
export function Control({ label, valueText, value, min, max, step = 1, onChange, fromPoint, children }) {
  const start = useRef(null);
  const commit = (v) => {
    if (v == null || Number.isNaN(v)) return;
    const s = +(Math.round(clamp(v, min, max) / step) * step).toFixed(6);
    if (s !== value) onChange(s);
  };
  const onKeyDown = (e) => {
    const big = Math.max(step, (max - min) / 10);
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (dir) {
      e.preventDefault();
      const d = Math.abs(dir) === 10 || e.shiftKey ? Math.sign(dir) * big : dir * step;
      commit(value + d);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      commit(e.key === 'Home' ? min : max);
    }
  };
  return (
    <g
      role="slider"
      tabIndex={0}
      className="ctl"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const pt = svgPoint(e.currentTarget, e);
        start.current = { pt, value };
        commit(fromPoint(pt, start.current));
      }}
      onPointerMove={(e) => {
        if (!start.current || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        commit(fromPoint(svgPoint(e.currentTarget, e), start.current));
      }}
      onPointerUp={() => (start.current = null)}
      onKeyDown={onKeyDown}
    >
      {children}
    </g>
  );
}

/** Кликабельный элемент SVG с поддержкой Enter/Space. */
export function Press({ label, onPress, children, pressed }) {
  return (
    <g
      role="button"
      tabIndex={0}
      className="ctl"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onPress}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onPress();
        }
      }}
    >
      {children}
    </g>
  );
}

/** Невидимая зона попадания. */
export const Hit = (props) => <rect fill="transparent" {...props} />;

/** Пунктир со стрелками — направление движения ручки. */
export function DashedArrow({ x1, y1, x2, y2, color }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = (x, y, ang) => {
    const s = 7;
    return `M${x + s * Math.cos(ang + 2.6)},${y + s * Math.sin(ang + 2.6)} L${x},${y} L${x + s * Math.cos(ang - 2.6)},${y + s * Math.sin(ang - 2.6)}`;
  };
  return (
    <g stroke={color} fill="none" strokeWidth="1.2">
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray="3 4" />
      <path d={head(x2, y2, a)} />
      <path d={head(x1, y1, a + Math.PI)} />
    </g>
  );
}
