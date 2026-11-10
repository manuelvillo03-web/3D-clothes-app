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

/** Prendas publicadas en el catálogo compartido. */
export async function fetchPublishedGarments(): Promise<RawGarment[]> {
  if (!remoteEnabled()) return [];
  const res = await call('garments?select=data&status=eq.published&order=updated_at.desc&limit=1000');
  if (!res.ok) throw new Error(`Catálogo no disponible (${res.status})`);
  const rows: { data: RawGarment }[] = await res.json();
  return rows.map((r) => r.data);
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
