/**
 * Catálogo compartido en Supabase.
 *
 * Solo tres cosas, y ninguna lleva datos del cuerpo:
 * - leer las prendas publicadas (revisadas);
 * - enviar una prenda para revisión (entra como «pendiente»);
 * - si el usuario lo marca, decir cómo le quedó una talla (anónimo).
 * Si no hay conexión o falla, la app sigue con el catálogo que lleva dentro.
 */
import { SUPABASE_KEY, SUPABASE_URL } from '../config';
import { ENGINE_VERSION } from '../core/ease';
import type { RawGarment } from '../core/garments';

const TIMEOUT_MS = 8000;

function headers(): Record<string, string> {
  // Las claves «publishable» van solo en apikey (no son un JWT de usuario).
  return { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...init.headers }, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export const remoteEnabled = () => SUPABASE_KEY.length > 0;

export interface CatalogCursor {
  /** `updated_at` de la última prenda recibida. */
  garments: string | null;
  /** `removed_at` de la última baja recibida. */
  removals: string | null;
}

export interface CatalogDelta {
  changed: RawGarment[];
  removed: string[];
  cursor: CatalogCursor;
}

const PAGE = 500;

async function pages<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; offset < 20 * PAGE; offset += PAGE) {
    const res = await call(`${path}&limit=${PAGE}&offset=${offset}`);
    if (!res.ok) throw new Error(`Catálogo no disponible (${res.status})`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/**
 * Lo que ha cambiado en el catálogo compartido desde la última sincronización
 * (todo, si es la primera). La app guarda el resultado y la próxima vez solo
 * pide las novedades: menos datos para el usuario y menos carga en el servidor.
 */
export async function fetchCatalogChanges(since: CatalogCursor): Promise<CatalogDelta> {
  if (!remoteEnabled()) return { changed: [], removed: [], cursor: since };
  const after = (column: string, value: string | null) => (value ? `&${column}=gt.${encodeURIComponent(value)}` : '');
  const [garments, removals] = await Promise.all([
    pages<{ data: RawGarment; updated_at: string }>(
      `garments?select=data,updated_at&status=eq.published&order=updated_at.asc${after('updated_at', since.garments)}`),
    pages<{ id: string; removed_at: string }>(
      `garment_removals?select=id,removed_at&order=removed_at.asc${after('removed_at', since.removals)}`),
  ]);
  return {
    changed: garments.map((r) => r.data),
    removed: removals.map((r) => r.id),
    cursor: {
      garments: garments.length ? garments[garments.length - 1].updated_at : since.garments,
      removals: removals.length ? removals[removals.length - 1].removed_at : since.removals,
    },
  };
}

/** Envía una prenda para que la revisemos antes de publicarla para todos. */
export async function submitGarment(garment: RawGarment, note?: string): Promise<void> {
  if (!remoteEnabled()) throw new Error('El catálogo compartido no está configurado');
  const res = await call('garment_submissions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ data: garment, note: note ?? null }),
  });
  if (!res.ok) throw new Error(`No se pudo enviar (${res.status})`);
}

/**
 * Cómo le quedó una talla a alguien que la compró. Anónimo y voluntario:
 * la prenda, la talla y la respuesta. Sirve para detectar marcas que tallan
 * pequeño o grande y afinar las holguras.
 */
export async function submitFeedback(f: {
  garmentId: string; size: string | null; recommended: string | null; verdict: 'small' | 'right' | 'large';
}): Promise<void> {
  if (!remoteEnabled() || !f.size) return;
  const res = await call('fit_feedback', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      garment_id: f.garmentId, size_label: f.size, recommended_label: f.recommended, verdict: f.verdict,
      engine_version: ENGINE_VERSION,
    }),
  });
  if (!res.ok) throw new Error(`No se pudo enviar (${res.status})`);
}
