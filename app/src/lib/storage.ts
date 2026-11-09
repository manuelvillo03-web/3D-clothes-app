/**
 * Datos del usuario guardados SOLO en el dispositivo.
 *
 * Medidas, armario y prendas propias no salen del móvil. Cada lectura y
 * escritura va protegida: si el almacenamiento falla (modo privado, sin
 * espacio), la app sigue funcionando con lo que tenga en memoria.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  profile: 'probador.profile.v1',
  wardrobe: 'probador.wardrobe.v1',
  garments: 'probador.garments.v1',
  history: 'probador.history.v1',
} as const;

export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function save<T>(key: string, value: T): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Borra todo lo que la app guarda (botón «Borrar mis datos»). */
export async function wipeAll(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  } catch {
    // Nada más que hacer: el almacenamiento no está disponible.
  }
}
