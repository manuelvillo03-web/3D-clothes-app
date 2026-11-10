import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildVertices, parseBodyModel, predictBody, PART } from '../bodyModel';
import { fitGarment } from '../fit';
import { parseGarment } from '../garments';
import { buildShell, landmarks, vertexNormals } from '../garmentShell';

const bin = readFileSync(join(__dirname, '../../../assets/models/body-model.bin'));
const model = parseBodyModel(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const given = { height: 178, weight: 77, chest: 99, waist: 85, hip: 99, inseam: 81 };
const pred = predictBody(model, 'male', given);
const vertices = buildVertices(model, pred.coefficients);

const tee = parseGarment({
  brand: 'Prueba', name: 'Camiseta', category: 'tshirt', cut: 'regular',
  sizes: [
    { label: 'S', measurements: { chest: 98, length: 68 } },
    { label: 'M', measurements: { chest: 106, length: 70 } },
    { label: 'L', measurements: { chest: 114, length: 72 } },
  ],
});
const jeans = parseGarment({
  brand: 'Prueba', name: 'Vaquero', category: 'jeans', cut: 'regular',
  sizes: [{ label: '32', measurements: { waist: 86, hip: 104, thigh: 60, inseam: 81 } }],
});

describe('prenda aproximada sobre el maniquí', () => {
  it('las normales son unitarias', () => {
    const n = vertexNormals(vertices, model.faces);
    for (let i = 0; i < 300; i += 3) expect(Math.hypot(n[i], n[i + 1], n[i + 2])).toBeCloseTo(1, 5);
  });

  it('la camiseta cubre el tronco, no baja de la cadera y se separa de la piel', () => {
    const fit = fitGarment(tee, pred.measurements);
    const size = fit.sizes.find((s) => s.label === 'M')!;
    const shell = buildShell(model, vertices, pred.measurements, tee, size);
    expect(shell.index.length).toBeGreaterThan(300);
    const used = new Set(shell.index);
    const hip = (pred.measurements.z_hip ?? 0.52 * pred.measurements.height) / 100;
    let low = 0;
    let moved = 0;
    for (const v of used) {
      if (shell.positions[v * 3 + 1] < hip - 0.09) low++;
      const d = Math.hypot(
        shell.positions[v * 3] - vertices[v * 3],
        shell.positions[v * 3 + 1] - vertices[v * 3 + 1],
        shell.positions[v * 3 + 2] - vertices[v * 3 + 2],
      );
      if (d > 0.003) moved++;
    }
    expect(low).toBe(0);
    expect(moved).toBe(used.size);
  });

  it('una talla más grande se separa más', () => {
    const fit = fitGarment(tee, pred.measurements);
    const gapOf = (label: string) => {
      const shell = buildShell(model, vertices, pred.measurements, tee, fit.sizes.find((s) => s.label === label)!);
      let sum = 0;
      const used = new Set(shell.index);
      for (const v of used) {
        sum += Math.hypot(shell.positions[v * 3] - vertices[v * 3], shell.positions[v * 3 + 2] - vertices[v * 3 + 2]);
      }
      return sum / used.size;
    };
    expect(gapOf('L')).toBeGreaterThan(gapOf('S'));
  });

  it('el vaquero cubre piernas por debajo de la cinturilla', () => {
    const fit = fitGarment(jeans, pred.measurements);
    const shell = buildShell(model, vertices, pred.measurements, jeans, fit.sizes[0]);
    const lm = landmarks(pred.measurements);
    const used = new Set(shell.index);
    let legs = 0;
    for (const v of used) {
      if (model.vertexPart[v] === PART.leg) legs++;
      expect(vertices[v * 3 + 1]).toBeLessThanOrEqual(lm.waist + 0.01);
    }
    expect(legs).toBeGreaterThan(0);
  });
});
