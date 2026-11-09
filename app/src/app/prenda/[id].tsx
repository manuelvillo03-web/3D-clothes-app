import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { BodyViewer } from '../../components/BodyViewer';
import { Legend, Recommendation, SizePicker, ZoneTable } from '../../components/fit';
import { Badge, Button, Card, Chip, H2, Loading, P, Row, Screen, Segmented } from '../../components/ui';
import type { Preference } from '../../core/ease';
import { compareWithReference, fitGarment } from '../../core/fit';
import { BOTTOMS, CATEGORY_NAMES, CUT_NAMES } from '../../core/garments';
import { buildShell } from '../../core/garmentShell';
import { useCatalog } from '../../lib/catalog';
import { useProfile } from '../../lib/profile';
import { color, font, space } from '../../lib/theme';
import { useMannequin } from '../../lib/useMannequin';

const PREFS: { value: Preference; label: string }[] = [
  { value: 'fitted', label: 'Ceñida' },
  { value: 'regular', label: 'Normal' },
  { value: 'loose', label: 'Holgada' },
];

export default function Prenda() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { byId, wardrobe, removeMine } = useCatalog();
  const { profile, body, setPreference } = useProfile();
  const mannequin = useMannequin();
  const item = byId(String(id));
  const garment = item?.garment;
  const preference = profile?.preference ?? 'regular';

  const result = useMemo(
    () => (garment && body ? fitGarment(garment, body, preference) : null),
    [garment, body, preference],
  );
  // Talla elegida a mano para esta prenda; si no hay, la recomendada.
  const [pick, setPick] = useState<{ id: string; label: string } | null>(null);
  const selected = pick && pick.id === id && result?.sizes.some((s) => s.label === pick.label)
    ? pick.label
    : result?.recommended ?? garment?.sizes[0]?.label ?? null;
  const setSelected = (label: string) => setPick({ id: String(id), label });
  const size = result?.sizes.find((s) => s.label === selected) ?? null;

  const shell = useMemo(() => {
    if (!mannequin || !garment || !body) return null;
    return buildShell(mannequin.model, mannequin.vertices, body, garment, size);
  }, [mannequin, garment, body, size]);

  // Prendas del armario con las que se puede comparar (misma parte del cuerpo).
  const refs = useMemo(() => {
    if (!garment || garment.chart_type !== 'garment') return [];
    const bottom = BOTTOMS.has(garment.category);
    return wardrobe.filter((w) => BOTTOMS.has(w.category) === bottom);
  }, [garment, wardrobe]);
  const [refId, setRefId] = useState<string | null>(null);
  const reference = refs.find((r) => r.id === refId) ?? null;
  const refResult = useMemo(
    () => (garment && reference ? compareWithReference(garment, reference) : null),
    [garment, reference],
  );

  if (!item || !garment) {
    return (
      <Screen title="Prenda">
        <P>No encontramos esta prenda.</P>
        <Button label="Ir al catálogo" onPress={() => router.replace('/catalogo')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: garment.brand }} />
      <View style={{ gap: 6 }}>
        <Text style={styles.brand}>{garment.brand.toUpperCase()}</Text>
        <Text style={styles.title}>{garment.name}</Text>
        <Row wrap>
          <Badge label={CATEGORY_NAMES[garment.category]} tint={color.muted} />
          <Badge label={`Corte ${CUT_NAMES[garment.cut].toLowerCase()}`} tint={color.muted} />
          <Badge
            label={garment.chart_type === 'garment' ? 'Medidas de la prenda' : 'Guía por cuerpo'}
            tint={garment.chart_type === 'garment' ? color.accent : color.muted}
          />
        </Row>
      </View>

      {!profile ? (
        <Card>
          <P>Para ver qué talla te queda, primero crea tu maniquí.</P>
          <Button label="Crear mi maniquí" onPress={() => router.push('/medidas')} />
        </Card>
      ) : (
        <>
          {mannequin ? (
            <BodyViewer
              model={mannequin.model}
              vertices={mannequin.vertices}
              shell={shell}
              bodyHeight={mannequin.bodyHeight}
              height={460}
            />
          ) : <Loading label="Preparando tu maniquí…" />}
          <Legend />
          {result ? (
            <>
              <SizePicker sizes={result.sizes} selected={selected} recommended={result.recommended} onSelect={setSelected} />
              <Recommendation result={result} />
              {size ? <ZoneTable size={size} /> : null}
            </>
          ) : null}

          <Card>
            <H2>Cómo te gusta la ropa</H2>
            <Segmented value={preference} options={PREFS} onChange={(p) => void setPreference(p)} />
          </Card>

          {garment.chart_type === 'garment' ? (
            <Card>
              <H2>Compárala con una prenda tuya</H2>
              {refs.length === 0 ? (
                <>
                  <P small muted>
                    Mide una prenda que te quede bien y guárdala en tu armario: te diremos qué talla de esta se le parece más.
                  </P>
                  <Button kind="secondary" label="Ir a mi armario" onPress={() => router.push('/armario')} />
                </>
              ) : (
                <>
                  <Row wrap>
                    {refs.map((r) => (
                      <Chip key={r.id} label={r.name} selected={r.id === refId} onPress={() => setRefId(r.id === refId ? null : r.id)} />
                    ))}
                  </Row>
                  {refResult ? refResult.explanation.map((l) => <P key={l} small>{l}</P>) : null}
                </>
              )}
            </Card>
          ) : null}
        </>
      )}

      <Card>
        <H2>Origen de los datos</H2>
        <P small muted>{garment.source ?? 'Medidas introducidas a mano.'}</P>
        {garment.url ? (
          <Button kind="ghost" label="Ver la guía de la marca" onPress={() => void Linking.openURL(garment.url!)} />
        ) : null}
        {item.origin === 'mine' ? (
          <Button kind="danger" label="Borrar esta prenda" onPress={() => {
            void removeMine(garment.id ?? '');
            router.replace('/catalogo');
          }} />
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { fontSize: font.tiny, letterSpacing: 1.5, color: color.muted, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '800', color: color.ink, marginBottom: space.xs },
});
