/** Formato de cara al usuario (el motor usa punto decimal para ser idéntico al de Python). */

/** Coma decimal, como se escribe en español. */
export const es = (text: string): string => text.replace(/(\d)\.(\d)/g, '$1,$2');

/** Nombre de la prenda sin la coletilla que llevan las guías generales de marca. */
export const shortName = (name: string): string => name.replace(/\s*\(gu[ií]a de tallas\)\s*$/i, '');
