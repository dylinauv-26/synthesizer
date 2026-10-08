import { useEffect, useMemo, useState } from 'react';
import { engine, DRUMS } from './audio/engine.js';
import {
  PRESETS, compileFunction, sampleFunction, fourier, applyOperator,
  euclid, compileSequence, degreeToMidi,
} from './math/analysis.js';
import FormulaPanel, { filterFreq } from './components/FormulaPanel.jsx';
import GeometryPanel from './components/GeometryPanel.jsx';
import RhythmPanel from './components/RhythmPanel.jsx';

// Клавиатура компьютера → хроматическая гамма от C
const KEYMAP = ['KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY', 'KeyH', 'KeyU', 'KeyJ', 'KeyK', 'KeyO', 'KeyL'];

const SEQUENCES = [
  { expr: 'mod(n^2, 7)', label: 'n² mod 7' },
  { expr: 'floor(4*sin(n*pi/4))', label: '⌊4 sin(πn/4)⌋' },
  { expr: 'mod(floor(n*1.618), 8)', label: '⌊nφ⌋ mod 8' },
  { expr: 'mod(n*3, 8) - 2', label: '3n mod 8 − 2' },
];

const INITIAL_K = { kick: 4, snare: 2, hat: 11 };
const ROTATION = { kick: 0, snare: 4, hat: 0 };

export default function App() {
  // ── голос 1: функция и оператор
  const [expr, setExpr] = useState(PRESETS[1].expr);
  const [fn, setFn] = useState(() => compileFunction(PRESETS[1].expr));
  const [exprError, setExprError] = useState(null);
  const [order, setOrder] = useState(0);
  const [harmonics, setHarmonics] = useState(16);

  const coeffs = useMemo(() => fourier(sampleFunction(fn)), [fn]);
  const opCoeffs = useMemo(() => applyOperator(coeffs, order), [coeffs, order]);

  useEffect(() => {
    const real = new Float32Array(harmonics + 1);
    const imag = new Float32Array(harmonics + 1);
    for (let n = 1; n <= harmonics; n++) {
      real[n] = opCoeffs.a[n];
      imag[n] = opCoeffs.b[n];
    }
    // если все коэффициенты нулевые (например, f = const), подставляем синус, чтобы не было тишины
    if (real.every((v) => v === 0) && imag.every((v) => v === 0)) imag[1] = 1;
    engine.setWave(real, imag);
  }, [opCoeffs, harmonics]);

  const changeExpr = (value) => {
    setExpr(value);
    try {
      const compiled = compileFunction(value);
      setFn(() => compiled);
      setExprError(null);
    } catch (e) {
      setExprError(e.message);
    }
  };
  const nextPreset = () => {
    const i = PRESETS.findIndex((p) => p.expr === expr);
    changeExpr(PRESETS[(i + 1) % PRESETS.length].expr);
  };

  // ── параметры звука: состояние UI + движок
  const [filterT, setFilterT] = useState(0.8);
  const [echo, setEcho] = useState(engine.params.echo);
  const [crossfade, setCrossfade] = useState(engine.params.crossfade);
  const [drive, setDrive] = useState(engine.params.drive);
  const [reverb, setReverb] = useState(engine.params.reverbWet);
  useEffect(() => engine.set('filterFreq', filterFreq(filterT)), [filterT]);
  useEffect(() => engine.set('echo', echo), [echo]);
  useEffect(() => engine.set('crossfade', crossfade), [crossfade]);
  useEffect(() => engine.set('drive', drive), [drive]);
  useEffect(() => engine.set('reverbWet', reverb), [reverb]);

  // ── мелодия a(n)
  const [seqIndex, setSeqIndex] = useState(0);
  const [root, setRoot] = useState(57);
  const [melodyOn, setMelodyOn] = useState(true);
  const melody = useMemo(
    () => compileSequence(SEQUENCES[seqIndex].expr).map((d) => (d == null ? null : degreeToMidi(d, 'minor', root))),
    [seqIndex, root],
  );

  // ── голос 2: ритмы Евклида
  const [euclidK, setEuclidK] = useState(INITIAL_K);
  const patterns = useMemo(
    () => Object.fromEntries(DRUMS.map((d) => [d, euclid(euclidK[d], 16, ROTATION[d])])),
    [euclidK],
  );

  useEffect(() => {
    engine.pattern = { melody, melodyOn, gate: 0.5, drums: patterns };
  }, [melody, melodyOn, patterns]);

  // ── транспорт
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(110);
  const [step, setStep] = useState(-1);
  useEffect(() => {
    engine.onStep = setStep;
  }, []);
  useEffect(() => {
    if (engine.built) engine.setBpm(bpm);
  }, [bpm]);
  const togglePlay = async () => {
    await engine.start();
    engine.setBpm(bpm);
    if (playing) engine.stop();
    else engine.play();
    setPlaying(!playing);
  };

  // ── звук включается первым касанием (браузеры не дают стартовать AudioContext без жеста)
  useEffect(() => {
    const unlock = () => engine.start();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // ── игра с клавиатуры
  const [octave, setOctave] = useState(0);
  useEffect(() => {
    const typing = (e) => e.target.tagName === 'INPUT';
    const down = (e) => {
      if (typing(e) || e.repeat || e.metaKey || e.ctrlKey) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (e.code === 'KeyZ') return setOctave((o) => Math.max(-2, o - 1));
      if (e.code === 'KeyX') return setOctave((o) => Math.min(2, o + 1));
      if (e.code === 'Digit1') return engine.triggerDrum('kick');
      if (e.code === 'Digit2') return engine.triggerDrum('snare');
      if (e.code === 'Digit3') return engine.triggerDrum('hat');
      const i = KEYMAP.indexOf(e.code);
      if (i >= 0) engine.noteOn(60 + octave * 12 + i);
    };
    const up = (e) => {
      const i = KEYMAP.indexOf(e.code);
      if (i >= 0) engine.noteOff(60 + octave * 12 + i);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  return (
    <main className="board">
      <section className="panel panel-formula" aria-label="Голос 1: формула">
        <FormulaPanel
          expr={expr} exprError={exprError} onExpr={changeExpr} onNextPreset={nextPreset}
          order={order} setOrder={setOrder} opCoeffs={opCoeffs} harmonics={harmonics}
          filterT={filterT} setFilterT={setFilterT} echo={echo} setEcho={setEcho}
          root={root} setRoot={setRoot}
          seqLabel={SEQUENCES[seqIndex].label} onNextSeq={() => setSeqIndex((i) => (i + 1) % SEQUENCES.length)}
          melodyOn={melodyOn} toggleMelody={() => setMelodyOn((v) => !v)}
        />
      </section>
      <section className="panel panel-geometry" aria-label="Геометрия и микс">
        <GeometryPanel fn={fn} harmonics={harmonics} setHarmonics={setHarmonics} crossfade={crossfade} setCrossfade={setCrossfade} />
      </section>
      <section className="panel panel-rhythm" aria-label="Голос 2: ритм">
        <RhythmPanel
          bpm={bpm} setBpm={setBpm} playing={playing} togglePlay={togglePlay}
          euclidK={euclidK} setK={(d, k) => setEuclidK((s) => ({ ...s, [d]: k }))}
          patterns={patterns} step={step} onHit={(d) => engine.start().then(() => engine.triggerDrum(d))}
          drive={drive} setDrive={setDrive} reverb={reverb} setReverb={setReverb}
        />
      </section>
    </main>
  );
}
