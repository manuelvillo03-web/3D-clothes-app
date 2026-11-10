import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORY_NAMES, CUT_NAMES, type Garment } from '../core/garments';
import { shortName } from '../lib/format';
import type { QuickFit } from '../lib/useFits';
import { color, family, radius, space } from '../lib/theme';
import { HangTag } from './fit';
import { BrandMark, Txt } from './ui';

export const openGarment = (id: string) => router.push({ pathname: '/prenda/[id]', params: { id } });

const AUDIENCE: Record<string, string> = { men: 'Hombre', women: 'Mujer', unisex: 'Unisex' };

/** Fila de prenda con su talla para el usuario. */
export function GarmentRow({ garment, fit, note }: { garment: Garment; fit?: QuickFit; note?: string }) {
  const meta = [CATEGORY_NAMES[garment.category], garment.audience ? AUDIENCE[garment.audience] : null,
    garment.cut !== 'regular' ? `corte ${CUT_NAMES[garment.cut].toLowerCase()}` : null].filter(Boolean).join(', ');
  return (
    <Pressable
      onPress={() => openGarment(garment.id ?? '')}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`${garment.brand}, ${garment.name}${fit?.size ? `, tu talla ${fit.size}` : ''}`}
    >
      <BrandMark brand={garment.brand} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={styles.brand}>{garment.brand}</Text>
        <Txt variant="label" numberOfLines={2}>{shortName(garment.name)}</Txt>
        <Txt variant="small" tone="muted" numberOfLines={1}>{note ?? meta}</Txt>
      </View>
      {fit?.size ? <HangTag label={fit.size} size="sm" tone={fit.wearable ? 'tape' : 'light'} /> : null}
    </Pressable>
  );
}

/** Tarjeta estrecha para carruseles: marca, prenda y talla. */
export function GarmentTile({ garment, fit }: { garment: Garment; fit?: QuickFit }) {
  return (
    <Pressable
      onPress={() => openGarment(garment.id ?? '')}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`${garment.brand}, ${garment.name}${fit?.size ? `, tu talla ${fit.size}` : ''}`}
    >
      <View style={styles.tileTop}>
        <BrandMark brand={garment.brand} size={36} />
        {fit?.size ? <HangTag label={fit.size} size="sm" tone={fit.wearable ? 'tape' : 'light'} /> : null}
      </View>
      <Text style={styles.brand} numberOfLines={1}>{garment.brand}</Text>
      <Txt variant="small" numberOfLines={2} style={{ minHeight: 38 }}>{shortName(garment.name)}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: color.surface,
    borderRadius: radius.lg, padding: space.md, paddingRight: space.lg,
  },
  brand: { fontFamily: family.num, fontSize: 14, color: color.muted, letterSpacing: 0.3 },
  tile: { width: 148, backgroundColor: color.surface, borderRadius: radius.lg, padding: space.md, gap: 4 },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
});
