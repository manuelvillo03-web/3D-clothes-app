/**
 * Maniquí en el propio móvil, sin servidor.
 *
 * `engine/scripts/build_mobile_model.py` genera miles de cuerpos con el motor
 * de Python (Anny + clad-body), los mide con la norma ISO 8559-1 y resume:
 *
 * 1. La forma: malla media + K componentes principales (PCA). Un cuerpo es
 *    `media + Σ c_k · componente_k`.
 * 2. La relación medidas ↔ forma: una gaussiana conjunta, por base de cuerpo,
 *    sobre [medidas, alturas de referencia, coeficientes c]. Dadas las medidas
 *    que el usuario conoce, la media condicionada da a la vez la forma del
 *    maniquí y una estimación de las medidas que no ha dado (con su error
 *    típico):
 *
 *        x_u | x_o  ~  N( μ_u + Σ_uo (Σ_oo + R)⁻¹ (x_o − μ_o),
 *                         Σ_uu − Σ_uo (Σ_oo + R)⁻¹ Σ_ou )
 *
 *    R es la varianza del error al medirse uno mismo con cinta.
 *
 * Las medidas que da el usuario se usan tal cual para recomendar talla; el
 * maniquí es la forma más probable con esas medidas.
 */

import type { Body } from './measurements';

export type Sex = 'female' | 'male';

/**
 * Parte del cuerpo de cada vértice (`vertexPart`), la misma que devuelve
 * `BodyModel.vertex_parts()` del motor: el tronco incluye cabeza y cuello,
 * los brazos incluyen las manos y las piernas los pies.
 */
export const PART = { torso: 1, arm: 2, leg: 3 } as const;

export interface SexModel {
  mean: Float64Array; // M + K
  cov: Float64Array; // (M + K)²
}

export interface BodyModelData {
  version: string;
  vertexCount: number;
  faces: Uint32Array;
  meanVertices: Float32Array; // 3V, metros, Y arriba, frente hacia +Z
  components: Float32Array; // K × 3V
  componentCount: number;
  /** Claves de la parte «medidas» de la gaussiana (cm o kg; alturas en cm). */
  keys: string[];
  /** Desviación típica del error al medirse (misma unidad que la medida). */
  noise: Record<string, number>;
  vertexPart: Uint8Array;
  sexes: Record<Sex, SexModel>;
  /** Precisión comprobada al generar el modelo (informativa). */
  validation?: Record<string, unknown>;
}

export interface BodyPrediction {
  sex: Sex;
  /** Medidas dadas (tal cual) + estimadas para las que faltan. */
  measurements: Body;
  /** Error típico de cada medida estimada (0 en las dadas). */
  uncertainty: Record<string, number>;
  provided: string[];
  coefficients: Float64Array;
}

// ------------------------------------------------------------- formato

const MAGIC = 'PRBM';

interface Section {
  offset: number;
  length: number;
  dtype: 'f32' | 'f64' | 'i16' | 'u8' | 'u16' | 'u32';
}

interface Header {
  version: string;
  vertex_count: number;
  component_count: number;
  keys: string[];
  noise: Record<string, number>;
  component_scale: number[];
  sections: Record<string, Section>;
  validation?: Record<string, unknown>;
}

function view(buf: ArrayBuffer, s: Section) {
  switch (s.dtype) {
    case 'f32': return new Float32Array(buf, s.offset, s.length);
    case 'f64': return new Float64Array(buf, s.offset, s.length);
    case 'i16': return new Int16Array(buf, s.offset, s.length);
    case 'u8': return new Uint8Array(buf, s.offset, s.length);
    case 'u16': return new Uint16Array(buf, s.offset, s.length);
    case 'u32': return new Uint32Array(buf, s.offset, s.length);
  }
}

function utf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(s));
}

/** Lee el binario que escribe `build_mobile_model.py`. */
export function parseBodyModel(buf: ArrayBuffer): BodyModelData {
  const head = new Uint8Array(buf, 0, 12);
  const magic = String.fromCharCode(head[0], head[1], head[2], head[3]);
  if (magic !== MAGIC) throw new Error('El archivo del maniquí no es válido');
  const dv = new DataView(buf);
  const headerLen = dv.getUint32(8, true);
  const header: Header = JSON.parse(utf8(new Uint8Array(buf, 12, headerLen)));
  const sec = (name: string) => {
    const s = header.sections[name];
    if (!s) throw new Error(`Falta la sección ${name} en el maniquí`);
    return view(buf, s);
  };

  const V = header.vertex_count;
  const K = header.component_count;
  const q = sec('components') as Int16Array;
  const components = new Float32Array(K * 3 * V);
  for (let k = 0; k < K; k++) {
    const scale = header.component_scale[k];
    const base = k * 3 * V;
    for (let i = 0; i < 3 * V; i++) components[base + i] = q[base + i] * scale;
  }
  const facesRaw = sec('faces');
  return {
    version: header.version,
    vertexCount: V,
    faces: facesRaw instanceof Uint32Array ? facesRaw : Uint32Array.from(facesRaw as Uint16Array),
    meanVertices: Float32Array.from(sec('mean_vertices') as Float32Array),
    components,
    componentCount: K,
    keys: header.keys,
    noise: header.noise,
    vertexPart: Uint8Array.from(sec('vertex_part') as Uint8Array),
    sexes: {
      female: { mean: Float64Array.from(sec('female_mean')), cov: Float64Array.from(sec('female_cov')) },
      male: { mean: Float64Array.from(sec('male_mean')), cov: Float64Array.from(sec('male_cov')) },
    },
    validation: header.validation,
  };
}

// ------------------------------------------------------------- álgebra

/** Cholesky en sitio de una matriz simétrica definida positiva n×n. */
function cholesky(a: Float64Array, n: number): Float64Array {
  const l = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = a[i * n + j];
      for (let k = 0; k < j; k++) s -= l[i * n + k] * l[j * n + k];
      if (i === j) {
        if (s <= 0) throw new Error('Matriz no definida positiva');
        l[i * n + i] = Math.sqrt(s);
      } else {
        l[i * n + j] = s / l[j * n + j];
      }
    }
  }
  return l;
}

/** Resuelve (L Lᵀ) x = b. */
function cholSolve(l: Float64Array, n: number, b: Float64Array): Float64Array {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= l[i * n + k] * y[k];
    y[i] = s / l[i * n + i];
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < n; k++) s -= l[k * n + i] * x[k];
    x[i] = s / l[i * n + i];
  }
  return x;
}

// ------------------------------------------------------------- predicción

/**
 * Forma más probable y medidas estimadas a partir de las medidas conocidas.
 * Las claves que el modelo no conoce se ignoran (no condicionan la forma).
 */
export function predictBody(model: BodyModelData, sex: Sex, given: Body): BodyPrediction {
  const { mean, cov } = model.sexes[sex];
  const M = model.keys.length;
  const N = M + model.componentCount;
  const obs: number[] = [];
  for (let i = 0; i < M; i++) if (given[model.keys[i]] !== undefined) obs.push(i);
  const unobs: number[] = [];
  for (let i = 0; i < N; i++) if (!obs.includes(i)) unobs.push(i);

  const no = obs.length;
  const cond = new Float64Array(N);
  const variance = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    cond[i] = mean[i];
    variance[i] = cov[i * N + i];
  }
  if (no > 0) {
    // (Σ_oo + R) y = x_o − μ_o
    const soo = new Float64Array(no * no);
    for (let a = 0; a < no; a++) {
      for (let b = 0; b < no; b++) soo[a * no + b] = cov[obs[a] * N + obs[b]];
      const sd = model.noise[model.keys[obs[a]]] ?? 0.5;
      soo[a * no + a] += sd * sd;
    }
    const l = cholesky(soo, no);
    const diff = new Float64Array(no);
    for (let a = 0; a < no; a++) diff[a] = given[model.keys[obs[a]]] - mean[obs[a]];
    const y = cholSolve(l, no, diff);
    for (const u of unobs) {
      let s = 0;
      for (let a = 0; a < no; a++) s += cov[u * N + obs[a]] * y[a];
      cond[u] = mean[u] + s;
    }
    // Varianza condicionada de las medidas no dadas (solo la diagonal).
    for (const u of unobs) {
      if (u >= M) continue;
      const col = new Float64Array(no);
      for (let a = 0; a < no; a++) col[a] = cov[obs[a] * N + u];
      const z = cholSolve(l, no, col);
      let s = 0;
      for (let a = 0; a < no; a++) s += col[a] * z[a];
      variance[u] = Math.max(cov[u * N + u] - s, 0);
    }
    // Las medidas dadas se quedan tal cual.
    for (const o of obs) {
      cond[o] = given[model.keys[o]];
      variance[o] = 0;
    }
  }

  const measurements: Body = {};
  const uncertainty: Record<string, number> = {};
  for (let i = 0; i < M; i++) {
    measurements[model.keys[i]] = Math.round(cond[i] * 10) / 10;
    uncertainty[model.keys[i]] = Math.round(Math.sqrt(variance[i]) * 10) / 10;
  }
  // Las medidas dadas que el modelo no conoce también se conservan.
  for (const [k, v] of Object.entries(given)) measurements[k] = v;
  return {
    sex,
    measurements,
    uncertainty,
    provided: Object.keys(given),
    coefficients: cond.slice(M),
  };
}

/** Vértices del maniquí (3V, metros, Y arriba) para unos coeficientes. */
export function buildVertices(model: BodyModelData, coefficients: ArrayLike<number>): Float32Array {
  const n = model.meanVertices.length;
  const out = Float32Array.from(model.meanVertices);
  for (let k = 0; k < model.componentCount; k++) {
    const c = coefficients[k];
    if (!c) continue;
    const base = k * n;
    const comp = model.components;
    for (let i = 0; i < n; i++) out[i] += c * comp[base + i];
  }
  return out;
}
