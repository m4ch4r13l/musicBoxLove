import { signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { OperationType, auth, db, googleProvider, handleFirestoreError, storage } from '../firebase';
import type { TurntableConfig, VinylDisc } from '../types/turntable';
import { normalizeConfig, sanitizeColor } from '../utils/configCodec';

export interface CloudGiftRecord {
  id: string;
  ownerId: string;
  clientLabel: string;
  isPublished: boolean;
  config: TurntableConfig;
  updatedAtMs: number;
}

export interface CloudMediaAsset {
  id: string;
  ownerId: string;
  kind: 'audio' | 'cover';
  title: string;
  fileName: string;
  fileSize: number;
  url: string;
  updatedAtMs: number;
  source: 'library' | 'gift';
  originLabel?: string;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export function sanitizeGiftId(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (cleaned && VALID_ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `regalo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function clampString(val: unknown, maxLen: number, fallback = ''): string {
  const s = typeof val === 'string' ? val.trim() : fallback;
  return s.slice(0, maxLen);
}

function sanitizeDiscForCloud(disc: VinylDisc, idx: number): VinylDisc {
  const rawId = clampString(disc.id || `disc-${idx + 1}`, 128, `disc-${idx + 1}`);
  const safeId = VALID_ID_REGEX.test(rawId)
    ? rawId
    : `disc-${idx + 1}-${Date.now().toString(36)}`;

  const cover = disc.coverUrl?.startsWith('blob:') ? '' : clampString(disc.coverUrl, 1024);
  const audio = disc.audioUrl?.startsWith('blob:') ? '' : clampString(disc.audioUrl, 1024);
  const synthPreset =
    typeof disc.synthPreset === 'number' && Number.isFinite(disc.synthPreset)
      ? Math.max(0, Math.min(10, Math.floor(disc.synthPreset)))
      : 0;

  return {
    id: safeId,
    title: clampString(disc.title, 120) || `Disco #${idx + 1}`,
    artist: clampString(disc.artist, 120),
    date: clampString(disc.date, 80),
    vinylColor: sanitizeColor(disc.vinylColor, '#141414').slice(0, 16),
    labelColor: sanitizeColor(disc.labelColor, '#e89f65').slice(0, 16),
    coverUrl: cover,
    audioUrl: audio,
    synthPreset,
    note: clampString(disc.note, 2000),
  };
}

function buildValidatedPayload(
  config: TurntableConfig,
  clientLabel: string,
  isPublished: boolean
) {
  const normalized = normalizeConfig(config);
  const safeDiscs = normalized.discs.slice(0, 12).map(sanitizeDiscForCloud);

  return {
    clientLabel: clampString(clientLabel || normalized.title, 120),
    eyebrow: clampString(normalized.eyebrow, 120),
    title: clampString(normalized.title, 160) || 'Nuestro Regalo',
    subtitle: clampString(normalized.subtitle, 300),
    signature: clampString(normalized.signature, 120),
    finish: normalized.finish ?? 'walnut',
    environment: normalized.environment ?? 'valley',
    discs: safeDiscs,
    isPublished: Boolean(isPublished),
  };
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function loadGiftById(giftId: string): Promise<CloudGiftRecord | null> {
  const safeId = giftId.trim();
  if (!safeId || !VALID_ID_REGEX.test(safeId) || safeId.length > 128) {
    return null;
  }

  const path = `gifts/${safeId}`;
  try {
    const snap = await getDoc(doc(db, 'gifts', safeId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      ownerId: String(data.ownerId ?? ''),
      clientLabel: String(data.clientLabel ?? data.title ?? ''),
      isPublished: Boolean(data.isPublished),
      config: normalizeConfig({
        eyebrow: data.eyebrow,
        title: data.title,
        subtitle: data.subtitle,
        signature: data.signature,
        finish: data.finish,
        environment: data.environment,
        discs: data.discs,
      }),
      updatedAtMs:
        data.updatedAt && typeof (data.updatedAt as Timestamp).toMillis === 'function'
          ? (data.updatedAt as Timestamp).toMillis()
          : 0,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeMyGifts(
  uid: string,
  onUpdate: (gifts: CloudGiftRecord[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const q = query(collection(db, 'gifts'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const records: CloudGiftRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        const updatedTs = data.updatedAt as Timestamp | undefined;
        return {
          id: d.id,
          ownerId: String(data.ownerId ?? uid),
          clientLabel: String(data.clientLabel ?? data.title ?? d.id),
          isPublished: Boolean(data.isPublished),
          config: normalizeConfig({
            eyebrow: data.eyebrow,
            title: data.title,
            subtitle: data.subtitle,
            signature: data.signature,
            finish: data.finish,
            environment: data.environment,
            discs: data.discs,
          }),
          updatedAtMs:
            updatedTs && typeof updatedTs.toMillis === 'function'
              ? updatedTs.toMillis()
              : 0,
        };
      });
      records.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onUpdate(records);
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'gifts');
      }
    }
  );
}

export async function saveCloudGift(params: {
  giftId: string;
  ownerId: string;
  clientLabel: string;
  isPublished: boolean;
  config: TurntableConfig;
}): Promise<string> {
  const safeId = sanitizeGiftId(params.giftId);
  const path = `gifts/${safeId}`;
  const docRef = doc(db, 'gifts', safeId);
  const payload = buildValidatedPayload(
    params.config,
    params.clientLabel,
    params.isPublished
  );

  let exists = false;
  try {
    const snap = await getDoc(docRef);
    exists = snap.exists();
  } catch {
    // If read denied because doc belongs to someone else or doesn't exist yet, attempt create
    exists = false;
  }

  if (exists) {
    try {
      await updateDoc(docRef, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      return safeId;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    try {
      await setDoc(docRef, {
        ownerId: params.ownerId,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return safeId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

export async function deleteCloudGift(giftId: string): Promise<void> {
  const safeId = giftId.trim();
  if (!safeId || !VALID_ID_REGEX.test(safeId)) return;
  const path = `gifts/${safeId}`;
  try {
    await deleteDoc(doc(db, 'gifts', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeMyMediaLibrary(
  uid: string,
  onUpdate: (items: CloudMediaAsset[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const q = query(collection(db, 'media_library'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: CloudMediaAsset[] = snapshot.docs.map((d) => {
        const data = d.data();
        const updatedTs = data.updatedAt as Timestamp | undefined;
        return {
          id: d.id,
          ownerId: String(data.ownerId ?? uid),
          kind: data.kind === 'cover' ? 'cover' : 'audio',
          title: String(data.title ?? data.fileName ?? 'Archivo'),
          fileName: String(data.fileName ?? ''),
          fileSize: typeof data.fileSize === 'number' ? data.fileSize : 0,
          url: String(data.url ?? ''),
          updatedAtMs:
            updatedTs && typeof updatedTs.toMillis === 'function'
              ? updatedTs.toMillis()
              : 0,
          source: 'library',
        };
      });
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onUpdate(items);
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'media_library');
      }
    }
  );
}

export async function saveMediaLibraryItem(params: {
  ownerId: string;
  kind: 'audio' | 'cover';
  title: string;
  fileName: string;
  fileSize: number;
  url: string;
}): Promise<string> {
  const safeUrl = clampString(params.url, 1024);
  if (!safeUrl) {
    throw new Error('URL vacía al guardar en biblioteca.');
  }

  const mediaId = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `media_library/${mediaId}`;
  const cleanTitle =
    clampString(params.title.replace(/\.[^.]+$/, ''), 140) ||
    clampString(params.fileName, 140) ||
    'Archivo';
  const cleanFileName = clampString(params.fileName, 160) || 'archivo';
  const safeSize = Math.max(0, Math.min(52428800, Math.floor(params.fileSize || 0)));

  try {
    await setDoc(doc(db, 'media_library', mediaId), {
      ownerId: params.ownerId,
      kind: params.kind,
      title: cleanTitle,
      fileName: cleanFileName,
      fileSize: safeSize,
      url: safeUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return mediaId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteMediaLibraryItem(mediaId: string): Promise<void> {
  const safeId = mediaId.trim();
  if (!safeId || !VALID_ID_REGEX.test(safeId)) return;
  const path = `media_library/${safeId}`;
  try {
    await deleteDoc(doc(db, 'media_library', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function buildMergedMediaLibrary(
  libraryItems: CloudMediaAsset[],
  cloudGifts: CloudGiftRecord[]
): CloudMediaAsset[] {
  const seenAudio = new Set<string>();
  const seenCover = new Set<string>();
  const merged: CloudMediaAsset[] = [];

  for (const item of libraryItems) {
    if (!item.url) continue;
    const seen = item.kind === 'cover' ? seenCover : seenAudio;
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    merged.push(item);
  }

  for (const gift of cloudGifts) {
    const giftName = gift.clientLabel || gift.config.title || gift.id;
    for (const disc of gift.config.discs) {
      if (disc.audioUrl && /^https?:\/\//i.test(disc.audioUrl) && !seenAudio.has(disc.audioUrl)) {
        seenAudio.add(disc.audioUrl);
        merged.push({
          id: `gift-audio-${gift.id}-${disc.id}`,
          ownerId: gift.ownerId,
          kind: 'audio',
          title: disc.title || 'Canción guardada',
          fileName: disc.artist ? `${disc.title} — ${disc.artist}` : disc.title,
          fileSize: 0,
          url: disc.audioUrl,
          updatedAtMs: gift.updatedAtMs,
          source: 'gift',
          originLabel: giftName,
        });
      }
      if (disc.coverUrl && /^https?:\/\//i.test(disc.coverUrl) && !seenCover.has(disc.coverUrl)) {
        seenCover.add(disc.coverUrl);
        merged.push({
          id: `gift-cover-${gift.id}-${disc.id}`,
          ownerId: gift.ownerId,
          kind: 'cover',
          title: disc.title ? `Portada: ${disc.title}` : 'Portada guardada',
          fileName: disc.title || 'portada',
          fileSize: 0,
          url: disc.coverUrl,
          updatedAtMs: gift.updatedAtMs,
          source: 'gift',
          originLabel: giftName,
        });
      }
    }
  }

  return merged;
}

export function findDuplicateMediaAsset(
  items: CloudMediaAsset[],
  kind: 'audio' | 'cover',
  file: File
): CloudMediaAsset | undefined {
  const targetName = file.name.trim().toLowerCase();
  return items.find(
    (item) =>
      item.kind === kind &&
      item.url &&
      item.fileSize > 0 &&
      item.fileSize === file.size &&
      item.fileName.trim().toLowerCase() === targetName
  );
}

const CLOUDINARY_CLOUD_NAME = (
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || ''
).trim();
const CLOUDINARY_UPLOAD_PRESET = (
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''
).trim();

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);
}

function uploadToCloudinary(params: {
  giftId: string;
  file: File;
  kind: 'audio' | 'cover';
  onProgress?: (percent: number) => void;
}): Promise<string> {
  const safeGift = sanitizeGiftId(params.giftId || 'borrador');
  const resourceType = params.kind === 'cover' ? 'image' : 'video';
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(
    CLOUDINARY_CLOUD_NAME
  )}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', `musicboxlove/${safeGift}`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const pct = Math.min(99, Math.round((event.loaded / event.total) * 100));
        params.onProgress?.(pct);
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}') as {
          secure_url?: string;
          error?: { message?: string };
        };
        if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
          params.onProgress?.(100);
          resolve(data.secure_url);
          return;
        }
        const rawErr = data.error?.message || `Error HTTP ${xhr.status}`;
        if (rawErr.toLowerCase().includes('preset')) {
          reject(
            new Error(
              'El Upload Preset de Cloudinary no existe o no está en modo Unsigned.'
            )
          );
          return;
        }
        reject(new Error(`Cloudinary: ${rawErr}`));
      } catch {
        reject(new Error('Respuesta inesperada de Cloudinary al subir el archivo.'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Error de red al conectar con Cloudinary.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Tiempo de espera agotado al subir a Cloudinary.'));
    };

    xhr.timeout = 120000;
    xhr.send(formData);
  });
}

export function uploadClientMedia(params: {
  ownerId: string;
  giftId: string;
  file: File;
  kind: 'audio' | 'cover';
  onProgress?: (percent: number) => void;
}): Promise<string> {
  const maxBytes = params.kind === 'audio' ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
  if (params.file.size > maxBytes) {
    return Promise.reject(
      new Error(
        params.kind === 'audio'
          ? 'El archivo de audio supera el límite de 25 MB.'
          : 'La imagen supera el límite de 10 MB.'
      )
    );
  }

  if (isCloudinaryConfigured()) {
    return uploadToCloudinary({
      giftId: params.giftId,
      file: params.file,
      kind: params.kind,
      onProgress: params.onProgress,
    });
  }

  const safeGift = sanitizeGiftId(params.giftId || 'borrador');
  const cleanName = params.file.name
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 80);
  const storagePath = `gifts/${params.ownerId}/${safeGift}/${Date.now()}-${cleanName}`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    let settled = false;
    let lastBytes = 0;

    const finishReject = (err: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(stallTimer);
      reject(err);
    };

    const task = uploadBytesResumable(storageRef, params.file, {
      contentType: params.file.type || (params.kind === 'audio' ? 'audio/mpeg' : 'image/jpeg'),
    });

    const stallTimer = window.setTimeout(() => {
      if (!settled && lastBytes === 0) {
        task.cancel();
        finishReject(
          new Error(
            'Falta configurar Cloudinary (VITE_CLOUDINARY_*) o activar Firebase Storage.'
          )
        );
      }
    }, 12000);

    task.on(
      'state_changed',
      (snapshot) => {
        lastBytes = snapshot.bytesTransferred;
        if (snapshot.bytesTransferred > 0) {
          window.clearTimeout(stallTimer);
        }
        if (snapshot.totalBytes > 0) {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          params.onProgress?.(pct);
        }
      },
      (err) => {
        const code = (err as { code?: string })?.code ?? '';
        if (code === 'storage/bucket-not-found' || code === 'storage/project-not-found') {
          finishReject(
            new Error(
              'El bucket de Firebase Storage no está activado en tu proyecto Firebase.'
            )
          );
          return;
        }
        if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
          finishReject(
            new Error(
              'Sin permisos en Firebase Storage. Revisa Storage → Rules en Firebase Console.'
            )
          );
          return;
        }
        if (code === 'storage/retry-limit-exceeded') {
          finishReject(
            new Error(
              'Firebase Storage no está disponible; configura Cloudinary o activa Storage.'
            )
          );
          return;
        }
        finishReject(err instanceof Error ? err : new Error('No se pudo subir el archivo.'));
      },
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(stallTimer);
        getDownloadURL(task.snapshot.ref).then(resolve).catch(reject);
      }
    );
  });
}
