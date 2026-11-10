import {
  BarlowCondensed_500Medium, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import {
  BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CatalogProvider } from '../lib/catalog';
import { ProfileProvider } from '../lib/profile';
import { color } from '../lib/theme';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
    BarlowCondensed_500Medium, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold,
    ...Ionicons.font,
  });
  // Si una tipografía no carga, la app sigue con la del sistema.
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: color.indigo }} />;
  return (
    <SafeAreaProvider>
      <ProfileProvider>
        <CatalogProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="bienvenida" options={{ animation: 'fade' }} />
            <Stack.Screen name="medidas" />
            <Stack.Screen name="prenda/[id]" />
            <Stack.Screen name="nueva-prenda" />
            <Stack.Screen name="privacidad" />
          </Stack>
        </CatalogProvider>
      </ProfileProvider>
    </SafeAreaProvider>
  );
}
