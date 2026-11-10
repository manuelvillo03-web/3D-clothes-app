/**
 * Dónde se toma cada medida, sobre el propio maniquí.
 *
 * Para un contorno se corta la malla con un plano y se rodea el corte con su
 * envolvente convexa, que es justo lo que hace una cinta métrica (no se mete
 * en los huecos). Para un largo se devuelve el segmento entre sus extremos.
 * Sirve para dibujar la «cinta» en 3D mientras el usuario se mide.
 */

import { PART, type BodyModelData } from './bodyModel';
import { landmarks } from './garmentShell';
import type { Body } from './measurements';

export type Vec3 = [number, number, number];

export interface RingMarker {
  kind: 'ring';
  /** Vértices del contorno, cerrado (el último enlaza con el primero). */
  points: Vec3[];
  /** Normal del plano de corte (la cinta se extiende a lo ancho de ella). */
  normal: Vec3;
  /** Perímetro en metros. */
  length: number;
}

export interface LineMarker {
  kind: 'line';
  points: Vec3[];
  length: number;
}

export type Marker = RingMarker | LineMarker;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function hull2d(pts: [number, number][]): number[] {
  const order = pts.map((_, i) => i).sort((a, b) => pts[a][0] - pts[b][0] || pts[a][1] - pts[b][1]);
  const turn = (o: number, a: number, b: number) =>
    (pts[a][0] - pts[o][0]) * (pts[b][1] - pts[o][1]) - (pts[a][1] - pts[o][1]) * (pts[b][0] - pts[o][0]);
  const lower: number[] = [];
  for (const i of order) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], i) <= 0) lower.pop();
    lower.push(i);
  }
  const upper: number[] = [];
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k];
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], i) <= 0) upper.pop();
    upper.push(i);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * Corte de la malla con el plano (origen, normal), limitado a las caras que
 * acepta `keep`, y rodeado con una cinta.
 */
export function sliceRing(
  model: BodyModelData, v: Float32Array, origin: Vec3, normal: Vec3, keep: (vertex: number) => boolean,
): RingMarker | null {
  const n = norm(normal);
  const f = model.faces;
  const at = (i: number): Vec3 => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]];
  const side = (i: number) => (v[i * 3] - origin[0]) * n[0] + (v[i * 3 + 1] - origin[1]) * n[1] + (v[i * 3 + 2] - origin[2]) * n[2];
  const cut: Vec3[] = [];
  for (let k = 0; k < f.length; k += 3) {
    const a = f[k], b = f[k + 1], c = f[k + 2];
    if (!keep(a) || !keep(b) || !keep(c)) continue;
    const sa = side(a), sb = side(b), sc = side(c);
    if ((sa > 0) === (sb > 0) && (sb > 0) === (sc > 0)) continue;
    for (const [i, j, si, sj] of [[a, b, sa, sb], [b, c, sb, sc], [c, a, sc, sa]] as const) {
      if ((si > 0) === (sj > 0)) continue;
      const t = si / (si - sj);
      const p = at(i), q = at(j);
      cut.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
    }
  }
  if (cut.length < 6) return null;
  // Base del plano para trabajar en 2D.
  const e1 = norm(cross(Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], n));
  const e2 = cross(n, e1);
  const flat = cut.map((p) => {
    const d = sub(p, origin);
    return [dot(d, e1), dot(d, e2)] as [number, number];
  });
  const ring = hull2d(flat).map((i) => cut[i]);
  if (ring.length < 3) return null;
  let length = 0;
  for (let i = 0; i < ring.length; i++) length += dist(ring[i], ring[(i + 1) % ring.length]);
  return { kind: 'ring', points: ring, normal: n, length };
}

function line(points: Vec3[]): LineMarker {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += dist(points[i - 1], points[i]);
  return { kind: 'line', points, length };
}

interface Arm { shoulder: Vec3; tip: Vec3; axis: Vec3; reach: number }

/** Brazo del lado +X: del hombro (su punto más alto) a la punta de la mano. */
function arm(model: BodyModelData, v: Float32Array): Arm | null {
  let top = -1;
  for (let i = 0; i < model.vertexCount; i++) {
    if (model.vertexPart[i] !== PART.arm || v[i * 3] <= 0) continue;
    if (top < 0 || v[i * 3 + 1] > v[top * 3 + 1]) top = i;
  }
  if (top < 0) return null;
  const shoulder: Vec3 = [v[top * 3], v[top * 3 + 1], v[top * 3 + 2]];
  let far = top;
  let reach = 0;
  for (let i = 0; i < model.vertexCount; i++) {
    if (model.vertexPart[i] !== PART.arm || v[i * 3] <= 0) continue;
    const d = Math.hypot(v[i * 3] - shoulder[0], v[i * 3 + 1] - shoulder[1], v[i * 3 + 2] - shoulder[2]);
    if (d > reach) {
      reach = d;
      far = i;
    }
  }
  const tip: Vec3 = [v[far * 3], v[far * 3 + 1], v[far * 3 + 2]];
  return { shoulder, tip, axis: norm(sub(tip, shoulder)), reach };
}

const isPart = (model: BodyModelData, part: number) => (i: number) => model.vertexPart[i] === part;

/**
 * Marca de una medida del cuerpo sobre el maniquí, o `null` si no tiene
 * (el peso; la altura ya la enseña la cinta de pared).
 */
export function markerFor(model: BodyModelData, v: Float32Array, body: Body, key: string): Marker | null {
  const lm = landmarks(body);
  const up: Vec3 = [0, 1, 0];
  const torso = isPart(model, PART.torso);
  // A la altura de la cadera la malla ya es «pierna»: la cinta rodea todo menos los brazos.
  const lower = (i: number) => model.vertexPart[i] !== PART.arm;
  const rightLeg = (i: number) => model.vertexPart[i] === PART.leg && v[i * 3] > 0;
  const rightArm = (i: number) => model.vertexPart[i] === PART.arm && v[i * 3] > 0;
  const horizontal = (y: number, keep: (i: number) => boolean) => sliceRing(model, v, [0, y, 0], up, keep);

  switch (key) {
    case 'chest': return horizontal(lm.bust, torso);
    case 'underbust': return horizontal(lm.bust - 0.035 * lm.height, torso);
    case 'waist': return horizontal(lm.waist, torso);
    case 'stomach': return horizontal((lm.waist + lm.hip) / 2 + 0.01, lower);
    case 'hip': return horizontal(lm.hip, lower);
    case 'thigh': return horizontal(lm.thigh, rightLeg) ?? horizontal(lm.crotch - 0.03, rightLeg);
    case 'knee': return horizontal(lm.knee, rightLeg);
    case 'calf': return horizontal(lm.knee - 0.075 * lm.height, rightLeg);
    case 'neck': {
      // El cuello es el tramo más estrecho entre los hombros y la barbilla.
      let best: RingMarker | null = null;
      for (let t = 0.815; t <= 0.875; t += 0.006) {
        const r = horizontal(t * lm.height, torso);
        if (r && (!best || r.length < best.length)) best = r;
      }
      return best;
    }
    case 'upper_arm': {
      const a = arm(model, v);
      if (!a) return null;
      const o: Vec3 = [a.shoulder[0] + a.axis[0] * a.reach * 0.24, a.shoulder[1] + a.axis[1] * a.reach * 0.24, a.shoulder[2] + a.axis[2] * a.reach * 0.24];
      return sliceRing(model, v, o, a.axis, rightArm);
    }
    case 'sleeve_length': {
      const a = arm(model, v);
      if (!a) return null;
      const len = Math.min((body.sleeve_length ?? 60) / 100, a.reach);
      const out = 0.012;
      const from: Vec3 = [a.shoulder[0] + out, a.shoulder[1] + out, a.shoulder[2]];
      return line([from, [from[0] + a.axis[0] * len, from[1] + a.axis[1] * len, from[2] + a.axis[2] * len]]);
    }
    case 'shoulder_width': {
      // Por la espalda, de punta a punta de los hombros pasando por la nuca.
      const half = (body.shoulder_width ?? 0.225 * lm.height * 100) / 200;
      let tip = -1;
      let nape = -1;
      for (let i = 0; i < model.vertexCount; i++) {
        const x = v[i * 3], y = v[i * 3 + 1];
        if (Math.abs(x - half * 0.96) < 0.015 && y > lm.bust && (tip < 0 || y > v[tip * 3 + 1])) tip = i;
        if (Math.abs(x) < 0.02 && y > 0.8 * lm.height && y < 0.86 * lm.height
          && (nape < 0 || v[i * 3 + 2] * FRONT < v[nape * 3 + 2] * FRONT)) nape = i;
      }
      if (tip < 0) return null;
      const t: Vec3 = [v[tip * 3], v[tip * 3 + 1] + 0.006, v[tip * 3 + 2] - 0.02 * FRONT];
      const mid: Vec3 = nape < 0 ? [0, t[1] + 0.03, t[2]] : [0, v[nape * 3 + 1], v[nape * 3 + 2] - 0.008 * FRONT];
      return line([[-t[0], t[1], t[2]], mid, t]);
    }
    case 'inseam': {
      const z = 0.02 * FRONT;
      return line([[0, 0, z], [0, lm.crotch, z]]);
    }
    default: return null;
  }
}

/** Signo de Z hacia el que mira el maniquí (el modelo mira a −Z). */
const FRONT = -1;
