import type { Status } from '../core/fit';

export const color = {
  bg: '#F6F2EC',
  surface: '#FFFFFF',
  surfaceAlt: '#EFE8DE',
  ink: '#1F1B16',
  muted: '#6B6259',
  faint: '#9A9087',
  line: '#E3DACE',
  accent: '#2F5D50',
  accentInk: '#FFFFFF',
  accentSoft: '#DCE8E3',
  danger: '#B3261E',
  skin: '#D9B99B',
  stage: '#ECE5DA',
} as const;

/** Colores del estado de ajuste de cada zona (también en el maniquí). */
export const statusColor: Record<Status, string> = {
  tight: '#D2463C',
  snug: '#E3A33B',
  good: '#3E9C6A',
  loose: '#4C86C6',
  very_loose: '#7C5CC4',
};

export const statusLabel: Record<Status, string> = {
  tight: 'Aprieta',
  snug: 'Justo',
  good: 'Bien',
  loose: 'Holgado',
  very_loose: 'Muy holgado',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const font = {
  title: 28,
  h2: 20,
  h3: 16,
  body: 15,
  small: 13,
  tiny: 11,
} as const;
