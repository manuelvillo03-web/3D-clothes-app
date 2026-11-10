import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BodyViewer, StagePlaceholder } from '../components/BodyViewer';
import { HangTag } from '../components/fit';
import { BrandMark, Button, Loading, Screen, Txt, type IconName } from '../components/ui';
import { buildVertices, predictBody } from '../core/bodyModel';
import { fitGarment } from '../core/fit';
import { buildShell } from '../core/garmentShell';
import { useCatalog } from '../lib/catalog';
import { useProfile } from '../lib/profile';
import { color, family, radius, space, statusColor } from '../lib/theme';

const SAMPLE = { height: 170, weight: 66, chest: 95, waist: 80, hip: 99 };

const POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'body', title: 'Un maniquí con tus medidas', body: 'Altura, peso y cuatro contornos. Lo que no sepas, lo estimamos y te decimos con cuánto margen.' },
  { icon: 'color-palette', title: 'Cada talla, zona a zona', body: 'Ves sobre tu cuerpo dónde aprieta y dónde sobra, y por qué te recomendamos una talla y no otra.' },
  { icon: 'lock-closed', title: 'Tus medidas no salen del móvil', body: 'Sin cuenta y sin servidores: el maniquí se calcula en tu dispositivo y lo borras cuando quieras.' },
];

const STEPS = [
  ['Mídete una vez', 'Con una cinta métrica y dos minutos. Te enseñamos por dónde pasa en cada medida.'],
  ['Elige la prenda', 'Busca la marca o copia la tabla de medidas de la tienda donde estás comprando.'],
  ['Compra tu talla', 'Te decimos cuál pedir y cómo te va a quedar antes de pagar el envío.'],
];

export default function Bienvenida() {
  const { model, profile } = useProfile();
  const { items } = useCatalog();
  const brands = useMemo(() => [...new Set(items.filter((i) => i.origin !== 'mine').map((i) => i.garment.brand))], [items]);

  // Maniquí de muestra con una camiseta puesta: enseña el producto antes de pedir nada.
  const demo = useMemo(() => {
    if (!model) return null;
    const p = predictBody(model, 'female', SAMPLE);
    const vertices = buildVertices(model, p.coefficients);
    const garment = items.find((i) => i.garment.category === 'tshirt' && i.garment.audience !== 'men')?.garment
      ?? items.find((i) => i.garment.category === 'tshirt')?.garment;
    let shell = null;
    let size: string | null = null;
    let note: { text: string; tint: string } | null = null;
    if (garment) {
      const r = fitGarment(garment, p.measurements, 'regular');
      // Una talla menos que la suya: el mapa de colores se entiende de un vistazo.
      const idx = r.sizes.findIndex((s) => s.label === r.recommended);
      const shown = r.sizes[Math.max(idx - 1, 0)] ?? null;
      size = r.recommended;
      shell = buildShell(model, vertices, p.measurements, garment, shown);
      const worst = shown?.zones.find((z) => z.status !== 'good');
      if (shown && worst && shown.label !== size) {
        note = { text: `Con la ${shown.label}: ${worst.name.toLowerCase()} ${worst.status_text}`, tint: statusColor[worst.status] };
      }
    }
    return { vertices, shell, size, note, bodyHeight: SAMPLE.height / 100 };
  }, [model, items]);

  const start = () => router.push('/medidas');

  return (
    <Screen tone="indigo" flush
      footer={<Button label={profile ? 'Volver a mi probador' : 'Crear mi maniquí'} icon="arrow-forward-circle" onPress={profile ? () => router.replace('/') : start} />}>
      <View style={styles.pad}>
        <View style={styles.brandRow}>
          <View style={styles.logo}><Ionicons name="body" size={18} color={color.tapeInk} /></View>
          <Text style={styles.wordmark}>Probador</Text>
        </View>
        <Txt variant="display" tone="onIndigo" style={styles.headline}>Acierta con la talla antes de comprar</Txt>
        <Txt tone="onIndigoMuted" style={{ fontSize: 16, lineHeight: 23 }}>
          Un maniquí con tus medidas te enseña cómo te queda cada talla de {brands.length} marcas.
        </Txt>
      </View>

      <View style={styles.stageWrap}>
        {demo ? (
          <BodyViewer model={model!} vertices={demo.vertices} shell={demo.shell} bodyHeight={demo.bodyHeight}
            height={380} spin controls={false} flat />
        ) : (
          <StagePlaceholder height={380} flat><Loading label="Preparando el probador…" tone="onIndigo" /></StagePlaceholder>
        )}
        {demo?.size ? (
          <View style={styles.floatTag} pointerEvents="none">
            <HangTag label={demo.size} tone="tape" size="lg" caption="Tu talla" />
          </View>
        ) : null}
        {demo?.note ? (
          <View style={styles.floatNote} pointerEvents="none">
            <View style={[styles.noteDot, { backgroundColor: demo.note.tint }]} />
            <Text style={styles.noteText}>{demo.note.text}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.pad, { gap: space.md }]}>
        <Button kind="onIndigo" label="Ver las marcas primero" onPress={() => router.push('/probar')} />
      </View>

      <View style={[styles.pad, { gap: space.md, marginTop: space.xl }]}>
        {POINTS.map((p) => (
          <View key={p.title} style={styles.point}>
            <View style={styles.pointIcon}><Ionicons name={p.icon} size={20} color={color.tape} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="h3" tone="onIndigo">{p.title}</Txt>
              <Txt variant="small" tone="onIndigoMuted">{p.body}</Txt>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: space.md, marginTop: space.xl }}>
        <View style={styles.pad}>
          <Txt variant="h2" tone="onIndigo">Las tallas de {brands.length} marcas, y las que añadas tú</Txt>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {brands.map((b) => (
            <View key={b} style={styles.brandItem}>
              <BrandMark brand={b} size={52} />
              <Text style={styles.brandName} numberOfLines={1}>{b}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={[styles.pad, styles.how]}>
        <Txt variant="h2">Cómo funciona</Txt>
        {STEPS.map(([t, d], i) => (
          <View key={t} style={styles.step}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="h3">{t}</Txt>
              <Txt variant="small" tone="muted">{d}</Txt>
            </View>
          </View>
        ))}
                <Button kind="ghost" label="Cómo tratamos tus datos" onPress={() => router.push('/privacidad')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.xl, width: '100%', maxWidth: 560, alignSelf: 'center', gap: space.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  logo: { width: 30, height: 30, borderRadius: 10, backgroundColor: color.tape, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontFamily: family.display, fontSize: 20, color: color.onIndigo, letterSpacing: -0.4 },
  headline: { fontSize: 36, lineHeight: 38, letterSpacing: -1.2 },
  stageWrap: { width: '100%', maxWidth: 560, alignSelf: 'center', marginTop: space.sm },
  floatTag: { position: 'absolute', right: space.xl, top: space.xl, transform: [{ rotate: '7deg' }] },
  floatNote: {
    position: 'absolute', right: space.lg, bottom: space.xl, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: color.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9,
  },
  noteDot: { width: 10, height: 10, borderRadius: 5 },
  noteText: { fontFamily: family.semibold, fontSize: 13, color: color.ink },
  point: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', backgroundColor: color.indigoDeep, borderRadius: radius.lg, padding: space.lg },
  pointIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  rail: { paddingHorizontal: space.xl, gap: space.md },
  brandItem: { alignItems: 'center', gap: 6, width: 68 },
  brandName: { fontFamily: family.medium, fontSize: 11, color: color.onIndigoMuted, textAlign: 'center' },
  how: {
    backgroundColor: color.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, marginTop: space.xxl,
    paddingTop: space.xl, paddingBottom: space.xl, maxWidth: undefined, gap: space.lg,
  },
  step: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  stepNum: { fontFamily: family.numBold, fontSize: 40, lineHeight: 42, color: color.indigo, width: 24, textAlign: 'center' },
});
