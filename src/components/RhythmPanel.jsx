import { DRUMS } from '../audio/engine.js';
import { Control, Press, Hit, DashedArrow } from './svg.jsx';
import { Paren, Radical, radicalBarX } from './glyphs.jsx';

const CREAM = 'var(--cream)';
const LIME = 'var(--lime)';
const MUTE = 'var(--cream-mute)';

// √ : черта радикала — слайдер темпа, под корнем — ритмы
const RX = 24;
const RY = 92;
const RH = 196;
const BAR_X = radicalBarX(RX, RH);
const T0 = BAR_X + 20;
const T1 = 384;
const BPM_MIN = 60;
const BPM_MAX = 180;

// ритмы Евклида: 16 точек в ряд
const DOT_X0 = 200;
const DOT_DX = 12.4;
const ROWS = { kick: 160, snare: 208, hat: 256 };

// ×
const XC = [210, 452];
const ARM = 130;
const THICK = 52;
const DIR = [Math.SQRT1_2, -Math.SQRT1_2]; // верхнее правое плечо

export default function RhythmPanel({ bpm, setBpm, playing, togglePlay, euclidK, setK, patterns, step, onHit, drive, setDrive, reverb, setReverb }) {
  const tx = T0 + ((bpm - BPM_MIN) / (BPM_MAX - BPM_MIN)) * (T1 - T0);
  const driveT = (drive - 0.2) / (10 - 0.2);
  const limeLen = THICK / 2 + 8 + driveT * (ARM - THICK / 2 - 8);
  const revY = 712 - reverb * 56;

  return (
    <svg className="poster" viewBox="0 0 420 800" preserveAspectRatio="xMidYMid meet">
      <text className="label caps" x="24" y="40" fill={CREAM}>03 / ритм</text>

      {/* старт / стоп */}
      <Press label={playing ? 'Стоп' : 'Играть'} onPress={togglePlay} pressed={playing}>
        <Hit x="350" y="14" width="56" height="40" />
        {playing ? <rect x="374" y="24" width="20" height="20" fill={LIME} /> : <path d="M374 22 L396 34 L374 46 Z" fill={CREAM} />}
      </Press>

      {/* темп */}
      <text className="label" x="24" y="88" fill={CREAM}>темп</text>
      <text className="glyph" x="24" y="128" fontSize="40" fill={CREAM}>{bpm}</text>
      <Radical x={RX} y={RY} w={396 - RX} h={RH} color={CREAM} />
      <Control
        label="Темп, BPM"
        valueText={`${bpm} BPM`}
        value={bpm}
        min={BPM_MIN}
        max={BPM_MAX}
        onChange={setBpm}
        fromPoint={(pt) => BPM_MIN + ((pt.x - T0) / (T1 - T0)) * (BPM_MAX - BPM_MIN)}
      >
        <Hit x={BAR_X} y="56" width={410 - BAR_X} height="56" />
        <DashedArrow x1={tx - 26} y1={66} x2={tx + 26} y2={66} color={CREAM} />
        <circle cx={tx} cy={RY} r="15" fill={LIME} className="handle" />
      </Control>

      {/* ритмы Евклида под корнем */}
      {DRUMS.map((d) => {
        const y = ROWS[d];
        const k = euclidK[d];
        return (
          <g key={d}>
            <Press label={`Ударить ${d}`} onPress={() => onHit(d)}>
              <Hit x="128" y={y - 16} width="62" height="32" />
              <text className="label" x="134" y={y + 5} fill={CREAM}>{d}</text>
            </Press>
            <Control
              label={`${d}: число ударов на 16 шагов`}
              valueText={`E(${k}, 16)`}
              value={k}
              min={0}
              max={16}
              onChange={(v) => setK(d, v)}
              fromPoint={(pt) => (pt.x - DOT_X0 + DOT_DX) / DOT_DX}
            >
              <Hit x={DOT_X0 - 12} y={y - 18} width={410 - DOT_X0} height="36" />
              {patterns[d].map((on, i) => {
                const x = DOT_X0 + i * DOT_DX;
                return (
                  <g key={i}>
                    {i === step && <circle cx={x} cy={y} r="8" fill="none" stroke={LIME} strokeWidth="1.5" />}
                    <circle cx={x} cy={y} r={on ? 4.6 : 1.6} fill={on ? CREAM : MUTE} />
                  </g>
                );
              })}
              <line x1={DOT_X0 - DOT_DX / 2 + k * DOT_DX} x2={DOT_X0 - DOT_DX / 2 + k * DOT_DX} y1={y - 12} y2={y + 12} stroke={LIME} strokeWidth="3" className="handle" />
            </Control>
          </g>
        );
      })}

      {/* × — перегруз (tanh) */}
      <g transform={`translate(${XC[0]},${XC[1]}) rotate(45)`} fill={CREAM}>
        <rect x={-ARM} y={-THICK / 2} width={ARM * 2} height={THICK} />
        <rect x={-THICK / 2} y={-ARM} width={THICK} height={ARM * 2} />
      </g>
      <Control
        label="Перегруз ударных, tanh(kx)"
        valueText={`k = ${drive.toFixed(1)}`}
        value={drive}
        min={0.2}
        max={10}
        step={0.1}
        onChange={setDrive}
        fromPoint={(pt) => {
          const d = (pt.x - XC[0]) * DIR[0] + (pt.y - XC[1]) * DIR[1];
          const t = (d - THICK / 2 - 8) / (ARM - THICK / 2 - 8);
          return 0.2 + t * (10 - 0.2);
        }}
      >
        <g transform={`translate(${XC[0]},${XC[1]}) rotate(-45)`}>
          <Hit x={THICK / 2} y={-THICK} width={ARM} height={THICK * 2} />
          <rect x={THICK / 2} y={-THICK / 2} width={limeLen - THICK / 2} height={THICK} fill={LIME} className="handle" />
        </g>
      </Control>
      <text className="label" x="24" y="606" fill={CREAM}>перегруз</text>
      <text className="glyph" x="24" y="636" fontSize="24" fill={CREAM}>tanh({drive.toFixed(1)}x)</text>

      {/* (÷)² — реверб */}
      <Paren x={150} y={624} h={160} color={CREAM} />
      <Paren x={286} y={624} h={160} color={CREAM} right />
      <text className="glyph" x="300" y="652" fontSize="40" fill={CREAM}>2</text>
      <rect x="182" y="724" width="72" height="12" fill={CREAM} />
      <circle cx="218" cy="762" r="11" fill={CREAM} />
      <Control
        label="Реверб ударных"
        valueText={`${Math.round(reverb * 100)}%`}
        value={reverb}
        min={0}
        max={1}
        step={0.01}
        onChange={setReverb}
        fromPoint={(pt) => (712 - pt.y) / 56}
      >
        <Hit x="176" y="636" width="84" height="88" />
        <DashedArrow x1={260} y1={652} x2={260} y2={712} color={CREAM} />
        <circle cx="218" cy={revY} r="14" fill={LIME} className="handle" />
      </Control>
      <text className="label" x="396" y="724" textAnchor="end" fill={CREAM}>реверб</text>

      {/* подсказка по клавишам */}
      <g className="label small" fill={MUTE}>
        <text x="24" y="690">space — старт</text>
        <text x="24" y="712">a … l — ноты</text>
        <text x="24" y="734">z x — октава</text>
        <text x="24" y="756">1 2 3 — удары</text>
      </g>
    </svg>
  );
}
