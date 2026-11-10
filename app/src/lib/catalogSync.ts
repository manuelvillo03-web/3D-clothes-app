/**
 * Mezcla del catálogo que viene dentro de la app con el compartido.
 *
 * Manda el servidor: si una guía incluida se corrige o se retira allí, la app
 * usa la corrección (o deja de mostrarla) sin esperar a una actualización.
 */
import type { RawGarment } from '../core/garments';

export interface CommunityCache {
  cursor: { garments: string | null; removals: string | null };
  garments: RawGarment[];
  /** Ids retirados del catálogo compartido. */
  removed: string[];
}

export const EMPTY_CACHE: CommunityCache = { cursor: { garments: null, removals: null }, garments: [], removed: [] };

/** Aplica a la copia local lo que ha cambiado en el servidor. */
export function applyDelta(
  cache: CommunityCache,
  delta: { changed: RawGarment[]; removed: string[]; cursor: CommunityCache['cursor'] },
): CommunityCache {
  const changedIds = new Set(delta.changed.map((g) => g.id));
  const removed = new Set([...(cache.removed ?? []), ...delta.removed]);
  for (const id of changedIds) if (id) removed.delete(id);
  return {
    cursor: delta.cursor,
    garments: [...delta.changed, ...cache.garments.filter((g) => !changedIds.has(g.id) && !removed.has(g.id ?? ''))],
    removed: [...removed],
  };
}

/** Catálogo que ve el usuario: el incluido (con las correcciones del servidor) y, detrás, lo que solo está en el servidor. */
export function mergeCatalog(bundled: RawGarment[], cache: Pick<CommunityCache, 'garments' | 'removed'>): {
  raw: RawGarment; origin: 'bundled' | 'community';
}[] {
  const remote = new Map(cache.garments.map((g) => [g.id, g]));
  const removed = new Set(cache.removed ?? []);
  const out: { raw: RawGarment; origin: 'bundled' | 'community' }[] = [];
  const seen = new Set<string | null | undefined>();
  for (const g of bundled) {
    if (removed.has(g.id ?? '')) continue;
    out.push({ raw: remote.get(g.id) ?? g, origin: 'bundled' });
    seen.add(g.id);
  }
  for (const g of cache.garments) {
    if (!seen.has(g.id) && !removed.has(g.id ?? '')) out.push({ raw: g, origin: 'community' });
  }
  return out;
}
