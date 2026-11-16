import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VinylAudioEngine } from './audio/vinylAudioEngine';
import { BottomDock } from './components/BottomDock';
import { DedicationModal } from './components/DedicationModal';
import { EditorDrawer } from './components/EditorDrawer';
import { TopBar } from './components/TopBar';
import { TurntableCanvas, type TurntableCanvasHandle } from './components/TurntableCanvas';
import type {
  AudioPlaybackStatus,
  CameraPreset,
  RpmMode,
  TurntableConfig,
} from './types/turntable';
import {
  clearDraftConfig,
  DEFAULT_CONFIG,
  encodeConfigToBase64,
  loadInitialAppState,
  normalizeConfig,
  saveDraftConfig,
} from './utils/configCodec';

export default function App() {
  const initialState = useMemo(() => loadInitialAppState(), []);
  const [config, setConfig] = useState<TurntableConfig>(initialState.config);
  const [isGiftMode] = useState<boolean>(initialState.isGiftMode);
  const [isPreviewingGift, setIsPreviewingGift] = useState(false);

  const [currentDiscIndex, setCurrentDiscIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rpm, setRpm] = useState<RpmMode>(33);
  const [dustCoverOpen, setDustCoverOpen] = useState(true);
  const [crackleEnabled, setCrackleEnabled] = useState(true);
  const [volume, setVolume] = useState(0.72);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [presetRequestTick, setPresetRequestTick] = useState(0);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const [noteOpen, setNoteOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('edit') === 'true';
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [audioStatus, setAudioStatus] = useState<AudioPlaybackStatus>({
    sourceType: 'synth',
    currentTime: 0,
    duration: 0,
    fallbackActive: false,
  });

  const audioEngineRef = useRef<VinylAudioEngine | null>(null);
  const canvasRef = useRef<TurntableCanvasHandle | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  // Initialize audio engine once
  useEffect(() => {
    const engine = new VinylAudioEngine(
      (status) => {
        setAudioStatus(status);
      },
      () => {
        const cued = canvasRef.current?.triggerRestartCue() ?? false;
        if (!cued) {
          audioEngineRef.current?.commitCuePlayback(true);
        }
      }
    );
    audioEngineRef.current = engine;
    return () => {
      engine.dispose();
      audioEngineRef.current = null;
    };
  }, []);

  // Persist creator drafts locally (except when viewing someone else's gift link)
  useEffect(() => {
    if (!isGiftMode) {
      saveDraftConfig(config);
    }
  }, [config, isGiftMode]);

  const safeDiscIndex = Math.min(currentDiscIndex, Math.max(0, config.discs.length - 1));
  const currentDisc = config.discs[safeDiscIndex] ?? DEFAULT_CONFIG.discs[0];

  const handleTogglePlay = useCallback(() => {
    const next = !isPlaying;
    setIsPlaying(next);
    if (next) {
      audioEngineRef.current?.prepareCuePlay(currentDisc, false);
      if (!canvasRef.current?.isReady()) {
        audioEngineRef.current?.commitCuePlayback(true);
      }
    } else {
      audioEngineRef.current?.pause(true);
    }
  }, [isPlaying, currentDisc]);

  const handleSelectDisc = useCallback(
    (index: number) => {
      const total = config.discs.length;
      if (total === 0) return;
      const wrapped = ((index % total) + total) % total;
      setCurrentDiscIndex(wrapped);
      const nextDisc = config.discs[wrapped];
      if (isPlaying && nextDisc) {
        prevAudioKeyRef.current = `${nextDisc.id}|${nextDisc.audioUrl}|${nextDisc.synthPreset}`;
        audioEngineRef.current?.prepareCuePlay(nextDisc, true);
        const cued = canvasRef.current?.triggerRestartCue() ?? false;
        if (!cued) {
          audioEngineRef.current?.commitCuePlayback(true);
        }
      }
    },
    [config.discs, isPlaying]
  );

  const handlePrevDisc = useCallback(() => {
    handleSelectDisc(safeDiscIndex - 1);
  }, [handleSelectDisc, safeDiscIndex]);

  const handleNextDisc = useCallback(() => {
    handleSelectDisc(safeDiscIndex + 1);
  }, [handleSelectDisc, safeDiscIndex]);

  const handleToggleRpm = useCallback(() => {
    setRpm((prev) => {
      const next: RpmMode = prev === 33 ? 45 : 33;
      audioEngineRef.current?.setRpm(next);
      return next;
    });
  }, []);

  const handleToggleCrackle = useCallback(() => {
    setCrackleEnabled((prev) => {
      const next = !prev;
      audioEngineRef.current?.setCrackleEnabled(next);
      return next;
    });
  }, []);

  const handleChangeVolume = useCallback((val: number) => {
    setVolume(val);
    audioEngineRef.current?.setVolume(val);
  }, []);

  const handleSelectCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    setPresetRequestTick((n) => n + 1);
  }, []);

  // Refresh synth/audio if the active disc's audio settings change in the editor while playing
  const currentDiscAudioKey = `${currentDisc.id}|${currentDisc.audioUrl}|${currentDisc.synthPreset}`;
  const prevAudioKeyRef = useRef(currentDiscAudioKey);
  useEffect(() => {
    if (prevAudioKeyRef.current !== currentDiscAudioKey) {
      prevAudioKeyRef.current = currentDiscAudioKey;
      if (isPlaying) {
        audioEngineRef.current?.prepareCuePlay(currentDisc, true);
        const cued = canvasRef.current?.triggerRestartCue() ?? false;
        if (!cued) {
          audioEngineRef.current?.commitCuePlayback(true);
        }
      }
    }
  }, [currentDiscAudioKey, currentDisc, isPlaying]);

  // Global keyboard shortcuts (Space = Play/Pause, H = Hide/Show dock, ArrowLeft/Right = Prev/Next)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isTyping) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((c) => !c);
      } else if (e.key === 'ArrowLeft') {
        handlePrevDisc();
      } else if (e.key === 'ArrowRight') {
        handleNextDisc();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlay, handlePrevDisc, handleNextDisc]);

  const handleCopyGiftLink = useCallback(() => {
    const encoded = encodeConfigToBase64(config);
    const url = `${window.location.origin}${window.location.pathname}?d=${encoded}`;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard
        .writeText(url)
        .then(() => showToast('Enlace de regalo copiado al portapapeles'))
        .catch(() => showToast('No se pudo copiar automáticamente; copia la URL de la barra'));
    } else {
      showToast('No se pudo acceder al portapapeles');
    }
  }, [config, showToast]);

  const handleExportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nuestros-discos-tocadiscos.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Configuración exportada en JSON');
  }, [config, showToast]);

  const handleImportJson = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result ?? '{}')) as Partial<TurntableConfig>;
          const normalized = normalizeConfig(parsed);
          setConfig(normalized);
          setCurrentDiscIndex(0);
          showToast('Configuración importada correctamente');
        } catch {
          showToast('El archivo JSON no tiene un formato válido');
        }
      };
      reader.readAsText(file);
    },
    [showToast]
  );

  const handleResetDefaults = useCallback(() => {
    clearDraftConfig();
    setConfig(structuredClone(DEFAULT_CONFIG));
    setCurrentDiscIndex(0);
    showToast('Se restauraron los discos de ejemplo');
  }, [showToast]);

  const showEditorButton = !isGiftMode && !isPreviewingGift;
  const playbackProgress =
    audioStatus.sourceType === 'mp3' && audioStatus.duration > 0
      ? audioStatus.currentTime / audioStatus.duration
      : -1;

  return (
    <main className="relative w-full h-full overflow-hidden select-none">
      {/* Full-viewport 3D Turntable */}
      <TurntableCanvas
        ref={canvasRef}
        currentDisc={currentDisc}
        isPlaying={isPlaying}
        rpm={rpm}
        finish={config.finish ?? 'walnut'}
        environment={config.environment ?? 'valley'}
        dustCoverOpen={dustCoverOpen}
        cameraPreset={cameraPreset}
        presetRequestTick={presetRequestTick}
        playbackProgress={playbackProgress}
        getAudioLevels={() =>
          audioEngineRef.current?.sampleReactiveLevels() ?? {
            bass: 0,
            mid: 0,
            high: 0,
            pulse: 0,
            active: false,
          }
        }
        onTogglePlay={handleTogglePlay}
        onToggleRpm={handleToggleRpm}
        onCueReady={() => audioEngineRef.current?.commitCuePlayback(true)}
        onRestartLift={() => audioEngineRef.current?.pauseForCue(true)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-[#e89f65] text-[#1c120c] text-xs font-semibold shadow-lg pointer-events-none"
        >
          {toastMessage}
        </div>
      )}

      {/* Minimal Editorial Top Header */}
      <TopBar
        eyebrow={config.eyebrow}
        title={config.title}
        subtitle={config.subtitle}
        showEditorButton={showEditorButton}
        isPreviewingGift={isPreviewingGift}
        onOpenNote={() => setNoteOpen(true)}
        onOpenEditor={() => {
          setIsPreviewingGift(false);
          setEditorOpen(true);
        }}
        onExitPreview={() => {
          setIsPreviewingGift(false);
          setEditorOpen(true);
        }}
      />

      {/* Unified Collapsible Bottom Control Dock */}
      <BottomDock
        discs={config.discs}
        currentIndex={safeDiscIndex}
        isPlaying={isPlaying}
        rpm={rpm}
        dustCoverOpen={dustCoverOpen}
        crackleEnabled={crackleEnabled}
        volume={volume}
        cameraPreset={cameraPreset}
        dockCollapsed={dockCollapsed}
        audioStatus={audioStatus}
        onToggleDock={() => setDockCollapsed((c) => !c)}
        onSelectDisc={handleSelectDisc}
        onTogglePlay={handleTogglePlay}
        onPrevDisc={handlePrevDisc}
        onNextDisc={handleNextDisc}
        onToggleRpm={handleToggleRpm}
        onToggleDustCover={() => setDustCoverOpen((o) => !o)}
        onToggleCrackle={handleToggleCrackle}
        onChangeVolume={handleChangeVolume}
        onSelectCameraPreset={handleSelectCameraPreset}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onSeek={(sec) => audioEngineRef.current?.seekTo(sec)}
      />

      {/* Tactile Paper Sleeve Dedication Modal */}
      <DedicationModal
        open={noteOpen}
        disc={currentDisc}
        discIndex={safeDiscIndex}
        totalDiscs={config.discs.length}
        signature={config.signature}
        isPlaying={isPlaying}
        onClose={() => setNoteOpen(false)}
        onPrevDisc={handlePrevDisc}
        onNextDisc={handleNextDisc}
        onTogglePlay={handleTogglePlay}
      />

      {/* Creator Customization Drawer */}
      <EditorDrawer
        open={editorOpen}
        config={config}
        currentDiscIndex={safeDiscIndex}
        onClose={() => setEditorOpen(false)}
        onUpdateConfig={setConfig}
        onSelectDisc={handleSelectDisc}
        onCopyGiftLink={handleCopyGiftLink}
        onPreviewAsRecipient={() => {
          setEditorOpen(false);
          setIsPreviewingGift(true);
          showToast('Vista previa activa: así lo verá quien reciba el regalo');
        }}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onResetDefaults={handleResetDefaults}
      />
    </main>
  );
}
