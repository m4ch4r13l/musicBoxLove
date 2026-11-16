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

  const safeGift = sanitizeGiftId(params.giftId || 'borrador');
  const cleanName = params.file.name
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 80);
  const storagePath = `gifts/${params.ownerId}/${safeGift}/${Date.now()}-${cleanName}`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, params.file, {
      contentType: params.file.type || (params.kind === 'audio' ? 'audio/mpeg' : 'image/jpeg'),
    });

    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          params.onProgress?.(pct);
        }
      },
      (err) => {
        reject(err);
      },
      () => {
        getDownloadURL(task.snapshot.ref).then(resolve).catch(reject);
      }
    );
  });
}
