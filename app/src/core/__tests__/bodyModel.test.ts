/**
 * El maniquí del móvil calcula lo mismo que numpy al generarlo.
 * Casos y binario: `python engine/scripts/build_mobile_model.py build ...`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildVertices, parseBodyModel, predictBody, type Sex } from '../bodyModel';

const root = join(__dirname, '../../..');
const bin = readFileSync(join(root, 'assets/models/body-model.bin'));
const model = parseBodyModel(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const cases: {
  sex: Sex;
  given: Record<string, number>;
  expected_measurements: Record<string, number>;
  expected_sd: Record<string, number>;
  expected_coefficients: number[];
}[] = JSON.parse(readFileSync(join(__dirname, '../__fixtures__/body-model-cases.json'), 'utf8'));

describe('modelo del cuerpo en el móvil', () => {
  it('lee el binario', () => {
    expect(model.vertexCount).toBeGreaterThan(0);
    expect(model.meanVertices.length).toBe(3 * model.vertexCount);
    expect(model.components.length).toBe(3 * model.vertexCount * model.componentCount);
    expect(model.vertexPart.length).toBe(model.vertexCount);
    expect(model.faces.length % 3).toBe(0);
    expect(Math.max(...model.faces)).toBeLessThan(model.vertexCount);
    const n = model.keys.length + model.componentCount;
    expect(model.sexes.male.cov.length).toBe(n * n);
    expect(model.sexes.female.mean.length).toBe(n);
  });

  it.each(cases.map((c, i) => [i, c] as const))('condiciona igual que numpy (caso %i)', (_, c) => {
    const p = predictBody(model, c.sex, c.given);
    for (const [key, value] of Object.entries(c.expected_measurements)) {
      if (key in c.given) expect(p.measurements[key]).toBe(c.given[key]);
      else expect(p.measurements[key]).toBeCloseTo(value, 0);
      expect(p.uncertainty[key]).toBeCloseTo(c.expected_sd[key], 0);
    }
    c.expected_coefficients.forEach((v, k) => {
      expect(p.coefficients[k]).toBeCloseTo(v, 4);
    });
  });

  it('las medidas dadas no se tocan y sin medidas sale el cuerpo medio', () => {
    const p = predictBody(model, 'female', { height: 170, weight: 62, chest: 90 });
    expect(p.measurements.height).toBe(170);
    expect(p.measurements.chest).toBe(90);
    expect(p.uncertainty.chest).toBe(0);
    const avg = predictBody(model, 'male', {});
    Array.from(avg.coefficients).forEach((c, k) => {
      expect(c).toBeCloseTo(model.sexes.male.mean[model.keys.length + k], 9);
    });
  });

  it('reconstruye los vértices con los coeficientes', () => {
    const zero = buildVertices(model, new Float64Array(model.componentCount));
    expect(Array.from(zero.slice(0, 6))).toEqual(Array.from(model.meanVertices.slice(0, 6)));
    const c = new Float64Array(model.componentCount);
    c[0] = 1;
    const one = buildVertices(model, c);
    const n = model.meanVertices.length;
    expect(one[5]).toBeCloseTo(model.meanVertices[5] + model.components[5], 6);
    expect(one.length).toBe(n);
  });
});
