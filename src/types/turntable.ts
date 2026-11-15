export type PlinthFinish = 'walnut' | 'ebony' | 'oak';

export type CameraPreset = 'overview' | 'needle' | 'label' | 'top';

export type RpmMode = 33 | 45;

export interface VinylDisc {
  id?: string;
  title: string;
  artist: string;
  date: string;
  vinylColor: string;
  labelColor: string;
  coverUrl: string;
  audioUrl: string;
  synthPreset: number;
  note: string;
}

export interface TurntableConfig {
  eyebrow: string;
  title: string;
  subtitle: string;
  signature: string;
  finish?: PlinthFinish;
  discs: VinylDisc[];
}

export interface AudioPlaybackStatus {
  sourceType: 'mp3' | 'synth';
  currentTime: number;
  duration: number;
  fallbackActive: boolean;
}
