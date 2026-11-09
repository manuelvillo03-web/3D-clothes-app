import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalog from '../../data/catalog.json';
import { fitGarment } from '../fit';
import { parseGarment, type RawGarment } from '../garments';
import { parseValue, pointsFor } from '../../lib/points';

// Cuerpos típicos (medidas de una persona media, no de nadie en concreto).
const WOMAN = { height: 165, weight: 60, chest: 90, waist: 72, hip: 98, inseam: 76, thigh: 56, neck: 33 };
const MAN = { height: 178, weight: 77, chest: 99, waist: 85, hip: 99, inseam: 81, thigh: 56, neck: 39.5 };

describe('catálogo incluido en la app', () => {
  const raws = catalog as RawGarment[];

  it('coincide con data/catalog/marcas (ejecuta npm run catalog)', () => {
    for (const raw of raws) {
      const file = JSON.parse(readFileSync(join(__dirname, `../../../../data/catalog/marcas/${raw.id}.json`), 'utf8'));
      expect(raw).toEqual(file);
    }
  });

  it.each(raws.map((r) => [r.id, r] as const))('%s es válida, tiene fuente y recomienda talla', (_, raw) => {
    const g = parseGarment(raw);
    expect(g.source).toBeTruthy();
    expect(g.url).toMatch(/^https:\/\//);
    expect(g.audience).toBeDefined();
    const body = g.audience === 'men' ? MAN : WOMAN;
    const r = fitGarment(g, body, 'regular');
    expect(r.recommended).not.toBeNull();
    // Un cuerpo medio debe caer en una talla central, no en un extremo.
    const labels = g.sizes.map((s) => s.label);
    const pos = labels.indexOf(r.recommended!);
    expect(pos).toBeGreaterThan(0);
    expect(pos).toBeLessThan(labels.length - 1);
  });

  it('las tallas van en orden creciente', () => {
    for (const raw of raws) {
      const g = parseGarment(raw);
      const key = Object.keys(g.sizes[0].measurements)[0];
      const mid = (v: number | [number, number]) => (Array.isArray(v) ? (v[0] + v[1]) / 2 : v);
      const vals = g.sizes.map((s) => mid(s.measurements[key]));
      vals.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(vals[i]));
    }
  });
});

describe('formularios', () => {
  it('lee números, decimales con coma e intervalos', () => {
    expect(parseValue('96')).toBe(96);
    expect(parseValue('96,5')).toBe(96.5);
    expect(parseValue('96-101')).toEqual([96, 101]);
    expect(parseValue('101 – 96')).toEqual([96, 101]);
    expect(parseValue('')).toBeNull();
    expect(parseValue('abc')).toBeNull();
    expect(parseValue('96cm')).toBeNull();
  });

  it('pide los puntos que el motor sabe usar', () => {
    expect(pointsFor('jeans', 'garment')).toContain('inseam');
    expect(pointsFor('tshirt', 'garment')).toContain('chest');
    expect(pointsFor('skirt', 'garment')).not.toContain('thigh');
    expect(pointsFor('shirt', 'body')).toContain('neck');
  });
});
