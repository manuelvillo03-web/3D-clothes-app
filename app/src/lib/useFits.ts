import { useMemo } from 'react';
import { fitGarment, type FitResult } from '../core/fit';
import type { CatalogItem } from './catalog';
import { useProfile } from './profile';

export interface QuickFit {
  size: string | null;
  wearable: boolean;
  confidence: FitResult['confidence'];
}

/** Talla recomendada de cada prenda para el usuario (vacío si aún no hay maniquí). */
export function useFits(items: CatalogItem[]): Map<string, QuickFit> {
  const { body, profile } = useProfile();
  const preference = profile?.preference ?? 'regular';
  return useMemo(() => {
    const out = new Map<string, QuickFit>();
    if (!body) return out;
    for (const { garment } of items) {
      if (!garment.id) continue;
      try {
        const r = fitGarment(garment, body, preference);
        out.set(garment.id, {
          size: r.recommended,
          wearable: r.sizes.find((s) => s.label === r.recommended)?.wearable ?? true,
          confidence: r.confidence,
        });
      } catch {
        // Prenda sin medidas comparables: se queda sin talla.
      }
    }
    return out;
  }, [items, body, preference]);
}
