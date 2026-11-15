import { MailOpen, SlidersHorizontal, EyeOff } from 'lucide-react';

interface TopBarProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  showEditorButton: boolean;
  isPreviewingGift: boolean;
  onOpenNote: () => void;
  onOpenEditor: () => void;
  onExitPreview: () => void;
}

export function TopBar({
  eyebrow,
  title,
  subtitle,
  showEditorButton,
  isPreviewingGift,
  onOpenNote,
  onOpenEditor,
  onExitPreview,
}: TopBarProps) {
  return (
    <header className="fixed top-4 left-4 right-4 sm:top-6 sm:left-7 sm:right-7 z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-3 pointer-events-none">
      <div className="pointer-events-auto max-w-lg">
        <button
          type="button"
          onDoubleClick={onOpenEditor}
          title="Doble clic para abrir el modo creador"
          className="text-left text-[11px] font-semibold tracking-[0.18em] text-[#e89f65] hover:text-[#f2b07b] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e89f65] rounded"
        >
          {eyebrow}
        </button>
        <h1 className="font-display text-[26px] sm:text-[38px] font-semibold leading-[1.08] text-[#f7efe6] mt-0.5 [text-wrap:balance] drop-shadow-[0_4px_18px_rgba(0,0,0,0.65)]">
          {title}
        </h1>
        <p className="hidden sm:block text-[13px] text-[#b8a898] mt-1.5 leading-relaxed max-w-md">
          {subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2.5 pointer-events-auto shrink-0">
        {isPreviewingGift && (
          <button
            type="button"
            onClick={onExitPreview}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#e89f65] text-[#1c120c] hover:bg-[#f2b07b] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <EyeOff className="w-3.5 h-3.5" />
            Salir de vista previa
          </button>
        )}

        <button
          type="button"
          onClick={onOpenNote}
          className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] rounded-lg text-xs font-medium bg-[#16110e]/92 text-[#f7efe6] border border-[#ffe0bd]/15 hover:border-[#e89f65]/70 hover:bg-[#221a15] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e89f65]"
        >
          <MailOpen className="w-3.5 h-3.5 text-[#e89f65]" />
          Leer dedicatoria
        </button>

        {showEditorButton && (
          <button
            type="button"
            onClick={onOpenEditor}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] rounded-lg text-xs font-medium bg-[#16110e]/92 text-[#f7efe6] border border-[#ffe0bd]/15 hover:border-[#e89f65]/70 hover:bg-[#221a15] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e89f65]"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#e89f65]" />
            Personalizar
          </button>
        )}
      </div>
    </header>
  );
}
