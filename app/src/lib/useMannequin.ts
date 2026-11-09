import { useMemo } from 'react';
import { buildVertices } from '../core/bodyModel';
import { useProfile } from './profile';

/** Vértices del maniquí del usuario (se recalculan solo si cambian sus medidas). */
export function useMannequin() {
  const { model, prediction } = useProfile();
  return useMemo(() => {
    if (!model || !prediction) return null;
    const vertices = buildVertices(model, prediction.coefficients);
    let top = 0;
    for (let i = 1; i < vertices.length; i += 3) top = Math.max(top, vertices[i]);
    return { model, vertices, bodyHeight: top || (prediction.measurements.height ?? 172) / 100 };
  }, [model, prediction]);
}
