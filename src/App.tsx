import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { VinylAudioEngine } from './audio/vinylAudioEngine';
import { BottomDock } from './components/BottomDock';
import { DedicationModal } from './components/DedicationModal';
import { EditorDrawer } from './components/EditorDrawer';
import { TopBar } from './components/TopBar';
import { TurntableCanvas, type TurntableCanvasHandle } from './components/TurntableCanvas';
import { auth } from './firebase';
import {
  buildMergedMediaLibrary,
  deleteCloudGift,
  deleteMediaLibraryItem,
  findDuplicateMediaAsset,
  loadGiftById,
  sanitizeGiftId,
  saveCloudGift,
  saveMediaLibraryItem,
  signInWithGoogle,
  signOutUser,
  subscribeMyGifts,
  subscribeMyMediaLibrary,
  uploadClientMedia,
  type CloudGiftRecord,
  type CloudMediaAsset,
} from './services/giftCloudService';
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

  // Firebase Auth & Cloud Gift State
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeGiftId, setActiveGiftId] = useState<string>(initialState.cloudGiftId ?? '');
  const [clientLabel, setClientLabel] = useState<string>('');
  const [isPublished, setIsPublished] = useState<boolean>(true);
  const [cloudGifts, setCloudGifts] = useState<CloudGiftRecord[]>([]);
  const [libraryItems, setLibraryItems] = useState<CloudMediaAsset[]>([]);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudGiftLoading, setCloudGiftLoading] = useState<boolean>(() =>
    Boolean(initialState.cloudGiftId)
  );
  const [cloudGiftError, setCloudGiftError] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [uploadState, setUploadState] = useState<{
    discIndex: number;
    kind: 'audio' | 'cover';
    progress: number;
  } | null>(null);

  const mediaLibrary = useMemo(
    () => buildMergedMediaLibrary(libraryItems, cloudGifts),
    [libraryItems, cloudGifts]
  );

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
    if (!isGiftMode && !initialState.cloudGiftId) {
      saveDraftConfig(config);
    }
  }, [config, isGiftMode, initialState.cloudGiftId]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to creator's saved client gifts ONLY when authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setCloudGifts([]);
      return;
    }
    const unsubscribe = subscribeMyGifts(
      user.uid,
      (records) => setCloudGifts(records),
      (err) => {
        console.error(err);
        showToast('No se pudieron cargar tus clientes de Firebase');
      }
    );
    return () => unsubscribe();
  }, [authReady, user, showToast]);

  // Subscribe to creator's reusable media library ONLY when authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setLibraryItems([]);
      return;
    }
    const unsubscribe = subscribeMyMediaLibrary(
      user.uid,
      (items) => setLibraryItems(items),
      (err) => {
        console.error(err);
      }
    );
    return () => unsubscribe();
  }, [authReady, user]);

  // Load shared gift from Firestore if ?gift=<id> is in URL
  useEffect(() => {
    const giftId = initialState.cloudGiftId;
    if (!giftId) return;
    let cancelled = false;
    setCloudGiftLoading(true);
    setCloudGiftError(null);

    loadGiftById(giftId)
      .then((record) => {
        if (cancelled) return;
        if (record) {
          setConfig(record.config);
          setActiveGiftId(record.id);
          setClientLabel(record.clientLabel);
          setIsPublished(record.isPublished);
          setCurrentDiscIndex(0);
          setCloudGiftLoading(false);
        } else {
          setCloudGiftError('No se encontró este regalo o el enlace ya expiró.');
          setCloudGiftLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setCloudGiftError('Este regalo no está disponible o aún se encuentra en borrador.');
        setCloudGiftLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialState.cloudGiftId]);

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

  const copyTextToClipboard = useCallback(
    (url: string, successMsg: string) => {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard
          .writeText(url)
          .then(() => showToast(successMsg))
          .catch(() => showToast('No se pudo copiar automáticamente; copia la URL de la barra'));
      } else {
        showToast('No se pudo acceder al portapapeles');
      }
    },
    [showToast]
  );

  const handleCopyCloudGiftLink = useCallback(
    (giftId: string) => {
      const url = `${window.location.origin}${window.location.pathname}?gift=${encodeURIComponent(giftId)}`;
      copyTextToClipboard(url, `Enlace corto ?gift=${giftId} copiado`);
    },
    [copyTextToClipboard]
  );

  const handleCopyGiftLink = useCallback(() => {
    const savedInCloud = activeGiftId && cloudGifts.some((g) => g.id === activeGiftId);
    if (savedInCloud) {
      handleCopyCloudGiftLink(activeGiftId);
      return;
    }
    const encoded = encodeConfigToBase64(config);
    const url = `${window.location.origin}${window.location.pathname}?d=${encoded}`;
    copyTextToClipboard(url, 'Enlace de regalo copiado al portapapeles');
  }, [activeGiftId, cloudGifts, config, copyTextToClipboard, handleCopyCloudGiftLink]);

  const handleSignIn = useCallback(async () => {
    try {
      await signInWithGoogle();
      showToast('Sesión iniciada con Google');
    } catch (err) {
      console.error(err);
      showToast('No se pudo iniciar sesión con Google');
    }
  }, [showToast]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOutUser();
      showToast('Sesión cerrada');
    } catch {
      showToast('No se pudo cerrar sesión');
    }
  }, [showToast]);

  const handleSaveCloudGift = useCallback(async () => {
    if (!user) {
      showToast('Inicia sesión con Google para guardar en Firebase');
      return;
    }
    setCloudSaving(true);
    try {
      const targetId = activeGiftId.trim() || sanitizeGiftId(clientLabel || config.title);
      const savedId = await saveCloudGift({
        giftId: targetId,
        ownerId: user.uid,
        clientLabel: clientLabel || config.title,
        isPublished,
        config,
      });
      setActiveGiftId(savedId);
      showToast(`Cliente guardado en Firebase (?gift=${savedId})`);
    } catch (err) {
      console.error(err);
      showToast('No se pudo guardar en Firebase. Revisa tus permisos o datos.');
    } finally {
      setCloudSaving(false);
    }
  }, [user, activeGiftId, clientLabel, config, isPublished, showToast]);

  const handleNewCloudGift = useCallback(() => {
    setActiveGiftId('');
    setClientLabel('');
    setIsPublished(true);
    setConfig(structuredClone(DEFAULT_CONFIG));
    setCurrentDiscIndex(0);
    showToast('Nuevo borrador de cliente listo');
  }, [showToast]);

  const handleLoadCloudGift = useCallback(
    (record: CloudGiftRecord) => {
      setConfig(record.config);
      setActiveGiftId(record.id);
      setClientLabel(record.clientLabel);
      setIsPublished(record.isPublished);
      setCurrentDiscIndex(0);
      showToast(`Regalo “${record.clientLabel || record.config.title}” cargado`);
    },
    [showToast]
  );

  const handleDeleteCloudGift = useCallback(
    async (giftId: string) => {
      try {
        await deleteCloudGift(giftId);
        if (activeGiftId === giftId) {
          setActiveGiftId('');
        }
        showToast('Cliente eliminado de Firebase (tus archivos siguen en Cloudinary)');
      } catch (err) {
        console.error(err);
        showToast('No se pudo eliminar el regalo');
      }
    },
    [activeGiftId, showToast]
  );

  const handleDeleteMediaAsset = useCallback(
    async (mediaId: string) => {
      try {
        await deleteMediaLibraryItem(mediaId);
        showToast('Elemento quitado de tu biblioteca');
      } catch (err) {
        console.error(err);
        showToast('No se pudo quitar de la biblioteca');
      }
    },
    [showToast]
  );

  const handleUploadDiscMedia = useCallback(
    async (discIndex: number, kind: 'audio' | 'cover', file: File) => {
      if (!user) {
        showToast('Inicia sesión con Google en “Nube” para subir archivos');
        return;
      }

      const duplicate = findDuplicateMediaAsset(mediaLibrary, kind, file);
      if (duplicate) {
        setConfig((prev) => ({
          ...prev,
          discs: prev.discs.map((d, i) =>
            i === discIndex
              ? { ...d, [kind === 'audio' ? 'audioUrl' : 'coverUrl']: duplicate.url }
              : d
          ),
        }));
        showToast('Archivo ya subido anteriormente: reutilizado sin duplicar en Cloudinary');
        return;
      }

      const targetGift = activeGiftId.trim() || sanitizeGiftId(clientLabel || config.title);
      if (!activeGiftId.trim()) {
        setActiveGiftId(targetGift);
      }

      setUploadState({ discIndex, kind, progress: 0 });
      try {
        const downloadUrl = await uploadClientMedia({
          ownerId: user.uid,
          giftId: targetGift,
          file,
          kind,
          onProgress: (progress) => setUploadState({ discIndex, kind, progress }),
        });

        const currentTitle = config.discs[discIndex]?.title ?? '';
        const friendlyTitle =
          kind === 'audio' &&
          currentTitle &&
          !currentTitle.startsWith('Recuerdo #')
            ? currentTitle
            : file.name.replace(/\.[^.]+$/, '');

        saveMediaLibraryItem({
          ownerId: user.uid,
          kind,
          title: friendlyTitle,
          fileName: file.name,
          fileSize: file.size,
          url: downloadUrl,
        }).catch((err) => {
          console.error('No se pudo registrar en biblioteca:', err);
        });

        setConfig((prev) => ({
          ...prev,
          discs: prev.discs.map((d, i) =>
            i === discIndex
              ? { ...d, [kind === 'audio' ? 'audioUrl' : 'coverUrl']: downloadUrl }
              : d
          ),
        }));
        showToast(
          kind === 'audio'
            ? 'MP3 subido y guardado en tu biblioteca reutilizable'
            : 'Portada subida y guardada en tu biblioteca reutilizable'
        );
      } catch (err) {
        console.error(err);
        showToast(
          err instanceof Error && err.message
            ? err.message
            : 'No se pudo subir el archivo a la nube'
        );
      } finally {
        setUploadState(null);
      }
    },
    [user, mediaLibrary, activeGiftId, clientLabel, config.title, config.discs, showToast]
  );

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
    setActiveGiftId('');
    setClientLabel('');
    setConfig(structuredClone(DEFAULT_CONFIG));
    setCurrentDiscIndex(0);
    showToast('Se restauraron los discos de ejemplo');
  }, [showToast]);

  const showEditorButton = !isGiftMode && !isPreviewingGift;
  const playbackProgress =
    audioStatus.sourceType === 'mp3' && audioStatus.duration > 0
      ? audioStatus.currentTime / audioStatus.duration
      : -1;

  const canRenderTurntable = !cloudGiftLoading && !cloudGiftError;
  const showLoadingOverlay = cloudGiftLoading || (!cloudGiftError && !sceneReady);

  return (
    <main className="relative w-full h-full overflow-hidden select-none">
      {/* Full-viewport 3D Turntable (mounted only after cloud gift resolves so demo state never flashes) */}
      {canRenderTurntable && (
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
          onSceneReady={() => setSceneReady(true)}
        />
      )}

      {/* Unavailable Gift Screen */}
      {cloudGiftError && (
        <div
          role="alert"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center bg-[radial-gradient(circle_at_50%_40%,#241913_0%,#0d0908_100%)]"
        >
          <div className="w-16 h-16 rounded-full border border-[#e89f65]/30 bg-[#1a130f] grid place-items-center mb-5 shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
            <span className="w-4 h-4 rounded-full bg-[#e89f65]/70" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-[#f7efe6]">
            Regalo no disponible
          </h1>
          <p className="text-sm text-[#b8a898] mt-2 max-w-sm leading-relaxed">
            {cloudGiftError}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 rounded-lg bg-[#e89f65] hover:bg-[#f2b07b] text-[#1c120c] text-xs font-semibold transition-colors cursor-pointer"
          >
            Volver a intentar
          </button>
        </div>
      )}

      {/* Warm Vinyl Loading Overlay */}
      <div
        aria-hidden={!showLoadingOverlay}
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center bg-[radial-gradient(circle_at_50%_42%,#241913_0%,#0d0908_100%)] transition-opacity duration-500 ${
          showLoadingOverlay ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#e89f65]/15 blur-xl" />
          <div className="w-24 h-24 rounded-full border border-[#ffe0bd]/15 bg-[radial-gradient(circle,#1e1a18_0%,#0c0a09_64%,#1c1816_66%,#090807_100%)] shadow-[0_18px_48px_rgba(0,0,0,0.75)] flex items-center justify-center animate-vinyl-spin">
            <div className="w-8 h-8 rounded-full bg-[#e89f65] flex items-center justify-center border border-[#fff0dc]/40">
              <div className="w-2 h-2 rounded-full bg-[#120d0b]" />
            </div>
          </div>
        </div>
        <p className="font-display text-2xl sm:text-3xl font-semibold text-[#f7efe6] tracking-wide">
          {initialState.cloudGiftId ? 'Preparando tu regalo...' : 'Cargando tocadiscos...'}
        </p>
        <p className="text-xs text-[#b8a898] mt-1.5">
          Ajustando la aguja y preparando los vinilos
        </p>
      </div>

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
      {canRenderTurntable && (
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
      )}

      {/* Unified Collapsible Bottom Control Dock */}
      {canRenderTurntable && (
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
      )}

      {/* Tactile Paper Sleeve Dedication Modal */}
      {canRenderTurntable && (
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
      )}

      {/* Creator Customization Drawer */}
      {!cloudGiftLoading && !cloudGiftError && (
        <EditorDrawer
        open={editorOpen}
        config={config}
        currentDiscIndex={safeDiscIndex}
        user={user}
        authReady={authReady}
        activeGiftId={activeGiftId}
        clientLabel={clientLabel}
        isPublished={isPublished}
        cloudGifts={cloudGifts}
        mediaLibrary={mediaLibrary}
        cloudSaving={cloudSaving}
        uploadState={uploadState}
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
        onChangeGiftId={setActiveGiftId}
        onChangeClientLabel={setClientLabel}
        onTogglePublished={setIsPublished}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onSaveCloudGift={handleSaveCloudGift}
        onNewCloudGift={handleNewCloudGift}
        onLoadCloudGift={handleLoadCloudGift}
        onCopyCloudGiftLink={handleCopyCloudGiftLink}
        onDeleteCloudGift={handleDeleteCloudGift}
        onDeleteMediaAsset={handleDeleteMediaAsset}
        onUploadDiscMedia={handleUploadDiscMedia}
        />
      )}
    </main>
  );
}
