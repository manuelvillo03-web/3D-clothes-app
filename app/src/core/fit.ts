/**
 * Comparación prenda-cuerpo y recomendación de talla.
 *
 * Copia fiel de `engine/src/probador/fit.py` (los tests de paridad comparan
 * los dos motores con los casos de `__fixtures__/golden.json`). Tres caminos:
 *
 * - `fitGarment` con tabla de la prenda: holgura zona a zona frente a `ease`.
 * - `fitGarment` con guía por cuerpo: ¿cae cada medida en el intervalo?
 * - `compareWithReference`: cada talla frente a una prenda del usuario.
 */

import * as E from './ease';
import type { Band, Preference } from './ease';
import { BOTTOMS, GARMENT_POINTS, elastanePct, type Category, type Garment, type Value } from './garments';
import type { Body } from './measurements';
import { fmtG } from './measurements';
import { fmtFixed, pyRound } from './pyformat';

export type Status = 'tight' | 'snug' | 'good' | 'loose' | 'very_loose';

export const STATUS_ES: Record<Status, string> = {
  tight: 'aprieta', snug: 'justo', good: 'bien', loose: 'holgado', very_loose: 'muy holgado',
};
export const LENGTH_STATUS_ES: Record<Status, string> = {
  tight: 'muy corto', snug: 'corto', good: 'bien', loose: 'largo', very_loose: 'muy largo',
};
export const LENGTH_ZONES = new Set(['length', 'sleeve_length', 'inseam', 'height']);

export const ZONE_WEIGHT: Record<string, number> = {
  chest: 1.0, waist: 0.8, hip: 0.8, thigh: 0.6, shoulder_width: 0.7,
  length: 0.4, sleeve_length: 0.5, neck: 0.6, inseam: 0.5, height: 0.3,
};
const TOP_WAIST_WEIGHT = 0.5;
const IN_BAND_WEIGHT = 0.05;

export interface ZoneResult {
  zone: string;
  name: string;
  status: Status;
  status_text: string;
  garment_cm: number | null;
  body_cm: number | null;
  ease_cm: number | null;
  ideal: [number, number] | null;
}

export interface SizeResult {
  label: string;
  score: number;
  zones: ZoneResult[];
  wearable: boolean;
}

export type Confidence = 'alta' | 'media' | 'baja';
export type Method = 'garment_chart' | 'body_chart' | 'reference';

export interface FitResult {
  recommended: string | null;
  alternative: string | null;
  confidence: Confidence;
  method: Method;
  sizes: SizeResult[];
  explanation: string[];
  warnings: string[];
  engine_version: string;
}

export interface ReferenceGarment {
  name?: string;
  category: Category;
  measurements: Record<string, number>;
}

const zw = (zone: string, fallback: number) => ZONE_WEIGHT[zone] ?? fallback;

function sizeResult(label: string, score: number, zones: ZoneResult[]): SizeResult {
  return { label, score: pyRound(score, 3), zones, wearable: !zones.some((z) => z.status === 'tight') };
}

// ---------------------------------------------------------------- utilidades

export function stretchFraction(garment: Garment): number {
  const base = E.BASE_STRETCH[garment.category] ?? 0.0;
  return Math.min(base + E.STRETCH_PER_ELASTANE_PCT * elastanePct(garment), E.MAX_STRETCH);
}

export function waistbandBody(body: Body, rise: string): number {
  const measured = body[`waistband_${rise}`];
  if (measured) return measured;
  return body.waist + (body.hip - body.waist) * (E.RISE_DROP[rise] ?? E.RISE_DROP.mid);
}

function shifted(b: Band, preference: Preference): Band {
  const shift = E.PREFERENCE_SHIFT[preference] * E.width(b);
  return E.band(b.idealMin + shift, b.idealMax + shift, b.tightMargin, b.looseMargin);
}

function classify(ease: number, b: Band): [Status, number] {
  if (ease < b.idealMin) {
    const d = (b.idealMin - ease) / b.tightMargin;
    return [d > 1 ? 'tight' : 'snug', 2.0 * d * d + (d > 1 ? 4.0 : 0.0)];
  }
  if (ease > b.idealMax) {
    const d = (ease - b.idealMax) / b.looseMargin;
    return [d > 1 ? 'very_loose' : 'loose', d * d + (d > 1 ? 1.0 : 0.0)];
  }
  return ['good', 0.0];
}

const statusText = (zone: string, status: Status) =>
  (LENGTH_ZONES.has(zone) ? LENGTH_STATUS_ES : STATUS_ES)[status];

const pointName = (zone: string) => GARMENT_POINTS[zone] ?? zone;

// ------------------------------------------------------- tabla de la prenda

type ZoneSpec = [zone: string, garment: number, body: number, band: Band, weight: number, give: number];

function garmentZones(garment: Garment, values: Record<string, number>, body: Body): ZoneSpec[] {
  const { category: cat, cut } = garment;
  const zones: ZoneSpec[] = [];
  const stretch = stretchFraction(garment);
  const has = (k: string) => k in values;
  const hasB = (k: string) => k in body;

  const circ = (zone: string, g: number, b: number, bd: Band, w: number) => {
    zones.push([zone, g, b, bd, w, stretch * b * E.COMFORT_STRETCH_SHARE]);
  };

  if (BOTTOMS.has(cat)) {
    if (has('waist') && hasB('waist') && hasB('hip')) {
      circ('waist', values.waist, waistbandBody(body, garment.rise ?? 'mid'), E.WAISTBAND[cut], ZONE_WEIGHT.waist);
    }
    if (has('hip') && hasB('hip')) circ('hip', values.hip, body.hip, E.HIP[cut], ZONE_WEIGHT.hip);
    if (has('thigh') && hasB('thigh') && cat !== 'skirt') {
      circ('thigh', values.thigh, body.thigh, E.THIGH[cut], ZONE_WEIGHT.thigh);
    }
    if (has('inseam') && hasB('inseam') && (cat === 'jeans' || cat === 'trousers')) {
      zones.push(['inseam', values.inseam, body.inseam, E.INSEAM, ZONE_WEIGHT.inseam, 0.0]);
    }
    return zones;
  }

  const chestBand = E.CHEST[cat][cut];
  if (has('chest') && hasB('chest')) circ('chest', values.chest, body.chest, chestBand, ZONE_WEIGHT.chest);
  if (has('waist') && hasB('waist')) {
    circ('waist', values.waist, body.waist, chestBand, cat === 'dress' ? ZONE_WEIGHT.waist : TOP_WAIST_WEIGHT);
  }
  if (has('hip') && hasB('hip')) {
    circ('hip', values.hip, body.hip, cat === 'dress' ? E.HIP[cut] : chestBand, ZONE_WEIGHT.hip * 0.75);
  }
  if (has('neck') && hasB('neck') && cat === 'shirt') {
    zones.push(['neck', values.neck, body.neck, E.NECK, ZONE_WEIGHT.neck, 0.0]);
  }
  if (has('shoulder_width') && hasB('shoulder_width')) {
    zones.push(['shoulder_width', values.shoulder_width, body.shoulder_width, E.SHOULDER[cut], ZONE_WEIGHT.shoulder_width, 0.0]);
  }
  if (has('length') && hasB('torso_length') && cat !== 'dress') {
    zones.push(['length', values.length, body.torso_length, E.TOP_LENGTH[cat], ZONE_WEIGHT.length, 0.0]);
  }
  if (garment.sleeve === 'long' && has('sleeve_length') && hasB('sleeve_length')) {
    let g = values.sleeve_length;
    let b = body.sleeve_length;
    let bd = E.SLEEVE;
    if (has('shoulder_width') && hasB('shoulder_width')) {
      g += values.shoulder_width / 2;
      b += body.shoulder_width / 2;
      bd = E.SLEEVE_CB;
    }
    zones.push(['sleeve_length', g, b, bd, ZONE_WEIGHT.sleeve_length, 0.0]);
  }
  return zones;
}

function evaluateGarmentChart(garment: Garment, body: Body, preference: Preference): SizeResult[] {
  return garment.sizes.map((size) => {
    const zones: ZoneResult[] = [];
    let score = 0.0;
    for (const spec of garmentZones(garment, size.measurements as Record<string, number>, body)) {
      const [zone, g, b, , w, give] = spec;
      let bd = spec[3];
      if (!LENGTH_ZONES.has(zone)) bd = shifted(bd, preference);
      const target = (bd.idealMin + bd.idealMax) / 2;
      const half = Math.max(E.width(bd) / 2, 0.5);
      if (give) bd = E.band(bd.idealMin - give, bd.idealMax, bd.tightMargin + give, bd.looseMargin);
      const ease = g - b;
      const [status, base] = classify(ease, bd);
      const penalty = base + IN_BAND_WEIGHT * ((ease - target) / half) ** 2;
      score += w * penalty;
      zones.push({
        zone, name: pointName(zone), status, status_text: statusText(zone, status),
        garment_cm: pyRound(g, 1), body_cm: pyRound(b, 1), ease_cm: pyRound(ease, 1),
        ideal: [pyRound(bd.idealMin, 1), pyRound(bd.idealMax, 1)],
      });
    }
    return sizeResult(size.label, score, zones);
  });
}

function evaluateBodyChart(garment: Garment, body: Body, preference: Preference): SizeResult[] {
  return garment.sizes.map((size) => {
    const zones: ZoneResult[] = [];
    let score = 0.0;
    for (const [zone, value] of Object.entries(size.measurements) as [string, Value][]) {
      if (!(zone in body)) continue;
      const [lo, hi] = Array.isArray(value) ? value : [value - 2.0, value + 2.0];
      const b = body[zone];
      const w = Math.max(hi - lo, 2.0);
      const target = { fitted: hi - 0.25 * w, regular: (lo + hi) / 2, loose: lo + 0.25 * w }[preference];
      const weight = zw(zone, 0.5);
      let status: Status;
      let penalty: number;
      if (b > hi) {
        const d = (b - hi) / 3.0;
        status = d > 1 ? 'tight' : 'snug';
        penalty = 2.0 * d * d + (d > 1 ? 4.0 : 0.0) + 0.25;
      } else if (b < lo) {
        const d = (lo - b) / 4.0;
        status = d > 1 ? 'very_loose' : 'loose';
        penalty = d * d + (d > 1 ? 1.0 : 0.0) + 0.25;
      } else {
        status = 'good';
        penalty = 0.25 * ((b - target) / (w / 2)) ** 2;
      }
      score += weight * penalty;
      zones.push({
        zone, name: pointName(zone), status, status_text: statusText(zone, status),
        garment_cm: null, body_cm: pyRound(b, 1), ease_cm: null, ideal: [pyRound(lo, 1), pyRound(hi, 1)],
      });
    }
    return sizeResult(size.label, score, zones);
  });
}

// ------------------------------------------------------- recomendación

function tightness(size: SizeResult): number {
  const eases = size.zones
    .filter((z) => z.ease_cm !== null && !LENGTH_ZONES.has(z.zone))
    .map((z) => z.ease_cm as number);
  if (eases.length) return eases.reduce((a, b) => a + b, 0) / eases.length;
  const pos = size.zones
    .filter((z) => z.ideal && z.body_cm !== null)
    .map((z) => ((z.body_cm as number) - z.ideal![0]) / Math.max(z.ideal![1] - z.ideal![0], 1e-6));
  return pos.length ? -pos.reduce((a, b) => a + b, 0) / pos.length : 0.0;
}

function recommend(sizes: SizeResult[], method: Method, garmentLabel: string): FitResult {
  const base = { method, sizes, warnings: [] as string[], engine_version: E.ENGINE_VERSION };
  const scored = sizes.filter((s) => s.zones.length);
  if (!scored.length) {
    return {
      ...base, recommended: null, alternative: null, confidence: 'baja',
      explanation: ['No hay medidas comparables entre la prenda y tu cuerpo.'],
    };
  }
  const ranked = [...scored].sort((a, b) => a.score - b.score);
  const best = ranked[0];
  const second = ranked.length > 1 ? ranked[1] : null;

  const bad = best.zones.filter((z) => (z.status === 'tight' || z.status === 'very_loose') && zw(z.zone, 0.5) >= 0.6);
  const close = second !== null && second.score - best.score < 0.15;
  const confidence: Confidence = bad.length ? 'baja' : close ? 'media' : 'alta';

  const lines = [`Te recomendamos la talla ${best.label}.`];
  for (const z of best.zones) {
    if (z.ease_cm !== null && !LENGTH_ZONES.has(z.zone)) {
      lines.push(`${z.name}: ${z.status_text} (${fmtFixed(z.ease_cm, 0, true)} cm de holgura).`);
    } else if (z.ease_cm !== null) {
      lines.push(`${z.name}: ${z.status_text} (${fmtFixed(z.ease_cm, 0, true)} cm respecto a tu cuerpo).`);
    } else {
      lines.push(
        `${z.name}: ${z.status_text} (tu medida ${fmtG(z.body_cm as number)}, ` +
          `la talla va de ${fmtG(z.ideal![0])} a ${fmtG(z.ideal![1])}).`,
      );
    }
  }

  let alternative: string | null = null;
  if (close && second) {
    alternative = second.label;
    const [tighter, looser] = [best, second].sort((a, b) => tightness(a) - tightness(b));
    lines.push(
      `Estás entre la ${tighter.label} y la ${looser.label}: la ${tighter.label} ` +
        `si te gusta más ceñido, la ${looser.label} si lo prefieres más holgado.`,
    );
  }
  for (const z of bad) lines.push(`Ojo: en ${z.name.toLowerCase()} te quedará ${z.status_text}.`);
  if (scored.every((s) => !s.wearable)) lines.push(`Ninguna talla de ${garmentLabel} parece cómoda para ti.`);
  return { ...base, recommended: best.label, alternative, confidence, explanation: lines };
}

/** Recomienda talla a partir de las medidas del cuerpo. */
export function fitGarment(garment: Garment, body: Body, preference: Preference = 'regular'): FitResult {
  const isGarmentChart = garment.chart_type === 'garment';
  const sizes = isGarmentChart
    ? evaluateGarmentChart(garment, body, preference)
    : evaluateBodyChart(garment, body, preference);
  const result = recommend(sizes, isGarmentChart ? 'garment_chart' : 'body_chart', garment.name);
  if (!isGarmentChart) {
    result.warnings.push(
      'Esta prenda solo tiene guía de tallas por cuerpo: la recomendación es menos precisa que con las medidas de la propia prenda.',
    );
  }
  const usesWaist = sizes.some((s) => s.zones.some((z) => z.zone === 'waist'));
  if (BOTTOMS.has(garment.category) && isGarmentChart && !(`waistband_${garment.rise}` in body) && usesWaist) {
    result.warnings.push(
      'La cintura del pantalón se ha comparado con una estimación de tu contorno a la altura de la cinturilla.',
    );
  }
  return result;
}

export const REFERENCE_SCALE: Record<string, number> = {
  chest: 4.0, waist: 3.0, hip: 3.0, thigh: 3.0, length: 3.0, sleeve_length: 2.0,
  shoulder_width: 2.0, inseam: 2.0, rise: 2.0, neck: 1.0, leg_opening: 3.0,
};

/** Compara cada talla con una prenda del usuario que le queda bien. */
export function compareWithReference(garment: Garment, reference: ReferenceGarment): FitResult {
  if (garment.chart_type !== 'garment') {
    throw new Error('Para comparar con tu prenda hace falta la tabla de medidas de la prenda, no la guía por cuerpo');
  }
  const refName = reference.name ?? 'Tu prenda';
  const ref: Record<string, number> = {};
  for (const [k, v] of Object.entries(reference.measurements)) {
    if (k.endsWith('_flat')) ref[k.slice(0, -5)] = v * 2;
    else ref[k] = v;
  }
  const sizes = garment.sizes.map((size) => {
    const zones: ZoneResult[] = [];
    let score = 0.0;
    for (const [zone, value] of Object.entries(size.measurements)) {
      if (!(zone in ref) || !(zone in REFERENCE_SCALE)) continue;
      const g = value as number;
      const delta = g - ref[zone];
      const scale = REFERENCE_SCALE[zone];
      score += zw(zone, 0.4) * (delta / scale) ** 2;
      let status: Status;
      let text: string;
      if (Math.abs(delta) <= 0.5 * scale) {
        status = 'good';
        text = 'igual que tu prenda';
      } else if (delta > 0) {
        status = delta <= 2 * scale ? 'loose' : 'very_loose';
        text = `${fmtFixed(delta, 0)} cm más que tu prenda`;
      } else {
        status = -delta <= 2 * scale ? 'snug' : 'tight';
        text = `${fmtFixed(-delta, 0)} cm menos que tu prenda`;
      }
      zones.push({
        zone, name: pointName(zone), status, status_text: text, garment_cm: pyRound(g, 1),
        body_cm: null, ease_cm: pyRound(delta, 1), ideal: null,
      });
    }
    return sizeResult(size.label, score, zones);
  });

  const base = { method: 'reference' as const, sizes, warnings: [] as string[], engine_version: E.ENGINE_VERSION };
  const scored = sizes.filter((s) => s.zones.length);
  if (!scored.length) {
    return {
      ...base, recommended: null, alternative: null, confidence: 'baja',
      explanation: ['Tu prenda y esta no tienen medidas en común.'],
    };
  }
  const ranked = [...scored].sort((a, b) => a.score - b.score);
  const best = ranked[0];
  const confidence: Confidence = best.score < 0.5 ? 'alta' : best.score < 2 ? 'media' : 'baja';
  const lines = [`La talla ${best.label} es la más parecida a ${refName}.`];
  for (const z of best.zones) lines.push(`${z.name}: ${z.status_text}.`);
  if (confidence === 'baja') {
    lines.push('Ninguna talla se parece mucho a tu prenda: puede que el corte sea distinto.');
  }
  const alternative = ranked.length > 1 && ranked[1].score - best.score < 0.3 ? ranked[1].label : null;
  return { ...base, recommended: best.label, alternative, confidence, explanation: lines };
}
