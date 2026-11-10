import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { BodyViewer, StagePlaceholder } from '../../components/BodyViewer';
import { Legend, Recommendation, SizePicker, ZoneGauges } from '../../components/fit';
import { BrandMark, Button, Card, Chip, EmptyState, Loading, Notice, Row, Screen, Segmented, Txt } from '../../components/ui';
import { compareWithReference, fitGarment } from '../../core/fit';
import { BOTTOMS, CATEGORY_NAMES, CUT_NAMES } from '../../core/garments';
import { buildShell } from '../../core/garmentShell';
import { useCatalog, type Verdict } from '../../lib/catalog';
import { es, shortName } from '../../lib/format';
import { PREFS } from '../../lib/prefs';
import { useProfile } from '../../lib/profile';
import { remoteEnabled, submitFeedback } from '../../lib/remote';
import { color, family, radius, space } from '../../lib/theme';
import { useMannequin } from '../../lib/useMannequin';

const VERDICTS: { value: Verdict; label: string }[] = [
  { value: 'small', label: 'Pequeña' },
  { value: 'right', label: 'Perfecta' },
  { value: 'large', label: 'Grande' },
];

export default function Prenda() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { byId, wardrobe, removeMine, history, recordTry, setVerdict } = useCatalog();
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
  const size = result?.sizes.find((s) => s.label === selected) ?? null;

  const shell = useMemo(() => {
    if (!mannequin || !garment || !body) return null;
    return buildShell(mannequin.model, mannequin.vertices, body, garment, size);
  }, [mannequin, garment, body, size]);

  const recommended = result?.recommended ?? null;
  const garmentId = garment?.id;
  useEffect(() => {
    if (garmentId && profile) recordTry(garmentId, recommended);
  }, [garmentId, recommended, profile, recordTry]);

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

  const [share, setShare] = useState(false);
  const tried = history.find((h) => h.id === garmentId);

  if (!item || !garment) {
    return (
      <Screen back title="Prenda">
        <EmptyState icon="shirt-outline" title="No encontramos esta prenda" body="Puede que la hayas borrado o que ya no esté en el catálogo."
          action={<Button kind="dark" label="Ver el catálogo" onPress={() => router.replace('/probar')} />} />
      </Screen>
    );
  }

  const answer = (v: Verdict) => {
    setVerdict(garment.id ?? '', selected, v);
    if (share && remoteEnabled() && item.origin !== 'mine') {
      void submitFeedback({ garmentId: garment.id ?? '', size: selected, recommended, verdict: v }).catch(() => undefined);
    }
  };

  return (
    <Screen back title={garment.brand}>
      <View style={styles.head}>
        <BrandMark brand={garment.brand} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="h2">{shortName(garment.name)}</Txt>
          <Txt variant="small" tone="muted">
            {CATEGORY_NAMES[garment.category]}, corte {CUT_NAMES[garment.cut].toLowerCase()}
            {garment.chart_type === 'garment' ? ', con las medidas de la prenda' : ', según la guía de la marca'}
          </Txt>
        </View>
      </View>

      {!profile ? (
        <Card tone="indigo">
          <Txt variant="h2" tone="onIndigo">Para saber tu talla falta tu maniquí</Txt>
          <Txt tone="onIndigoMuted">Son dos minutos con una cinta métrica, y te sirve para todas las prendas.</Txt>
          <Button label="Crear mi maniquí" onPress={() => router.push('/medidas')} />
        </Card>
      ) : (
        <>
          {mannequin ? (
            <BodyViewer model={mannequin.model} vertices={mannequin.vertices} shell={shell} bodyHeight={mannequin.bodyHeight} height={440}>
              <Legend title={size ? `Talla ${size.label}` : undefined} />
            </BodyViewer>
          ) : <StagePlaceholder height={440}><Loading label="Preparando tu maniquí…" tone="onIndigo" /></StagePlaceholder>}

          {result ? (
            <>
              <View style={styles.bleed}>
                <SizePicker sizes={result.sizes} selected={selected} recommended={result.recommended}
                  onSelect={(label) => setPick({ id: String(id), label })} />
              </View>
              <Recommendation result={result} />
              {size ? <ZoneGauges size={size} isRecommended={size.label === result.recommended} /> : null}
            </>
          ) : null}

          <Card>
            <Txt variant="h2">Cómo te gusta la ropa</Txt>
            <Segmented value={preference} options={PREFS} onChange={(p) => void setPreference(p)} />
          </Card>

          {garment.chart_type === 'garment' ? (
            <Card>
              <Txt variant="h2">Compárala con una prenda tuya</Txt>
              {refs.length === 0 ? (
                <>
                  <Txt variant="small" tone="muted">
                    Mide una prenda que te quede bien y guárdala en tu armario: te diremos qué talla de esta se le parece más.
                  </Txt>
                  <Button kind="secondary" label="Ir a mi armario" onPress={() => router.push('/armario')} />
                </>
              ) : (
                <>
                  <Row wrap>
                    {refs.map((r) => (
                      <Chip key={r.id} label={r.name} selected={r.id === refId} onPress={() => setRefId(r.id === refId ? null : r.id)} />
                    ))}
                  </Row>
                  {refResult ? refResult.explanation.map((l) => <Txt key={l} variant="small">{es(l)}</Txt>) : null}
                </>
              )}
            </Card>
          ) : null}

          {result?.recommended ? (
            <Card tone="soft">
              <Txt variant="h2">¿La compraste? Cuéntanos cómo te quedó</Txt>
              <Txt variant="small" tone="muted">Con la talla {selected}. Así sabrás la próxima vez si esta marca talla pequeño o grande para ti.</Txt>
              <Row>
                {VERDICTS.map((v) => (
                  <Pressable key={v.value} onPress={() => answer(v.value)} accessibilityRole="button"
                    accessibilityState={{ selected: tried?.verdict === v.value }}
                    style={[styles.verdict, tried?.verdict === v.value && styles.verdictOn]}>
                    <Text style={[styles.verdictText, tried?.verdict === v.value && { color: color.onIndigo }]}>{v.label}</Text>
                  </Pressable>
                ))}
              </Row>
              {remoteEnabled() && item.origin !== 'mine' ? (
                <Pressable onPress={() => setShare((s) => !s)} accessibilityRole="checkbox" accessibilityState={{ checked: share }} style={styles.share}>
                  <View style={[styles.box, share && styles.boxOn]} />
                  <Text style={styles.shareText}>
                    Enviar mi respuesta de forma anónima para mejorar las tallas de todos. Solo viaja la prenda, la talla y
                    la respuesta; nunca tus medidas.
                  </Text>
                </Pressable>
              ) : null}
            </Card>
          ) : null}
        </>
      )}

      <Card>
        <Txt variant="h2">De dónde salen estas medidas</Txt>
        <Txt variant="small" tone="muted">{garment.source ?? 'Medidas introducidas a mano.'}</Txt>
        {garment.verified === false && item.origin !== 'mine' ? (
          <Notice tone="warn">Esta guía está pendiente de contrastar con la web oficial de la marca.</Notice>
        ) : null}
        {garment.url ? (
          <Button kind="secondary" icon="open-outline" label="Ver la guía de la marca" onPress={() => void Linking.openURL(garment.url!)} />
        ) : null}
        {item.origin === 'mine' ? (
          <Button kind="danger" label="Borrar esta prenda" onPress={() => {
            void removeMine(garment.id ?? '');
            router.replace('/probar');
          }} />
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  bleed: { marginHorizontal: -space.lg },
  verdict: {
    flex: 1, minHeight: 46, borderRadius: radius.pill, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center',
  },
  verdictOn: { backgroundColor: color.indigo },
  verdictText: { fontFamily: family.heading, fontSize: 14, color: color.ink },
  share: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: color.indigo, marginTop: 1 },
  boxOn: { backgroundColor: color.indigo },
  shareText: { flex: 1, fontFamily: family.body, fontSize: 13, color: color.ink, lineHeight: 19 },
});
