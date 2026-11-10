import { describe, expect, it } from 'vitest';
import type { RawGarment } from '../../core/garments';
import { applyDelta, EMPTY_CACHE, mergeCatalog } from '../catalogSync';

const g = (id: string, name = id): RawGarment => ({
  id, brand: 'Marca', name, category: 'tshirt', sizes: [{ label: 'M', measurements: { chest: 100 } }],
});

describe('sincronización del catálogo', () => {
  it('la primera vez guarda todo y recuerda por dónde va', () => {
    const cache = applyDelta(EMPTY_CACHE, { changed: [g('a'), g('b')], removed: [], cursor: { garments: 't1', removals: null } });
    expect(cache.garments.map((x) => x.id)).toEqual(['a', 'b']);
    expect(cache.cursor.garments).toBe('t1');
  });

  it('una novedad sustituye a la copia anterior y una baja la quita', () => {
    let cache = applyDelta(EMPTY_CACHE, { changed: [g('a'), g('b')], removed: [], cursor: { garments: 't1', removals: null } });
    cache = applyDelta(cache, { changed: [g('a', 'corregida')], removed: ['b'], cursor: { garments: 't2', removals: 'r1' } });
    expect(cache.garments).toHaveLength(1);
    expect(cache.garments[0].name).toBe('corregida');
    expect(cache.removed).toEqual(['b']);
  });

  it('una prenda retirada que se vuelve a publicar deja de estar de baja', () => {
    let cache = applyDelta(EMPTY_CACHE, { changed: [], removed: ['a'], cursor: { garments: null, removals: 'r1' } });
    cache = applyDelta(cache, { changed: [g('a')], removed: [], cursor: { garments: 't1', removals: 'r1' } });
    expect(cache.removed).toEqual([]);
    expect(cache.garments.map((x) => x.id)).toEqual(['a']);
  });

  it('el servidor manda sobre las guías incluidas en la app', () => {
    const bundled = [g('a'), g('b'), g('c')];
    const merged = mergeCatalog(bundled, { garments: [g('b', 'corregida'), g('z')], removed: ['c'] });
    expect(merged.map((m) => [m.raw.id, m.raw.name, m.origin])).toEqual([
      ['a', 'a', 'bundled'], ['b', 'corregida', 'bundled'], ['z', 'z', 'community'],
    ]);
  });

  it('sin conexión se ve el catálogo incluido tal cual', () => {
    expect(mergeCatalog([g('a')], EMPTY_CACHE).map((m) => m.raw.id)).toEqual(['a']);
  });
});
