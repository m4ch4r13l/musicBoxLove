import type { PlinthFinish, TurntableConfig, VinylDisc } from '../types/turntable';

const DRAFT_STORAGE_KEY = 'nuestros_discos_draft_v1';

export const SYNTH_PRESETS = [
  { id: 0, name: 'Noche de Lluvia (Lo-Fi Rhodes)' },
  { id: 1, name: 'Atardecer en Vinilo (Acordes Cálidos)' },
  { id: 2, name: 'Caja de Música (Celesta)' },
  { id: 3, name: 'Vals de Medianoche (Piano Suave)' },
  { id: 4, name: 'Brisa de Verano (Armónicos)' },
] as const;

export const VINYL_COLOR_PRESETS = [
  { name: 'Negro Clásico', hex: '#141414' },
  { name: 'Burdeos Vino', hex: '#5e1924' },
  { name: 'Azul Medianoche', hex: '#19384a' },
  { name: 'Ámbar Dorado', hex: '#8a551c' },
  { name: 'Verde Botella', hex: '#1b3b2b' },
  { name: 'Crema Vintage', hex: '#cfc4b2' },
] as const;

export const PLINTH_FINISHES: { id: PlinthFinish; label: string; swatch: string }[] = [
  { id: 'walnut', label: 'Nogal Clásico', swatch: '#59341d' },
  { id: 'ebony', label: 'Ébano Nocturno', swatch: '#221f1e' },
  { id: 'oak', label: 'Roble Miel', swatch: '#8a613a' },
];

export const DEFAULT_CONFIG: TurntableConfig = {
  eyebrow: 'Nuestra Banda Sonora · Vol. I',
  title: 'Canciones que me recuerdan a ti',
  subtitle: 'Elige un vinilo, baja la aguja y descubre lo que escribí detrás de cada funda.',
  signature: 'Siempre tuyo',
  finish: 'walnut',
  discs: [
    {
      id: 'disc-1',
      title: 'La primera vez que te vi',
      artist: 'Melodía Nocturna',
      date: 'El comienzo de todo',
      vinylColor: '#141414',
      labelColor: '#d97742',
      coverUrl: '',
      audioUrl: '',
      synthPreset: 0,
      note: 'Todavía recuerdo exactamente cómo iba el tiempo ese día. No sabía que una coincidencia tan simple se iba a convertir en mi lugar favorito del mundo.\n\nDale play y deja que gire un rato.',
    },
    {
      id: 'disc-2',
      title: 'Nuestros viajes sin prisa',
      artist: 'Acordes de Tarde',
      date: 'Kilómetros juntos',
      vinylColor: '#5e1924',
      labelColor: '#f0c987',
      coverUrl: '',
      audioUrl: '',
      synthPreset: 1,
      note: 'No importa si vamos lejos o solo a dar la vuelta por un café: contigo cualquier trayecto suena bien. Gracias por ser mi mejor compañía.',
    },
    {
      id: 'disc-3',
      title: 'Lo que aún nos falta vivir',
      artist: 'Caja de Música',
      date: 'Para el futuro',
      vinylColor: '#19384a',
      labelColor: '#9ad1d4',
      coverUrl: '',
      audioUrl: '',
      synthPreset: 2,
      note: 'Este disco todavía tiene espacio en blanco para todas las canciones, risas y aventuras que nos faltan por estrenar.\n\nTe quiero muchísimo.',
    },
  ],
};

export function sanitizeColor(colorStr: unknown, fallback = '#e89f65'): string {
  if (typeof colorStr === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(colorStr.trim())) {
    return colorStr.trim();
  }
  return fallback;
}

export function sanitizeHttpUrl(urlStr: unknown): string {
  if (typeof urlStr !== 'string') return '';
  const trimmed = urlStr.trim();
  if (/^https?:\/\//i.test(trimmed) || /^blob:/i.test(trimmed)) {
    return trimmed;
  }
  return '';
}

export function normalizeConfig(raw: Partial<TurntableConfig> | null | undefined): TurntableConfig {
  const base = structuredClone(DEFAULT_CONFIG);
  if (!raw || typeof raw !== 'object') return base;

  const discs: VinylDisc[] =
    Array.isArray(raw.discs) && raw.discs.length > 0
      ? raw.discs.map((d, idx) => ({
          id: typeof d?.id === 'string' && d.id ? d.id : `disc-${idx + 1}-${Date.now()}`,
          title: typeof d?.title === 'string' ? d.title : `Disco #${idx + 1}`,
          artist: typeof d?.artist === 'string' ? d.artist : 'Nuestra canción',
          date: typeof d?.date === 'string' ? d.date : 'Recuerdo especial',
          vinylColor: sanitizeColor(d?.vinylColor, '#141414'),
          labelColor: sanitizeColor(d?.labelColor, '#e89f65'),
          coverUrl: typeof d?.coverUrl === 'string' ? d.coverUrl : '',
          audioUrl: typeof d?.audioUrl === 'string' ? d.audioUrl : '',
          synthPreset:
            typeof d?.synthPreset === 'number' && Number.isFinite(d.synthPreset)
              ? Math.max(0, Math.floor(d.synthPreset))
              : idx % SYNTH_PRESETS.length,
          note: typeof d?.note === 'string' ? d.note : '',
        }))
      : base.discs;

  const finish: PlinthFinish =
    raw.finish === 'ebony' || raw.finish === 'oak' || raw.finish === 'walnut'
      ? raw.finish
      : 'walnut';

  return {
    eyebrow: typeof raw.eyebrow === 'string' ? raw.eyebrow : base.eyebrow,
    title: typeof raw.title === 'string' ? raw.title : base.title,
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : base.subtitle,
    signature: typeof raw.signature === 'string' ? raw.signature : base.signature,
    finish,
    discs,
  };
}

export function encodeConfigToBase64(obj: TurntableConfig): string {
  // Strip transient blob: URLs when generating shareable gift links
  const clean: TurntableConfig = {
    ...obj,
    discs: obj.discs.map((d) => ({
      ...d,
      audioUrl: d.audioUrl.startsWith('blob:') ? '' : d.audioUrl,
      coverUrl: d.coverUrl.startsWith('blob:') ? '' : d.coverUrl,
    })),
  };
  const json = JSON.stringify(clean);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeConfigFromBase64(base64Str: string): TurntableConfig {
  const binary = atob(base64Str);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(json) as Partial<TurntableConfig>;
  return normalizeConfig(parsed);
}

export function loadInitialAppState(): {
  config: TurntableConfig;
  isGiftMode: boolean;
} {
  const urlParams = new URLSearchParams(window.location.search);
  const encoded = urlParams.get('d');
  const forceEdit = urlParams.get('edit') === 'true';

  if (encoded) {
    try {
      const parsed = decodeConfigFromBase64(encoded);
      return {
        config: parsed,
        isGiftMode: !forceEdit,
      };
    } catch {
      // Fallback to draft or default if link is malformed
    }
  }

  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (saved) {
      return {
        config: normalizeConfig(JSON.parse(saved) as Partial<TurntableConfig>),
        isGiftMode: false,
      };
    }
  } catch {
    // Ignore storage errors
  }

  return {
    config: structuredClone(DEFAULT_CONFIG),
    isGiftMode: false,
  };
}

export function saveDraftConfig(config: TurntableConfig): void {
  try {
    const clean: TurntableConfig = {
      ...config,
      discs: config.discs.map((d) => ({
        ...d,
        audioUrl: d.audioUrl.startsWith('blob:') ? '' : d.audioUrl,
        coverUrl: d.coverUrl.startsWith('blob:') ? '' : d.coverUrl,
      })),
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearDraftConfig(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function buildFallbackSleeveSvg(vinylColor: string, labelColor: string): string {
  const vCol = sanitizeColor(vinylColor, '#1c1917');
  const lCol = sanitizeColor(labelColor, '#e89f65');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
    <defs>
      <radialGradient id="vg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${vCol}"/>
        <stop offset="70%" stop-color="${vCol}"/>
        <stop offset="100%" stop-color="#080706"/>
      </radialGradient>
    </defs>
    <rect width="240" height="240" rx="12" fill="#211914"/>
    <circle cx="120" cy="120" r="96" fill="url(#vg)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <circle cx="120" cy="120" r="78" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <circle cx="120" cy="120" r="62" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <circle cx="120" cy="120" r="38" fill="${lCol}"/>
    <circle cx="120" cy="120" r="32" fill="none" stroke="rgba(28,19,13,0.35)" stroke-width="1"/>
    <circle cx="120" cy="120" r="7" fill="#141414"/>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
