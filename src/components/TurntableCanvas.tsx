import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Disc3 } from 'lucide-react';
import type { AudioReactiveLevels } from '../audio/vinylAudioEngine';
import { TurntableScene } from '../three/TurntableScene';
import type {
  CameraPreset,
  PlinthFinish,
  RpmMode,
  SceneEnvironment,
  VinylDisc,
} from '../types/turntable';

export interface TurntableCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
}

interface TurntableCanvasProps {
  currentDisc: VinylDisc;
  isPlaying: boolean;
  rpm: RpmMode;
  finish: PlinthFinish;
  environment: SceneEnvironment;
  dustCoverOpen: boolean;
  cameraPreset: CameraPreset;
  presetRequestTick: number;
  playbackProgress: number;
  getAudioLevels?: () => AudioReactiveLevels;
  onTogglePlay: () => void;
  onToggleRpm: () => void;
}

export const TurntableCanvas = forwardRef<TurntableCanvasHandle, TurntableCanvasProps>(
  function TurntableCanvas(
    {
      currentDisc,
      isPlaying,
      rpm,
      finish,
      environment,
      dustCoverOpen,
      cameraPreset,
      presetRequestTick,
      playbackProgress,
      getAudioLevels,
      onTogglePlay,
      onToggleRpm,
    },
    ref
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<TurntableScene | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => sceneRef.current?.zoomBy(0.74),
        zoomOut: () => sceneRef.current?.zoomBy(1.36),
      }),
      []
    );

  const onTogglePlayRef = useRef(onTogglePlay);
  const onToggleRpmRef = useRef(onToggleRpm);
  const getAudioLevelsRef = useRef(getAudioLevels);
  onTogglePlayRef.current = onTogglePlay;
  onToggleRpmRef.current = onToggleRpm;
  getAudioLevelsRef.current = getAudioLevels;

  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    try {
      const controller = new TurntableScene(container, {
        onTogglePlay: () => onTogglePlayRef.current(),
        onToggleRpm: () => onToggleRpmRef.current(),
        getAudioLevels: () =>
          getAudioLevelsRef.current?.() ?? {
            bass: 0,
            mid: 0,
            high: 0,
            pulse: 0,
            active: false,
          },
        onContextLost: () => setWebglError(true),
        onContextRestored: () => setWebglError(false),
      });
      sceneRef.current = controller;
      return () => {
        controller.dispose();
        sceneRef.current = null;
      };
    } catch {
      setWebglError(true);
    }
  }, []);

  useEffect(() => {
    sceneRef.current?.setDisc(currentDisc, true);
  }, [currentDisc]);

  useEffect(() => {
    sceneRef.current?.setPlaying(isPlaying);
  }, [isPlaying]);

  useEffect(() => {
    sceneRef.current?.setRpm(rpm);
  }, [rpm]);

  useEffect(() => {
    sceneRef.current?.setFinish(finish);
  }, [finish]);

  useEffect(() => {
    sceneRef.current?.setEnvironment(environment);
  }, [environment]);

  useEffect(() => {
    sceneRef.current?.setDustCoverOpen(dustCoverOpen);
  }, [dustCoverOpen]);

  useEffect(() => {
    sceneRef.current?.setPlaybackProgress(playbackProgress);
  }, [playbackProgress]);

  useEffect(() => {
    if (presetRequestTick > 0) {
      sceneRef.current?.setCameraPreset(cameraPreset);
    }
  }, [cameraPreset, presetRequestTick]);

  return (
    <div className="fixed inset-0 z-0">
      <div
        ref={mountRef}
        className="w-full h-full"
        aria-label="Escena 3D interactiva del tocadiscos"
      />
      {webglError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#120d0b] px-6 text-center">
          <div className="w-20 h-20 rounded-full border border-[#e89f65]/30 flex items-center justify-center mb-4">
            <Disc3
              className={`w-10 h-10 text-[#e89f65] ${isPlaying ? 'animate-vinyl-spin' : ''}`}
            />
          </div>
          <p className="font-display text-2xl text-[#f7efe6]">
            {currentDisc.title}
          </p>
          <p className="text-sm text-[#b8a898] mt-1">
            La vista 3D no está disponible en este navegador, pero el reproductor de audio sigue activo.
          </p>
        </div>
      )}
    </div>
  );
});
