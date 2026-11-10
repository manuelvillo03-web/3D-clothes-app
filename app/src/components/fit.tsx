import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LENGTH_ZONES, type FitResult, type SizeResult, type Status, type ZoneResult } from '../core/fit';
import { fmtG } from '../core/measurements';
import { es } from '../lib/format';
import { color, family, radius, space, statusColor, statusLabel } from '../lib/theme';
import { Card, Txt } from './ui';

const CONFIDENCE: Record<FitResult['confidence'], { label: string; level: number }> = {
  alta: { label: 'Confianza alta', level: 3 },
  media: { label: 'Confianza media', level: 2 },
  baja: { label: 'Confianza baja', level: 1 },
};

/** Estado que resume una talla: lo peor que le pasa. */
export function overall(size: SizeResult): Status {
  const has = (s: Status) => size.zones.some((z) => z.status === s);
  if (has('tight')) return 'tight';
  if (has('very_loose')) return 'very_loose';
  if (has('snug')) return 'snug';
  if (has('loose')) return 'loose';
  return 'good';
}

/** Etiqueta colgante de talla, como la de la prenda. */
export function HangTag({ label, tone = 'light', caption, size = 'md' }: {
  label: string; tone?: 'light' | 'indigo' | 'tape'; caption?: string; size?: 'sm' | 'md' | 'lg';
}) {
  const dims = { sm: { w: 46, h: 58, f: 22 }, md: { w: 62, h: 80, f: 30 }, lg: { w: 104, h: 132, f: 56 } }[size];
  const long = label.length > 3;
  const bg = tone === 'indigo' ? color.indigo : tone === 'tape' ? color.tape : color.surface;
  const fg = tone === 'indigo' ? color.onIndigo : color.tapeInk;
  return (
    <View style={[styles.tag, { minWidth: dims.w, height: dims.h, backgroundColor: bg }, tone === 'light' && styles.tagLine]}>
      <View style={[styles.hole, size === 'lg' && { width: 12, height: 12, borderRadius: 6, marginTop: 10 }, tone !== 'light' && { backgroundColor: tone === 'tape' ? color.indigo : color.tape }]} />
      <Text style={[styles.tagLabel, { fontSize: long ? dims.f * 0.62 : dims.f, lineHeight: dims.f * 1.05, color: fg }]} numberOfLines={1}>{label}</Text>
      {caption ? <Text style={[styles.tagCaption, { color: fg }, size === 'lg' && { fontSize: 13 }]}>{caption}</Text> : <View style={{ height: 4 }} />}
    </View>
  );
}

export function SizePicker({ sizes, selected, recommended, onSelect }: {
  sizes: SizeResult[]; selected: string | null; recommended: string | null; onSelect: (label: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sizes}
      accessibilityRole="radiogroup" accessibilityLabel="Tallas">
      {sizes.map((s) => {
        const on = s.label === selected;
        const rec = s.label === recommended;
        const st = overall(s);
        return (
          <Pressable
            key={s.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`Talla ${s.label}${rec ? ', tu talla' : ''}, ${statusLabel[st].toLowerCase()}`}
            onPress={() => onSelect(s.label)}
            style={({ pressed }) => [{ alignItems: 'center', gap: 6 }, pressed && { opacity: 0.75 }]}
          >
            <HangTag label={s.label} tone={on ? 'indigo' : rec ? 'tape' : 'light'} caption={rec ? 'Tu talla' : undefined} />
            <View style={[styles.sizeDot, { backgroundColor: s.zones.length ? statusColor[st] : color.line }, on && { width: 22 }]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Veredicto: la talla recomendada, con cuánta confianza y por qué. */
export function Recommendation({ result }: { result: FitResult }) {
  if (!result.recommended) {
    return <Card><Txt>{result.explanation[0]}</Txt></Card>;
  }
  const conf = CONFIDENCE[result.confidence];
  const best = result.sizes.find((s) => s.label === result.recommended);
  const zoneNames = new Set((best?.zones ?? []).map((z) => `${z.name}:`));
  // Las frases zona a zona ya están en los medidores: aquí solo el resto.
  const notes = result.explanation.slice(1).filter((l) => ![...zoneNames].some((n) => l.startsWith(n)));
  const good = (best?.zones ?? []).filter((z) => z.status === 'good').map((z) => z.name.toLowerCase());
  const summary = !best ? '' : good.length === best.zones.length
    ? 'Te queda bien en todas las zonas que podemos comparar.'
    : good.length ? `Te queda bien en ${list(good)}.` : 'Es la que más se acerca, pero ninguna zona queda del todo bien.';
  return (
    <Card tone="indigo" style={{ gap: space.lg }}>
      <View style={styles.recTop}>
        <HangTag label={result.recommended} tone="tape" size="lg" caption="Tu talla" />
        <View style={{ flex: 1, gap: space.sm }}>
          <Txt variant="h2" tone="onIndigo">{summary}</Txt>
          <View style={styles.conf} accessible accessibilityLabel={conf.label}>
            {[1, 2, 3].map((n) => (
              <View key={n} style={[styles.confBar, { backgroundColor: n <= conf.level ? color.tape : 'rgba(255,255,255,0.22)' }]} />
            ))}
            <Txt variant="small" tone="onIndigoMuted">{conf.label}</Txt>
          </View>
        </View>
      </View>
      {notes.length || result.warnings.length ? (
        <View style={{ gap: 6 }}>
          {notes.map((line) => <Txt key={line} variant="small" tone="onIndigo">{es(line)}</Txt>)}
          {result.warnings.map((w) => <Txt key={w} variant="small" tone="onIndigoMuted">{w}</Txt>)}
        </View>
      ) : null}
    </Card>
  );
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** Posición (0 aprieta … 1 holgado) del marcador en el medidor de una zona. */
export function gaugePosition(z: ZoneResult): number {
  const clamp = (v: number) => Math.max(0.04, Math.min(0.96, v));
  if (z.ideal) {
    const [lo, hi] = z.ideal;
    const span = Math.max(hi - lo, 2);
    if (z.ease_cm !== null) return clamp(1 / 3 + ((z.ease_cm - lo) / span) / 3);
    if (z.body_cm !== null) return clamp(1 / 3 + ((hi - z.body_cm) / span) / 3);
  }
  return { tight: 0.08, snug: 0.26, good: 0.5, loose: 0.74, very_loose: 0.92 }[z.status];
}

function detail(z: ZoneResult): string {
  return es(rawDetail(z));
}

function rawDetail(z: ZoneResult): string {
  if (z.ease_cm !== null && z.garment_cm !== null && z.body_cm !== null) {
    const sign = z.ease_cm > 0 ? '+' : '';
    return `Prenda ${fmtG(z.garment_cm)}, tú ${fmtG(z.body_cm)} (${sign}${fmtG(z.ease_cm)} cm)`;
  }
  if (z.ease_cm !== null && z.garment_cm !== null) {
    const sign = z.ease_cm > 0 ? '+' : '';
    return `Prenda ${fmtG(z.garment_cm)} (${sign}${fmtG(z.ease_cm)} cm frente a la tuya)`;
  }
  if (z.ideal && z.body_cm !== null) {
    return `Tú ${fmtG(z.body_cm)}, la talla va de ${fmtG(z.ideal[0])} a ${fmtG(z.ideal[1])} cm`;
  }
  return '';
}

function Gauge({ zone }: { zone: ZoneResult }) {
  const pos = gaugePosition(zone);
  const tint = statusColor[zone.status];
  const lengthy = LENGTH_ZONES.has(zone.zone);
  return (
    <View style={styles.gauge} accessible accessibilityLabel={`${zone.name}: ${zone.status_text}. ${detail(zone)}`}>
      <View style={styles.gaugeHead}>
        <Txt variant="label">{zone.name}</Txt>
        <Text style={[styles.gaugeStatus, { color: tint }]}>{zone.status_text.charAt(0).toUpperCase() + zone.status_text.slice(1)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.seg, { backgroundColor: '#FBD9D6', borderTopLeftRadius: 5, borderBottomLeftRadius: 5 }]} />
        <View style={[styles.seg, { backgroundColor: '#C9EFDD' }]} />
        <View style={[styles.seg, { backgroundColor: '#D5E6FB', borderTopRightRadius: 5, borderBottomRightRadius: 5 }]} />
        <View style={[styles.knob, { left: `${pos * 100}%`, backgroundColor: tint }]} />
      </View>
      <View style={styles.gaugeFoot}>
        <Text style={styles.scale}>{lengthy ? 'Corto' : 'Aprieta'}</Text>
        <Text style={styles.gaugeDetail} numberOfLines={1}>{detail(zone)}</Text>
        <Text style={styles.scale}>{lengthy ? 'Largo' : 'Holgado'}</Text>
      </View>
    </View>
  );
}

export function ZoneGauges({ size, isRecommended }: { size: SizeResult; isRecommended: boolean }) {
  return (
    <Card>
      <View style={styles.gaugeHead}>
        <Txt variant="h2">Talla {size.label}, zona a zona</Txt>
        {!isRecommended ? <Txt variant="small" tone="muted">No es tu talla</Txt> : null}
      </View>
      {size.zones.length === 0 ? <Txt tone="muted">Esta talla no tiene medidas comparables con tu cuerpo.</Txt> : null}
      {size.zones.map((z) => <Gauge key={z.zone} zone={z} />)}
    </Card>
  );
}

/** Leyenda de colores del mapa de ajuste, para ir sobre el escenario. */
export function Legend({ title }: { title?: string }) {
  const order: Status[] = ['tight', 'snug', 'good', 'loose', 'very_loose'];
  return (
    <View style={styles.legend} pointerEvents="none">
      {title ? <Text style={styles.legendTitle}>{title}</Text> : null}
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
  tag: {
    borderRadius: 10, borderTopLeftRadius: 18, borderTopRightRadius: 18, alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingBottom: 6,
  },
  tagLine: { borderWidth: 1.5, borderColor: color.line },
  hole: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.bg, marginTop: 7 },
  tagLabel: { fontFamily: family.numBold, letterSpacing: -0.5 },
  tagCaption: { fontFamily: family.semibold, fontSize: 9.5, lineHeight: 12 },
  sizes: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 2 },
  sizeDot: { width: 8, height: 8, borderRadius: 4 },
  recTop: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  conf: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  confBar: { width: 16, height: 5, borderRadius: 3 },
  gauge: { gap: 6, paddingTop: space.xs },
  gaugeHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  gaugeStatus: { fontFamily: family.heading, fontSize: 14 },
  track: { flexDirection: 'row', height: 10, gap: 2, marginHorizontal: 9 },
  seg: { flex: 1 },
  knob: {
    position: 'absolute', top: -5, width: 20, height: 20, borderRadius: 10, marginLeft: -10,
    borderWidth: 3, borderColor: color.surface,
  },
  gaugeFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  scale: { fontFamily: family.medium, fontSize: 11, color: color.faint },
  gaugeDetail: { flex: 1, textAlign: 'center', fontFamily: family.numMedium, fontSize: 14, color: color.muted },
  legend: {
    position: 'absolute', right: space.md, top: space.md, gap: 5, backgroundColor: 'rgba(20,24,63,0.55)',
    borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8,
  },
  legendTitle: { fontFamily: family.numBold, fontSize: 17, color: color.tape, marginBottom: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 11, color: color.onIndigo, fontFamily: family.medium },
});
