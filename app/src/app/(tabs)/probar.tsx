import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GarmentRow } from '../../components/garment';
import { BrandMark, Button, Chip, EmptyState, IconButton, Notice, Row, Screen, SearchField, Txt } from '../../components/ui';
import { BOTTOMS, CATEGORY_NAMES, type Category } from '../../core/garments';
import { useCatalog } from '../../lib/catalog';
import { useProfile } from '../../lib/profile';
import { color, family, space } from '../../lib/theme';
import { useFits } from '../../lib/useFits';

type Audience = 'all' | 'men' | 'women';
type Group = 'all' | 'tops' | 'bottoms' | 'dresses';

const GROUPS: { value: Group; label: string; test: (c: Category) => boolean }[] = [
  { value: 'all', label: 'Todo', test: () => true },
  { value: 'tops', label: 'Parte de arriba', test: (c) => !BOTTOMS.has(c) && c !== 'dress' },
  { value: 'bottoms', label: 'Parte de abajo', test: (c) => BOTTOMS.has(c) },
  { value: 'dresses', label: 'Vestidos', test: (c) => c === 'dress' },
];

const ORIGIN_NOTE = { bundled: undefined, mine: 'Añadida por ti', community: 'Añadida por la comunidad' } as const;

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Probar() {
  const { items, remoteStatus } = useCatalog();
  const { profile } = useProfile();
  const [q, setQ] = useState('');
  const [audience, setAudience] = useState<Audience>(
    profile?.sex === 'male' ? 'men' : profile?.sex === 'female' ? 'women' : 'all',
  );
  const [group, setGroup] = useState<Group>('all');
  const [brand, setBrand] = useState<string | null>(null);
  const fits = useFits(items);

  const brands = useMemo(() => {
    const count = new Map<string, number>();
    for (const { garment: g } of items) count.set(g.brand, (count.get(g.brand) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [items]);

  const filtered = useMemo(() => {
    const needle = fold(q.trim());
    const test = GROUPS.find((g) => g.value === group)!.test;
    return items.filter(({ garment: g }) =>
      (audience === 'all' || !g.audience || g.audience === audience || g.audience === 'unisex')
      && test(g.category)
      && (!brand || g.brand === brand)
      && (!needle || fold(`${g.brand} ${g.name} ${CATEGORY_NAMES[g.category]}`).includes(needle)));
  }, [items, q, audience, group, brand]);

  return (
    <Screen tabs title="Probar" right={<IconButton icon="add" label="Añadir una prenda" filled onPress={() => router.push('/nueva-prenda')} />}>
      <SearchField value={q} onChange={setQ} placeholder="Busca una marca o una prenda" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.rail}>
        {brands.map(([b]) => (
          <Pressable key={b} onPress={() => setBrand(brand === b ? null : b)} style={styles.brandItem}
            accessibilityRole="button" accessibilityState={{ selected: brand === b }} accessibilityLabel={`Marca ${b}`}>
            <BrandMark brand={b} size={52} selected={brand === b} />
            <Text style={[styles.brandName, brand === b && { color: color.indigo, fontFamily: family.heading }]} numberOfLines={1}>{b}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={[styles.rail, { gap: 6 }]}>
        {([['all', 'Todos'], ['women', 'Mujer'], ['men', 'Hombre']] as const).map(([v, l]) => (
          <Chip key={v} label={l} selected={audience === v} onPress={() => setAudience(v)} />
        ))}
        <View style={styles.sep} />
        {GROUPS.map((g) => <Chip key={g.value} label={g.label} selected={group === g.value} onPress={() => setGroup(g.value)} />)}
      </ScrollView>

      {!profile ? (
        <Notice icon="body">
          Aún no tienes maniquí, así que no podemos decirte tu talla. Créalo en dos minutos desde Inicio.
        </Notice>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Txt variant="small" tone="muted">
          {filtered.length === 1 ? '1 guía de tallas' : `${filtered.length} guías de tallas`}{brand ? ` de ${brand}` : ''}
        </Txt>
        {filtered.map((it) => (
          <GarmentRow key={it.garment.id ?? it.garment.name} garment={it.garment} fit={fits.get(it.garment.id ?? '')} note={ORIGIN_NOTE[it.origin]} />
        ))}
      </View>

      {filtered.length === 0 ? (
        <EmptyState icon="search" title="No está en la lista" body="Copia la tabla de medidas de la tienda y te decimos tu talla igual."
          action={<Button kind="dark" label="Añadir esa prenda" onPress={() => router.push('/nueva-prenda')} />} />
      ) : (
        <View style={styles.add}>
          <Txt variant="h3">¿No encuentras la prenda que estás mirando?</Txt>
          <Txt variant="small" tone="muted">
            Copia su tabla de medidas de la web de la tienda. Con las medidas de la propia prenda la recomendación es
            más precisa que con la guía general de la marca.
          </Txt>
          <Row><Button kind="dark" label="Añadir una prenda" icon="add" onPress={() => router.push('/nueva-prenda')} /></Row>
        </View>
      )}
      {remoteStatus === 'error' ? (
        <Txt variant="small" tone="muted">Sin conexión con el catálogo compartido: ves las guías que vienen con la app.</Txt>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -space.lg, flexGrow: 0 },
  rail: { paddingHorizontal: space.lg, gap: space.md, alignItems: 'center' },
  brandItem: { alignItems: 'center', gap: 5, width: 64 },
  brandName: { fontFamily: family.medium, fontSize: 11, color: color.muted, textAlign: 'center', width: 64 },
  sep: { width: 1, height: 22, backgroundColor: color.line, marginHorizontal: 4 },
  add: { backgroundColor: color.indigoSoft, borderRadius: 20, padding: space.lg, gap: space.sm },
});
