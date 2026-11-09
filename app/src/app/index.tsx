import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BodyViewer } from '../components/BodyViewer';
import { Button, Card, H1, H2, Loading, Notice, P, Row, Screen, Segmented } from '../components/ui';
import type { Preference } from '../core/ease';
import { BY_KEY, fmtG } from '../core/measurements';
import { useProfile } from '../lib/profile';
import { color, font, radius, space } from '../lib/theme';
import { useMannequin } from '../lib/useMannequin';

const PREFS: { value: Preference; label: string }[] = [
  { value: 'fitted', label: 'Ceñida' },
  { value: 'regular', label: 'Normal' },
  { value: 'loose', label: 'Holgada' },
];

export default function Home() {
  const { ready, profile } = useProfile();
  if (!ready) return <Screen><Loading label="Cargando…" /></Screen>;
  return profile ? <Dashboard /> : <Welcome />;
}

function Welcome() {
  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.kicker}>PROBADOR</Text>
        <H1>Tu talla, antes de comprar.</H1>
        <P muted>
          Crea un maniquí con tus medidas y compara cada talla zona a zona: dónde aprieta, dónde sobra y cuál te
          conviene.
        </P>
      </View>
      <Card>
        {[
          ['1', 'Mídete', 'Altura, peso y cuatro contornos con una cinta. Te explicamos cómo.'],
          ['2', 'Elige la prenda', 'Una marca de la lista, o las medidas de la prenda que estás mirando.'],
          ['3', 'Mira cómo te queda', 'Talla recomendada, explicación y el mapa de ajuste sobre tu maniquí.'],
        ].map(([n, t, d]) => (
          <View key={n} style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{t}</Text>
              <P small muted>{d}</P>
            </View>
          </View>
        ))}
      </Card>
      <Button label="Crear mi maniquí" onPress={() => router.push('/medidas')} />
      <Notice>Tus medidas se guardan solo en este dispositivo. No necesitas cuenta.</Notice>
      <Button kind="ghost" label="Cómo tratamos tus datos" onPress={() => router.push('/privacidad')} />
    </Screen>
  );
}

function Dashboard() {
  const { profile, prediction, modelError, retryModel, setPreference } = useProfile();
  const mannequin = useMannequin();
  if (!profile) return null;
  const given = new Set(Object.keys(profile.measurements));
  const shown = ['height', 'weight', 'chest', 'waist', 'hip', 'inseam'];

  return (
    <Screen>
      {mannequin ? (
        <BodyViewer model={mannequin.model} vertices={mannequin.vertices} bodyHeight={mannequin.bodyHeight} height={440} />
      ) : modelError ? (
        <Card>
          <P>No hemos podido cargar el maniquí: {modelError}</P>
          <Button kind="secondary" label="Reintentar" onPress={retryModel} />
        </Card>
      ) : (
        <View style={[styles.placeholder]}><Loading label="Preparando tu maniquí…" /></View>
      )}

      <Button label="Probar una prenda" onPress={() => router.push('/catalogo')} />
      <Row>
        <Button kind="secondary" label="Mi armario" onPress={() => router.push('/armario')} style={{ flex: 1 }} />
        <Button kind="secondary" label="Mis medidas" onPress={() => router.push('/medidas')} style={{ flex: 1 }} />
      </Row>

      <Card>
        <H2>Cómo te gusta la ropa</H2>
        <Segmented value={profile.preference} options={PREFS} onChange={(p) => void setPreference(p)} />
        <P small muted>Mueve la recomendación hacia tallas más ajustadas o más amplias.</P>
      </Card>

      <Card>
        <H2>Tu maniquí</H2>
        <View style={styles.grid}>
          {shown.map((k) => {
            const v = prediction?.measurements[k] ?? profile.measurements[k];
            if (v === undefined) return null;
            const sd = prediction?.uncertainty[k] ?? 0;
            return (
              <View key={k} style={styles.cell}>
                <Text style={styles.cellLabel}>{BY_KEY[k].name}</Text>
                <Text style={styles.cellValue}>{fmtG(v)} {BY_KEY[k].unit}</Text>
                {!given.has(k) ? <Text style={styles.cellEst}>estimada ±{fmtG(sd)}</Text> : null}
              </View>
            );
          })}
        </View>
        <P small muted>
          Las medidas que no has dado se estiman a partir de las demás. Cuantas más des, más fiable es la
          recomendación.
        </P>
      </Card>
      <Button kind="ghost" label="Privacidad y borrar mis datos" onPress={() => router.push('/privacidad')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.sm, paddingTop: space.lg },
  kicker: { fontSize: font.tiny, letterSpacing: 2, color: color.accent, fontWeight: '800' },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  stepNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { color: color.accent, fontWeight: '800' },
  stepTitle: { fontSize: font.body, fontWeight: '700', color: color.ink },
  placeholder: { height: 440, borderRadius: radius.lg, backgroundColor: color.stage, justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  cell: { width: '33.33%' },
  cellLabel: { fontSize: font.small, color: color.muted },
  cellValue: { fontSize: font.h3, fontWeight: '700', color: color.ink },
  cellEst: { fontSize: font.tiny, color: color.accent },
});
