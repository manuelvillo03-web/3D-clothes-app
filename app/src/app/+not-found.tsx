import { Redirect } from 'expo-router';

/** Cualquier ruta desconocida vuelve al inicio (también al abrir la web desde otra ruta). */
export default function NotFound() {
  return <Redirect href="/" />;
}
