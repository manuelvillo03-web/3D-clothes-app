/**
 * Catálogo de la app: guías de tallas incluidas + prendas que añade el
 * usuario (solo en su dispositivo) + prendas publicadas en Supabase.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import bundled from '../data/catalog.json';
import type { ReferenceGarment } from '../core/fit';
import { parseGarment, type Garment, type RawGarment } from '../core/garments';
import { applyDelta, EMPTY_CACHE, mergeCatalog, type CommunityCache } from './catalogSync';
import { fetchCatalogChanges } from './remote';
import { KEYS, load, save } from './storage';

export interface CatalogItem {
  garment: Garment;
  raw: RawGarment;
  origin: 'bundled' | 'mine' | 'community';
}

export interface WardrobeItem extends ReferenceGarment {
  id: string;
  name: string;
  createdAt: string;
}

export type Verdict = 'small' | 'right' | 'large';

/** Prenda que el usuario ha mirado (y, si lo cuenta, cómo le quedó). */
export interface TryItem {
  id: string;
  size: string | null;
  at: string;
  verdict?: Verdict;
}

const HISTORY_MAX = 24;

function toItems(raws: RawGarment[], origin: CatalogItem['origin']): CatalogItem[] {
  const out: CatalogItem[] = [];
  for (const raw of raws) {
    try {
      out.push({ garment: parseGarment(raw), raw, origin });
    } catch {
      // Prenda mal formada: se ignora en lugar de romper el catálogo.
    }
  }
  return out;
}

const BUNDLED = bundled as RawGarment[];

interface CatalogState {
  items: CatalogItem[];
  byId: (id: string) => CatalogItem | undefined;
  addMine: (raw: RawGarment) => Promise<CatalogItem>;
  removeMine: (id: string) => Promise<void>;
  remoteStatus: 'idle' | 'loading' | 'ok' | 'error';
  wardrobe: WardrobeItem[];
  addWardrobe: (item: Omit<WardrobeItem, 'id' | 'createdAt'>) => Promise<void>;
  removeWardrobe: (id: string) => Promise<void>;
  history: TryItem[];
  /** Apunta que se ha mirado una prenda (la más reciente, primero). */
  recordTry: (id: string, size: string | null) => void;
  setVerdict: (id: string, size: string | null, verdict: Verdict) => void;
  /** Olvida armario y prendas propias en memoria (tras «Borrar mis datos»). */
  reset: () => void;
}

const Ctx = createContext<CatalogState | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [mine, setMine] = useState<RawGarment[]>([]);
  const [community, setCommunity] = useState<CommunityCache>(EMPTY_CACHE);
  const [remoteStatus, setRemoteStatus] = useState<CatalogState['remoteStatus']>('loading');
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [history, setHistory] = useState<TryItem[]>([]);

  useEffect(() => {
    load<RawGarment[]>(KEYS.garments, []).then(setMine);
    load<WardrobeItem[]>(KEYS.wardrobe, []).then(setWardrobe);
    load<TryItem[]>(KEYS.history, []).then(setHistory);
    // Catálogo compartido: primero la copia guardada (funciona sin conexión)
    // y después solo las novedades desde la última sincronización.
    let alive = true;
    (async () => {
      const cache = { ...EMPTY_CACHE, ...(await load<CommunityCache>(KEYS.community, EMPTY_CACHE)) };
      if (!alive) return;
      setCommunity(cache);
      try {
        const delta = await fetchCatalogChanges(cache.cursor);
        if (!alive) return;
        if (delta.changed.length || delta.removed.length) {
          const next = applyDelta(cache, delta);
          setCommunity(next);
          void save(KEYS.community, next);
        }
        setRemoteStatus('ok');
      } catch {
        if (alive) setRemoteStatus('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const items = useMemo(() => {
    const own = toItems(mine, 'mine');
    const taken = new Set(own.map((it) => it.garment.id));
    const shared: CatalogItem[] = [];
    for (const { raw, origin } of mergeCatalog(BUNDLED, community)) {
      if (taken.has(raw.id)) continue;
      shared.push(...toItems([raw], origin));
    }
    return [...own, ...shared];
  }, [mine, community]);

  const byId = useCallback((id: string) => items.find((it) => it.garment.id === id), [items]);

  const addMine = useCallback(async (raw: RawGarment) => {
    const garment = parseGarment(raw); // lanza si no es válida
    const next = [raw, ...mine.filter((g) => g.id !== raw.id)];
    setMine(next);
    await save(KEYS.garments, next);
    return { garment, raw, origin: 'mine' as const };
  }, [mine]);

  const removeMine = useCallback(async (id: string) => {
    const next = mine.filter((g) => g.id !== id);
    setMine(next);
    await save(KEYS.garments, next);
  }, [mine]);

  const addWardrobe = useCallback(async (item: Omit<WardrobeItem, 'id' | 'createdAt'>) => {
    const next = [{ ...item, id: `armario-${Date.now()}`, createdAt: new Date().toISOString() }, ...wardrobe];
    setWardrobe(next);
    await save(KEYS.wardrobe, next);
  }, [wardrobe]);

  const removeWardrobe = useCallback(async (id: string) => {
    const next = wardrobe.filter((w) => w.id !== id);
    setWardrobe(next);
    await save(KEYS.wardrobe, next);
  }, [wardrobe]);

  const recordTry = useCallback((id: string, size: string | null) => {
    setHistory((prev) => {
      const old = prev.find((h) => h.id === id);
      if (prev[0]?.id === id && prev[0].size === size) return prev;
      const next = [{ ...old, id, size, at: new Date().toISOString() }, ...prev.filter((h) => h.id !== id)].slice(0, HISTORY_MAX);
      void save(KEYS.history, next);
      return next;
    });
  }, []);

  const setVerdict = useCallback((id: string, size: string | null, verdict: Verdict) => {
    setHistory((prev) => {
      const next = [{ id, size, verdict, at: new Date().toISOString() }, ...prev.filter((h) => h.id !== id)].slice(0, HISTORY_MAX);
      void save(KEYS.history, next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setMine([]);
    setWardrobe([]);
    setHistory([]);
  }, []);

  const value = useMemo(() => ({
    items, byId, addMine, removeMine, remoteStatus, wardrobe, addWardrobe, removeWardrobe, history, recordTry, setVerdict, reset,
  }), [items, byId, addMine, removeMine, remoteStatus, wardrobe, addWardrobe, removeWardrobe, history, recordTry, setVerdict, reset]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalog(): CatalogState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCatalog fuera de CatalogProvider');
  return v;
}
