/**
 * Paridad con el motor de Python: mismos cientos de casos, mismo resultado.
 * Los casos se regeneran con `python engine/scripts/export_golden.py`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '../ease';
import { compareWithReference, fitGarment, type FitResult, type ReferenceGarment } from '../fit';
import { parseGarment } from '../garments';
import type { Preference } from '../ease';

interface Golden {
  engine_version: string;
  fit: { garment: unknown; body: Record<string, number>; preference: Preference; expected: FitResult }[];
  reference: { garment: unknown; reference: ReferenceGarment; expected: FitResult }[];
}

const golden: Golden = JSON.parse(readFileSync(join(__dirname, '../__fixtures__/golden.json'), 'utf8'));

function expectSame(actual: FitResult, expected: FitResult) {
  expect(actual.recommended).toBe(expected.recommended);
  expect(actual.alternative).toBe(expected.alternative);
  expect(actual.confidence).toBe(expected.confidence);
  expect(actual.method).toBe(expected.method);
  expect(actual.explanation).toEqual(expected.explanation);
  expect(actual.warnings).toEqual(expected.warnings);
  expect(actual.sizes.length).toBe(expected.sizes.length);
  actual.sizes.forEach((size, i) => {
    const exp = expected.sizes[i];
    expect(size.label).toBe(exp.label);
    expect(size.score).toBeCloseTo(exp.score, 9);
    expect(size.wearable).toBe(exp.wearable);
    expect(size.zones.map((z) => [z.zone, z.status, z.status_text])).toEqual(
      exp.zones.map((z) => [z.zone, z.status, z.status_text]),
    );
    size.zones.forEach((z, j) => {
      const e = exp.zones[j];
      for (const key of ['garment_cm', 'body_cm', 'ease_cm'] as const) {
        if (e[key] === null) expect(z[key]).toBeNull();
        else expect(z[key]).toBeCloseTo(e[key] as number, 9);
      }
      expect(z.ideal).toEqual(e.ideal);
    });
  });
}

describe('paridad con el motor de Python', () => {
  it('usa la misma versión de calibración', () => {
    expect(golden.engine_version).toBe(ENGINE_VERSION);
  });

  it(`recomienda igual en ${golden.fit.length} casos de ajuste`, () => {
    for (const c of golden.fit) {
      expectSame(fitGarment(parseGarment(c.garment), c.body, c.preference), c.expected);
    }
  });

  it(`compara igual con prenda propia en ${golden.reference.length} casos`, () => {
    for (const c of golden.reference) {
      expectSame(compareWithReference(parseGarment(c.garment), c.reference), c.expected);
    }
  });
});
