import { Ionicons } from '@expo/vector-icons';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName } from '../../components/ui';
import { color, family, TAB_BAR_HEIGHT } from '../../lib/theme';

const TABS: Record<string, { label: string; icon: IconName; iconOn: IconName }> = {
  index: { label: 'Inicio', icon: 'body-outline', iconOn: 'body' },
  probar: { label: 'Probar', icon: 'shirt-outline', iconOn: 'shirt' },
  armario: { label: 'Armario', icon: 'file-tray-stacked-outline', iconOn: 'file-tray-stacked' },
  perfil: { label: 'Perfil', icon: 'options-outline', iconOn: 'options' },
};

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
      <View style={styles.inner} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const on = state.index === i;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tab.label}
              onPress={() => navigateToTab(route.key)}
              style={styles.item}
            >
              <View style={[styles.pill, on && styles.pillOn]}>
                <Ionicons name={on ? tab.iconOn : tab.icon} size={21} color={on ? color.tape : color.muted} />
              </View>
              <Text style={[styles.label, on && styles.labelOn]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="probar" />
      <Tabs.Screen name="armario" />
      <Tabs.Screen name="perfil" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color.surface,
    borderTopWidth: 1, borderTopColor: color.line, alignItems: 'center',
  },
  inner: { flexDirection: 'row', width: '100%', maxWidth: 560, height: TAB_BAR_HEIGHT },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  pill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: color.indigo },
  label: { fontSize: 11, fontFamily: family.medium, color: color.muted },
  labelOn: { color: color.indigo, fontFamily: family.heading },
});
