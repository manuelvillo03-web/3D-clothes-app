import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, family, font, noOutline, radius, space, TAB_BAR_HEIGHT } from '../lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ------------------------------------------------------------------ texto

const VARIANTS = {
  display: { fontFamily: family.display, fontSize: font.display, lineHeight: 40, letterSpacing: -1 },
  title: { fontFamily: family.display, fontSize: font.title, lineHeight: 32, letterSpacing: -0.6 },
  h2: { fontFamily: family.heading, fontSize: font.h2, lineHeight: 26, letterSpacing: -0.3 },
  h3: { fontFamily: family.semibold, fontSize: font.h3, lineHeight: 22 },
  body: { fontFamily: family.body, fontSize: font.body, lineHeight: 22 },
  label: { fontFamily: family.semibold, fontSize: font.body, lineHeight: 20 },
  small: { fontFamily: family.body, fontSize: font.small, lineHeight: 19 },
  tiny: { fontFamily: family.medium, fontSize: font.tiny, lineHeight: 14 },
  num: { fontFamily: family.num, fontSize: 20, lineHeight: 22 },
} as const satisfies Record<string, TextStyle>;

export function Txt({ variant = 'body', tone, style, ...rest }: TextProps & {
  variant?: keyof typeof VARIANTS;
  tone?: 'ink' | 'muted' | 'faint' | 'onIndigo' | 'onIndigoMuted' | 'danger' | 'indigo';
}) {
  const c = tone ? color[tone] : color.ink;
  const heading = variant === 'display' || variant === 'title' || variant === 'h2';
  return <Text accessibilityRole={heading ? 'header' : undefined} {...rest} style={[VARIANTS[variant], { color: c }, style]} />;
}

export const H1 = ({ children }: { children: ReactNode }) => <Txt variant="title">{children}</Txt>;
export const H2 = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => (
  <Txt variant="h2" style={style}>{children}</Txt>
);
export function P({ children, muted, small, style }: {
  children: ReactNode; muted?: boolean; small?: boolean; style?: StyleProp<TextStyle>;
}) {
  return <Txt variant={small ? 'small' : 'body'} tone={muted ? 'muted' : 'ink'} style={style}>{children}</Txt>;
}

// ------------------------------------------------------------------ pantalla

export function Screen({ children, title, back, right, tabs, scroll = true, tone = 'light', flush, footer }: {
  children: ReactNode;
  /** Cabecera propia de la pantalla. */
  title?: string;
  back?: boolean;
  right?: ReactNode;
  /** La pantalla vive dentro de las pestañas: deja sitio a la barra. */
  tabs?: boolean;
  scroll?: boolean;
  tone?: 'light' | 'indigo';
  /** Sin margen lateral (para contenido a sangre). */
  flush?: boolean;
  /** Barra fija al pie (botón principal). */
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const dark = tone === 'indigo';
  const bottom = (tabs ? TAB_BAR_HEIGHT : 0) + insets.bottom + space.xl;
  const content = <View style={[styles.column, flush && { maxWidth: undefined }]}>{children}</View>;
  return (
    <View style={[styles.screen, dark && { backgroundColor: color.indigo }, { paddingTop: insets.top }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {title !== undefined || back ? (
        <View style={styles.header}>
          {back ? (
            <IconButton
              icon="chevron-back"
              label="Atrás"
              tone={dark ? 'onIndigo' : 'ink'}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          ) : null}
          <Txt variant={back ? 'h3' : 'title'} tone={dark ? 'onIndigo' : 'ink'} style={{ flex: 1 }} numberOfLines={1}>
            {title ?? ''}
          </Txt>
          {right}
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, flush && { paddingHorizontal: 0 }, { paddingBottom: footer ? space.xl : bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, { flex: 1 }, flush && { paddingHorizontal: 0 }]}>{content}</View>
      )}
      {footer ? (
        <View style={[styles.footer, dark && { backgroundColor: color.indigo, borderTopColor: 'transparent' }, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ piezas

export function Card({ children, style, tone = 'surface' }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'surface' | 'indigo' | 'soft';
}) {
  return (
    <View style={[styles.card, tone === 'indigo' && styles.cardIndigo, tone === 'soft' && styles.cardSoft, style]}>
      {children}
    </View>
  );
}

export function Button({ label, onPress, kind = 'primary', disabled, busy, style, icon }: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger' | 'onIndigo';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: IconName;
}) {
  const palette = {
    primary: { bg: color.tape, fg: color.tapeInk, border: color.tape },
    dark: { bg: color.indigo, fg: color.onIndigo, border: color.indigo },
    secondary: { bg: color.surface, fg: color.ink, border: color.line },
    ghost: { bg: 'transparent', fg: color.indigo, border: 'transparent' },
    danger: { bg: color.surface, fg: color.danger, border: color.danger },
    onIndigo: { bg: 'transparent', fg: color.onIndigo, border: 'rgba(255,255,255,0.35)' },
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        pressed && { transform: [{ scale: 0.985 }] },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={palette.fg} /> : (
        <>
          {icon ? <Ionicons name={icon} size={19} color={palette.fg} /> : null}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, tone = 'ink', filled }: {
  icon: IconName; label: string; onPress: () => void; tone?: 'ink' | 'onIndigo' | 'danger'; filled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, filled && { backgroundColor: color.surface, borderColor: color.line, borderWidth: 1 }, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={22} color={color[tone]} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon }: {
  label: string; selected?: boolean; onPress?: () => void; icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {icon ? <Ionicons name={icon} size={15} color={selected ? color.onIndigo : color.muted} /> : null}
      <Text style={[styles.chipText, selected && { color: color.onIndigo }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, style, wrap }: { children: ReactNode; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[styles.row, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Segmented<T extends string>({ value, options, onChange, tone = 'light' }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; tone?: 'light' | 'indigo';
}) {
  const dark = tone === 'indigo';
  return (
    <View style={[styles.segmented, dark && { backgroundColor: 'rgba(255,255,255,0.1)' }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, on && (dark ? { backgroundColor: color.tape } : styles.segmentOn)]}
          >
            <Text style={[styles.segmentText, dark && { color: color.onIndigoMuted }, on && { color: dark ? color.tapeInk : color.ink, fontFamily: family.heading }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function NumberField({ label, unit, value, onChange, hint, placeholder, estimated, onFocus, active }: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  estimated?: boolean;
  onFocus?: () => void;
  active?: boolean;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldTop}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={[styles.inputWrap, active && { borderColor: color.indigo }]}>
          <TextInput
            accessibilityLabel={`${label} en ${unit}`}
            value={value}
            onChangeText={(t) => onChange(t.replace(',', '.').replace(/[^0-9.]/g, ''))}
            onFocus={onFocus}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder={placeholder}
            placeholderTextColor={estimated ? color.muted : color.faint}
            style={[styles.input, noOutline]}
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
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.faint}
        style={[styles.textInput, noOutline]}
      />
    </View>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={18} color={color.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.faint}
        style={[styles.searchInput, noOutline]}
        accessibilityLabel={placeholder}
        returnKeyType="search"
      />
      {value ? (
        <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel="Borrar búsqueda" hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={color.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Badge({ label, tint, solid }: { label: string; tint: string; solid?: boolean }) {
  return (
    <View style={[styles.badge, { backgroundColor: solid ? tint : `${tint}1F` }]}>
      <Text style={[styles.badgeText, { color: solid ? '#FFFFFF' : tint }]}>{label}</Text>
    </View>
  );
}

export function Loading({ label, tone = 'ink' }: { label: string; tone?: 'ink' | 'onIndigo' }) {
  return (
    <View style={{ padding: space.xl, alignItems: 'center', gap: space.md }}>
      <ActivityIndicator color={tone === 'onIndigo' ? color.tape : color.indigo} />
      <Txt variant="small" tone={tone === 'onIndigo' ? 'onIndigoMuted' : 'muted'}>{label}</Txt>
    </View>
  );
}

export function Notice({ children, tone = 'info', icon }: { children: ReactNode; tone?: 'info' | 'warn'; icon?: IconName }) {
  const warn = tone === 'warn';
  return (
    <View style={[styles.notice, warn && { backgroundColor: '#FFF3D6' }]}>
      <Ionicons name={icon ?? (warn ? 'alert-circle' : 'lock-closed')} size={18} color={warn ? '#9A6B00' : color.indigo} style={{ marginTop: 1 }} />
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

/** Fila de lista con icono, texto y flecha (ajustes, accesos). */
export function ListRow({ icon, title, detail, onPress, danger, last }: {
  icon: IconName; title: string; detail?: string; onPress: () => void; danger?: boolean; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.listRow, !last && styles.listRowLine, pressed && { opacity: 0.6 }]}
    >
      <View style={[styles.listIcon, danger && { backgroundColor: color.dangerSoft }]}>
        <Ionicons name={icon} size={18} color={danger ? color.danger : color.indigo} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="label" tone={danger ? 'danger' : 'ink'}>{title}</Txt>
        {detail ? <Txt variant="small" tone="muted">{detail}</Txt> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={color.faint} />
    </Pressable>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={28} color={color.indigo} /></View>
      <Txt variant="h2" style={{ textAlign: 'center' }}>{title}</Txt>
      <Txt tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>{body}</Txt>
      {action}
    </View>
  );
}

const BRAND_TINTS: [bg: string, ink: string][] = [
  ['#E3E5F6', '#1D2257'], ['#FFF1B8', '#5B4500'], ['#D6F2E4', '#0F5A3A'],
  ['#FBDDDB', '#8A1F26'], ['#D9E9FC', '#144A86'], ['#E9E0FB', '#48308F'],
];

/** Monograma de marca: sin logotipos ajenos, solo sus iniciales y un color propio. */
export function BrandMark({ brand, size = 44, selected }: { brand: string; size?: number; selected?: boolean }) {
  const letters = brand.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ& ]/g, '').split(/\s+/).filter(Boolean);
  const mono = (letters.length > 1 ? letters[0][0] + letters[1][0] : (letters[0] ?? '?').slice(0, 2)).toUpperCase();
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = (hash * 31 + brand.charCodeAt(i)) % 9973;
  const [bg, ink] = BRAND_TINTS[hash % BRAND_TINTS.length];
  return (
    <View style={[styles.brandMark, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, selected && { borderColor: color.indigo }]}>
      <Text style={[styles.brandMarkText, { fontSize: size * 0.4, color: ink }]}>{mono}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, minHeight: 52 },
  scroll: { paddingHorizontal: space.lg, paddingTop: space.sm, alignItems: 'center' },
  column: { width: '100%', maxWidth: 560, gap: space.lg },
  footer: { backgroundColor: color.bg, borderTopWidth: 1, borderTopColor: color.line, paddingHorizontal: space.lg, paddingTop: space.md, alignItems: 'center' },
  footerInner: { width: '100%', maxWidth: 560, gap: space.sm },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  cardIndigo: { backgroundColor: color.indigo },
  cardSoft: { backgroundColor: color.indigoSoft },
  button: {
    minHeight: 54, borderRadius: radius.pill, borderWidth: 1.5, paddingHorizontal: space.xl,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.sm,
  },
  buttonText: { fontSize: 16, fontFamily: family.heading },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill,
    backgroundColor: color.surface,
  },
  chipSelected: { backgroundColor: color.indigo },
  chipText: { fontSize: font.small, color: color.ink, fontFamily: family.semibold },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  segmented: { flexDirection: 'row', backgroundColor: color.surfaceAlt, borderRadius: radius.pill, padding: 4 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  segmentOn: { backgroundColor: color.surface },
  segmentText: { fontSize: font.small, color: color.muted, fontFamily: family.semibold },
  field: { gap: 4 },
  fieldTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  fieldLabel: { fontSize: font.body, color: color.ink, fontFamily: family.semibold, flex: 1 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4, flexShrink: 0, borderWidth: 1.5, borderColor: color.line,
    borderRadius: radius.md, paddingHorizontal: space.md, backgroundColor: color.surface,
  },
  input: { width: 70, paddingVertical: 9, fontSize: 22, color: color.ink, textAlign: 'right', fontFamily: family.num },
  unit: { width: 22, fontSize: font.small, color: color.muted, fontFamily: family.medium },
  hint: { fontSize: font.small, color: color.muted, lineHeight: 18, fontFamily: family.body },
  textInput: {
    width: '100%', minWidth: 0, borderWidth: 1.5, borderColor: color.line, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: 12, fontSize: font.body, color: color.ink,
    backgroundColor: color.surface, fontFamily: family.body,
  },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.surface,
    borderRadius: radius.pill, paddingHorizontal: space.lg, minHeight: 50,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: font.body, color: color.ink, fontFamily: family.body, paddingVertical: 12 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: font.tiny, fontFamily: family.semibold },
  notice: { flexDirection: 'row', gap: space.sm, backgroundColor: color.indigoSoft, borderRadius: radius.md, padding: space.md },
  noticeText: { flex: 1, fontSize: font.small, color: color.ink, lineHeight: 19, fontFamily: family.body },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  listRowLine: { borderBottomWidth: 1, borderBottomColor: color.line },
  listIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: color.indigoSoft, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: color.indigoSoft, alignItems: 'center', justifyContent: 'center' },
  brandMark: { borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { fontFamily: family.numBold, letterSpacing: 0.5 },
});
