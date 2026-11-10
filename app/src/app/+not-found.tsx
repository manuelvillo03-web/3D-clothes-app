import { Redirect } from 'expo-router';

/**
 * Cualquier ruta desconocida vuelve al inicio. También es lo que hace que la
 * versión web funcione servida desde una subcarpeta o un archivo suelto.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
