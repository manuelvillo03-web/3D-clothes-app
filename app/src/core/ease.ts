/**
 * Holguras ideales por categoría, corte y zona (cm).
 *
 * Copia fiel de `engine/src/probador/ease.py`. ESTOS VALORES SON EL PUNTO DE
 * PARTIDA, NO LA VERDAD: se calibran con pruebas reales y con las valoraciones
 * de los usuarios. Cada cambio sube ENGINE_VERSION en los dos motores.
 */

export const ENGINE_VERSION = '2026.11.0';

export interface Band {
  idealMin: number;
  idealMax: number;
  /** Cuánto por debajo del mínimo pasa de «justo» a «aprieta». */
  tightMargin: number;
  /** Cuánto por encima del máximo pasa de «holgado» a «muy holgado». */
  looseMargin: number;
}

export const band = (idealMin: number, idealMax: number, tightMargin: number, looseMargin: number): Band => ({
  idealMin, idealMax, tightMargin, looseMargin,
});

export const width = (b: Band): number => b.idealMax - b.idealMin;

function circ(lo: number, hi: number): Band {
  const w = hi - lo;
  return band(lo, hi, Math.max(3.0, 0.4 * w), Math.max(5.0, 0.6 * w));
}

export type Cut = 'slim' | 'regular' | 'relaxed' | 'oversize';
type ByCut = Record<Cut, Band>;

export const CHEST: Record<string, ByCut> = {
  tshirt: { slim: circ(2, 8), regular: circ(8, 16), relaxed: circ(14, 24), oversize: circ(22, 40) },
  polo: { slim: circ(4, 10), regular: circ(10, 18), relaxed: circ(16, 26), oversize: circ(24, 40) },
  shirt: { slim: circ(8, 14), regular: circ(14, 22), relaxed: circ(20, 30), oversize: circ(28, 44) },
  sweater: { slim: circ(4, 10), regular: circ(10, 18), relaxed: circ(16, 26), oversize: circ(24, 42) },
  hoodie: { slim: circ(8, 14), regular: circ(14, 24), relaxed: circ(20, 32), oversize: circ(30, 50) },
  jacket: { slim: circ(10, 16), regular: circ(16, 24), relaxed: circ(22, 32), oversize: circ(30, 50) },
  coat: { slim: circ(14, 20), regular: circ(20, 30), relaxed: circ(28, 40), oversize: circ(36, 60) },
  dress: { slim: circ(2, 8), regular: circ(6, 14), relaxed: circ(12, 22), oversize: circ(20, 40) },
};

export const WAISTBAND: ByCut = { slim: circ(-1, 2), regular: circ(0, 3), relaxed: circ(1, 5), oversize: circ(2, 8) };
export const HIP: ByCut = { slim: circ(0, 4), regular: circ(3, 8), relaxed: circ(6, 12), oversize: circ(10, 20) };
export const THIGH: ByCut = { slim: circ(1, 5), regular: circ(4, 10), relaxed: circ(8, 16), oversize: circ(14, 26) };
export const SHOULDER: ByCut = {
  slim: band(2, 5, 2, 3), regular: band(3, 7, 2, 3), relaxed: band(6, 11, 2, 4), oversize: band(10, 20, 3, 6),
};
export const NECK = band(1, 3, 1, 2);
export const INSEAM = band(-2, 2, 3, 5);
export const SLEEVE = band(-1.5, 2.5, 3, 4);
export const SLEEVE_CB = band(0.5, 5, 3, 4);
export const TOP_LENGTH: Record<string, Band> = {
  tshirt: band(-8, 2, 5, 6), polo: band(-8, 2, 5, 6), shirt: band(-4, 4, 5, 8),
  sweater: band(-8, 2, 5, 6), hoodie: band(-8, 3, 5, 6), jacket: band(-8, 4, 5, 8),
  coat: band(0, 40, 6, 20), dress: band(0, 60, 10, 30),
};

export const BASE_STRETCH: Record<string, number> = {
  tshirt: 0.04, polo: 0.03, sweater: 0.06, hoodie: 0.04, jeans: 0.015,
};
export const STRETCH_PER_ELASTANE_PCT = 0.025;
export const MAX_STRETCH = 0.25;
export const COMFORT_STRETCH_SHARE = 0.5;

export type Preference = 'fitted' | 'regular' | 'loose';
export const PREFERENCE_SHIFT: Record<Preference, number> = { fitted: -0.35, regular: 0.0, loose: 0.35 };

export const RISE_DROP: Record<string, number> = { high: 0.02, mid: 0.2, low: 0.45 };
