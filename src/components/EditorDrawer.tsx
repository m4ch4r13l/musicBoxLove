import { useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowDown,
  ArrowUp,
  Cloud,
  CloudUpload,
  Copy,
  Download,
  Eye,
  FolderOpen,
  Link2,
  LogIn,
  LogOut,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { CloudGiftRecord } from '../services/giftCloudService';
import type {
  PlinthFinish,
  SceneEnvironment,
  TurntableConfig,
  VinylDisc,
} from '../types/turntable';
import {
  PLINTH_FINISHES,
  SCENE_ENVIRONMENTS,
  SYNTH_PRESETS,
  VINYL_COLOR_PRESETS,
  sanitizeColor,
} from '../utils/configCodec';

interface EditorDrawerProps {
  open: boolean;
  config: TurntableConfig;
  currentDiscIndex: number;
  user: User | null;
  authReady: boolean;
  activeGiftId: string;
  clientLabel: string;
  isPublished: boolean;
  cloudGifts: CloudGiftRecord[];
  cloudSaving: boolean;
  uploadState: { discIndex: number; kind: 'audio' | 'cover'; progress: number } | null;
  onClose: () => void;
  onUpdateConfig: (next: TurntableConfig) => void;
  onSelectDisc: (index: number) => void;
  onCopyGiftLink: () => void;
  onPreviewAsRecipient: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onResetDefaults: () => void;
  onChangeGiftId: (val: string) => void;
  onChangeClientLabel: (val: string) => void;
  onTogglePublished: (val: boolean) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSaveCloudGift: () => void;
  onNewCloudGift: () => void;
  onLoadCloudGift: (record: CloudGiftRecord) => void;
  onCopyCloudGiftLink: (giftId: string) => void;
  onDeleteCloudGift: (giftId: string) => void;
  onUploadDiscMedia: (discIndex: number, kind: 'audio' | 'cover', file: File) => void;
}

export function EditorDrawer({
  open,
  config,
  currentDiscIndex,
  user,
  authReady,
  activeGiftId,
  clientLabel,
  isPublished,
  cloudGifts,
  cloudSaving,
  uploadState,
  onClose,
  onUpdateConfig,
  onSelectDisc,
  onCopyGiftLink,
  onPreviewAsRecipient,
  onExportJson,
  onImportJson,
  onResetDefaults,
  onChangeGiftId,
  onChangeClientLabel,
  onTogglePublished,
  onSignIn,
  onSignOut,
  onSaveCloudGift,
  onNewCloudGift,
  onLoadCloudGift,
  onCopyCloudGiftLink,
  onDeleteCloudGift,
  onUploadDiscMedia,
}: EditorDrawerProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'discs' | 'cloud'>('discs');
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  const updateField = <K extends keyof TurntableConfig>(
    key: K,
    value: TurntableConfig[K]
  ) => {
    onUpdateConfig({ ...config, [key]: value });
  };

  const updateDisc = <K extends keyof VinylDisc>(
    index: number,
    key: K,
    value: VinylDisc[K]
  ) => {
    const nextDiscs = config.discs.map((d, i) =>
      i === index ? { ...d, [key]: value } : d
    );
    onUpdateConfig({ ...config, discs: nextDiscs });
  };

  const addDisc = () => {
    if (config.discs.length >= 12) return;
    const idx = config.discs.length;
    const newDisc: VinylDisc = {
      id: `disc-${Date.now()}`,
      title: `Recuerdo #${idx + 1}`,
      artist: 'Nuestra canción',
      date: 'Fecha especial',
      vinylColor: VINYL_COLOR_PRESETS[idx % VINYL_COLOR_PRESETS.length].hex,
      labelColor: '#e89f65',
      coverUrl: '',
      audioUrl: '',
      synthPreset: idx % SYNTH_PRESETS.length,
      note: 'Escribe aquí tu dedicatoria...',
    };
    const nextDiscs = [...config.discs, newDisc];
    onUpdateConfig({ ...config, discs: nextDiscs });
    onSelectDisc(nextDiscs.length - 1);
  };

  const removeDisc = (index: number) => {
    if (config.discs.length <= 1) return;
    const nextDiscs = config.discs.filter((_, i) => i !== index);
    onUpdateConfig({ ...config, discs: nextDiscs });
    if (currentDiscIndex >= nextDiscs.length) {
      onSelectDisc(nextDiscs.length - 1);
    }
  };

  const moveDisc = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= config.discs.length) return;
    const nextDiscs = [...config.discs];
    const [item] = nextDiscs.splice(index, 1);
    nextDiscs.splice(target, 0, item);
    onUpdateConfig({ ...config, discs: nextDiscs });
    onSelectDisc(target);
  };

  const handleLocalAudioFile = (index: number, file: File | undefined) => {
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    updateDisc(index, 'audioUrl', blobUrl);
  };

  return (
    <aside
      aria-hidden={!open}
      className={`fixed top-0 right-0 bottom-0 z-40 w-[min(95vw,440px)] bg-[#16110e] border-l border-[#ffe0bd]/14 shadow-[-24px_0_60px_rgba(0,0,0,0.72)] flex flex-col transition-transform duration-300 ease-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Drawer Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[#ffe0bd]/10 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#f7efe6]">
            Personalizar Regalo
          </h2>
          <p className="text-xs text-[#b8a898] mt-0.5">
            Al compartir el enlace de regalo, este panel se oculta automáticamente.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel de personalización"
          className="w-9 h-9 rounded-lg bg-[#221a15] border border-[#ffe0bd]/12 text-[#f7efe6] hover:border-[#e89f65] grid place-items-center shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Segmented Tabs */}
      <div className="px-5 pt-3">
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#1e1713] rounded-lg border border-[#ffe0bd]/10">
          <button
            type="button"
            onClick={() => setActiveTab('discs')}
            className={`py-2 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'discs'
                ? 'bg-[#2e231c] text-[#f7efe6]'
                : 'text-[#b8a898] hover:text-[#f7efe6]'
            }`}
          >
            Vinilos ({config.discs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-2 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'general'
                ? 'bg-[#2e231c] text-[#f7efe6]'
                : 'text-[#b8a898] hover:text-[#f7efe6]'
            }`}
          >
            Escenario
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`py-2 text-[11px] font-medium rounded-md transition-colors cursor-pointer inline-flex items-center justify-center gap-1 ${
              activeTab === 'cloud'
                ? 'bg-[#2e231c] text-[#f7efe6]'
                : 'text-[#b8a898] hover:text-[#f7efe6]'
            }`}
          >
            <Cloud className="w-3 h-3 text-[#e89f65]" />
            <span>Nube ({cloudGifts.length})</span>
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto custom-scroll px-5 py-4 space-y-4">
        {activeTab === 'general' ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[#b8a898]">
                Etiqueta superior
              </label>
              <input
                type="text"
                maxLength={120}
                value={config.eyebrow}
                onChange={(e) => updateField('eyebrow', e.target.value)}
                className="bg-[#221a15] border border-[#ffe0bd]/12 rounded-lg px-3 py-2 text-sm text-[#f7efe6] focus:outline-none focus:border-[#e89f65] select-text"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[#b8a898]">
                Título principal del regalo
              </label>
              <input
                type="text"
                maxLength={160}
                value={config.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="bg-[#221a15] border border-[#ffe0bd]/12 rounded-lg px-3 py-2 text-sm text-[#f7efe6] focus:outline-none focus:border-[#e89f65] select-text"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[#b8a898]">
                Subtítulo o instrucción
              </label>
              <textarea
                rows={2}
                maxLength={300}
                value={config.subtitle}
                onChange={(e) => updateField('subtitle', e.target.value)}
                className="bg-[#221a15] border border-[#ffe0bd]/12 rounded-lg px-3 py-2 text-sm text-[#f7efe6] focus:outline-none focus:border-[#e89f65] select-text resize-y"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[#b8a898]">
                Tu firma al pie de las dedicatorias
              </label>
              <input
                type="text"
                maxLength={120}
                value={config.signature}
                onChange={(e) => updateField('signature', e.target.value)}
                className="bg-[#221a15] border border-[#ffe0bd]/12 rounded-lg px-3 py-2 text-sm text-[#f7efe6] focus:outline-none focus:border-[#e89f65] select-text"
              />
            </div>

            {/* 3D Scene Environment Selector */}
            <div className="flex flex-col gap-2 pt-2">
              <label className="text-[11px] font-medium text-[#b8a898]">
                Escenario 3D
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SCENE_ENVIRONMENTS.map((env) => {
                  const selected = (config.environment ?? 'valley') === env.id;
                  return (
                    <button
                      key={env.id}
                      type="button"
                      onClick={() =>
                        updateField('environment', env.id as SceneEnvironment)
                      }
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#2e231c] border-[#e89f65] text-[#f7efe6]'
                          : 'bg-[#221a15] border-[#ffe0bd]/10 text-[#b8a898] hover:text-[#f7efe6]'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full border border-white/25 shrink-0"
                        style={{ backgroundColor: env.swatch }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold truncate text-[#f7efe6]">
                          {env.label}
                        </span>
                        <span className="block text-[10px] text-[#b8a898] truncate">
                          {env.desc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Plinth Wood Finish */}
            <div className="flex flex-col gap-2 pt-2">
              <label className="text-[11px] font-medium text-[#b8a898]">
                Acabado de madera del tocadiscos
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PLINTH_FINISHES.map((f) => {
                  const selected = (config.finish ?? 'walnut') === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => updateField('finish', f.id as PlinthFinish)}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#2e231c] border-[#e89f65] text-[#f7efe6]'
                          : 'bg-[#221a15] border-[#ffe0bd]/10 text-[#b8a898] hover:text-[#f7efe6]'
                      }`}
                    >
                      <span
                        className="w-6 h-6 rounded-full border border-white/20"
                        style={{ backgroundColor: f.swatch }}
                      />
                      <span className="truncate w-full text-center text-[11px]">
                        {f.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Data Management */}
            <div className="pt-4 border-t border-[#ffe0bd]/10 space-y-2">
              <div className="text-[11px] font-medium text-[#b8a898]">
                Respaldo de configuración
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => jsonInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#221a15] border border-[#ffe0bd]/12 text-xs text-[#f7efe6] hover:border-[#e89f65]/60 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#e89f65]" />
                  Importar JSON
                </button>
                <button
                  type="button"
                  onClick={onExportJson}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#221a15] border border-[#ffe0bd]/12 text-xs text-[#f7efe6] hover:border-[#e89f65]/60 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#e89f65]" />
                  Exportar JSON
                </button>
              </div>
              <input
                ref={jsonInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportJson(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={onResetDefaults}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-transparent border border-[#ffe0bd]/10 text-xs text-[#b8a898] hover:text-[#f7efe6] hover:border-[#ffe0bd]/25 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar valores de ejemplo
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {config.discs.map((disc, idx) => {
              const isCurrent = idx === currentDiscIndex;
              return (
                <div
                  key={disc.id ?? idx}
                  className={`rounded-xl p-3.5 border transition-colors ${
                    isCurrent
                      ? 'bg-[#221a15] border-[#e89f65]/50'
                      : 'bg-[#1c1512] border-[#ffe0bd]/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => onSelectDisc(idx)}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-[#e89f65] hover:underline cursor-pointer"
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-white/25"
                        style={{ backgroundColor: sanitizeColor(disc.vinylColor, '#141414') }}
                      />
                      Vinilo #{idx + 1} {isCurrent ? '(En el plato)' : ''}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveDisc(idx, -1)}
                        disabled={idx === 0}
                        title="Subir"
                        className="p-1.5 rounded bg-[#2a211b] text-[#b8a898] hover:text-[#f7efe6] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDisc(idx, 1)}
                        disabled={idx === config.discs.length - 1}
                        title="Bajar"
                        className="p-1.5 rounded bg-[#2a211b] text-[#b8a898] hover:text-[#f7efe6] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      {config.discs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDisc(idx)}
                          title="Eliminar vinilo"
                          className="p-1.5 rounded bg-[#2a211b] text-[#b8a898] hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-[#b8a898]">
                        Título de la canción o recuerdo
                      </label>
                      <input
                        type="text"
                        maxLength={120}
                        value={disc.title}
                        onFocus={() => onSelectDisc(idx)}
                        onChange={(e) => updateDisc(idx, 'title', e.target.value)}
                        className="bg-[#16110e] border border-[#ffe0bd]/12 rounded-lg px-2.5 py-1.5 text-sm text-[#f7efe6] focus:outline-none focus:border-[#e89f65] select-text"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-[#b8a898]">Artista</label>
                        <input
                          type="text"
                          maxLength={120}
                          value={disc.artist}
                          onChange={(e) => updateDisc(idx, 'artist', e.target.value)}
                          className="bg-[#16110e] border border-[#ffe0bd]/12 rounded-lg px-2.5 py-1.5 text-xs text-[#f7efe6] focus:outline-none focus:border-[#e89f65] select-text"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-[#b8a898]">Fecha / Etiqueta</label>
                        <input
                          type="text"
                          maxLength={80}
                          value={disc.date}
                          onChange={(e) => updateDisc(idx, 'date', e.target.value)}
                          className="bg-[#16110e] border border-[#ffe0bd]/12 rounded-lg px-2.5 py-1.5 text-xs text-[#f7efe6] focus:outline-none focus:border-[#e89f65] select-text"
                        />
                      </div>
                    </div>

                    {/* Vinyl Color Presets + Custom Picker */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-[#b8a898]">Color del vinilo</label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {VINYL_COLOR_PRESETS.map((preset) => (
                            <button
                              key={preset.hex}
                              type="button"
                              title={preset.name}
                              onClick={() => updateDisc(idx, 'vinylColor', preset.hex)}
                              className={`w-5 h-5 rounded-full border cursor-pointer ${
                                disc.vinylColor.toLowerCase() === preset.hex.toLowerCase()
                                  ? 'border-[#e89f65] scale-110'
                                  : 'border-white/20'
                              }`}
                              style={{ backgroundColor: preset.hex }}
                            />
                          ))}
                          <input
                            type="color"
                            value={sanitizeColor(disc.vinylColor, '#141414')}
                            onChange={(e) => updateDisc(idx, 'vinylColor', e.target.value)}
                            aria-label="Color personalizado del vinilo"
                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] text-[#b8a898]">Color de etiqueta</label>
                        <input
                          type="color"
                          value={sanitizeColor(disc.labelColor, '#e89f65')}
                          onChange={(e) => updateDisc(idx, 'labelColor', e.target.value)}
                          className="w-full h-8 rounded-lg bg-[#16110e] border border-[#ffe0bd]/12 cursor-pointer p-0.5"
                        />
                      </div>
                    </div>

                    {/* Synth Preset */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-[#b8a898]">
                        Melodía sintetizada (si no hay MP3)
                      </label>
                      <select
                        value={disc.synthPreset}
                        onChange={(e) =>
                          updateDisc(idx, 'synthPreset', Number(e.target.value))
                        }
                        className="bg-[#16110e] border border-[#ffe0bd]/12 rounded-lg px-2.5 py-1.5 text-xs text-[#f7efe6] focus:outline-none focus:border-[#e89f65]"
                      >
                        {SYNTH_PRESETS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Audio MP3 URL + Firebase upload + Local test */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] text-[#b8a898]">
                          Audio MP3
                        </label>
                        <div className="flex items-center gap-2.5">
                          <label className="inline-flex items-center gap-1 text-[10px] text-[#e89f65] hover:underline cursor-pointer">
                            <CloudUpload className="w-3 h-3" />
                            <span>Subir MP3</span>
                            <input
                              type="file"
                              accept="audio/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  if (!user) {
                                    setActiveTab('cloud');
                                  }
                                  onUploadDiscMedia(idx, 'audio', file);
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>
                          <label className="text-[10px] text-[#b8a898] hover:text-[#f7efe6] hover:underline cursor-pointer">
                            Probar local
                            <input
                              type="file"
                              accept="audio/*"
                              className="hidden"
                              onChange={(e) =>
                                handleLocalAudioFile(idx, e.target.files?.[0])
                              }
                            />
                          </label>
                        </div>
                      </div>
                      <input
                        type="text"
                        maxLength={1024}
                        placeholder="https://.../cancion.mp3 o sube un archivo"
                        value={disc.audioUrl.startsWith('blob:') ? '' : disc.audioUrl}
                        onChange={(e) => updateDisc(idx, 'audioUrl', e.target.value)}
                        className="bg-[#16110e] border border-[#ffe0bd]/12 rounded-lg px-2.5 py-1.5 text-xs text-[#f7efe6] focus:outline-none focus:border-[#e89f65] select-text"
                      />
                      {uploadState?.discIndex === idx && uploadState.kind === 'audio' && (
                        <div className="space-y-1">
                          <div className="w-full h-1.5 rounded-full bg-[#2a211b] overflow-hidden">
                            <div
                              className="h-full bg-[#e89f65] transition-all"
                              style={{ width: `${uploadState.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[#e89f65]">
                            Subiendo audio a la nube... {uploadState.progress}%
                          </span>
                        </div>
                      )}
                      {disc.audioUrl.startsWith('blob:') && (
                        <span className="text-[10px] text-[#b8a898]">
                          Audio local solo para esta sesión. Usa “Subir MP3” o una URL pública para compartir.
                        </span>
                      )}
                    </div>

                    {/* Cover URL + Firebase upload */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] text-[#b8a898]">
                          Foto de portada (opcional)
                        </label>
                        <label className="inline-flex items-center gap-1 text-[10px] text-[#e89f65] hover:underline cursor-pointer">
                          <CloudUpload className="w-3 h-3" />
                          <span>Subir foto</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (!user) {
                                  setActiveTab('cloud');
                                }
                                onUploadDiscMedia(idx, 'cover', file);
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                      <input
                        type="text"
                        maxLength={1024}
                        placeholder="https://.../foto.jpg o sube una imagen"
                        value={disc.coverUrl}
                        onChange={(e) => updateDisc(idx, 'coverUrl', e.target.value)}
                        className="bg-[#16110e] border border-[#ffe0bd]/12 rounded-lg px-2.5 py-1.5 text-xs text-[#f7efe6] focus:outline-none focus:border-[#e89f65] select-text"
                      />
                      {uploadState?.discIndex === idx && uploadState.kind === 'cover' && (
                        <div className="space-y-1">
                          <div className="w-full h-1.5 rounded-full bg-[#2a211b] overflow-hidden">
                            <div
                              className="h-full bg-[#e89f65] transition-all"
                              style={{ width: `${uploadState.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[#e89f65]">
                            Subiendo portada a la nube... {uploadState.progress}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Note */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-[#b8a898]">
                        Dedicatoria escrita en la funda
                      </label>
                      <textarea
                        rows={3}
                        maxLength={2000}
                        value={disc.note}
                        onChange={(e) => updateDisc(idx, 'note', e.target.value)}
                        className="bg-[#16110e] border border-[#ffe0bd]/12 rounded-lg px-2.5 py-1.5 text-xs text-[#f7efe6] focus:outline-none focus:border-[#e89f65] select-text resize-y"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addDisc}
              disabled={config.discs.length >= 12}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#e89f65]/45 text-xs font-medium text-[#e89f65] hover:bg-[#e89f65]/10 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {config.discs.length >= 12 ? 'Límite de 12 vinilos alcanzado' : 'Añadir nuevo vinilo'}
            </button>
          </div>
        )}

        {activeTab === 'cloud' && (
          <div className="space-y-4">
            {!authReady ? (
              <div className="rounded-xl p-4 bg-[#1c1512] border border-[#ffe0bd]/10 text-xs text-[#b8a898]">
                Conectando con Firebase...
              </div>
            ) : !user ? (
              <div className="rounded-xl p-4 bg-[#1c1512] border border-[#ffe0bd]/12 space-y-3">
                <div className="flex items-start gap-2.5">
                  <Cloud className="w-5 h-5 text-[#e89f65] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#f7efe6]">
                      Guarda regalos y archivos de clientes en Firebase
                    </h3>
                    <p className="text-xs text-[#b8a898] mt-1 leading-relaxed">
                      Inicia sesión con Google para guardar cada tocadiscos por cliente, subir sus MP3/portadas sin tocar el repositorio y compartir enlaces cortos (<code className="text-[#e89f65]">?gift=...</code>).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#e89f65] hover:bg-[#f2b07b] text-[#1c120c] text-xs font-semibold transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  Iniciar sesión con Google
                </button>
              </div>
            ) : (
              <>
                {/* Signed-in user bar */}
                <div className="rounded-xl p-3 bg-[#1c1512] border border-[#ffe0bd]/12 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#f7efe6] truncate">
                      {user.displayName || 'Creador conectado'}
                    </div>
                    <div className="text-[11px] text-[#b8a898] truncate">
                      {user.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#221a15] border border-[#ffe0bd]/12 text-[11px] text-[#b8a898] hover:text-[#f7efe6] cursor-pointer shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Salir
                  </button>
                </div>

                {/* Save current gift to Firestore */}
                <div className="rounded-xl p-3.5 bg-[#221a15] border border-[#e89f65]/30 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#f7efe6]">
                      Regalo activo en Firebase
                    </span>
                    <button
                      type="button"
                      onClick={onNewCloudGift}
                      className="text-[11px] text-[#e89f65] hover:underline cursor-pointer"
                    >
                      + Nuevo cliente
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-[#b8a898]">
                      Nombre del cliente (referencia interna)
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      placeholder="Ej. Regalo para Ana y Luis"
                      value={clientLabel}
                      onChange={(e) => onChangeClientLabel(e.target.value)}
                      className="bg-[#16110e] border border-[#ffe0bd]/12 rounded-lg px-2.5 py-1.5 text-xs text-[#f7efe6] focus:outline-none focus:border-[#e89f65] select-text"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-[#b8a898]">
                      ID corto del enlace (?gift=...)
                    </label>
                    <input
                      type="text"
                      maxLength={64}
                      placeholder="Se genera automático o escribe ej. ana-y-luis"
                      value={activeGiftId}
                      onChange={(e) => onChangeGiftId(e.target.value)}
                      className="bg-[#16110e] border border-[#ffe0bd]/12 rounded-lg px-2.5 py-1.5 text-xs text-[#f7efe6] focus:outline-none focus:border-[#e89f65] select-text"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[#f7efe6] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={(e) => onTogglePublished(e.target.checked)}
                      className="accent-[#e89f65] w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Enlace público activo (el cliente puede abrirlo)</span>
                  </label>

                  <button
                    type="button"
                    onClick={onSaveCloudGift}
                    disabled={cloudSaving}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#e89f65] hover:bg-[#f2b07b] disabled:opacity-50 text-[#1c120c] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {cloudSaving ? 'Guardando en Firebase...' : 'Guardar en Firebase'}
                  </button>
                </div>

                {/* Saved Client Gifts List */}
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-[#b8a898]">
                    Clientes guardados ({cloudGifts.length})
                  </div>
                  {cloudGifts.length === 0 ? (
                    <p className="text-xs text-[#b8a898]/80 rounded-xl p-3 bg-[#1c1512] border border-[#ffe0bd]/10">
                      Aún no has guardado regalos en Firebase. Edita tus vinilos y pulsa “Guardar en Firebase”.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {cloudGifts.map((rec) => {
                        const isSelected = activeGiftId === rec.id;
                        return (
                          <div
                            key={rec.id}
                            className={`rounded-xl p-3 border transition-colors ${
                              isSelected
                                ? 'bg-[#281f19] border-[#e89f65]/60'
                                : 'bg-[#1c1512] border-[#ffe0bd]/10'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-[#f7efe6] truncate">
                                  {rec.clientLabel || rec.config.title}
                                </div>
                                <div className="text-[10px] text-[#b8a898] truncate mt-0.5">
                                  ?gift={rec.id} · {rec.config.discs.length} disco(s)
                                </div>
                              </div>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                                  rec.isPublished
                                    ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-[#2a211b] text-[#b8a898]'
                                }`}
                              >
                                {rec.isPublished ? 'Público' : 'Borrador'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-2.5">
                              <button
                                type="button"
                                onClick={() => onLoadCloudGift(rec)}
                                className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[#221a15] border border-[#ffe0bd]/12 text-[11px] text-[#f7efe6] hover:border-[#e89f65]/60 cursor-pointer"
                              >
                                <FolderOpen className="w-3 h-3 text-[#e89f65]" />
                                Abrir
                              </button>
                              <button
                                type="button"
                                onClick={() => onCopyCloudGiftLink(rec.id)}
                                className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[#221a15] border border-[#ffe0bd]/12 text-[11px] text-[#f7efe6] hover:border-[#e89f65]/60 cursor-pointer"
                              >
                                <Copy className="w-3 h-3 text-[#e89f65]" />
                                Link
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteCloudGift(rec.id)}
                                title="Eliminar regalo"
                                className="p-1.5 rounded-lg bg-[#221a15] border border-[#ffe0bd]/12 text-[#b8a898] hover:text-red-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-4 border-t border-[#ffe0bd]/10 bg-[#120e0b] flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPreviewAsRecipient}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#221a15] border border-[#ffe0bd]/12 text-xs font-medium text-[#f7efe6] hover:border-[#e89f65]/60 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[#e89f65]" />
            Vista previa regalo
          </button>

          <button
            type="button"
            onClick={onCopyGiftLink}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#e89f65] hover:bg-[#f2b07b] text-[#1c120c] text-xs font-semibold transition-colors cursor-pointer"
          >
            <Link2 className="w-3.5 h-3.5" />
            Copiar enlace regalo
          </button>
        </div>
      </div>
    </aside>
  );
}
