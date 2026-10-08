import { useMemo } from 'react';
import { partialSum } from '../math/analysis.js';
import { Control, Press, Hit, DashedArrow } from './svg.jsx';
import { Integral, Paren } from './glyphs.jsx';

const INK = 'var(--ink)';
const CORAL = 'var(--coral)';
const NOTE = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

// операция: ручка внутри скобок, вверх — производные, вниз — интегралы
const OP_Y0 = 290;
const OP_DY = 45;
const OP_MARKS = { 2: 'f″', 1: 'f′', 0: 'f', '-1': '∫', '-2': '∫∫' };

export const filterFreq = (t) => 80 * Math.pow(16000 / 80, t);

function OperatorGlyph({ order }) {
  if (order === -1) return <Integral x={40} y={150} h={290} color={INK} />;
  if (order === -2)
    return (
      <>
        <Integral x={14} y={160} h={270} color={INK} />
        <Integral x={56} y={160} h={270} color={INK} />
      </>
    );
  if (order === 0) return <text className="glyph" x={70} y={360} fontSize="200" textAnchor="middle" fill={INK}>f</text>;
  const sup = order === 2 ? '²' : '';
  return (
    <g fill={INK} className="glyph" textAnchor="middle">
      <text x={70} y={268} fontSize="76">d{sup}</text>
      <rect x={22} y={287} width={96} height={4} />
      <text x={70} y={360} fontSize="76">dx{sup}</text>
    </g>
  );
}

export default function FormulaPanel({
  expr, exprError, onExpr, onNextPreset,
  order, setOrder, opCoeffs, harmonics,
  filterT, setFilterT, echo, setEcho, root, setRoot,
  seqLabel, onNextSeq, melodyOn, toggleMelody,
}) {
  // форма волны, которая звучит, — маленький график внутри скобок
  const wave = useMemo(() => {
    const n = 128;
    const ys = Array.from({ length: n + 1 }, (_, i) => partialSum(opCoeffs, harmonics, -Math.PI + (2 * Math.PI * i) / n));
    const peak = Math.max(1e-9, ...ys.map(Math.abs));
    return ys.map((y, i) => `${i ? 'L' : 'M'}${(152 + (i / n) * 164).toFixed(1)},${(OP_Y0 - (y / peak) * 78).toFixed(1)}`).join(' ');
  }, [opCoeffs, harmonics]);

  const fx = 24 + filterT * 372;
  const freq = filterFreq(filterT);
  const echoLen = 20 + echo * 160;
  const note = `${NOTE[root % 12]}`;
  const octave = Math.floor(root / 12) - 1;

  return (
    <svg className="poster" viewBox="0 0 420 800" preserveAspectRatio="xMidYMid meet">
      <text className="label caps" x="24" y="40" fill={INK}>01 / формула</text>

      {/* f(x) = … */}
      <text className="label" x="24" y="92" fill={INK}>f(x) =</text>
      <foreignObject x="104" y="62" width="256" height="44">
        <input
          className={`fx-input${exprError ? ' error' : ''}`}
          value={expr}
          spellCheck={false}
          aria-label="Функция f(x)"
          title={exprError ?? 'Любая функция от x на отрезке [−π, π]'}
          onChange={(e) => onExpr(e.target.value)}
        />
      </foreignObject>
      <Press label="Следующая функция" onPress={onNextPreset}>
        <Hit x="368" y="66" width="44" height="40" />
        <text className="glyph" x="390" y="96" fontSize="30" textAnchor="middle" fill={CORAL}>↻</text>
      </Press>

      {/* мелодия a(n) */}
      <Press label="Следующая мелодия" onPress={onNextSeq}>
        <Hit x="20" y="112" width="300" height="28" />
        <text className="label" x="24" y="132" fill={INK}>мелодия · <tspan className="glyph" fontSize="20">a(n) = {seqLabel}</tspan></text>
      </Press>
      <Press label="Мелодия вкл/выкл" onPress={toggleMelody} pressed={melodyOn}>
        <Hit x="330" y="112" width="80" height="28" />
        <circle cx="342" cy="127" r="6" fill={melodyOn ? CORAL : 'none'} stroke={melodyOn ? CORAL : INK} strokeWidth="1.2" />
        <text className="label" x="396" y="132" textAnchor="end" fill={INK}>{melodyOn ? 'вкл' : 'выкл'}</text>
      </Press>

      {/* операция: ∫ ( ● ) dx */}
      <OperatorGlyph order={order} />
      <Paren x={130} y={160} h={260} color={INK} />
      <Paren x={340} y={160} h={260} color={INK} right />
      <path d={wave} fill="none" stroke="var(--ink)" strokeOpacity="0.22" strokeWidth="1.5" />
      {order < 0 && (
        <text className="glyph" x="402" y="470" fontSize={order === -1 ? 84 : 58} textAnchor="end" fill={INK}>
          {order === -1 ? 'dx' : 'dx dx'}
        </text>
      )}
      <Control
        label="Операция: производная или интеграл"
        valueText={OP_MARKS[order]}
        value={order}
        min={-2}
        max={2}
        onChange={setOrder}
        fromPoint={(pt) => (OP_Y0 - pt.y) / OP_DY}
      >
        <Hit x="140" y="160" width="190" height="260" />
        <DashedArrow x1={234} y1={182} x2={234} y2={398} color={INK} />
        {[2, 1, 0, -1, -2].map((o) => (
          <g key={o}>
            <line x1="226" x2="242" y1={OP_Y0 - o * OP_DY} y2={OP_Y0 - o * OP_DY} stroke={INK} strokeWidth="1" />
            <text className="glyph" x="262" y={OP_Y0 - o * OP_DY + 6} fontSize="18" fill={o === order ? CORAL : 'var(--ink-mute)'}>
              {OP_MARKS[o]}
            </text>
          </g>
        ))}
        <circle cx="234" cy={OP_Y0 - order * OP_DY} r="22" fill={CORAL} className="handle" />
      </Control>
      <text className="label" x="234" y="452" textAnchor="middle" fill={INK}>операция</text>

      {/* фильтр — слайдер с делениями */}
      <Control
        label="Фильтр (частота среза)"
        valueText={`${Math.round(freq)} Гц`}
        value={filterT}
        min={0}
        max={1}
        step={0.01}
        onChange={setFilterT}
        fromPoint={(pt) => (pt.x - 24) / 372}
      >
        <Hit x="10" y="490" width="400" height="80" />
        <text className="label" x="24" y="505" fill={INK}>фильтр</text>
        <text className="glyph" x="396" y="508" fontSize="24" textAnchor="end" fill={INK}>
          {freq >= 1000 ? `${(freq / 1000).toFixed(1)}k` : Math.round(freq)}
        </text>
        <line x1="24" x2="396" y1="526" y2="526" stroke={INK} strokeWidth="3" />
        {Array.from({ length: 13 }, (_, i) => {
          const x = 24 + (i / 12) * 372;
          const near = Math.abs(x - fx) < 372 / 24;
          return <line key={i} x1={x} x2={x} y1={i % 6 === 0 ? 548 : 552} y2="566" stroke={near ? CORAL : INK} strokeWidth={near ? 2.5 : 1.5} />;
        })}
        <circle cx={fx} cy="526" r="15" fill={CORAL} className="handle" />
      </Control>

      {/* эхо — правое плечо креста */}
      <rect x="84" y="610" width="30" height="160" fill={INK} />
      <rect x="24" y="676" width="60" height="30" fill={INK} />
      <Control
        label="Эхо (дилэй)"
        valueText={`${Math.round(echo * 100)}%`}
        value={echo}
        min={0}
        max={1}
        step={0.01}
        onChange={setEcho}
        fromPoint={(pt) => (pt.x - 134) / 160}
      >
        <Hit x="114" y="650" width="180" height="84" />
        <rect x="114" y="676" width={echoLen} height="30" fill={CORAL} className="handle" />
      </Control>
      <text className="label" x="99" y="792" textAnchor="middle" fill={INK}>эхо</text>

      {/* тон — нота как «i²» */}
      <Control
        label="Тон (тоника мелодии)"
        valueText={`${note}${octave}`}
        value={root}
        min={36}
        max={72}
        onChange={setRoot}
        fromPoint={(pt, s) => s.value + Math.round((s.pt.y - pt.y) / 10)}
      >
        <Hit x="296" y="610" width="124" height="170" />
        <DashedArrow x1={404} y1={640} x2={404} y2={740} color={INK} />
        <text className="glyph" x="340" y="760" fontSize={note.length > 1 ? 100 : 130} textAnchor="middle" fill={INK}>{note}</text>
        <text className="glyph" x="384" y="672" fontSize="46" textAnchor="middle" fill={INK}>{octave}</text>
      </Control>
      <text className="label" x="340" y="792" textAnchor="middle" fill={INK}>тон</text>
    </svg>
  );
}
