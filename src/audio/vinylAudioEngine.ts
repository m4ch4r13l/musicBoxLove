import type { AudioPlaybackStatus, RpmMode, VinylDisc } from '../types/turntable';

interface SynthPresetDef {
  tempoMs: number;
  chords: number[][];
  melody: number[];
  waveform: OscillatorType;
  subWaveform: OscillatorType;
}

const PRESET_DEFS: SynthPresetDef[] = [
  // 0: Noche de Lluvia (Lo-Fi Rhodes)
  {
    tempoMs: 700,
    chords: [
      [220.0, 261.63, 329.63, 392.0], // Am7
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [130.81, 196.0, 246.94, 329.63], // Cmaj7
      [196.0, 246.94, 293.66, 392.0], // G6
    ],
    melody: [523.25, 493.88, 392.0, 440.0, 523.25, 659.25, 587.33, 493.88],
    waveform: 'sine',
    subWaveform: 'triangle',
  },
  // 1: Atardecer en Vinilo (Acordes Cálidos)
  {
    tempoMs: 640,
    chords: [
      [146.83, 220.0, 261.63, 349.23], // Dm7
      [196.0, 246.94, 293.66, 349.23], // G7
      [130.81, 164.81, 196.0, 246.94], // Cmaj7
      [220.0, 261.63, 329.63, 392.0], // Am7
    ],
    melody: [440.0, 523.25, 587.33, 523.25, 493.88, 392.0, 329.63, 392.0],
    waveform: 'triangle',
    subWaveform: 'sine',
  },
  // 2: Caja de Música (Celesta)
  {
    tempoMs: 560,
    chords: [
      [261.63, 329.63, 392.0],
      [246.94, 293.66, 392.0],
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
    ],
    melody: [659.25, 783.99, 1046.5, 783.99, 698.46, 880.0, 783.99, 659.25],
    waveform: 'sine',
    subWaveform: 'sine',
  },
  // 3: Vals de Medianoche (Piano Suave)
  {
    tempoMs: 600,
    chords: [
      [196.0, 246.94, 293.66, 369.99], // Gmaj7
      [164.81, 196.0, 246.94, 293.66], // Em7
      [130.81, 164.81, 196.0, 246.94], // Cmaj7
      [146.83, 220.0, 261.63, 369.99], // D7sus
    ],
    melody: [587.33, 493.88, 392.0, 440.0, 493.88, 587.33, 659.25, 587.33],
    waveform: 'sine',
    subWaveform: 'triangle',
  },
  // 4: Brisa de Verano (Armónicos)
  {
    tempoMs: 660,
    chords: [
      [164.81, 207.65, 246.94, 311.13], // Emaj7
      [220.0, 277.18, 329.63, 415.3], // Amaj7
      [185.0, 220.0, 277.18, 329.63], // F#m7
      [246.94, 311.13, 369.99, 440.0], // B7sus
    ],
    melody: [659.25, 622.25, 493.88, 554.37, 659.25, 830.61, 739.99, 622.25],
    waveform: 'triangle',
    subWaveform: 'sine',
  },
];

export class VinylAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private warmthFilter: BiquadFilterNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private crackleSource: AudioBufferSourceNode | null = null;
  private crackleGain: GainNode | null = null;
  private synthTimer: number | null = null;

  private realAudio: HTMLAudioElement;
  private loadedAudioUrl = '';
  private isPlaying = false;
  private volume = 0.72;
  private crackleEnabled = true;
  private rpm: RpmMode = 33;
  private currentDisc: VinylDisc | null = null;
  private fallbackActive = false;
  private step = 0;

  private onStatusChange?: (status: AudioPlaybackStatus) => void;
  private progressTimer: number | null = null;

  constructor(onStatusChange?: (status: AudioPlaybackStatus) => void) {
    this.onStatusChange = onStatusChange;
    this.realAudio = new Audio();
    this.realAudio.preload = 'metadata';

    this.realAudio.addEventListener('ended', () => {
      // Loop gently like a record or notify
      this.realAudio.currentTime = 0;
      if (this.isPlaying) {
        this.realAudio.play().catch(() => {});
      }
    });

    this.realAudio.addEventListener('timeupdate', () => {
      this.emitStatus();
    });

    this.realAudio.addEventListener('loadedmetadata', () => {
      this.emitStatus();
    });
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume * 0.42;

      this.warmthFilter = this.ctx.createBiquadFilter();
      this.warmthFilter.type = 'lowpass';
      this.warmthFilter.frequency.value = 3100;
      this.warmthFilter.Q.value = 0.7;

      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = this.createImpulseResponse(this.ctx, 1.8, 2.6);

      const dryGain = this.ctx.createGain();
      dryGain.gain.value = 0.78;
      const wetGain = this.ctx.createGain();
      wetGain.gain.value = 0.28;

      this.warmthFilter.connect(dryGain);
      this.warmthFilter.connect(this.reverbNode);
      this.reverbNode.connect(wetGain);

      dryGain.connect(this.masterGain);
      wetGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private createImpulseResponse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  public playNeedleDrop(): void {
    const ctx = this.ensureContext();
    if (!this.masterGain) return;
    const now = ctx.currentTime;

    // Soft low-end thump when stylus lands on vinyl
    const thumpOsc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thumpOsc.type = 'sine';
    thumpOsc.frequency.setValueAtTime(115, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(36, now + 0.14);

    thumpGain.gain.setValueAtTime(0.001, now);
    thumpGain.gain.linearRampToValueAtTime(0.45, now + 0.012);
    thumpGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);

    thumpOsc.connect(thumpGain);
    thumpGain.connect(this.masterGain);
    thumpOsc.start(now);
    thumpOsc.stop(now + 0.2);

    // Subtle stylus micro-tick
    const clickBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
    const data = clickBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.004));
    }
    const clickSrc = ctx.createBufferSource();
    clickSrc.buffer = clickBuf;
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.value = 2400;
    const clickGain = ctx.createGain();
    clickGain.gain.value = 0.22;

    clickSrc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(this.masterGain);
    clickSrc.start(now + 0.015);
  }

  public playNeedleLift(): void {
    const ctx = this.ensureContext();
    if (!this.masterGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.06);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  private startCrackle(): void {
    const ctx = this.ensureContext();
    if (!this.masterGain || this.crackleSource) return;

    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Subtle brownian warmth hiss
      lastOut = (lastOut + 0.04 * white) / 1.04;
      const pop = Math.random() > 0.9988 ? (Math.random() * 0.55 - 0.275) : 0;
      const microTick = Math.random() > 0.994 ? (Math.random() * 0.12 - 0.06) : 0;
      data[i] = lastOut * 0.08 + pop + microTick;
    }

    this.crackleSource = ctx.createBufferSource();
    this.crackleSource.buffer = buffer;
    this.crackleSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1950;
    filter.Q.value = 0.65;

    this.crackleGain = ctx.createGain();
    this.crackleGain.gain.value = this.crackleEnabled ? 0.34 : 0;

    this.crackleSource.connect(filter);
    filter.connect(this.crackleGain);
    this.crackleGain.connect(this.masterGain);
    this.crackleSource.start();
  }

  private stopCrackle(): void {
    if (this.crackleSource) {
      try {
        this.crackleSource.stop();
      } catch {
        // Ignore already stopped
      }
      this.crackleSource.disconnect();
      this.crackleSource = null;
    }
    if (this.crackleGain) {
      this.crackleGain.disconnect();
      this.crackleGain = null;
    }
  }

  private startSynth(presetIndex: number): void {
    const ctx = this.ensureContext();
    this.stopSynth();

    const preset = PRESET_DEFS[presetIndex % PRESET_DEFS.length];
    const rpmFactor = this.rpm === 45 ? 0.74 : 1.0; // 45 RPM plays slightly brisker
    const pitchShift = this.rpm === 45 ? 1.06 : 1.0;

    const triggerStep = () => {
      if (!this.isPlaying || !this.warmthFilter) return;

      const now = ctx.currentTime;
      const chordIdx = Math.floor(this.step / 4) % preset.chords.length;
      const noteFreq = preset.melody[this.step % preset.melody.length] * pitchShift;

      // Play lush chord pad at the start of every 4-beat bar
      if (this.step % 4 === 0) {
        const chord = preset.chords[chordIdx];
        chord.forEach((freq, idx) => {
          if (!this.warmthFilter) return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = idx === 0 ? 'triangle' : preset.waveform;
          // Subtle analog detune warmth
          osc.frequency.setValueAtTime(freq * pitchShift, now);
          osc.detune.setValueAtTime((idx - 1.5) * 4, now);

          gain.gain.setValueAtTime(0.0005, now);
          gain.gain.linearRampToValueAtTime(0.095, now + 0.14);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 2.7 * rpmFactor);

          osc.connect(gain);
          gain.connect(this.warmthFilter);
          osc.start(now);
          osc.stop(now + 2.8 * rpmFactor);
        });
      }

      // Play gentle melody bell / Rhodes note
      const melOsc = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const melGain = ctx.createGain();

      melOsc.type = preset.waveform;
      melOsc.frequency.setValueAtTime(noteFreq, now);
      subOsc.type = preset.subWaveform;
      subOsc.frequency.setValueAtTime(noteFreq * 0.5, now);

      melGain.gain.setValueAtTime(0.001, now);
      melGain.gain.linearRampToValueAtTime(0.16, now + 0.035);
      melGain.gain.exponentialRampToValueAtTime(0.0008, now + 1.35 * rpmFactor);

      melOsc.connect(melGain);
      subOsc.connect(melGain);
      melGain.connect(this.warmthFilter);

      melOsc.start(now);
      subOsc.start(now);
      melOsc.stop(now + 1.45 * rpmFactor);
      subOsc.stop(now + 1.45 * rpmFactor);

      this.step++;
    };

    triggerStep();
    this.synthTimer = window.setInterval(triggerStep, Math.round(preset.tempoMs * rpmFactor));
  }

  private stopSynth(): void {
    if (this.synthTimer !== null) {
      window.clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
  }

  public playDisc(disc: VinylDisc, withNeedleSound = true): void {
    this.currentDisc = disc;
    this.isPlaying = true;
    this.fallbackActive = false;

    this.ensureContext();
    if (withNeedleSound) {
      this.playNeedleDrop();
    }
    this.startCrackle();

    const audioUrl = disc.audioUrl?.trim();
    if (audioUrl) {
      this.stopSynth();
      if (this.loadedAudioUrl !== audioUrl) {
        this.loadedAudioUrl = audioUrl;
        this.realAudio.src = audioUrl;
      }
      this.realAudio.volume = this.volume;
      this.realAudio.playbackRate = this.rpm === 45 ? 1.18 : 1.0;

      this.realAudio
        .play()
        .then(() => {
          this.fallbackActive = false;
          this.emitStatus();
        })
        .catch(() => {
          this.fallbackActive = true;
          this.startSynth(disc.synthPreset ?? 0);
          this.emitStatus();
        });
    } else {
      this.realAudio.pause();
      this.startSynth(disc.synthPreset ?? 0);
      this.emitStatus();
    }
  }

  public pause(withNeedleSound = true): void {
    if (this.isPlaying && withNeedleSound) {
      this.playNeedleLift();
    }
    this.isPlaying = false;
    this.realAudio.pause();
    this.stopSynth();
    this.stopCrackle();
    this.emitStatus();
  }

  public setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.realAudio.volume = this.volume;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume * 0.42, this.ctx.currentTime, 0.04);
    }
  }

  public setCrackleEnabled(enabled: boolean): void {
    this.crackleEnabled = enabled;
    if (this.crackleGain && this.ctx) {
      this.crackleGain.gain.setTargetAtTime(enabled ? 0.34 : 0, this.ctx.currentTime, 0.05);
    }
  }

  public setRpm(rpm: RpmMode): void {
    this.rpm = rpm;
    this.realAudio.playbackRate = rpm === 45 ? 1.18 : 1.0;
    if (this.isPlaying && this.currentDisc) {
      if (!this.currentDisc.audioUrl?.trim() || this.fallbackActive) {
        this.startSynth(this.currentDisc.synthPreset ?? 0);
      }
    }
  }

  public seekTo(seconds: number): void {
    if (Number.isFinite(seconds) && this.realAudio.duration > 0) {
      this.realAudio.currentTime = Math.max(0, Math.min(this.realAudio.duration, seconds));
      this.emitStatus();
    }
  }

  private emitStatus(): void {
    if (!this.onStatusChange) return;
    const usingMp3 = Boolean(this.currentDisc?.audioUrl?.trim()) && !this.fallbackActive;
    this.onStatusChange({
      sourceType: usingMp3 ? 'mp3' : 'synth',
      currentTime: usingMp3 ? this.realAudio.currentTime || 0 : 0,
      duration: usingMp3 && Number.isFinite(this.realAudio.duration) ? this.realAudio.duration : 0,
      fallbackActive: this.fallbackActive,
    });
  }

  public dispose(): void {
    this.pause(false);
    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer);
    }
    this.realAudio.src = '';
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
