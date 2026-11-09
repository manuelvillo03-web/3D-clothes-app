/**
 * Configuración pública de la app.
 *
 * La clave de Supabase es la «publishable»: está pensada para ir dentro de
 * la app y solo permite lo que dejan las políticas de seguridad por fila
 * (leer el catálogo publicado y enviar prendas para revisión). Se puede
 * sustituir con EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_KEY.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://lpymattuqngwsrlrnlmz.supabase.co';
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_N0MsCGMkj2WM5YT-jEYSmQ_FIw9wRSL';
