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

export interface AudioReactiveLevels {
  bass: number;
  mid: number;
  high: number;
  pulse: number;
  active: boolean;
}

export class VinylAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private realAudioGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;

  private warmthFilter: BiquadFilterNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private crackleSource: AudioBufferSourceNode | null = null;
  private crackleGain: GainNode | null = null;
  private synthTimer: number | null = null;

  private analyzedAudio: HTMLAudioElement;
  private plainAudio: HTMLAudioElement;
  private activeAudioEl: HTMLAudioElement;
  private loadedUrlMap = new WeakMap<HTMLAudioElement, string>();

  private isPlaying = false;
  private waitingForCue = false;
  private inLeadIn = false;
  private leadInTimer: number | null = null;
  private leadInToken = 0;
  private volume = 0.72;
  private crackleEnabled = true;
  private rpm: RpmMode = 33;
  private currentDisc: VinylDisc | null = null;
  private fallbackActive = false;
  private step = 0;
  private unlockedEls = new WeakSet<HTMLAudioElement>();
  private nonCorsUrls = new Set<string>();

  // Beat / onset detection state (zero-allocation per frame)
  private fastAvgBass = 0;
  private slowAvgEnergy = 0.12;
  private prevBass = 0;
  private prevMid = 0;
  private prevHigh = 0;
  private smoothBass = 0;
  private smoothMid = 0;
  private smoothHigh = 0;
  private beatPulse = 0;
  private beatCooldown = 0;
  private wasReactiveActive = false;
  private reactiveStartMs = 0;
  private reactiveLevels: AudioReactiveLevels = {
    bass: 0,
    mid: 0,
    high: 0,
    pulse: 0,
    active: false,
  };

  private onStatusChange?: (status: AudioPlaybackStatus) => void;
  private onTrackEnded?: () => void;
  private progressTimer: number | null = null;

  constructor(
    onStatusChange?: (status: AudioPlaybackStatus) => void,
    onTrackEnded?: () => void
  ) {
    this.onStatusChange = onStatusChange;
    this.onTrackEnded = onTrackEnded;
    this.analyzedAudio = this.createAudioElement(true);
    this.plainAudio = this.createAudioElement(false);
    this.activeAudioEl = this.plainAudio;
  }

  private createAudioElement(useCors: boolean): HTMLAudioElement {
    const el = new Audio();
    el.preload = 'metadata';
    if (useCors) {
      el.crossOrigin = 'anonymous';
    }

    el.addEventListener('ended', () => {
      if (el !== this.activeAudioEl || !this.isPlaying) return;
      this.isPlaying = false;
      this.stopSynth();
      this.stopCrackle();
      el.pause();
      el.currentTime = 0;
      this.playNeedleLift();
      this.emitStatus();

      if (this.onTrackEnded) {
        this.waitingForCue = true;
        this.onTrackEnded();
      } else {
        this.isPlaying = true;
        this.startCrackle();
        el.play().catch(() => {});
      }
    });

    el.addEventListener('error', () => {
      if (!useCors || el !== this.activeAudioEl || !this.currentDisc) return;
      const failedUrl = this.loadedUrlMap.get(el) || this.currentDisc.audioUrl?.trim();
      if (!failedUrl || failedUrl.startsWith('blob:') || failedUrl.startsWith('data:')) return;
      if (this.nonCorsUrls.has(failedUrl)) return;

      this.nonCorsUrls.add(failedUrl);
      if (this.isPlaying && !this.inLeadIn) {
        const plain = this.configureAudioElement(this.currentDisc, false);
        if (plain && plain === this.plainAudio) {
          plain.muted = false;
          plain.play().catch(() => {});
        }
      }
    });

    el.addEventListener('timeupdate', () => {
      if (el === this.activeAudioEl) {
        this.emitStatus();
      }
    });

    el.addEventListener('loadedmetadata', () => {
      if (el === this.activeAudioEl) {
        this.emitStatus();
      }
    });

    return el;
  }

  private canAnalyseUrl(url: string): boolean {
    if (this.nonCorsUrls.has(url)) return false;
    try {
      if (url.startsWith('blob:') || url.startsWith('data:')) return true;
      const resolved = new URL(url, window.location.href);
      return resolved.protocol === 'https:' || resolved.protocol === 'http:';
    } catch {
      return false;
    }
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.5;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume * 0.42;

      this.realAudioGain = this.ctx.createGain();
      this.realAudioGain.gain.value = this.volume;

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

      const synthBus = this.ctx.createGain();
      synthBus.gain.value = 1.0;

      dryGain.connect(synthBus);
      wetGain.connect(synthBus);

      synthBus.connect(this.masterGain);
      synthBus.connect(this.analyser);

      const silentSink = this.ctx.createGain();
      silentSink.gain.value = 0;

      this.masterGain.connect(this.ctx.destination);
      this.realAudioGain.connect(this.ctx.destination);
      this.analyser.connect(silentSink);
      silentSink.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private ensureMediaSource(): boolean {
    if (this.mediaSource) return true;
    const ctx = this.ensureContext();
    if (!this.realAudioGain || !this.analyser) return false;
    try {
      this.mediaSource = ctx.createMediaElementSource(this.analyzedAudio);
      this.mediaSource.connect(this.realAudioGain);
      this.mediaSource.connect(this.analyser);
      this.analyzedAudio.volume = 1;
      return true;
    } catch {
      return false;
    }
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

    // Warm low-end cartridge thump when stylus lands on vinyl
    const thumpOsc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thumpOsc.type = 'sine';
    thumpOsc.frequency.setValueAtTime(128, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(34, now + 0.18);

    thumpGain.gain.setValueAtTime(0.001, now);
    thumpGain.gain.linearRampToValueAtTime(0.42, now + 0.014);
    thumpGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.22);

    thumpOsc.connect(thumpGain);
    thumpGain.connect(this.masterGain);
    thumpOsc.start(now);
    thumpOsc.stop(now + 0.24);

    // Distinct stylus touchdown & lead-in groove rustle
    const clickBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.065), ctx.sampleRate);
    const data = clickBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.011));
    }
    const clickSrc = ctx.createBufferSource();
    clickSrc.buffer = clickBuf;
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.value = 2100;
    clickFilter.Q.value = 0.85;
    const clickGain = ctx.createGain();
    clickGain.gain.value = 0.24;

    clickSrc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(this.masterGain);
    clickSrc.start(now + 0.012);

    // Subtle secondary micro-settle tick in the lead-in groove
    const settleBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.025), ctx.sampleRate);
    const settleData = settleBuf.getChannelData(0);
    for (let i = 0; i < settleData.length; i++) {
      settleData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
    }
    const settleSrc = ctx.createBufferSource();
    settleSrc.buffer = settleBuf;
    const settleGain = ctx.createGain();
    settleGain.gain.value = 0.42;
    settleSrc.connect(settleGain);
    settleGain.connect(clickFilter);
    settleSrc.start(now + 0.075);
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
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  private startCrackle(leadInBoost = false): void {
    const ctx = this.ensureContext();
    if (!this.masterGain || this.crackleSource) return;

    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    let popDecay = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Warm vinyl groove rumble + subtle surface hiss
      lastOut = (lastOut + 0.045 * white) / 1.045;
      if (Math.random() > 0.9974) {
        popDecay = (Math.random() * 2 - 1) * 0.44;
      } else {
        popDecay *= 0.86;
      }
      const microTick = Math.random() > 0.991 ? (Math.random() * 0.15 - 0.075) : 0;
      data[i] = lastOut * 0.14 + white * 0.015 + popDecay + microTick;
    }

    this.crackleSource = ctx.createBufferSource();
    this.crackleSource.buffer = buffer;
    this.crackleSource.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 95;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5800;

    this.crackleGain = ctx.createGain();
    const initialGain = leadInBoost
      ? this.crackleEnabled
        ? 0.44
        : 0.16
      : this.crackleEnabled
        ? 0.24
        : 0;
    this.crackleGain.gain.setValueAtTime(initialGain, ctx.currentTime);

    this.crackleSource.connect(hp);
    hp.connect(lp);
    lp.connect(this.crackleGain);
    this.crackleGain.connect(this.masterGain);
    this.crackleSource.start();
  }

  private clearLeadIn(): void {
    this.leadInToken++;
    this.inLeadIn = false;
    if (this.leadInTimer !== null) {
      window.clearTimeout(this.leadInTimer);
      this.leadInTimer = null;
    }
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

  private configureAudioElement(disc: VinylDisc, resetToStart: boolean): HTMLAudioElement | null {
    const audioUrl = disc.audioUrl?.trim();
    if (!audioUrl) {
      this.analyzedAudio.pause();
      this.plainAudio.pause();
      return null;
    }

    const useAnalyzed = this.canAnalyseUrl(audioUrl) && this.ensureMediaSource();
    const targetEl = useAnalyzed ? this.analyzedAudio : this.plainAudio;
    const otherEl = useAnalyzed ? this.plainAudio : this.analyzedAudio;
    otherEl.pause();
    this.activeAudioEl = targetEl;

    const urlChanged = this.loadedUrlMap.get(targetEl) !== audioUrl;
    if (urlChanged) {
      this.loadedUrlMap.set(targetEl, audioUrl);
      targetEl.src = audioUrl;
    } else if (resetToStart && targetEl.readyState >= 1) {
      targetEl.currentTime = 0;
    }

    targetEl.volume = targetEl === this.plainAudio ? this.volume : 1;
    targetEl.playbackRate = this.rpm === 45 ? 1.18 : 1.0;
    return targetEl;
  }

  public prepareCuePlay(disc: VinylDisc, resetToStart = false): void {
    const wasPlaying = this.isPlaying;
    this.clearLeadIn();
    this.currentDisc = disc;
    this.isPlaying = false;
    this.waitingForCue = true;
    this.fallbackActive = false;

    this.ensureContext();
    this.stopSynth();
    this.stopCrackle();
    this.analyzedAudio.pause();
    this.plainAudio.pause();

    if (wasPlaying && resetToStart) {
      this.playNeedleLift();
    }

    const targetEl = this.configureAudioElement(disc, resetToStart);
    if (targetEl && !this.unlockedEls.has(targetEl)) {
      const savedTime = resetToStart ? 0 : targetEl.currentTime;
      targetEl.muted = true;
      targetEl
        .play()
        .then(() => {
          this.unlockedEls.add(targetEl);
          if (this.waitingForCue || this.inLeadIn) {
            targetEl.pause();
            targetEl.muted = false;
            if (resetToStart) {
              targetEl.currentTime = 0;
            } else if (Math.abs(targetEl.currentTime - savedTime) > 0.15) {
              targetEl.currentTime = savedTime;
            }
          } else {
            targetEl.muted = false;
          }
        })
        .catch(() => {
          targetEl.muted = false;
        });
    }

    this.emitStatus();
  }

  public commitCuePlayback(withNeedleSound = true): void {
    if (!this.waitingForCue || !this.currentDisc) return;
    this.waitingForCue = false;
    this.clearLeadIn();

    const disc = this.currentDisc;
    const token = ++this.leadInToken;
    this.isPlaying = true;
    this.inLeadIn = true;
    this.fallbackActive = false;

    const ctx = this.ensureContext();
    if (withNeedleSound) {
      this.playNeedleDrop();
    }
    this.startCrackle(true);

    // Solo vinyl lead-in groove crackle for ~1.25s before music enters
    this.leadInTimer = window.setTimeout(() => {
      if (!this.isPlaying || token !== this.leadInToken) return;
      this.inLeadIn = false;
      this.leadInTimer = null;

      if (this.crackleGain) {
        this.crackleGain.gain.setTargetAtTime(
          this.crackleEnabled ? 0.24 : 0,
          ctx.currentTime,
          0.22
        );
      }

      this.beginTrackAudio(disc);
    }, 1250);
  }

  public pauseForCue(withNeedleSound = true): void {
    const wasPlaying = this.isPlaying;
    this.clearLeadIn();
    if (wasPlaying && withNeedleSound) {
      this.playNeedleLift();
    }
    this.isPlaying = false;
    this.waitingForCue = true;
    this.analyzedAudio.pause();
    this.plainAudio.pause();
    this.stopSynth();
    this.stopCrackle();
    this.emitStatus();
  }

  public playDisc(disc: VinylDisc, withNeedleSound = true): void {
    this.clearLeadIn();
    this.currentDisc = disc;
    this.waitingForCue = false;
    this.startCurrentDiscNow(disc, withNeedleSound);
  }

  private startCurrentDiscNow(disc: VinylDisc, withNeedleSound: boolean): void {
    this.currentDisc = disc;
    this.isPlaying = true;
    this.fallbackActive = false;

    this.ensureContext();
    if (withNeedleSound) {
      this.playNeedleDrop();
    }
    this.startCrackle(false);
    this.beginTrackAudio(disc);
  }

  private beginTrackAudio(disc: VinylDisc): void {
    const targetEl = this.configureAudioElement(disc, false);
    if (targetEl) {
      this.stopSynth();
      targetEl.muted = false;
      targetEl
        .play()
        .then(() => {
          if (!this.isPlaying || this.inLeadIn) {
            targetEl.pause();
            return;
          }
          this.unlockedEls.add(targetEl);
          this.fallbackActive = false;
          this.emitStatus();
        })
        .catch(() => {
          if (!this.isPlaying || this.inLeadIn) return;
          const audioUrl = disc.audioUrl?.trim();
          if (targetEl === this.analyzedAudio && audioUrl && !this.nonCorsUrls.has(audioUrl)) {
            this.nonCorsUrls.add(audioUrl);
            const plain = this.configureAudioElement(disc, false);
            if (plain && plain === this.plainAudio) {
              plain.muted = false;
              plain
                .play()
                .then(() => {
                  if (!this.isPlaying || this.inLeadIn) {
                    plain.pause();
                    return;
                  }
                  this.unlockedEls.add(plain);
                  this.fallbackActive = false;
                  this.emitStatus();
                })
                .catch(() => {
                  if (!this.isPlaying || this.inLeadIn) return;
                  this.fallbackActive = true;
                  this.startSynth(disc.synthPreset ?? 0);
                  this.emitStatus();
                });
              return;
            }
          }
          this.fallbackActive = true;
          this.startSynth(disc.synthPreset ?? 0);
          this.emitStatus();
        });
    } else {
      this.startSynth(disc.synthPreset ?? 0);
      this.emitStatus();
    }
  }

  public pause(withNeedleSound = true): void {
    const wasPlaying = this.isPlaying;
    this.clearLeadIn();
    if (wasPlaying && withNeedleSound) {
      this.playNeedleLift();
    }
    this.waitingForCue = false;
    this.isPlaying = false;
    this.analyzedAudio.pause();
    this.plainAudio.pause();
    this.stopSynth();
    this.stopCrackle();
    this.emitStatus();
  }

  public setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.plainAudio.volume = this.volume;
    if (this.ctx) {
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(this.volume * 0.42, this.ctx.currentTime, 0.04);
      }
      if (this.realAudioGain) {
        this.realAudioGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.04);
      }
    }
  }

  public setCrackleEnabled(enabled: boolean): void {
    this.crackleEnabled = enabled;
    if (this.crackleGain && this.ctx && !this.inLeadIn) {
      this.crackleGain.gain.setTargetAtTime(enabled ? 0.24 : 0, this.ctx.currentTime, 0.05);
    }
  }

  public setRpm(rpm: RpmMode): void {
    this.rpm = rpm;
    const rate = rpm === 45 ? 1.18 : 1.0;
    this.analyzedAudio.playbackRate = rate;
    this.plainAudio.playbackRate = rate;
    if (this.isPlaying && !this.inLeadIn && this.currentDisc) {
      if (!this.currentDisc.audioUrl?.trim() || this.fallbackActive) {
        this.startSynth(this.currentDisc.synthPreset ?? 0);
      }
    }
  }

  public seekTo(seconds: number): void {
    if (Number.isFinite(seconds) && this.activeAudioEl.duration > 0) {
      this.activeAudioEl.currentTime = Math.max(
        0,
        Math.min(this.activeAudioEl.duration, seconds)
      );
      this.emitStatus();
    }
  }

  public sampleReactiveLevels(): AudioReactiveLevels {
    if (!this.isPlaying || this.inLeadIn) {
      this.wasReactiveActive = false;
      this.fastAvgBass *= 0.9;
      this.slowAvgEnergy = this.slowAvgEnergy * 0.96 + 0.16 * 0.04;
      this.prevBass = 0;
      this.prevMid = 0;
      this.prevHigh = 0;
      this.smoothBass *= 0.84;
      this.smoothMid *= 0.84;
      this.smoothHigh *= 0.84;
      this.beatPulse *= 0.78;
      this.beatCooldown = 0;
      this.reactiveLevels.bass = this.smoothBass;
      this.reactiveLevels.mid = this.smoothMid;
      this.reactiveLevels.high = this.smoothHigh;
      this.reactiveLevels.pulse = this.beatPulse;
      this.reactiveLevels.active = false;
      return this.reactiveLevels;
    }

    let rawKick = 0;
    let rawBass = 0;
    let rawMid = 0;
    let rawHigh = 0;

    if (this.analyser && this.freqData) {
      this.analyser.getByteFrequencyData(this.freqData);
      const data = this.freqData;

      // 44.1-48kHz / 1024 ≈ 43-47 Hz per bin
      let sum = 0;
      for (let i = 1; i <= 3; i++) sum += data[i];
      rawKick = sum / (3 * 255);

      sum = 0;
      for (let i = 1; i <= 6; i++) sum += data[i];
      rawBass = sum / (6 * 255);

      sum = 0;
      for (let i = 7; i <= 42; i++) sum += data[i];
      rawMid = sum / (36 * 255);

      sum = 0;
      for (let i = 43; i <= 140; i++) sum += data[i];
      rawHigh = sum / (98 * 255);
    }

    // Fallback rhythmic pulse ONLY if the external host strictly blocks CORS
    const usingPlainExternal =
      Boolean(this.currentDisc?.audioUrl?.trim()) &&
      !this.fallbackActive &&
      this.activeAudioEl === this.plainAudio;

    if (usingPlainExternal && rawBass + rawMid + rawHigh < 0.015) {
      const t = this.plainAudio.currentTime || performance.now() * 0.001;
      const beatPhase = (t * 1.9) % 1;
      const kick = Math.pow(Math.max(0, 1 - beatPhase * 3.0), 2);
      const wave = 0.5 + 0.5 * Math.sin(t * 5.2);
      rawKick = 0.2 + kick * 0.72;
      rawBass = 0.22 + kick * 0.65;
      rawMid = 0.24 + wave * 0.42;
      rawHigh = 0.18 + Math.pow(Math.max(0, Math.sin(t * 11.4)), 2) * 0.48;
    }

    const nowMs = performance.now();
    const instantEnergy = rawBass * 0.45 + rawMid * 0.35 + rawHigh * 0.2;

    // On the first active frame of a track, seed baselines so there is no artificial transient spike
    if (!this.wasReactiveActive) {
      this.wasReactiveActive = true;
      this.reactiveStartMs = nowMs;
      this.prevBass = rawKick;
      this.prevMid = rawMid;
      this.prevHigh = rawHigh;
      this.fastAvgBass = rawKick;
      this.slowAvgEnergy = Math.max(0.16, instantEnergy);
    }

    // Gentle 650ms fade-in ramp at track start so sudden intros don't jolt the particles
    const startRamp = Math.min(1, (nowMs - this.reactiveStartMs) / 650);

    // Track overall song loudness without over-amplifying quiet silence/noise
    this.slowAvgEnergy = Math.max(0.1, this.slowAvgEnergy * 0.985 + instantEnergy * 0.015);
    const normFactor = Math.min(1.85, Math.max(0.75, 0.24 / this.slowAvgEnergy));
    const silenceGate = instantEnergy < 0.025 ? instantEnergy / 0.025 : 1;

    // Spectral flux transient detection (kicks, snares, and crisp hi-hats)
    this.fastAvgBass = this.fastAvgBass * 0.85 + rawKick * 0.15;
    const kickSurge = Math.max(0, rawKick - this.prevBass * 0.97) * 4.4;
    const bassAboveAvg = Math.max(0, rawKick - this.fastAvgBass * 1.05) * 4.8;
    const midSnap = Math.max(0, rawMid - this.prevMid) * 3.2;
    const highSnap = Math.max(0, rawHigh - this.prevHigh) * 2.8;

    this.prevBass = rawKick;
    this.prevMid = rawMid;
    this.prevHigh = rawHigh;

    const rawTransient = Math.min(
      1,
      (bassAboveAvg * 0.9 + kickSurge * 0.55 + midSnap * 0.42 + highSnap * 0.22) *
        normFactor *
        0.64 *
        silenceGate *
        startRamp
    );

    if (this.beatCooldown > 0) this.beatCooldown--;
    if (rawTransient > 0.24 && this.beatCooldown === 0 && rawTransient > this.beatPulse * 0.88) {
      const nextPeak = Math.min(1, 0.32 + rawTransient * 0.68);
      this.beatPulse = this.beatPulse * 0.5 + nextPeak * 0.5;
      this.beatCooldown = 8; // ~130ms spacing for crisp yet graceful beat swells
    } else {
      this.beatPulse = Math.max(this.beatPulse * 0.85, rawTransient * 0.44);
    }

    const targetBass = Math.min(1, rawBass * 1.22 * normFactor * startRamp);
    const targetMid = Math.min(1, rawMid * 1.38 * normFactor * startRamp);
    const targetHigh = Math.min(1, rawHigh * 1.65 * normFactor * startRamp);

    // Balanced musical envelope: clear swell on beats, smooth fade out
    this.smoothBass =
      targetBass > this.smoothBass
        ? this.smoothBass * 0.52 + targetBass * 0.48
        : this.smoothBass * 0.82 + targetBass * 0.18;
    this.smoothMid =
      targetMid > this.smoothMid
        ? this.smoothMid * 0.54 + targetMid * 0.46
        : this.smoothMid * 0.83 + targetMid * 0.17;
    this.smoothHigh =
      targetHigh > this.smoothHigh
        ? this.smoothHigh * 0.48 + targetHigh * 0.52
        : this.smoothHigh * 0.82 + targetHigh * 0.18;

    this.reactiveLevels.bass = this.smoothBass;
    this.reactiveLevels.mid = this.smoothMid;
    this.reactiveLevels.high = this.smoothHigh;
    this.reactiveLevels.pulse = this.beatPulse;
    this.reactiveLevels.active = true;
    return this.reactiveLevels;
  }

  private emitStatus(): void {
    if (!this.onStatusChange) return;
    const usingMp3 = Boolean(this.currentDisc?.audioUrl?.trim()) && !this.fallbackActive;
    const el = this.activeAudioEl;
    this.onStatusChange({
      sourceType: usingMp3 ? 'mp3' : 'synth',
      currentTime: usingMp3 ? el.currentTime || 0 : 0,
      duration: usingMp3 && Number.isFinite(el.duration) ? el.duration : 0,
      fallbackActive: this.fallbackActive,
    });
  }

  public dispose(): void {
    this.pause(false);
    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer);
    }
    this.analyzedAudio.src = '';
    this.plainAudio.src = '';
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
