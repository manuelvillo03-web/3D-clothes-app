import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { markerFor } from '../bodyMarkers';
import { buildVertices, parseBodyModel, predictBody, type Sex } from '../bodyModel';

const buf = readFileSync(resolve(__dirname, '../../../assets/models/body-model.bin'));
const model = parseBodyModel(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);

const PEOPLE: [Sex, Record<string, number>][] = [
  ['female', { height: 164, weight: 60 }],
  ['female', { height: 172, weight: 82, chest: 108, waist: 92, hip: 114 }],
  ['male', { height: 178, weight: 76 }],
  ['male', { height: 190, weight: 104, chest: 116, waist: 106 }],
];

describe('marcas de medida sobre el maniquí', () => {
  for (const [sex, given] of PEOPLE) {
    const p = predictBody(model, sex, given);
    const v = buildVertices(model, p.coefficients);
    const label = `${sex} ${given.height} cm, ${given.weight} kg`;

    it(`la cinta mide lo mismo que el maniquí en los contornos (${label})`, () => {
      const report: Record<string, string> = {};
      for (const [key, tol] of [['chest', 0.03], ['waist', 0.03], ['hip', 0.03], ['thigh', 0.04], ['neck', 0.08], ['upper_arm', 0.08], ['knee', 0.06], ['calf', 0.08], ['underbust', 0.08], ['stomach', 0.08]] as const) {
        const m = markerFor(model, v, p.measurements, key);
        expect(m, key).not.toBeNull();
        expect(m!.kind).toBe('ring');
        const cm = m!.length * 100;
        report[key] = `${cm.toFixed(1)} / ${p.measurements[key].toFixed(1)}`;
        expect(Math.abs(cm - p.measurements[key]) / p.measurements[key], `${key}: ${report[key]}`).toBeLessThan(tol);
      }
    });

    it(`los largos tienen la longitud de la medida (${label})`, () => {
      const inseam = markerFor(model, v, p.measurements, 'inseam')!;
      expect(inseam.length * 100).toBeCloseTo(p.measurements.inseam, 3);
      const sleeve = markerFor(model, v, p.measurements, 'sleeve_length')!;
      expect(sleeve.length * 100).toBeLessThanOrEqual(p.measurements.sleeve_length + 0.01);
      const shoulders = markerFor(model, v, p.measurements, 'shoulder_width')!;
      expect(Math.abs(shoulders.length * 100 - p.measurements.shoulder_width)).toBeLessThan(5);
    });
  }

  it('el peso y la altura no tienen marca', () => {
    const p = predictBody(model, 'female', { height: 165, weight: 60 });
    const v = buildVertices(model, p.coefficients);
    expect(markerFor(model, v, p.measurements, 'weight')).toBeNull();
    expect(markerFor(model, v, p.measurements, 'height')).toBeNull();
  });
});
