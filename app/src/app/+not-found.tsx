import { router } from 'expo-router';
import { Button, EmptyState, Screen } from '../components/ui';

export default function NotFound() {
  return (
    <Screen>
      <EmptyState
        icon="help-buoy-outline"
        title="Esta pantalla no existe"
        body="Puede que el enlace esté mal o que la prenda ya no esté en el catálogo."
        action={<Button label="Ir al inicio" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
