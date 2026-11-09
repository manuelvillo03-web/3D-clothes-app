/**
 * Formato de las prendas y su validación.
 *
 * Mismo formato que `engine/src/probador/garments.py` y que
 * `data/catalog/schema.json`. Una prenda es una lista de tallas y cada talla
 * una tabla de medidas:
 *
 * - `garment`: medidas de la propia prenda (lo mejor). Contornos completos;
 *   si la marca da el ancho a plano se usa la clave `*_flat` y se dobla.
 * - `body`: medidas del cuerpo al que va destinada la talla (guía de tallas).
 *   Cada valor puede ser un número o un intervalo [min, max].
 */

import { z } from 'zod';
import type { Cut } from './ease';

export const CATEGORIES = [
  'tshirt', 'shirt', 'polo', 'sweater', 'hoodie', 'jacket', 'coat', 'dress',
  'jeans', 'trousers', 'shorts', 'skirt',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_NAMES: Record<Category, string> = {
  tshirt: 'Camiseta', shirt: 'Camisa', polo: 'Polo', sweater: 'Jersey', hoodie: 'Sudadera',
  jacket: 'Chaqueta', coat: 'Abrigo', dress: 'Vestido', jeans: 'Vaqueros',
  trousers: 'Pantalón', shorts: 'Pantalón corto', skirt: 'Falda',
};

export const CUTS = ['slim', 'regular', 'relaxed', 'oversize'] as const satisfies readonly Cut[];
export const CUT_NAMES: Record<Cut, string> = {
  slim: 'Ajustado', regular: 'Regular', relaxed: 'Holgado', oversize: 'Oversize',
};

export type ChartType = 'garment' | 'body';
export type Sleeve = 'none' | 'short' | 'long';
export type Rise = 'low' | 'mid' | 'high';

export const TOPS = new Set<Category>(['tshirt', 'shirt', 'polo', 'sweater', 'hoodie', 'jacket', 'coat', 'dress']);
export const BOTTOMS = new Set<Category>(['jeans', 'trousers', 'shorts', 'skirt']);

export const GARMENT_POINTS: Record<string, string> = {
  chest: 'Pecho',
  waist: 'Cintura',
  hip: 'Cadera',
  thigh: 'Muslo',
  length: 'Largo',
  sleeve_length: 'Manga',
  shoulder_width: 'Hombros',
  inseam: 'Entrepierna',
  rise: 'Tiro',
  neck: 'Cuello',
  leg_opening: 'Bajo',
  height: 'Altura',
};
export const FLAT_SUFFIX = '_flat';
const ELASTANE_NAMES = ['elastane', 'elastano', 'spandex', 'lycra', 'elastan'];

export type Value = number | [number, number];

export interface Size {
  label: string;
  /** Normalizadas: sin `_flat` (ya multiplicadas por dos). */
  measurements: Record<string, Value>;
}

export interface Garment {
  id?: string | null;
  brand: string;
  name: string;
  category: Category;
  cut: Cut;
  chart_type: ChartType;
  sleeve: Sleeve;
  rise: Rise | null;
  composition: Record<string, number>;
  sizes: Size[];
  url?: string | null;
  price?: { amount: number; currency: string } | null;
  barcodes: string[];
  source?: string | null;
  verified: boolean;
  /** Solo en el catálogo: público al que va (para filtrar). */
  audience?: 'men' | 'women' | 'unisex';
}

const valueSchema = z.union([z.number(), z.tuple([z.number(), z.number()])]);

const rawSizeSchema = z.object({
  label: z.string().min(1).max(20),
  measurements: z.record(z.string(), valueSchema),
});

const rawGarmentSchema = z.object({
  id: z.string().nullish(),
  brand: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(CATEGORIES),
  cut: z.enum(CUTS).default('regular'),
  chart_type: z.enum(['garment', 'body']).default('garment'),
  sleeve: z.enum(['none', 'short', 'long']).nullish(),
  rise: z.enum(['low', 'mid', 'high']).nullish(),
  composition: z.record(z.string(), z.number()).default({}),
  sizes: z.array(rawSizeSchema).min(1),
  url: z.string().nullish(),
  price: z.object({ amount: z.number().min(0), currency: z.string().default('EUR') }).nullish(),
  barcodes: z.array(z.string()).default([]),
  source: z.string().nullish(),
  verified: z.boolean().default(false),
  audience: z.enum(['men', 'women', 'unisex']).optional(),
});

export type RawGarment = z.input<typeof rawGarmentSchema>;

export class GarmentError extends Error {}

function normalizeSize(raw: z.infer<typeof rawSizeSchema>): Size {
  const out: Record<string, Value> = {};
  for (const [key, original] of Object.entries(raw.measurements)) {
    const base = key.endsWith(FLAT_SUFFIX) ? key.slice(0, -FLAT_SUFFIX.length) : key;
    if (!(base in GARMENT_POINTS)) throw new GarmentError(`Punto de medida desconocido: ${key}`);
    let value: Value = original as Value;
    if (key.endsWith(FLAT_SUFFIX)) {
      value = Array.isArray(value) ? [value[0] * 2, value[1] * 2] : value * 2;
    }
    if (Array.isArray(value)) {
      const [lo, hi] = value;
      if (!(lo > 0 && lo <= hi)) throw new GarmentError(`${key}: intervalo no válido [${lo}, ${hi}]`);
    } else if (!(value > 0)) {
      throw new GarmentError(`${key}: la medida tiene que ser positiva`);
    }
    out[base] = value;
  }
  if (!Object.keys(out).length) throw new GarmentError('La talla no tiene medidas');
  return { label: raw.label, measurements: out };
}

/** Valida y normaliza una prenda (del catálogo o introducida por el usuario). */
export function parseGarment(input: unknown): Garment {
  const parsed = rawGarmentSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new GarmentError(`Prenda no válida (${issue.path.join('.') || 'raíz'}): ${issue.message}`);
  }
  const g = parsed.data;
  const sizes = g.sizes.map(normalizeSize);
  const labels = sizes.map((s) => s.label);
  if (new Set(labels).size !== labels.length) throw new GarmentError('Hay tallas repetidas');
  if (g.chart_type === 'garment') {
    for (const s of sizes) {
      if (Object.values(s.measurements).some(Array.isArray)) {
        throw new GarmentError(
          "Una tabla de medidas de prenda no admite intervalos; usa chart_type='body' para guías de tallas por cuerpo",
        );
      }
    }
  }
  const total = Object.values(g.composition).reduce((a, b) => a + b, 0);
  if (Object.keys(g.composition).length && !(total >= 95 && total <= 105)) {
    throw new GarmentError(`La composición suma ${total} %, no 100 %`);
  }
  const sleeve: Sleeve = g.sleeve ?? (g.category === 'tshirt' || g.category === 'polo'
    ? 'short' : BOTTOMS.has(g.category) ? 'none' : 'long');
  const rise: Rise | null = g.rise ?? (BOTTOMS.has(g.category) ? 'mid' : null);
  return {
    id: g.id ?? null, brand: g.brand, name: g.name, category: g.category, cut: g.cut,
    chart_type: g.chart_type, sleeve, rise, composition: g.composition, sizes,
    url: g.url ?? null, price: g.price ?? null, barcodes: g.barcodes,
    source: g.source ?? null, verified: g.verified, audience: g.audience,
  };
}

export function elastanePct(garment: Garment): number {
  return Object.entries(garment.composition)
    .filter(([k]) => ELASTANE_NAMES.includes(k.trim().toLowerCase()))
    .reduce((a, [, v]) => a + v, 0);
}
