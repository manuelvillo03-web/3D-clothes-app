/**
 * Prenda aproximada alrededor del maniquí, coloreada por zonas.
 *
 * No simula la tela: «infla» la superficie del maniquí por donde cubre la
 * prenda. En cada zona la separación es la holgura de esa talla repartida
 * alrededor del contorno (un contorno C que crece ΔC se separa ΔC / 2π), y el
 * color es el estado de la zona (aprieta, justo, bien, holgado, muy holgado).
 * Es fiel a las medidas, no a la caída del tejido.
 */

import { PART, type BodyModelData } from './bodyModel';
import type { SizeResult, Status } from './fit';
import { BOTTOMS, type Garment } from './garments';
import type { Body } from './measurements';

export interface Shell {
  positions: Float32Array;
  colors: Float32Array;
  index: Uint32Array;
}

/** Holgura nominal (cm) cuando la talla solo trae guía por cuerpo. */
const NOMINAL_EASE: Record<Status, number> = { tight: 0.5, snug: 2, good: 6, loose: 12, very_loose: 20 };
const RISE_FRACTION: Record<string, number> = { high: 0.05, mid: 0.25, low: 0.5 };
const MIN_GAP = 0.004; // m: evita que la prenda se cruce con la piel
const UNKNOWN = '#B8B0A6';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function vertexNormals(vertices: Float32Array, faces: Uint32Array): Float32Array {
  const n = new Float32Array(vertices.length);
  for (let f = 0; f < faces.length; f += 3) {
    const a = faces[f] * 3, b = faces[f + 1] * 3, c = faces[f + 2] * 3;
    const ux = vertices[b] - vertices[a], uy = vertices[b + 1] - vertices[a + 1], uz = vertices[b + 2] - vertices[a + 2];
    const vx = vertices[c] - vertices[a], vy = vertices[c + 1] - vertices[a + 1], vz = vertices[c + 2] - vertices[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) {
      n[i] += nx; n[i + 1] += ny; n[i + 2] += nz;
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const len = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= len; n[i + 1] /= len; n[i + 2] /= len;
  }
  return n;
}

/** Alturas de referencia (m). Si faltan, proporciones típicas de la altura. */
export function landmarks(body: Body) {
  const h = (body.height ?? 172) / 100;
  const z = (key: string, frac: number) => (body[key] !== undefined ? body[key] / 100 : frac * h);
  return {
    height: h,
    bust: z('z_bust', 0.72),
    waist: z('z_waist', 0.61),
    hip: z('z_hip', 0.52),
    thigh: z('z_thigh', 0.44),
    knee: z('z_knee', 0.28),
    crotch: body.inseam !== undefined ? body.inseam / 100 : 0.46 * h,
  };
}

/** Punto más alto del brazo de cada lado: arranque de la manga. */
function shoulderPoints(model: BodyModelData, v: Float32Array) {
  const best = { left: -1, right: -1 };
  for (let i = 0; i < model.vertexCount; i++) {
    if (model.vertexPart[i] !== PART.arm) continue;
    const side = v[i * 3] < 0 ? 'left' : 'right';
    if (best[side] < 0 || v[i * 3 + 1] > v[best[side] * 3 + 1]) best[side] = i;
  }
  const point = (i: number) => (i < 0 ? null : [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]] as const);
  return { left: point(best.left), right: point(best.right) };
}

/** La cabeza queda fuera por el cuello de la prenda; manos y pies, por el largo. */
function partKind(p: number): 'torso' | 'arm' | 'leg' {
  if (p === PART.arm) return 'arm';
  if (p === PART.leg) return 'leg';
  return 'torso';
}

export function buildShell(
  model: BodyModelData, vertices: Float32Array, body: Body, garment: Garment, size: SizeResult | null,
): Shell {
  const lm = landmarks(body);
  const normals = vertexNormals(vertices, model.faces);
  const zones = new Map((size?.zones ?? []).map((z) => [z.zone, z]));
  const isBottom = BOTTOMS.has(garment.category);
  const scale = lm.height / 1.75;

  const easeOf = (zone: string): number | null => {
    const z = zones.get(zone);
    if (!z) return null;
    if (z.ease_cm !== null) return z.ease_cm;
    return NOMINAL_EASE[z.status];
  };
  const colorOf = (zone: string) => {
    const z = zones.get(zone);
    return hexToRgb(z ? STATUS_HEX[z.status] : UNKNOWN);
  };
  const gap = (easeCm: number | null) => MIN_GAP + Math.max(easeCm ?? 4, 0.6) / (2 * Math.PI) / 100;

  // Límites verticales de la prenda (m).
  const shoulders = shoulderPoints(model, vertices);
  const shoulderY = Math.max(shoulders.left?.[1] ?? lm.bust + 0.14, shoulders.right?.[1] ?? lm.bust + 0.14);
  const collar = shoulderY + 0.035 * scale;
  const lengthZone = zones.get('length');
  const torsoLen = body.torso_length;
  let hem: number;
  if (isBottom) {
    const inseamZone = zones.get('inseam');
    if (garment.category === 'shorts') hem = lm.crotch - 0.18 * scale;
    else if (garment.category === 'skirt') hem = lm.knee + 0.06 * scale;
    else hem = lm.crotch - (inseamZone?.garment_cm ?? body.inseam ?? lm.crotch * 100) / 100;
  } else if (lengthZone?.garment_cm && torsoLen) {
    hem = lm.crotch + (torsoLen - lengthZone.garment_cm) / 100;
  } else if (garment.category === 'dress') {
    hem = lm.knee + 0.04 * scale;
  } else if (garment.category === 'coat') {
    hem = lm.knee + 0.12 * scale;
  } else {
    hem = lm.hip - 0.07 * scale;
  }
  hem = Math.max(hem, 0.06);
  const waistband = lm.waist - (RISE_FRACTION[garment.rise ?? 'mid'] ?? 0.25) * (lm.waist - lm.hip);
  const sleeveReach = garment.sleeve === 'long'
    ? (body.sleeve_length ?? 60 * scale) / 100 + Math.max(-0.08, Math.min(0.08, (easeOf('sleeve_length') ?? 0) / 100))
    : garment.sleeve === 'short' ? 0.2 * scale : 0;

  // Separación de la piel según la altura, interpolada entre zonas.
  const anchors: [number, number][] = isBottom
    ? [[waistband, gap(easeOf('waist'))], [lm.hip, gap(easeOf('hip') ?? easeOf('waist'))],
      [lm.crotch, gap(easeOf('thigh') ?? easeOf('hip'))]]
    : [[lm.bust, gap(easeOf('chest'))], [lm.waist, gap(easeOf('waist') ?? easeOf('chest'))],
      [lm.hip, gap(easeOf('hip') ?? easeOf('waist') ?? easeOf('chest'))]];
  const gapAt = (y: number) => {
    if (y >= anchors[0][0]) return anchors[0][1];
    for (let i = 1; i < anchors.length; i++) {
      const [y0, g0] = anchors[i - 1];
      const [y1, g1] = anchors[i];
      if (y >= y1) return g0 + ((y - y0) / (y1 - y0 || 1)) * (g1 - g0);
    }
    return anchors[anchors.length - 1][1];
  };

  const V = model.vertexCount;
  const covered = new Uint8Array(V);
  const positions = Float32Array.from(vertices);
  const colors = new Float32Array(V * 3);
  const band = 0.05 * scale; // franja del bajo o del puño que lleva el color del largo

  for (let i = 0; i < V; i++) {
    const x = vertices[i * 3], y = vertices[i * 3 + 1], zc = vertices[i * 3 + 2];
    const kind = partKind(model.vertexPart[i]);
    let zone: string | null = null;
    let g = 0;

    if (isBottom) {
      if (kind === 'torso' && y <= waistband && y >= lm.crotch - 0.03) {
        zone = y > (lm.hip + waistband) / 2 ? 'waist' : 'hip';
        g = gapAt(y);
      } else if (kind === 'leg' && y >= hem) {
        zone = y < hem + band && zones.has('inseam') ? 'inseam' : zones.has('thigh') ? 'thigh' : 'hip';
        // Hacia el tobillo la pernera se ajusta menos que en el muslo.
        const t = Math.max(0, Math.min(1, (lm.crotch - y) / Math.max(lm.crotch - hem, 0.01)));
        g = gapAt(lm.crotch) * (1 - 0.35 * t);
      }
    } else if (kind === 'torso' && y <= collar && y >= hem) {
      if (y < hem + band && zones.has('length')) zone = 'length';
      else if (y > lm.bust + 0.06 * scale && zones.has('shoulder_width')) zone = 'shoulder_width';
      else {
        const d = [['chest', Math.abs(y - lm.bust)], ['waist', Math.abs(y - lm.waist)], ['hip', Math.abs(y - lm.hip)]] as const;
        zone = [...d].filter(([k]) => zones.has(k)).sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'chest';
      }
      g = gapAt(Math.min(y, lm.bust));
    } else if (kind === 'leg' && !isBottom && y >= hem && (garment.category === 'dress' || garment.category === 'coat')) {
      zone = y < hem + band && zones.has('length') ? 'length' : 'hip';
      g = gapAt(lm.hip);
    } else if (kind === 'arm' && sleeveReach > 0) {
      const s = x < 0 ? shoulders.left : shoulders.right;
      if (s) {
        const d = Math.hypot(x - s[0], y - s[1], zc - s[2]);
        if (d <= sleeveReach) {
          zone = garment.sleeve === 'long' && d > sleeveReach - band && zones.has('sleeve_length') ? 'sleeve_length' : 'chest';
          g = MIN_GAP + Math.min(gapAt(lm.bust), 0.02) * 0.5;
        }
      }
    }

    if (zone) {
      covered[i] = 1;
      positions[i * 3] += normals[i * 3] * g;
      positions[i * 3 + 1] += normals[i * 3 + 1] * g;
      positions[i * 3 + 2] += normals[i * 3 + 2] * g;
      const [r, gg, b] = colorOf(zone);
      colors[i * 3] = r; colors[i * 3 + 1] = gg; colors[i * 3 + 2] = b;
    }
  }

  const tri: number[] = [];
  const f = model.faces;
  for (let k = 0; k < f.length; k += 3) {
    if (covered[f[k]] && covered[f[k + 1]] && covered[f[k + 2]]) tri.push(f[k], f[k + 1], f[k + 2]);
  }
  return { positions, colors, index: Uint32Array.from(tri) };
}

// Duplicado de theme.statusColor para que el núcleo no dependa de la UI.
const STATUS_HEX: Record<Status, string> = {
  tight: '#D2463C', snug: '#E3A33B', good: '#3E9C6A', loose: '#4C86C6', very_loose: '#7C5CC4',
};
