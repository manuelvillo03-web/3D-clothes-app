/**
 * Sistema de diseño de Probador.
 *
 * La identidad sale del taller de costura: el añil del vaquero como color de
 * marca (y del «probador» donde vive el maniquí) y el amarillo de la cinta
 * métrica como único acento. Los números (tallas, centímetros) van en una
 * condensada, como en las etiquetas de la ropa y en la propia cinta.
 */
import { Platform } from 'react-native';
import type { Status } from '../core/fit';

export const color = {
  bg: '#F1F2F6',
  surface: '#FFFFFF',
  surfaceAlt: '#E7E9F1',
  ink: '#171A33',
  muted: '#5C6080',
  faint: '#9A9DB5',
  line: '#DCDFEA',
  indigo: '#1D2257',
  indigoDeep: '#14183F',
  indigoSoft: '#E3E5F6',
  onIndigo: '#FFFFFF',
  onIndigoMuted: '#B9BDE0',
  tape: '#FFD43A',
  tapeDeep: '#E2B100',
  tapeInk: '#1D2257',
  danger: '#D7373F',
  dangerSoft: '#FBE4E5',
  mannequin: '#D9DCE8',
  // Compatibilidad con componentes anteriores.
  accent: '#1D2257',
  accentInk: '#FFFFFF',
  accentSoft: '#E3E5F6',
  stage: '#1D2257',
  skin: '#D9DCE8',
} as const;

/** Colores del estado de ajuste de cada zona (también en el maniquí). */
export const statusColor: Record<Status, string> = {
  tight: '#F0505A',
  snug: '#F59A2F',
  good: '#2DB37A',
  loose: '#4C9BEF',
  very_loose: '#9B7BF0',
};

export const statusLabel: Record<Status, string> = {
  tight: 'Aprieta',
  snug: 'Justo',
  good: 'Bien',
  loose: 'Holgado',
  very_loose: 'Muy holgado',
};

export const family = {
  display: 'BricolageGrotesque_800ExtraBold',
  heading: 'BricolageGrotesque_700Bold',
  semibold: 'BricolageGrotesque_600SemiBold',
  medium: 'BricolageGrotesque_500Medium',
  body: 'BricolageGrotesque_400Regular',
  num: 'BarlowCondensed_600SemiBold',
  numBold: 'BarlowCondensed_700Bold',
  numMedium: 'BarlowCondensed_500Medium',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const font = {
  display: 36,
  title: 28,
  h2: 21,
  h3: 17,
  body: 15,
  small: 13,
  tiny: 11,
} as const;

/** Altura de la barra de pestañas (sin el margen seguro inferior). */
export const TAB_BAR_HEIGHT = 64;

/** En la web, el campo con foco ya se marca con su borde: fuera el aro del navegador. */
export const noOutline: object = Platform.OS === 'web' ? { outlineStyle: 'none' } : {};
