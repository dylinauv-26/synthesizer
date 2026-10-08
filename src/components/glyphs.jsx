// Математические знаки как SVG-пути: толщина и концы штрихов как у наборного шрифта.

/** ∫ высотой h, левый верхний угол (x, y). Ширина ≈ 0.32·h. */
export function Integral({ x, y, h, color }) {
  const s = h / 200;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M58 22 C52 2, 34 4, 32 30 L28 172 C26 196, 8 198, 4 182" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />
      <circle cx="57" cy="21" r="8" fill={color} />
      <circle cx="5" cy="181" r="8" fill={color} />
    </g>
  );
}

/** Скобка высотой h. Левая занимает [x, x + 0.15h]; правая (right) — [x − 0.15h, x]. */
export function Paren({ x, y, h, color, right = false }) {
  const s = h / 200;
  return (
    <g transform={`translate(${x},${y}) scale(${right ? -s : s},${s})`}>
      <path d="M30 0 C-4 50 -4 150 30 200 C7 150 7 50 30 0 Z" fill={color} />
    </g>
  );
}

/** √ : крючок, жирный спуск, тонкий подъём и горизонтальная черта до x + w. Возвращает x начала черты. */
export const radicalBarX = (x, h) => x + h * 0.5;
export function Radical({ x, y, w, h, color }) {
  const bx = radicalBarX(x, h);
  return (
    <g stroke={color} fill="none">
      <line x1={x} y1={y + h * 0.62} x2={x + h * 0.12} y2={y + h * 0.54} strokeWidth="4" />
      <line x1={x + h * 0.12} y1={y + h * 0.54} x2={x + h * 0.25} y2={y + h} strokeWidth="14" />
      <line x1={x + h * 0.25} y1={y + h} x2={bx} y2={y} strokeWidth="4" />
      <line x1={bx - 2} y1={y} x2={x + w} y2={y} strokeWidth="12" />
    </g>
  );
}
