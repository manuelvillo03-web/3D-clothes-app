import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Badge, Button, Chip, P, Row, Screen } from '../components/ui';
import { fitGarment } from '../core/fit';
import { BOTTOMS, CATEGORY_NAMES, type Category } from '../core/garments';
import { useCatalog, type CatalogItem } from '../lib/catalog';
import { useProfile } from '../lib/profile';
import { color, font, radius, space, statusColor } from '../lib/theme';

type Audience = 'all' | 'men' | 'women';
type Group = 'all' | 'tops' | 'bottoms' | 'dresses';

const GROUPS: { value: Group; label: string; test: (c: Category) => boolean }[] = [
  { value: 'all', label: 'Todo', test: () => true },
  { value: 'tops', label: 'Arriba', test: (c) => !BOTTOMS.has(c) && c !== 'dress' },
  { value: 'bottoms', label: 'Abajo', test: (c) => BOTTOMS.has(c) },
  { value: 'dresses', label: 'Vestidos', test: (c) => c === 'dress' },
];

const ORIGIN: Record<CatalogItem['origin'], string> = {
  bundled: '', mine: 'Añadida por ti', community: 'Comunidad',
};

export default function Catalogo() {
  const { items, remoteStatus } = useCatalog();
  const { profile, body } = useProfile();
  const [q, setQ] = useState('');
  const [audience, setAudience] = useState<Audience>(
    profile?.sex === 'male' ? 'men' : profile?.sex === 'female' ? 'women' : 'all',
  );
  const [group, setGroup] = useState<Group>('all');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const test = GROUPS.find((g) => g.value === group)!.test;
    return items.filter(({ garment: g }) =>
      (audience === 'all' || !g.audience || g.audience === audience || g.audience === 'unisex')
      && test(g.category)
      && (!needle || `${g.brand} ${g.name} ${CATEGORY_NAMES[g.category]}`.toLowerCase().includes(needle)));
  }, [items, q, audience, group]);

  return (
    <Screen>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Busca una marca o prenda"
        placeholderTextColor={color.faint}
        style={styles.search}
        accessibilityLabel="Buscar en el catálogo"
      />
      <Row wrap>
        {([['all', 'Todos'], ['women', 'Mujer'], ['men', 'Hombre']] as const).map(([v, l]) => (
          <Chip key={v} label={l} selected={audience === v} onPress={() => setAudience(v)} />
        ))}
      </Row>
      <Row wrap>
        {GROUPS.map((g) => <Chip key={g.value} label={g.label} selected={group === g.value} onPress={() => setGroup(g.value)} />)}
      </Row>

      <Button kind="secondary" label="+ Añadir la prenda que estás mirando" onPress={() => router.push('/nueva-prenda')} />

      {filtered.length === 0 ? <P muted>No hay prendas con esos filtros.</P> : null}
      {filtered.map((it) => {
        const g = it.garment;
        let size: string | null = null;
        let wearable = true;
        if (body) {
          try {
            const r = fitGarment(g, body, profile?.preference ?? 'regular');
            size = r.recommended;
            wearable = r.sizes.find((s) => s.label === size)?.wearable ?? true;
          } catch {
            size = null;
          }
        }
        return (
          <Pressable
            key={g.id ?? g.name}
            onPress={() => router.push({ pathname: '/prenda/[id]', params: { id: g.id ?? '' } })}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={`${g.brand}, ${g.name}${size ? `, tu talla ${size}` : ''}`}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.brand}>{g.brand.toUpperCase()}</Text>
              <Text style={styles.name}>{g.name}</Text>
              <Row wrap>
                <Badge label={CATEGORY_NAMES[g.category]} tint={color.muted} />
                <Badge
                  label={g.chart_type === 'garment' ? 'Medidas de la prenda' : 'Guía por cuerpo'}
                  tint={g.chart_type === 'garment' ? color.accent : color.muted}
                />
                {ORIGIN[it.origin] ? <Badge label={ORIGIN[it.origin]} tint={statusColor.loose} /> : null}
              </Row>
            </View>
            {size ? (
              <View style={[styles.size, !wearable && { backgroundColor: '#F7DCD9' }]}>
                <Text style={styles.sizeLabel}>tu talla</Text>
                <Text style={[styles.sizeValue, !wearable && { color: statusColor.tight }]}>{size}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
      {remoteStatus === 'error' ? (
        <P small muted>Sin conexión con el catálogo compartido: se muestran las guías incluidas en la app.</P>
      ) : null}
      <P small muted>
        Las guías de tallas son las publicadas por cada marca (medidas del cuerpo). Cada ficha enlaza a su fuente.
      </P>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.line,
    paddingHorizontal: space.lg, paddingVertical: 12, fontSize: font.body, color: color.ink,
  },
  item: {
    flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: color.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: color.line, padding: space.lg,
  },
  brand: { fontSize: font.tiny, letterSpacing: 1.5, color: color.muted, fontWeight: '800' },
  name: { fontSize: font.body, fontWeight: '700', color: color.ink },
  size: {
    minWidth: 64, paddingHorizontal: space.sm, paddingVertical: space.sm, borderRadius: radius.md,
    backgroundColor: color.accentSoft, alignItems: 'center',
  },
  sizeLabel: { fontSize: font.tiny, color: color.accent, fontWeight: '700' },
  sizeValue: { fontSize: font.h2, color: color.accent, fontWeight: '800' },
});
