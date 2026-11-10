import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, EmptyState, IconButton, Notice, NumberField, Row, Screen, TextField, Txt } from '../../components/ui';
import { CATEGORIES, CATEGORY_NAMES, GARMENT_POINTS, type Category } from '../../core/garments';
import { fmtG } from '../../core/measurements';
import { useCatalog } from '../../lib/catalog';
import { es } from '../../lib/format';
import { POINT_HELP, pointsFor } from '../../lib/points';
import { color, family, radius, space } from '../../lib/theme';

export default function Armario() {
  const { wardrobe, addWardrobe, removeWardrobe } = useCatalog();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('tshirt');
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const points = useMemo(() => pointsFor(category, 'garment'), [category]);

  const save = async () => {
    const measurements: Record<string, number> = {};
    for (const p of points) {
      const n = parseFloat((values[p] ?? '').replace(',', '.'));
      if (Number.isFinite(n) && n > 0) measurements[p] = n;
    }
    if (!Object.keys(measurements).length) {
      setError('Añade al menos una medida de la prenda.');
      return;
    }
    await addWardrobe({ name: name.trim() || `Mi ${CATEGORY_NAMES[category].toLowerCase()}`, category, measurements });
    setName('');
    setValues({});
    setError(null);
    setAdding(false);
  };

  const form = (
    <Card>
      <View style={styles.formHead}>
        <Txt variant="h2">Una prenda que te queda bien</Txt>
        <IconButton icon="close" label="Cerrar" onPress={() => setAdding(false)} />
      </View>
      <TextField label="Cómo la llamas" value={name} onChange={setName} placeholder="Mi camiseta blanca favorita" />
      <Txt variant="label">Qué es</Txt>
      <Row wrap>
        {CATEGORIES.map((c) => <Chip key={c} label={CATEGORY_NAMES[c]} selected={c === category} onPress={() => setCategory(c)} />)}
      </Row>
      <Notice icon="resize">Extiéndela sobre una mesa y mide en centímetros. Los contornos, completos: el doble del ancho de lado a lado.</Notice>
      {points.map((p) => (
        <NumberField key={p} label={GARMENT_POINTS[p]} unit="cm" value={values[p] ?? ''}
          onChange={(v) => setValues((s) => ({ ...s, [p]: v }))} hint={POINT_HELP[p]} />
      ))}
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <Button label="Guardar en mi armario" onPress={() => void save()} />
    </Card>
  );

  return (
    <Screen tabs title="Armario"
      right={!adding && wardrobe.length ? <IconButton icon="add" label="Añadir una prenda tuya" filled onPress={() => setAdding(true)} /> : undefined}>
      {adding ? form : null}

      {!adding && wardrobe.length === 0 ? (
        <EmptyState
          icon="file-tray-stacked-outline"
          title="La talla más fiable ya está en tu armario"
          body="Guarda las medidas de una prenda que te quede como te gusta. Cuando mires otra con su tabla de medidas, te diremos qué talla se le parece más."
          action={<Button kind="dark" icon="add" label="Medir una prenda mía" onPress={() => setAdding(true)} />}
        />
      ) : null}

      {wardrobe.length ? (
        <Txt tone="muted">
          Al mirar una prenda con su tabla de medidas podrás compararla con cualquiera de estas.
        </Txt>
      ) : null}
      {wardrobe.map((w) => (
        <Card key={w.id}>
          <View style={styles.itemHead}>
            <View style={{ flex: 1 }}>
              <Txt variant="h3">{w.name}</Txt>
              <Txt variant="small" tone="muted">{CATEGORY_NAMES[w.category]}</Txt>
            </View>
            <IconButton icon="trash-outline" label={`Quitar ${w.name}`} tone="danger" onPress={() => void removeWardrobe(w.id)} />
          </View>
          <View style={styles.measures}>
            {Object.entries(w.measurements).map(([k, v]) => (
              <View key={k} style={styles.measure}>
                <Text style={styles.measureValue}>{es(fmtG(v))}</Text>
                <Text style={styles.measureLabel}>{GARMENT_POINTS[k] ?? k}</Text>
              </View>
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  formHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  measures: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  measure: { backgroundColor: color.bg, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, minWidth: 76 },
  measureValue: { fontFamily: family.numBold, fontSize: 22, lineHeight: 24, color: color.ink },
  measureLabel: { fontFamily: family.medium, fontSize: 11, color: color.muted },
});
