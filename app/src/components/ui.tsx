import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, space } from '../lib/theme';

export function Screen({ title, children, scroll = true }: { title?: string; children: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const content = <View style={styles.column}>{children}</View>;
  return (
    <View style={styles.screen}>
      {title !== undefined && <Stack.Screen options={{ title }} />}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: space.xxl + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, { flex: 1 }]}>{content}</View>
      )}
    </View>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1} accessibilityRole="header">{children}</Text>;
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h2, style]} accessibilityRole="header">{children}</Text>;
}

export function P({ children, muted, small, style }: {
  children: ReactNode; muted?: boolean; small?: boolean; style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[styles.p, muted && { color: color.muted }, small && { fontSize: font.small }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ label, onPress, kind = 'primary', disabled, busy, style }: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: { bg: color.accent, fg: color.accentInk, border: color.accent },
    secondary: { bg: color.surface, fg: color.ink, border: color.line },
    ghost: { bg: 'transparent', fg: color.accent, border: 'transparent' },
    danger: { bg: color.surface, fg: color.danger, border: color.danger },
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={palette.fg} /> : (
        <Text style={[styles.buttonText, { color: palette.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && { color: color.accentInk }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, style, wrap }: { children: ReactNode; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[styles.row, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: o.value === value }}
          onPress={() => onChange(o.value)}
          style={[styles.segment, o.value === value && styles.segmentOn]}
        >
          <Text style={[styles.segmentText, o.value === value && { color: color.ink, fontWeight: '700' }]}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function NumberField({ label, unit, value, onChange, hint, placeholder, estimated }: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  estimated?: boolean;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldTop}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.inputWrap}>
          <TextInput
            accessibilityLabel={`${label} en ${unit}`}
            value={value}
            onChangeText={(t) => onChange(t.replace(',', '.').replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder={placeholder}
            placeholderTextColor={estimated ? color.accent : color.faint}
            style={styles.input}
            maxLength={6}
          />
          <Text style={styles.unit}>{unit}</Text>
        </View>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function TextField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { marginBottom: space.xs }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.faint}
        style={[styles.input, styles.textInput]}
      />
    </View>
  );
}

export function Badge({ label, tint }: { label: string; tint: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${tint}22`, borderColor: `${tint}66` }]}>
      <Text style={[styles.badgeText, { color: tint }]}>{label}</Text>
    </View>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <View style={{ padding: space.xl, alignItems: 'center', gap: space.md }}>
      <ActivityIndicator color={color.accent} />
      <P muted>{label}</P>
    </View>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <View style={[styles.notice, tone === 'warn' && { backgroundColor: '#FBEFD9', borderColor: '#EBC889' }]}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  scroll: { padding: space.lg, alignItems: 'center' },
  column: { width: '100%', maxWidth: 680, gap: space.lg },
  h1: { fontSize: font.title, fontWeight: '800', color: color.ink, letterSpacing: -0.5 },
  h2: { fontSize: font.h2, fontWeight: '700', color: color.ink },
  p: { fontSize: font.body, color: color.ink, lineHeight: 22 },
  card: {
    backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md,
    borderWidth: 1, borderColor: color.line,
  },
  button: {
    minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { fontSize: font.body, fontWeight: '700' },
  chip: {
    paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill,
    borderWidth: 1, borderColor: color.line, backgroundColor: color.surface,
  },
  chipSelected: { backgroundColor: color.accent, borderColor: color.accent },
  chipText: { fontSize: font.small, color: color.ink, fontWeight: '600' },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  segmented: {
    flexDirection: 'row', backgroundColor: color.surfaceAlt, borderRadius: radius.md, padding: 3,
  },
  segment: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  segmentOn: { backgroundColor: color.surface },
  segmentText: { fontSize: font.small, color: color.muted, fontWeight: '600' },
  field: { gap: 2 },
  fieldTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  fieldLabel: { fontSize: font.body, color: color.ink, fontWeight: '600', flex: 1 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 0 },
  input: {
    width: 96, borderWidth: 1, borderColor: color.line, borderRadius: radius.sm,
    paddingHorizontal: space.md, paddingVertical: 10, fontSize: font.body, color: color.ink,
    backgroundColor: color.surface, textAlign: 'right',
  },
  textInput: { textAlign: 'left', width: '100%', minWidth: 0 },
  unit: { width: 26, fontSize: font.small, color: color.muted },
  hint: { fontSize: font.small, color: color.muted, lineHeight: 18 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  badgeText: { fontSize: font.tiny, fontWeight: '700' },
  notice: {
    backgroundColor: color.accentSoft, borderColor: '#B9D2C8', borderWidth: 1, borderRadius: radius.md, padding: space.md,
  },
  noticeText: { fontSize: font.small, color: color.ink, lineHeight: 19 },
});
