import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, ListRow, Screen, Segmented, Txt } from '../../components/ui';
import { ENGINE_VERSION } from '../../core/ease';
import { MEASUREMENTS } from '../../core/measurements';
import { useCatalog } from '../../lib/catalog';
import { PREFS } from '../../lib/prefs';
import { useProfile } from '../../lib/profile';
import { color, family, space } from '../../lib/theme';

export default function Perfil() {
  const { profile, setPreference } = useProfile();
  const { items, wardrobe, history } = useCatalog();
  const given = profile ? Object.keys(profile.measurements).length : 0;
  const brands = new Set(items.filter((i) => i.origin !== 'mine').map((i) => i.garment.brand)).size;
  const mine = items.filter((i) => i.origin === 'mine').length;

  return (
    <Screen tabs title="Perfil">
      {profile ? (
        <Card tone="indigo">
          <Txt variant="h2" tone="onIndigo">Tu maniquí</Txt>
          <View style={styles.stats}>
            {[[String(given), `de ${MEASUREMENTS.length} medidas`], [String(wardrobe.length), 'prendas tuyas'], [String(history.length), 'prendas miradas']].map(([n, l]) => (
              <View key={l} style={styles.stat}>
                <Text style={styles.statNum}>{n}</Text>
                <Text style={styles.statLabel}>{l}</Text>
              </View>
            ))}
          </View>
          <Button label="Editar mis medidas" icon="create-outline" onPress={() => router.push('/medidas')} />
        </Card>
      ) : (
        <Card tone="indigo">
          <Txt variant="h2" tone="onIndigo">Aún no tienes maniquí</Txt>
          <Txt tone="onIndigoMuted">Créalo con tu altura, tu peso y cuatro medidas para ver tu talla en cada prenda.</Txt>
          <Button label="Crear mi maniquí" onPress={() => router.push('/medidas')} />
        </Card>
      )}

      {profile ? (
        <Card>
          <Txt variant="h3">Cómo te gusta la ropa</Txt>
          <Segmented value={profile.preference} options={PREFS} onChange={(p) => void setPreference(p)} />
        </Card>
      ) : null}

      <Card style={{ gap: 0, paddingVertical: space.xs }}>
        <ListRow icon="add-circle-outline" title="Añadir una prenda" detail={mine ? `Has añadido ${mine}` : 'Copia la tabla de medidas de una tienda'} onPress={() => router.push('/nueva-prenda')} />
        <ListRow icon="lock-closed-outline" title="Privacidad" detail="Qué se guarda y dónde" onPress={() => router.push('/privacidad')} />
        <ListRow icon="sparkles-outline" title="Ver la presentación" detail="Cómo funciona Probador" onPress={() => router.push('/bienvenida')} />
        <ListRow icon="trash-outline" title="Borrar mis datos" danger last onPress={() => router.push('/privacidad')} />
      </Card>

      <Txt variant="small" tone="faint" style={{ textAlign: 'center' }}>
        Probador 0.2, motor de tallas {ENGINE_VERSION}. {items.length} guías de {brands} marcas.{'\n'}
        Las recomendaciones son orientativas: la talla final depende del tejido y de cada prenda.
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, backgroundColor: color.indigoDeep, borderRadius: 14, padding: space.md },
  statNum: { fontFamily: family.numBold, fontSize: 34, lineHeight: 36, color: color.tape },
  statLabel: { fontFamily: family.medium, fontSize: 12, color: color.onIndigoMuted },
});
