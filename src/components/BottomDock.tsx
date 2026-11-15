import { useEffect, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Disc,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  AudioPlaybackStatus,
  CameraPreset,
  RpmMode,
  VinylDisc,
} from '../types/turntable';
import { sanitizeColor, sanitizeHttpUrl } from '../utils/configCodec';

interface BottomDockProps {
  discs: VinylDisc[];
  currentIndex: number;
  isPlaying: boolean;
  rpm: RpmMode;
  dustCoverOpen: boolean;
  crackleEnabled: boolean;
  volume: number;
  cameraPreset: CameraPreset;
  dockCollapsed: boolean;
  audioStatus: AudioPlaybackStatus;
  onToggleDock: () => void;
  onSelectDisc: (index: number) => void;
  onTogglePlay: () => void;
  onPrevDisc: () => void;
  onNextDisc: () => void;
  onToggleRpm: () => void;
  onToggleDustCover: () => void;
  onToggleCrackle: () => void;
  onChangeVolume: (val: number) => void;
  onSelectCameraPreset: (preset: CameraPreset) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSeek: (seconds: number) => void;
}

const CAMERA_OPTIONS: { id: CameraPreset; label: string }[] = [
  { id: 'overview', label: 'General' },
  { id: 'needle', label: 'Aguja' },
  { id: 'label', label: 'Etiqueta' },
  { id: 'top', label: 'Cenital' },
];

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function BottomDock({
  discs,
  currentIndex,
  isPlaying,
  rpm,
  dustCoverOpen,
  crackleEnabled,
  volume,
  cameraPreset,
  dockCollapsed,
  audioStatus,
  onToggleDock,
  onSelectDisc,
  onTogglePlay,
  onPrevDisc,
  onNextDisc,
  onToggleRpm,
  onToggleDustCover,
  onToggleCrackle,
  onChangeVolume,
  onSelectCameraPreset,
  onZoomIn,
  onZoomOut,
  onSeek,
}: BottomDockProps) {
  const currentDisc = discs[currentIndex] ?? discs[0];
  const labelColor = sanitizeColor(currentDisc?.labelColor, '#e89f65');
  const vinylColor = sanitizeColor(currentDisc?.vinylColor, '#141414');
  const safeCoverUrl = sanitizeHttpUrl(currentDisc?.coverUrl);
  const [miniImgError, setMiniImgError] = useState(false);

  useEffect(() => {
    setMiniImgError(false);
  }, [safeCoverUrl]);

  return (
    <div
      className={`fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-10 w-[min(94vw,760px)] flex flex-col items-center pointer-events-none transition-transform duration-300 ease-out ${
        dockCollapsed ? 'translate-y-[calc(100%-34px)]' : 'translate-y-0'
      }`}
    >
      {/* Collapsible Zen / Cinema Toggle */}
      <button
        type="button"
        onClick={onToggleDock}
        aria-expanded={!dockCollapsed}
        title="Ocultar o mostrar controles (Tecla H)"
        className="pointer-events-auto mb-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium bg-[#16110e]/92 text-[#b8a898] hover:text-[#f7efe6] border border-[#ffe0bd]/14 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e89f65]"
      >
        {dockCollapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 text-[#e89f65]" />
            Mostrar controles
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 text-[#e89f65]" />
            Ocultar controles
          </>
        )}
      </button>

      {/* Main Unified Console Container */}
      <div className="pointer-events-auto w-full bg-[#16110e]/94 border border-[#ffe0bd]/14 rounded-2xl p-3 sm:p-4 shadow-[0_20px_50px_rgba(0,0,0,0.65)] flex flex-col gap-3">
        {/* Top Row: Disc Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {discs.map((disc, idx) => {
            const active = idx === currentIndex;
            const dotColor = sanitizeColor(disc.labelColor, '#e89f65');
            return (
              <button
                key={disc.id ?? idx}
                type="button"
                onClick={() => onSelectDisc(idx)}
                className={`inline-flex items-center gap-2 px-3 py-2 min-h-[36px] rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e89f65] ${
                  active
                    ? 'bg-[#2e231c] text-[#f7efe6] border border-[#e89f65]/60'
                    : 'bg-[#1d1612] text-[#b8a898] border border-transparent hover:text-[#f7efe6] hover:bg-[#251c17]'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/40"
                  style={{ backgroundColor: dotColor }}
                />
                <span className="max-w-[165px] truncate">
                  {disc.title || `Disco #${idx + 1}`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Middle Row: Now Playing + Transport Controls */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`relative w-11 h-11 rounded-full border border-white/15 grid place-items-center shrink-0 overflow-hidden ${
                isPlaying
                  ? rpm === 45
                    ? 'animate-vinyl-spin-45'
                    : 'animate-vinyl-spin'
                  : ''
              }`}
              style={{
                background: `radial-gradient(circle, ${vinylColor} 45%, #0c0a09 100%)`,
              }}
            >
              {safeCoverUrl && !miniImgError ? (
                <>
                  <img
                    src={safeCoverUrl}
                    alt={currentDisc?.title || 'Portada del disco'}
                    referrerPolicy="no-referrer"
                    onError={() => setMiniImgError(true)}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <div className="absolute w-2 h-2 rounded-full bg-[#111] border border-white/30" />
                </>
              ) : (
                <div
                  className="w-4 h-4 rounded-full border-2 border-[#111]"
                  style={{ backgroundColor: labelColor }}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[#f7efe6] truncate">
                {currentDisc?.title || 'Sin título'}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#b8a898] truncate">
                <span className="truncate">{currentDisc?.artist || 'Artista'}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{currentDisc?.date || 'Edición Especial'}</span>
              </div>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onPrevDisc}
              aria-label="Disco anterior"
              title="Disco anterior"
              className="w-10 h-10 rounded-lg bg-[#221a15] border border-[#ffe0bd]/12 text-[#f7efe6] hover:border-[#e89f65]/70 grid place-items-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e89f65]"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pausar reproducción' : 'Iniciar reproducción'}
              title={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
              className="w-11 h-11 rounded-full bg-[#e89f65] hover:bg-[#f2b07b] text-[#1b110a] grid place-items-center transition-transform active:scale-95 cursor-pointer shadow-[0_0_20px_rgba(232,159,101,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onNextDisc}
              aria-label="Siguiente disco"
              title="Siguiente disco"
              className="w-10 h-10 rounded-lg bg-[#221a15] border border-[#ffe0bd]/12 text-[#f7efe6] hover:border-[#e89f65]/70 grid place-items-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e89f65]"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Optional MP3 Scrubber */}
        {audioStatus.sourceType === 'mp3' && audioStatus.duration > 0 && (
          <div className="flex items-center gap-2.5 text-[11px] text-[#b8a898] tabular-nums">
            <span>{formatTime(audioStatus.currentTime)}</span>
            <input
              type="range"
              min={0}
              max={audioStatus.duration}
              step={0.5}
              value={audioStatus.currentTime}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Progreso de la canción"
              className="flex-1 accent-[#e89f65] h-1 bg-[#2c221b] rounded-lg cursor-pointer"
            />
            <span>{formatTime(audioStatus.duration)}</span>
          </div>
        )}

        {/* Bottom Hardware & Camera Bar */}
        <div className="pt-2 border-t border-[#ffe0bd]/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          {/* Camera Angles & Zoom Controls (mobile + desktop) */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 w-full sm:w-auto">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <Camera className="w-3.5 h-3.5 text-[#b8a898] mr-0.5 shrink-0" />
              {CAMERA_OPTIONS.map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => onSelectCameraPreset(cam.id)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    cameraPreset === cam.id
                      ? 'bg-[#2e231c] text-[#e89f65]'
                      : 'text-[#b8a898] hover:text-[#f7efe6]'
                  }`}
                >
                  {cam.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-[#ffe0bd]/10">
              <button
                type="button"
                onClick={onZoomOut}
                aria-label="Alejar cámara"
                title="Alejar cámara"
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#221a15] border border-[#ffe0bd]/12 text-[#f7efe6] hover:border-[#e89f65]/60 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e89f65]"
              >
                <ZoomOut className="w-3.5 h-3.5 text-[#e89f65]" />
                <span className="sm:hidden">Alejar</span>
              </button>
              <button
                type="button"
                onClick={onZoomIn}
                aria-label="Acercar cámara"
                title="Acercar cámara"
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#221a15] border border-[#ffe0bd]/12 text-[#f7efe6] hover:border-[#e89f65]/60 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e89f65]"
              >
                <ZoomIn className="w-3.5 h-3.5 text-[#e89f65]" />
                <span className="sm:hidden">Acercar</span>
              </button>
            </div>
          </div>

          {/* Hardware & Audio Toggles */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleRpm}
                title="Cambiar velocidad de giro"
                className="px-2.5 py-1 rounded bg-[#221a15] border border-[#ffe0bd]/12 text-[#f7efe6] hover:border-[#e89f65]/60 font-medium tabular-nums whitespace-nowrap shrink-0 cursor-pointer"
              >
                {rpm} RPM
              </button>

              <button
                type="button"
                onClick={onToggleDustCover}
                title="Abrir o cerrar cubierta acrílica"
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  dustCoverOpen
                    ? 'bg-[#221a15] border-[#ffe0bd]/12 text-[#b8a898] hover:text-[#f7efe6]'
                    : 'bg-[#2e231c] border-[#e89f65]/50 text-[#e89f65]'
                }`}
              >
                <Disc className="w-3 h-3" />
                {dustCoverOpen ? 'Tapa abierta' : 'Tapa cerrada'}
              </button>

              <button
                type="button"
                onClick={onToggleCrackle}
                title="Activar o desactivar sonido de aguja y vinilo"
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  crackleEnabled
                    ? 'bg-[#2e231c] border-[#e89f65]/50 text-[#e89f65]'
                    : 'bg-[#221a15] border-[#ffe0bd]/12 text-[#b8a898]'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                Vinilo
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-1.5 pl-1">
              <button
                type="button"
                onClick={() => onChangeVolume(volume > 0 ? 0 : 0.72)}
                aria-label={volume > 0 ? 'Silenciar' : 'Activar sonido'}
                className="text-[#b8a898] hover:text-[#f7efe6] cursor-pointer"
              >
                {volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={volume}
                onChange={(e) => onChangeVolume(Number(e.target.value))}
                aria-label="Volumen"
                className="w-16 sm:w-20 accent-[#e89f65] h-1 bg-[#2c221b] rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
