import { compile } from 'mathjs';

// Все функции живут на одном периоде x ∈ [−π, π].
export const SAMPLES = 1024;
export const MAX_HARMONICS = 64;

export const PRESETS = [
  { id: 'sin', label: 'sin x', expr: 'sin(x)' },
  { id: 'square', label: 'меандр', expr: 'sign(sin(x))' },
  { id: 'saw', label: 'пила', expr: 'x / pi' },
  { id: 'tri', label: '|x|', expr: 'abs(x)' },
  { id: 'cubic', label: 'x³ − π²x', expr: 'x^3 - pi^2 * x' },
  { id: 'bell', label: 'e^(−x²)', expr: 'exp(-x^2)' },
];

// Порядок оператора: −2 = ∫∫f, −1 = ∫f, 0 = f, 1 = f′, 2 = f″
export const OPERATORS = [
  { order: -2, label: '∫∫f', name: 'второй интеграл' },
  { order: -1, label: '∫f', name: 'интеграл' },
  { order: 0, label: 'f', name: 'функция' },
  { order: 1, label: 'f′', name: 'производная' },
  { order: 2, label: 'f″', name: 'вторая производная' },
];

export function operatorColor(order) {
  if (order > 0) return 'var(--accent-red)';
  if (order < 0) return 'var(--accent-green)';
  return 'var(--accent-blue)';
}

/** Компилирует выражение от x. Бросает ошибку с понятным текстом. */
export function compileFunction(expr) {
  const code = compile(expr);
  const fn = (x) => {
    const v = code.evaluate({ x });
    return typeof v === 'number' ? v : Number(v);
  };
  // проверяем, что функция вычисляется на всём периоде
  for (let i = 0; i <= 16; i++) {
    const v = fn(-Math.PI + (2 * Math.PI * i) / 16);
    if (!Number.isFinite(v)) throw new Error('функция не определена на [−π, π]');
  }
  return fn;
}

export function sampleFunction(fn, n = SAMPLES) {
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    xs[j] = -Math.PI + (2 * Math.PI * j) / n;
    ys[j] = fn(xs[j]);
  }
  return { xs, ys };
}

/**
 * Коэффициенты ряда Фурье: f(x) ≈ a₀ + Σ aₙ·cos(nx) + bₙ·sin(nx).
 * Интегралы считаются суммой Римана по равномерной сетке.
 */
export function fourier({ xs, ys }, harmonics = MAX_HARMONICS) {
  const m = ys.length;
  const a = new Float64Array(harmonics + 1);
  const b = new Float64Array(harmonics + 1);
  let sum = 0;
  for (let j = 0; j < m; j++) sum += ys[j];
  a[0] = sum / m;
  for (let n = 1; n <= harmonics; n++) {
    let sa = 0;
    let sb = 0;
    for (let j = 0; j < m; j++) {
      sa += ys[j] * Math.cos(n * xs[j]);
      sb += ys[j] * Math.sin(n * xs[j]);
    }
    a[n] = (2 * sa) / m;
    b[n] = (2 * sb) / m;
  }
  return { a, b };
}

/**
 * Производная и интеграл прямо в пространстве коэффициентов:
 *   d/dx [a·cos nx + b·sin nx] = n·b·cos nx − n·a·sin nx
 *   ∫    [a·cos nx + b·sin nx] = −(b/n)·cos nx + (a/n)·sin nx  (+ C, берём C = 0)
 * Производная умножает n-ю гармонику на n (звук ярче), интеграл делит на n (мягче).
 */
export function applyOperator({ a, b }, order) {
  let ca = Float64Array.from(a);
  let cb = Float64Array.from(b);
  const steps = Math.abs(order);
  for (let s = 0; s < steps; s++) {
    const na = new Float64Array(ca.length);
    const nb = new Float64Array(cb.length);
    for (let n = 1; n < ca.length; n++) {
      if (order > 0) {
        na[n] = n * cb[n];
        nb[n] = -n * ca[n];
      } else {
        na[n] = -cb[n] / n;
        nb[n] = ca[n] / n;
      }
    }
    ca = na;
    cb = nb;
  }
  return { a: ca, b: cb };
}

/** Частичная сумма ряда S_N(x) — видно явление Гиббса. */
export function partialSum({ a, b }, harmonics, x) {
  let y = a[0];
  for (let n = 1; n <= harmonics; n++) y += a[n] * Math.cos(n * x) + b[n] * Math.sin(n * x);
  return y;
}

export function amplitudes({ a, b }, harmonics) {
  const out = [];
  for (let n = 1; n <= harmonics; n++) out.push(Math.hypot(a[n], b[n]));
  return out;
}

/** Численная производная (центральная разность) — для касательной. */
export function derivativeAt(fn, x, h = 1e-4) {
  return (fn(x + h) - fn(x - h)) / (2 * h);
}

/** ∫_{−π}^{x} f(t) dt методом трапеций — для закрашенной площади. */
export function integralTo(fn, x, steps = 400) {
  const a = -Math.PI;
  const h = (x - a) / steps;
  if (h === 0) return 0;
  let s = (fn(a) + fn(x)) / 2;
  for (let i = 1; i < steps; i++) s += fn(a + i * h);
  return s * h;
}

/** Ритм Евклида E(k, n): k ударов максимально равномерно на n шагах (алгоритм Бьорклунда в форме Брезенхэма). */
export function euclid(pulses, steps, rotation = 0) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const j = (((i - rotation) % steps) + steps) % steps;
    out.push((j * pulses) % steps < pulses);
  }
  return out;
}

/** Последовательность a(n), n = 0..len−1. Возвращает целые числа или null там, где не определено. */
export function compileSequence(expr, len = 16) {
  const code = compile(expr);
  const values = [];
  for (let n = 0; n < len; n++) {
    const v = Number(code.evaluate({ n }));
    values.push(Number.isFinite(v) ? Math.round(v) : null);
  }
  return values;
}

export const SCALES = {
  major: { label: 'мажор', steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { label: 'минор', steps: [0, 2, 3, 5, 7, 8, 10] },
  penta: { label: 'пентатоника', steps: [0, 3, 5, 7, 10] },
  dorian: { label: 'дорийский', steps: [0, 2, 3, 5, 7, 9, 10] },
};

/** Ступень лада → MIDI-нота (отрицательные ступени уходят вниз по октавам). */
export function degreeToMidi(degree, scaleId, root) {
  const steps = SCALES[scaleId].steps;
  const len = steps.length;
  const octave = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return root + octave * 12 + steps[idx];
}
