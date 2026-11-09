import { BOTTOMS, type Category, type ChartType } from '../core/garments';

/** Puntos de medida que se piden en los formularios según la prenda. */
export function pointsFor(category: Category, chart: ChartType): string[] {
  if (chart === 'body') {
    if (BOTTOMS.has(category)) return ['waist', 'hip', 'thigh', 'inseam'];
    if (category === 'shirt') return ['chest', 'waist', 'neck'];
    return ['chest', 'waist', 'hip'];
  }
  if (BOTTOMS.has(category)) {
    return category === 'skirt' ? ['waist', 'hip', 'length'] : ['waist', 'hip', 'thigh', 'inseam', 'rise'];
  }
  if (category === 'dress') return ['chest', 'waist', 'hip', 'length'];
  return ['chest', 'length', 'shoulder_width', 'sleeve_length', ...(category === 'shirt' ? ['neck'] : [])];
}

/** Contornos que una marca puede dar «a plano» (la mitad). */
export const CIRCUMFERENCES = new Set(['chest', 'waist', 'hip', 'thigh', 'leg_opening']);

export const POINT_HELP: Record<string, string> = {
  chest: 'De axila a axila',
  waist: 'Cintura o cinturilla',
  hip: 'Por la parte más ancha',
  thigh: 'Justo bajo la entrepierna',
  length: 'Del hombro al bajo',
  sleeve_length: 'De la costura del hombro al puño',
  shoulder_width: 'De costura a costura por la espalda',
  inseam: 'De la entrepierna al bajo',
  rise: 'Tiro delantero',
  neck: 'Cuello de camisa',
};

/** Lee «96», «96,5» o un intervalo «96-101». */
export function parseValue(text: string): number | [number, number] | null {
  const t = text.trim().replace(/,/g, '.');
  if (!t) return null;
  const range = t.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (range) {
    const lo = parseFloat(range[1]);
    const hi = parseFloat(range[2]);
    return lo <= hi ? [lo, hi] : [hi, lo];
  }
  const n = parseFloat(t);
  return Number.isFinite(n) && /^\d+(\.\d+)?$/.test(t) ? n : null;
}
