import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, H2, Notice, P, Row, Screen, Segmented, TextField } from '../components/ui';
import { BOTTOMS, CATEGORIES, CATEGORY_NAMES, CUT_NAMES, CUTS, GARMENT_POINTS, parseGarment, type Category, type ChartType, type RawGarment } from '../core/garments';
import type { Cut } from '../core/ease';
import { useCatalog } from '../lib/catalog';
import { CIRCUMFERENCES, POINT_HELP, parseValue, pointsFor } from '../lib/points';
import { remoteEnabled, submitGarment } from '../lib/remote';
import { color, font, radius, space } from '../lib/theme';

interface SizeRow { label: string; values: Record<string, string> }

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

export default function NuevaPrenda() {
  const { addMine } = useCatalog();
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('tshirt');
  const [cut, setCut] = useState<Cut>('regular');
  const [chart, setChart] = useState<ChartType>('garment');
  const [flat, setFlat] = useState(false);
  const [elastane, setElastane] = useState('');
  const [rows, setRows] = useState<SizeRow[]>([{ label: 'S', values: {} }, { label: 'M', values: {} }, { label: 'L', values: {} }]);
  const [share, setShare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const points = useMemo(() => pointsFor(category, chart), [category, chart]);

  const build = (): RawGarment => {
    const e = Math.min(parseFloat(elastane.replace(',', '.')), 100);
    const composition: Record<string, number> = Number.isFinite(e) && e > 0 ? { elastano: e, otros: 100 - e } : {};
    const sizes = rows.filter((r) => r.label.trim()).map((r) => {
      const measurements: Record<string, number | [number, number]> = {};
      for (const p of points) {
        const v = parseValue(r.values[p] ?? '');
        if (v === null) continue;
        if (chart === 'garment' && Array.isArray(v)) throw new Error(`${GARMENT_POINTS[p]} de la talla ${r.label}: en medidas de la prenda pon un solo número.`);
        const key = chart === 'garment' && flat && CIRCUMFERENCES.has(p) ? `${p}_flat` : p;
        measurements[key] = v;
      }
      return { label: r.label.trim(), measurements };
    }).filter((s) => Object.keys(s.measurements).length > 0);
    return {
      id: `mia-${slug(brand)}-${slug(name)}-${Date.now().toString(36)}`,
      brand: brand.trim() || 'Sin marca', name: name.trim() || CATEGORY_NAMES[category],
      category, cut, chart_type: chart, composition, sizes,
      source: chart === 'garment' ? 'Medidas de la prenda introducidas por el usuario' : 'Guía de tallas introducida por el usuario',
      verified: false,
    };
  };

  const save = async () => {
    setError(null);
    let raw: RawGarment;
    try {
      raw = build();
      parseGarment(raw);
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Prenda no válida \(sizes\): /, '') : 'Revisa los datos.');
      return;
    }
    setBusy(true);
    try {
      await addMine(raw);
      if (share && remoteEnabled()) {
        try {
          await submitGarment(raw);
        } catch {
          // La prenda queda guardada en el móvil aunque el envío falle.
        }
      }
      router.replace({ pathname: '/prenda/[id]', params: { id: raw.id! } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <P muted>
        Copia la tabla de medidas de la web de la tienda (o mide la prenda en casa). Con las medidas de la propia
        prenda la recomendación es mucho más precisa que con una guía por cuerpo.
      </P>
      <Card>
        <TextField label="Marca" value={brand} onChange={setBrand} placeholder="Ej.: la tienda" />
        <TextField label="Nombre" value={name} onChange={setName} placeholder="Ej.: camiseta de algodón" />
        <Text style={styles.label}>Tipo de prenda</Text>
        <Row wrap>
          {CATEGORIES.map((c) => <Chip key={c} label={CATEGORY_NAMES[c]} selected={c === category} onPress={() => setCategory(c)} />)}
        </Row>
        <Text style={styles.label}>Corte</Text>
        <Segmented value={cut} options={CUTS.map((c) => ({ value: c, label: CUT_NAMES[c] }))} onChange={setCut} />
      </Card>

      <Card>
        <H2>¿Qué medidas tienes?</H2>
        <Segmented<ChartType>
          value={chart}
          options={[{ value: 'garment', label: 'De la prenda' }, { value: 'body', label: 'Guía por cuerpo' }]}
          onChange={setChart}
        />
        <P small muted>
          {chart === 'garment'
            ? 'Lo que mide la prenda extendida, en cm.'
            : 'Las medidas del cuerpo para cada talla. Puedes poner un intervalo, por ejemplo 96-101.'}
        </P>
        {chart === 'garment' ? (
          <Pressable onPress={() => setFlat((f) => !f)} style={styles.toggle} accessibilityRole="checkbox" accessibilityState={{ checked: flat }}>
            <View style={[styles.box, flat && styles.boxOn]} />
            <Text style={styles.toggleText}>Los contornos vienen «a plano» (la mitad, de costura a costura)</Text>
          </Pressable>
        ) : null}
        <View style={styles.inline}>
          <Text style={styles.label}>Elastano (%)</Text>
          <TextInput value={elastane} onChangeText={setElastane} keyboardType="decimal-pad" placeholder="0" style={styles.cell} accessibilityLabel="Porcentaje de elastano" />
        </View>
      </Card>

      <Card>
        <H2>Tallas</H2>
        <View style={styles.headRow}>
          <Text style={[styles.colHead, { width: 64 }]}>Talla</Text>
          {points.map((p) => <Text key={p} style={styles.colHead} numberOfLines={2}>{GARMENT_POINTS[p]}</Text>)}
        </View>
        {rows.map((r, i) => (
          <View key={i} style={styles.headRow}>
            <TextInput
              value={r.label}
              onChangeText={(t) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, label: t } : x)))}
              style={[styles.cell, { width: 64 }]}
              accessibilityLabel={`Nombre de la talla ${i + 1}`}
            />
            {points.map((p) => (
              <TextInput
                key={p}
                value={r.values[p] ?? ''}
                onChangeText={(t) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, values: { ...x.values, [p]: t } } : x)))}
                keyboardType={chart === 'body' ? 'numbers-and-punctuation' : 'decimal-pad'}
                style={[styles.cell, { flex: 1 }]}
                accessibilityLabel={`${GARMENT_POINTS[p]} de la talla ${r.label || i + 1}`}
              />
            ))}
          </View>
        ))}
        <Row>
          <Button kind="secondary" label="+ Talla" onPress={() => setRows((rs) => [...rs, { label: '', values: {} }])} style={{ flex: 1 }} />
          {rows.length > 1 ? (
            <Button kind="secondary" label="− Quitar última" onPress={() => setRows((rs) => rs.slice(0, -1))} style={{ flex: 1 }} />
          ) : null}
        </Row>
        <P small muted>{points.map((p) => `${GARMENT_POINTS[p]}: ${POINT_HELP[p] ?? ''}`).join(' · ')}</P>
        {BOTTOMS.has(category) ? <P small muted>Si la marca da la talla como W32 / L32, la cintura en cm es la medida que importa.</P> : null}
      </Card>

      {remoteEnabled() ? (
        <Pressable onPress={() => setShare((s) => !s)} style={styles.toggle} accessibilityRole="checkbox" accessibilityState={{ checked: share }}>
          <View style={[styles.box, share && styles.boxOn]} />
          <Text style={styles.toggleText}>
            Compartir esta prenda con otros usuarios. Solo se envía la tabla de la prenda, nunca tus medidas; la
            revisamos antes de publicarla.
          </Text>
        </Pressable>
      ) : null}

      {error ? <Notice tone="warn">{error}</Notice> : null}
      <Button label="Guardar y ver mi talla" onPress={() => void save()} busy={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.body, fontWeight: '600', color: color.ink },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  colHead: { flex: 1, fontSize: font.tiny, color: color.muted, fontWeight: '700', textAlign: 'center' },
  cell: {
    borderWidth: 1, borderColor: color.line, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 6,
    fontSize: font.small, color: color.ink, backgroundColor: color.surface, textAlign: 'center', minWidth: 0,
  },
  toggle: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  box: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: color.accent, marginTop: 1 },
  boxOn: { backgroundColor: color.accent },
  toggleText: { flex: 1, fontSize: font.small, color: color.ink, lineHeight: 19 },
});
