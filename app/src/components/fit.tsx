import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FitResult, SizeResult, Status } from '../core/fit';
import { fmtG } from '../core/measurements';
import { color, font, radius, space, statusColor, statusLabel } from '../lib/theme';
import { Badge, Card, H2, P } from './ui';

const CONFIDENCE: Record<FitResult['confidence'], { label: string; tint: string }> = {
  alta: { label: 'Confianza alta', tint: statusColor.good },
  media: { label: 'Confianza media', tint: statusColor.snug },
  baja: { label: 'Confianza baja', tint: statusColor.tight },
};

export function SizePicker({ sizes, selected, recommended, onSelect }: {
  sizes: SizeResult[]; selected: string | null; recommended: string | null; onSelect: (label: string) => void;
}) {
  return (
    <View style={styles.sizes} accessibilityRole="radiogroup" accessibilityLabel="Tallas">
      {sizes.map((s) => {
        const on = s.label === selected;
        const rec = s.label === recommended;
        return (
          <Pressable
            key={s.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`Talla ${s.label}${rec ? ', recomendada' : ''}${s.wearable ? '' : ', aprieta'}`}
            onPress={() => onSelect(s.label)}
            style={[styles.size, on && styles.sizeOn, !s.wearable && styles.sizeTight]}
          >
            <Text style={[styles.sizeText, on && { color: color.accentInk }]}>{s.label}</Text>
            {rec ? <View style={[styles.dot, { backgroundColor: on ? color.accentInk : color.accent }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Recommendation({ result }: { result: FitResult }) {
  if (!result.recommended) {
    return <Card><P>{result.explanation[0]}</P></Card>;
  }
  const conf = CONFIDENCE[result.confidence];
  const [headline, ...rest] = result.explanation;
  return (
    <Card>
      <View style={styles.recTop}>
        <View style={styles.recSize}>
          <Text style={styles.recLabel}>Tu talla</Text>
          <Text style={styles.recValue}>{result.recommended}</Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Badge label={conf.label} tint={conf.tint} />
          {result.alternative ? <P small muted>Alternativa: {result.alternative}</P> : null}
          <P small muted>{headline}</P>
        </View>
      </View>
      {rest.map((line) => <P key={line} small>{line}</P>)}
      {result.warnings.map((w) => <P key={w} small muted>{w}</P>)}
    </Card>
  );
}

export function ZoneTable({ size }: { size: SizeResult }) {
  return (
    <Card>
      <H2>Talla {size.label}, zona a zona</H2>
      {size.zones.length === 0 ? <P muted>Esta talla no tiene medidas comparables con tu cuerpo.</P> : null}
      {size.zones.map((z) => (
        <View key={z.zone} style={styles.zoneRow}>
          <View style={[styles.swatch, { backgroundColor: statusColor[z.status] }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.zoneName}>{z.name}</Text>
            <Text style={styles.zoneDetail}>{detail(z)}</Text>
          </View>
          <Text style={[styles.zoneStatus, { color: statusColor[z.status] }]}>{z.status_text}</Text>
        </View>
      ))}
    </Card>
  );
}

function detail(z: SizeResult['zones'][number]): string {
  if (z.ease_cm !== null && z.garment_cm !== null && z.body_cm !== null) {
    const sign = z.ease_cm > 0 ? '+' : '';
    return `Prenda ${fmtG(z.garment_cm)} cm · tú ${fmtG(z.body_cm)} cm · ${sign}${fmtG(z.ease_cm)} cm`;
  }
  if (z.ease_cm !== null && z.garment_cm !== null) {
    const sign = z.ease_cm > 0 ? '+' : '';
    return `Prenda ${fmtG(z.garment_cm)} cm · ${sign}${fmtG(z.ease_cm)} cm frente a la tuya`;
  }
  if (z.ideal && z.body_cm !== null) {
    return `Tú ${fmtG(z.body_cm)} cm · la talla va de ${fmtG(z.ideal[0])} a ${fmtG(z.ideal[1])} cm`;
  }
  return '';
}

export function Legend() {
  const order: Status[] = ['tight', 'snug', 'good', 'loose', 'very_loose'];
  return (
    <View style={styles.legend}>
      {order.map((s) => (
        <View key={s} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: statusColor[s] }]} />
          <Text style={styles.legendText}>{statusLabel[s]}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  size: {
    minWidth: 52, height: 44, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1,
    borderColor: color.line, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center',
  },
  sizeOn: { backgroundColor: color.accent, borderColor: color.accent },
  sizeTight: { borderStyle: 'dashed' },
  sizeText: { fontSize: font.body, fontWeight: '700', color: color.ink },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 3 },
  recTop: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  recSize: {
    width: 88, height: 88, borderRadius: radius.lg, backgroundColor: color.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  recLabel: { fontSize: font.tiny, color: color.accent, fontWeight: '700', textTransform: 'uppercase' },
  recValue: { fontSize: 30, fontWeight: '800', color: color.accent },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
  swatch: { width: 12, height: 36, borderRadius: 4 },
  zoneName: { fontSize: font.body, fontWeight: '700', color: color.ink },
  zoneDetail: { fontSize: font.small, color: color.muted },
  zoneStatus: { fontSize: font.small, fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: font.tiny, color: color.muted, fontWeight: '600' },
});
