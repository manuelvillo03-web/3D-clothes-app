import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CatalogProvider } from '../lib/catalog';
import { ProfileProvider } from '../lib/profile';
import { color } from '../lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ProfileProvider>
        <CatalogProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: color.bg },
              headerShadowVisible: false,
              headerTintColor: color.ink,
              headerTitleStyle: { fontWeight: '700' },
              headerBackTitle: 'Atrás',
              contentStyle: { backgroundColor: color.bg },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Probador' }} />
            <Stack.Screen name="medidas" options={{ title: 'Mis medidas' }} />
            <Stack.Screen name="catalogo" options={{ title: 'Probar una prenda' }} />
            <Stack.Screen name="prenda/[id]" options={{ title: 'Prenda' }} />
            <Stack.Screen name="nueva-prenda" options={{ title: 'Añadir una prenda' }} />
            <Stack.Screen name="armario" options={{ title: 'Mi armario' }} />
            <Stack.Screen name="privacidad" options={{ title: 'Privacidad' }} />
          </Stack>
        </CatalogProvider>
      </ProfileProvider>
    </SafeAreaProvider>
  );
}
