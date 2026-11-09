import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, H2, Notice, NumberField, P, Row, Screen, TextField } from '../components/ui';
import { CATEGORIES, CATEGORY_NAMES, GARMENT_POINTS, type Category } from '../core/garments';
import { fmtG } from '../core/measurements';
import { useCatalog } from '../lib/catalog';
import { POINT_HELP, pointsFor } from '../lib/points';
import { color, font, space } from '../lib/theme';

export default function Armario() {
  const { wardrobe, addWardrobe, removeWardrobe } = useCatalog();
  const [adding, setAdding] = useState(wardrobe.length === 0);
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

  return (
    <Screen>
      <P muted>
        Guarda prendas tuyas que te queden como te gusta. Al mirar una prenda con su tabla de medidas te diremos qué
        talla se parece más a la tuya. Es la forma más fiable de acertar.
      </P>

      {wardrobe.map((w) => (
        <Card key={w.id}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{w.name}</Text>
              <P small muted>
                {CATEGORY_NAMES[w.category]} · {Object.entries(w.measurements).map(([k, v]) => `${GARMENT_POINTS[k]} ${fmtG(v)}`).join(' · ')} cm
              </P>
            </View>
            <Button kind="ghost" label="Quitar" onPress={() => void removeWardrobe(w.id)} />
          </View>
        </Card>
      ))}

      {adding ? (
        <Card>
          <H2>Añadir una prenda tuya</H2>
          <TextField label="Nombre" value={name} onChange={setName} placeholder="Ej.: mi camiseta blanca favorita" />
          <Row wrap>
            {CATEGORIES.map((c) => <Chip key={c} label={CATEGORY_NAMES[c]} selected={c === category} onPress={() => setCategory(c)} />)}
          </Row>
          <P small muted>Extiende la prenda sobre una mesa y mide en cm. Los contornos, completos (el doble del ancho a plano).</P>
          {points.map((p) => (
            <NumberField
              key={p}
              label={GARMENT_POINTS[p]}
              unit="cm"
              value={values[p] ?? ''}
              onChange={(v) => setValues((s) => ({ ...s, [p]: v }))}
              hint={POINT_HELP[p]}
            />
          ))}
          {error ? <Notice tone="warn">{error}</Notice> : null}
          <Button label="Guardar en mi armario" onPress={() => void save()} />
        </Card>
      ) : (
        <Button kind="secondary" label="+ Añadir una prenda tuya" onPress={() => setAdding(true)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { fontSize: font.body, fontWeight: '700', color: color.ink },
});
