import { Redirect, router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BodyViewer, StagePlaceholder } from '../../components/BodyViewer';
import { GarmentRow, GarmentTile } from '../../components/garment';
import { Button, Card, IconButton, Loading, Screen, Segmented, Txt } from '../../components/ui';
import { BY_KEY, MEASUREMENTS, fmtG } from '../../core/measurements';
import { useCatalog } from '../../lib/catalog';
import { PREFS } from '../../lib/prefs';
import { useProfile } from '../../lib/profile';
import { color, family, radius, space } from '../../lib/theme';
import { useFits } from '../../lib/useFits';
import { useMannequin } from '../../lib/useMannequin';

const STRIP = ['chest', 'waist', 'hip', 'inseam'];

export default function Inicio() {
  const { ready, profile, prediction, modelError, retryModel, setPreference } = useProfile();
  const { items, history, byId } = useCatalog();
  const mannequin = useMannequin();

  // Una prenda por marca, de las que le corresponden, para el carrusel de tallas.
  const featured = useMemo(() => {
    const want = profile?.sex === 'male' ? 'men' : 'women';
    const seen = new Set<string>();
    return items.filter(({ garment: g, origin }) => {
      if (origin === 'mine' || seen.has(g.brand)) return false;
      if (g.audience && g.audience !== want && g.audience !== 'unisex') return false;
      seen.add(g.brand);
      return true;
    }).slice(0, 12);
  }, [items, profile?.sex]);
  const recent = useMemo(
    () => history.map((h) => ({ h, item: byId(h.id) })).filter((x) => x.item).slice(0, 3),
    [history, byId],
  );
  const fits = useFits(useMemo(() => [...featured, ...recent.map((r) => r.item!)], [featured, recent]));

  if (!ready) return <Screen tabs><Loading label="Abriendo tu probador…" /></Screen>;
  if (!profile) return <Redirect href="/bienvenida" />;

  const given = new Set(Object.keys(profile.measurements));
  const basics = MEASUREMENTS.filter((m) => m.basic);
  const done = basics.filter((m) => given.has(m.key)).length;

  return (
    <Screen tabs title="Tu probador" right={<IconButton icon="create-outline" label="Editar mis medidas" filled onPress={() => router.push('/medidas')} />}>
      {mannequin ? (
        <BodyViewer model={mannequin.model} vertices={mannequin.vertices} bodyHeight={mannequin.bodyHeight} height={420} />
      ) : modelError ? (
        <Card>
          <Txt>No hemos podido cargar el maniquí. {modelError}</Txt>
          <Button kind="secondary" label="Reintentar" onPress={retryModel} />
        </Card>
      ) : (
        <StagePlaceholder height={420}><Loading label="Preparando tu maniquí…" tone="onIndigo" /></StagePlaceholder>
      )}

      <View style={styles.strip}>
        {STRIP.map((k) => {
          const v = prediction?.measurements[k] ?? profile.measurements[k];
          return (
            <View key={k} style={styles.cell} accessible
              accessibilityLabel={`${BY_KEY[k].name}: ${v === undefined ? 'sin dato' : `${fmtG(Math.round(v * 10) / 10)} centímetros`}${given.has(k) ? '' : ', estimada'}`}>
              <Text style={styles.cellValue}>{v === undefined ? '–' : `${given.has(k) ? '' : '≈'}${fmtG(Math.round(v))}`}</Text>
              <Text style={styles.cellLabel}>{BY_KEY[k].name}</Text>
            </View>
          );
        })}
      </View>

      <Button label="Probar una prenda" icon="shirt" onPress={() => router.push('/probar')} />

      {done < basics.length ? (
        <Card tone="soft">
          <View style={styles.progressHead}>
            <Txt variant="h3">Tu maniquí puede afinar más</Txt>
            <Text style={styles.count}>{done}/{basics.length}</Text>
          </View>
          <View style={styles.progress}><View style={[styles.progressFill, { width: `${(done / basics.length) * 100}%` }]} /></View>
          <Txt variant="small" tone="muted">
            Las medidas con «≈» son estimadas a partir de las demás. Con la cinta en la mano son dos minutos.
          </Txt>
          <Button kind="dark" label="Añadir las que faltan" onPress={() => router.push('/medidas')} />
        </Card>
      ) : null}

      {featured.length ? (
        <View style={{ gap: space.md }}>
          <Txt variant="h2">Tu talla en cada marca</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.rail}>
            {featured.map((it) => <GarmentTile key={it.garment.id} garment={it.garment} fit={fits.get(it.garment.id ?? '')} />)}
          </ScrollView>
        </View>
      ) : null}

      {recent.length ? (
        <View style={{ gap: space.sm }}>
          <Txt variant="h2">Lo último que has mirado</Txt>
          {recent.map(({ h, item }) => (
            <GarmentRow key={h.id} garment={item!.garment} fit={fits.get(h.id)}
              note={h.verdict ? { small: 'La compraste y te quedó pequeña', right: 'La compraste y acertamos', large: 'La compraste y te quedó grande' }[h.verdict] : undefined} />
          ))}
        </View>
      ) : null}

      <Card>
        <Txt variant="h2">Cómo te gusta la ropa</Txt>
        <Segmented value={profile.preference} options={PREFS} onChange={(p) => void setPreference(p)} />
        <Txt variant="small" tone="muted">Mueve todas las recomendaciones hacia tallas más ajustadas o más amplias.</Txt>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.lg, paddingVertical: space.md },
  cell: { flex: 1, alignItems: 'center', gap: 0 },
  cellValue: { fontFamily: family.numBold, fontSize: 30, lineHeight: 32, color: color.ink },
  cellLabel: { fontFamily: family.medium, fontSize: 12, color: color.muted },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  count: { fontFamily: family.numBold, fontSize: 22, color: color.indigo },
  progress: { height: 8, borderRadius: 4, backgroundColor: color.surface, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: color.tape, borderRadius: 4 },
  bleed: { marginHorizontal: -space.lg },
  rail: { paddingHorizontal: space.lg, gap: space.sm },
});
