/**
 * Redondeo y formato idénticos a los de Python.
 *
 * El motor de Python es la referencia y los tests de paridad comparan los
 * textos carácter a carácter, así que hace falta redondear igual: Python
 * redondea el valor binario exacto y, en un empate exacto (2,25 → 2,2),
 * elige el par. `toFixed` de JavaScript elige el mayor (2,3).
 */

function isExactTie(abs: number, digits: number): boolean {
  // Desarrollo decimal exacto (toFixed con 100 decimales no redondea a
  // ningún valor habitual de este motor).
  const s = abs.toFixed(100);
  const dot = s.indexOf('.');
  const rest = s.slice(dot + 1 + digits);
  return /^50*$/.test(rest);
}

/** `round(x, digits)` de Python. */
export function pyRound(x: number, digits = 0): number {
  if (!Number.isFinite(x)) return x;
  const abs = Math.abs(x);
  let r: number;
  if (isExactTie(abs, digits)) {
    const scale = 10 ** digits;
    const floor = Math.floor(abs * scale);
    r = (floor % 2 === 0 ? floor : floor + 1) / scale;
  } else {
    r = Number(abs.toFixed(digits));
  }
  return x < 0 || Object.is(x, -0) ? -r : r;
}

/** `f"{x:.Nf}"` (o `f"{x:+.Nf}"` con `plus`) de Python. */
export function fmtFixed(x: number, digits: number, plus = false): string {
  const negative = x < 0 || Object.is(x, -0);
  const r = Math.abs(pyRound(x, digits));
  const body = r.toFixed(digits);
  if (negative) return `-${body}`;
  return plus ? `+${body}` : body;
}
