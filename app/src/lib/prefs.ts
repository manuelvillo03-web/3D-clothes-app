import type { Preference } from '../core/ease';

/** Cómo le gusta la ropa al usuario (desplaza todas las recomendaciones). */
export const PREFS: { value: Preference; label: string }[] = [
  { value: 'fitted', label: 'Ceñida' },
  { value: 'regular', label: 'Normal' },
  { value: 'loose', label: 'Holgada' },
];
