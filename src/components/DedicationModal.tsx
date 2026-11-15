import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import type { VinylDisc } from '../types/turntable';
import { buildFallbackSleeveSvg, sanitizeHttpUrl } from '../utils/configCodec';

interface DedicationModalProps {
  open: boolean;
  disc: VinylDisc;
  discIndex: number;
  totalDiscs: number;
  signature: string;
  isPlaying: boolean;
  onClose: () => void;
  onPrevDisc: () => void;
  onNextDisc: () => void;
  onTogglePlay: () => void;
}

export function DedicationModal({
  open,
  disc,
  discIndex,
  totalDiscs,
  signature,
  isPlaying,
  onClose,
  onPrevDisc,
  onNextDisc,
  onTogglePlay,
}: DedicationModalProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const safeCoverUrl = sanitizeHttpUrl(disc.coverUrl);

  useEffect(() => {
    setImgFailed(false);
  }, [disc.coverUrl, discIndex]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const fallbackSvg = buildFallbackSleeveSvg(disc.vinylColor, disc.labelColor);
  const displaySrc = safeCoverUrl && !imgFailed ? safeCoverUrl : fallbackSvg;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sleeve-song-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-30 bg-[#080605]/80 grid place-items-center p-4 sm:p-6"
    >
      <div className="relative w-[min(92vw,500px)] bg-[#f6efe2] text-[#2b211a] rounded-xl p-6 sm:p-8 shadow-[0_28px_70px_rgba(0,0,0,0.75),inset_0_0_45px_rgba(168,134,96,0.2)] border border-[#5a422c]/25 -rotate-[0.6deg] transition-transform">
        {/* Close X */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar funda"
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full text-[#6e5846] hover:text-[#2b211a] hover:bg-[#2b211a]/8 grid place-items-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Sleeve Header */}
        <div className="flex items-center gap-4 border-b border-dashed border-[#2b211a]/25 pb-4 mb-4 pr-6">
          <img
            src={displaySrc}
            alt={`Portada de ${disc.title}`}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-20 h-20 rounded-lg object-cover bg-[#2c221b] shadow-md shrink-0"
          />

          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8c6239]">
              {disc.date || 'Recuerdo Especial'}
            </div>
            <h2
              id="sleeve-song-title"
              className="font-display text-2xl font-semibold leading-tight text-[#2b211a] mt-0.5 [text-wrap:balance]"
            >
              {disc.title}
            </h2>
            <div className="text-xs text-[#6e5846] mt-0.5 truncate">
              {disc.artist}
            </div>
          </div>
        </div>

        {/* Handwritten Dedication Message */}
        <div className="font-handwriting text-[23px] sm:text-[25px] leading-[1.42] text-[#2b211a] whitespace-pre-line max-h-[42vh] overflow-y-auto custom-scroll pr-1 select-text">
          {disc.note || 'Sin dedicatoria escrita todavía.'}
        </div>

        {/* Footer with signature & sleeve pagination */}
        <div className="mt-6 pt-3 border-t border-[#2b211a]/12 flex flex-wrap items-center justify-between gap-3">
          <span className="font-handwriting text-xl text-[#5a422c]">
            {signature}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              title={isPlaying ? 'Pausar disco' : 'Escuchar este disco'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#e89f65]/25 hover:bg-[#e89f65]/40 text-[#2b211a] text-xs font-medium transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3 h-3 fill-current" /> Pausar
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" /> Sonar
                </>
              )}
            </button>

            {totalDiscs > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onPrevDisc}
                  aria-label="Funda anterior"
                  className="w-8 h-8 rounded-full border border-[#2b211a]/20 hover:bg-[#2b211a]/10 grid place-items-center cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-[#6e5846] tabular-nums px-1">
                  {discIndex + 1}/{totalDiscs}
                </span>
                <button
                  type="button"
                  onClick={onNextDisc}
                  aria-label="Siguiente funda"
                  className="w-8 h-8 rounded-full border border-[#2b211a]/20 hover:bg-[#2b211a]/10 grid place-items-center cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-full bg-[#2b211a] text-[#f6efe2] hover:bg-[#3f3026] text-xs font-medium transition-colors cursor-pointer"
            >
              Guardar funda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
