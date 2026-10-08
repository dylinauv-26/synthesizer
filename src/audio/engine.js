import * as Tone from 'tone';

export const STEPS = 16;
export const DRUMS = ['kick', 'snare', 'hat'];

const tanhCurve = (k) => (x) => Math.tanh(k * x) / Math.tanh(k);
// одна ручка «эхо» управляет и обратной связью, и громкостью повторов
const echoMap = (v) => ({ feedback: 0.1 + 0.6 * v, wet: 0.5 * v });
const SYNTH_DB = -6;
const DRUMS_DB = -4;

/**
 * Весь звук приложения.
 *
 * Голос 1 «f(x)»:  осцилляторы с формой волны из ряда Фурье → фильтр → дилэй → канал
 * Голос 2 «Δ»:     kick / snare / hat → свои каналы → шина → tanh-сатурация → реверб → канал
 * Оба голоса → мастер-канал → лимитер → выход.
 */
class Engine {
  built = false;
  wave = null;
  waveData = null;
  liveVoices = new Map();
  step = 0;
  onStep = null;

  params = {
    attack: 0.01,
    release: 0.4,
    filterType: 'lowpass',
    filterFreq: 6000,
    filterQ: 1,
    echo: 0.35,
    crossfade: 0.5,
    drive: 1.5,
    reverbWet: 0.15,
    decay: { kick: 0.4, snare: 0.2, hat: 0.08 },
  };

  pattern = {
    melody: Array(STEPS).fill(null),
    melodyOn: true,
    gate: 0.5,
    drums: { kick: Array(STEPS).fill(false), snare: Array(STEPS).fill(false), hat: Array(STEPS).fill(false) },
  };

  async start() {
    await Tone.start();
    if (!this.built) this.build();
  }

  build() {
    const p = this.params;

    this.master = new Tone.Channel({ volume: -4 });
    this.limiter = new Tone.Limiter(-1);
    this.scope = new Tone.Waveform(1024);
    this.master.chain(this.limiter, Tone.getDestination());
    this.master.connect(this.scope);

    // ── голос 1: f(x)
    this.synthIn = new Tone.Gain(0.35);
    this.filter = new Tone.Filter({ type: p.filterType, frequency: p.filterFreq, Q: p.filterQ });
    this.delay = new Tone.FeedbackDelay({ delayTime: '8n.', ...echoMap(p.echo) });
    this.synthCh = new Tone.Channel({ volume: SYNTH_DB });
    this.synthIn.chain(this.filter, this.delay, this.synthCh, this.master);

    // ── голос 2: ударные
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 6,
      envelope: { attack: 0.001, decay: p.decay.kick, sustain: 0, release: 0.05 },
    });
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: p.decay.snare, sustain: 0, release: 0.03 },
    });
    this.hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: p.decay.hat, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 6000,
      octaves: 1.5,
    });
    this.hat.frequency.value = 250;
    this.drumBus = new Tone.Gain(1);
    this.drumCh = {
      kick: new Tone.Channel({ volume: -2 }),
      snare: new Tone.Channel({ volume: -10 }),
      hat: new Tone.Channel({ volume: -22, pan: 0.25 }),
    };
    this.kick.connect(this.drumCh.kick);
    this.snare.connect(this.drumCh.snare);
    this.hat.connect(this.drumCh.hat);
    DRUMS.forEach((d) => this.drumCh[d].connect(this.drumBus));

    this.shaper = new Tone.WaveShaper(tanhCurve(p.drive), 4096);
    this.reverb = new Tone.Reverb({ decay: 1.6, wet: p.reverbWet });
    this.drumOut = new Tone.Channel({ volume: DRUMS_DB });
    this.drumBus.chain(this.shaper, this.reverb, this.drumOut, this.master);

    // индикаторы уровня для микшера
    this.meters = {};
    const strips = { synth: this.synthCh, ...this.drumCh, drums: this.drumOut, master: this.master };
    this.channels = strips;
    Object.entries(strips).forEach(([id, ch]) => {
      const m = new Tone.Meter({ smoothing: 0.8, normalRange: true });
      ch.connect(m);
      this.meters[id] = m;
    });

    Tone.getTransport().bpm.value = 110;
    Tone.getTransport().scheduleRepeat((time) => this.tick(time), '16n');

    this.built = true;
    this.set('crossfade', p.crossfade);
    if (this.waveData) this.setWave(this.waveData.real, this.waveData.imag);
  }

  tick(time) {
    const s = this.step % STEPS;
    const { melody, melodyOn, gate, drums } = this.pattern;
    const sixteenth = Tone.Time('16n').toSeconds();

    if (melodyOn && melody[s] != null) this.playNote(melody[s], sixteenth * gate * 2, time);
    if (drums.kick[s]) this.kick.triggerAttackRelease('C1', '8n', time);
    if (drums.snare[s]) this.snare.triggerAttackRelease('16n', time);
    if (drums.hat[s]) this.hat.triggerAttackRelease('32n', time, 0.6);

    Tone.getDraw().schedule(() => this.onStep?.(s), time);
    this.step++;
  }

  // ── форма волны голоса 1

  /** real[n], imag[n] — коэффициенты при cos(nx) и sin(nx). Web Audio сам нормирует пик к 1. */
  setWave(real, imag) {
    this.waveData = { real, imag };
    if (!this.built) return;
    this.wave = Tone.getContext().createPeriodicWave(real, imag);
    this.liveVoices.forEach((v) => v.osc.setPeriodicWave(this.wave));
  }

  makeVoice(midi) {
    const osc = new Tone.ToneOscillatorNode({ frequency: Tone.Frequency(midi, 'midi').toFrequency() });
    osc.setPeriodicWave(this.wave);
    const env = new Tone.AmplitudeEnvelope({
      attack: this.params.attack,
      decay: 0.1,
      sustain: 0.8,
      release: this.params.release,
    });
    osc.connect(env);
    env.connect(this.synthIn);
    osc.onended = () => {
      osc.dispose();
      env.dispose();
    };
    return { osc, env };
  }

  playNote(midi, duration, time = Tone.now()) {
    if (!this.built || !this.wave) return;
    const { osc, env } = this.makeVoice(midi);
    osc.start(time);
    env.triggerAttackRelease(duration, time);
    osc.stop(time + duration + this.params.release + 0.05);
  }

  noteOn(midi) {
    if (!this.built || !this.wave || this.liveVoices.has(midi)) return;
    const voice = this.makeVoice(midi);
    const now = Tone.now();
    voice.osc.start(now);
    voice.env.triggerAttack(now);
    this.liveVoices.set(midi, voice);
  }

  noteOff(midi) {
    const voice = this.liveVoices.get(midi);
    if (!voice) return;
    const now = Tone.now();
    voice.env.triggerRelease(now);
    voice.osc.stop(now + this.params.release + 0.05);
    this.liveVoices.delete(midi);
  }

  triggerDrum(name) {
    if (!this.built) return;
    if (name === 'kick') this.kick.triggerAttackRelease('C1', '8n');
    if (name === 'snare') this.snare.triggerAttackRelease('16n');
    if (name === 'hat') this.hat.triggerAttackRelease('32n', undefined, 0.6);
  }

  // ── параметры

  set(key, value) {
    this.params[key] = value;
    if (!this.built) return;
    switch (key) {
      case 'filterType':
        this.filter.type = value;
        break;
      case 'filterFreq':
        this.filter.frequency.rampTo(value, 0.05);
        break;
      case 'filterQ':
        this.filter.Q.value = value;
        break;
      case 'echo': {
        const { feedback, wet } = echoMap(value);
        this.delay.feedback.rampTo(feedback, 0.05);
        this.delay.wet.rampTo(wet, 0.05);
        break;
      }
      case 'crossfade': {
        // равная мощность: cos²θ + sin²θ = 1, поэтому в середине громкость не проваливается
        const theta = (value * Math.PI) / 2;
        this.synthCh.volume.rampTo(SYNTH_DB + Tone.gainToDb(Math.max(1e-4, Math.cos(theta))), 0.05);
        this.drumOut.volume.rampTo(DRUMS_DB + Tone.gainToDb(Math.max(1e-4, Math.sin(theta))), 0.05);
        break;
      }
      case 'drive':
        this.shaper.setMap(tanhCurve(value));
        break;
      case 'reverbWet':
        this.reverb.wet.rampTo(value, 0.05);
        break;
      default:
        break;
    }
  }

  setDecay(drum, value) {
    this.params.decay[drum] = value;
    if (this.built) this[drum].envelope.decay = value;
  }

  setChannel(id, key, value) {
    const ch = this.channels?.[id];
    if (!ch) return;
    if (key === 'volume') ch.volume.rampTo(value, 0.05);
    else if (key === 'pan') ch.pan.rampTo(value, 0.05);
    else ch[key] = value; // mute / solo
  }

  level(id) {
    const m = this.meters?.[id];
    if (!m) return 0;
    const v = m.getValue();
    return Array.isArray(v) ? Math.max(...v) : v;
  }

  // ── транспорт

  play() {
    this.step = 0;
    Tone.getTransport().start('+0.05');
  }

  stop() {
    Tone.getTransport().stop();
    this.onStep?.(-1);
  }

  setBpm(bpm) {
    Tone.getTransport().bpm.rampTo(bpm, 0.1);
  }

  /** Фаза внутри такта ∈ [0, 1) — по ней бежит точка x₀ на графике. */
  barPhase() {
    if (!this.built) return null;
    const t = Tone.getTransport();
    if (t.state !== 'started') return null;
    const bar = Tone.Time('1m').toSeconds();
    return (t.seconds % bar) / bar;
  }
}

export const engine = new Engine();
