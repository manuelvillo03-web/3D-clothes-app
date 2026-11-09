/**
 * Catálogo de medidas del cuerpo.
 *
 * Copia fiel de `engine/src/probador/measurements.py`: las claves, rangos,
 * tolerancias e instrucciones tienen que coincidir con el motor de Python
 * (los tests de paridad lo comprueban con `golden.json`).
 */

export type Unit = 'cm' | 'kg';
export type Kind = 'length' | 'circumference' | 'scalar';

export interface BodyMeasurement {
  key: string;
  name: string;
  unit: Unit;
  kind: Kind;
  min: number;
  max: number;
  /** Desviación aceptable entre el maniquí y la medida del usuario. */
  tolerance: number;
  /** Se pide en el formulario básico; las demás son opcionales. */
  basic: boolean;
  howTo: string;
}

export const MEASUREMENTS: readonly BodyMeasurement[] = [
  {
    key: 'height', name: 'Altura', unit: 'cm', kind: 'scalar', min: 140, max: 210,
    tolerance: 0.5, basic: true,
    howTo: 'Descalzo, de espaldas a una pared, con los talones juntos. Mide desde el suelo hasta lo más alto de la cabeza.',
  },
  {
    key: 'weight', name: 'Peso', unit: 'kg', kind: 'scalar', min: 40, max: 160,
    tolerance: 3.0, basic: true,
    howTo: 'Por la mañana, con ropa ligera.',
  },
  {
    key: 'chest', name: 'Pecho', unit: 'cm', kind: 'circumference', min: 70, max: 150,
    tolerance: 0.5, basic: true,
    howTo: 'Pasa la cinta por debajo de las axilas y por la parte más ancha del pecho, horizontal y sin apretar. Respira con normalidad.',
  },
  {
    key: 'waist', name: 'Cintura', unit: 'cm', kind: 'circumference', min: 55, max: 150,
    tolerance: 0.5, basic: true,
    howTo: 'A la altura del ombligo, entre la última costilla y el hueso de la cadera. Cinta horizontal, sin meter tripa.',
  },
  {
    key: 'hip', name: 'Cadera', unit: 'cm', kind: 'circumference', min: 70, max: 160,
    tolerance: 0.5, basic: true,
    howTo: 'Con los pies juntos, por la parte más ancha de los glúteos, con la cinta horizontal.',
  },
  {
    key: 'inseam', name: 'Entrepierna', unit: 'cm', kind: 'length', min: 60, max: 100,
    tolerance: 0.5, basic: true,
    howTo: 'Descalzo y de pie, desde la entrepierna hasta el suelo, por la cara interior de la pierna. Más fácil con ayuda o con un libro apretado contra la entrepierna.',
  },
  {
    key: 'shoulder_width', name: 'Ancho de hombros', unit: 'cm', kind: 'length', min: 30, max: 55,
    tolerance: 1.5, basic: false,
    howTo: 'Por la espalda, de la punta de un hombro a la del otro, pasando por la base del cuello. Mejor con ayuda.',
  },
  {
    key: 'sleeve_length', name: 'Largo de brazo', unit: 'cm', kind: 'length', min: 45, max: 75,
    tolerance: 1.0, basic: false,
    howTo: 'Con el brazo un poco doblado, desde la punta del hombro, por fuera del codo, hasta el hueso de la muñeca.',
  },
  {
    key: 'neck', name: 'Cuello', unit: 'cm', kind: 'circumference', min: 28, max: 52,
    tolerance: 0.5, basic: false,
    howTo: 'Justo por debajo de la nuez, sin apretar. Útil para camisas.',
  },
  {
    key: 'upper_arm', name: 'Brazo', unit: 'cm', kind: 'circumference', min: 20, max: 52,
    tolerance: 0.8, basic: false,
    howTo: 'Por la parte más gruesa del brazo, a medio camino entre el hombro y el codo, con el brazo relajado.',
  },
  {
    key: 'thigh', name: 'Muslo', unit: 'cm', kind: 'circumference', min: 38, max: 85,
    tolerance: 0.5, basic: false,
    howTo: 'Por la parte más gruesa del muslo, justo debajo del glúteo, con las piernas un poco separadas.',
  },
  {
    key: 'underbust', name: 'Bajo pecho', unit: 'cm', kind: 'circumference', min: 58, max: 135,
    tolerance: 0.5, basic: false,
    howTo: 'Justo por debajo del pecho, donde va la banda del sujetador.',
  },
  {
    key: 'stomach', name: 'Barriga', unit: 'cm', kind: 'circumference', min: 60, max: 165,
    tolerance: 1.5, basic: false,
    howTo: 'Por el punto que más sobresale de la barriga, normalmente a la altura del ombligo o un poco por debajo.',
  },
  {
    key: 'knee', name: 'Rodilla', unit: 'cm', kind: 'circumference', min: 28, max: 52,
    tolerance: 0.8, basic: false,
    howTo: 'Por el centro de la rótula, con la rodilla ligeramente doblada.',
  },
  {
    key: 'calf', name: 'Gemelo', unit: 'cm', kind: 'circumference', min: 26, max: 55,
    tolerance: 0.8, basic: false,
    howTo: 'Por la parte más ancha del gemelo.',
  },
];

export const BY_KEY: Readonly<Record<string, BodyMeasurement>> = Object.fromEntries(
  MEASUREMENTS.map((m) => [m.key, m]),
);

/**
 * Medidas que el maniquí estima aunque el usuario no las dé y que el motor
 * de ajuste usa para prendas (tiro, largo de torso, cinturilla...).
 */
export const DERIVED_KEYS = [
  'front_rise', 'back_rise', 'crotch_length', 'torso_length', 'back_neck_to_waist',
  'waistband_high', 'waistband_mid', 'waistband_low',
] as const;

export const DERIVED_NAMES: Readonly<Record<string, string>> = {
  front_rise: 'Tiro delantero',
  back_rise: 'Tiro trasero',
  crotch_length: 'Tiro completo',
  torso_length: 'Largo de torso',
  back_neck_to_waist: 'Talle de espalda',
  waistband_high: 'Contorno a tiro alto',
  waistband_mid: 'Contorno a tiro medio',
  waistband_low: 'Contorno a tiro bajo',
};

export const REQUIRED_KEYS = ['height', 'weight'] as const;

export type Body = Record<string, number>;

export class MeasurementError extends Error {}

/**
 * Comprueba las medidas del usuario. Lanza `MeasurementError` si falta algo
 * imprescindible o hay claves desconocidas; devuelve avisos en español para
 * valores fuera de lo habitual (no impiden calcular).
 */
export function validateMeasurements(measurements: Body): string[] {
  const unknown = Object.keys(measurements).filter((k) => !(k in BY_KEY)).sort();
  if (unknown.length) throw new MeasurementError(`Medidas desconocidas: ${unknown.join(', ')}`);
  const missing = REQUIRED_KEYS.filter((k) => !(k in measurements));
  if (missing.length) {
    const names = missing.map((k) => BY_KEY[k].name.toLowerCase()).join(', ');
    throw new MeasurementError(`Faltan medidas imprescindibles: ${names}`);
  }

  const warnings: string[] = [];
  for (const [key, value] of Object.entries(measurements)) {
    const spec = BY_KEY[key];
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new MeasurementError(`${spec.name}: el valor no es un número`);
    }
    if (value <= 0) throw new MeasurementError(`${spec.name}: el valor tiene que ser positivo`);
    if (value < spec.min || value > spec.max) {
      warnings.push(
        `${spec.name}: ${fmtG(value)} ${spec.unit} es poco habitual ` +
          `(lo normal está entre ${fmtG(spec.min)} y ${fmtG(spec.max)} ${spec.unit}). ` +
          'Revisa que esté bien medida.',
      );
    }
  }

  const m = measurements;
  if (m.waist !== undefined && m.hip !== undefined && m.waist > m.hip * 1.35) {
    warnings.push(
      'La cintura es mucho mayor que la cadera. Comprueba que la cadera está medida por la parte más ancha de los glúteos.',
    );
  }
  if (m.inseam !== undefined && m.inseam > m.height * 0.56) {
    warnings.push(
      'La entrepierna parece demasiado larga para tu altura. Mídela desde la entrepierna hasta el suelo, no desde la cintura.',
    );
  }
  if (m.underbust !== undefined && m.chest !== undefined && m.underbust > m.chest) {
    warnings.push('El bajo pecho no puede ser mayor que el pecho. Revisa ambas medidas.');
  }
  return warnings;
}

/** Igual que el formato `:g` de Python para valores habituales (sin ceros sobrantes). */
export function fmtG(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toPrecision(6)));
}
