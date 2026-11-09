import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H2, Notice, NumberField, P, Screen, Segmented } from '../components/ui';
import { predictBody, type Sex } from '../core/bodyModel';
import { MEASUREMENTS, MeasurementError, fmtG, validateMeasurements, type Body } from '../core/measurements';
import { useProfile } from '../lib/profile';
import { color, font, radius, space } from '../lib/theme';

const SEXES: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Cuerpo femenino' },
  { value: 'male', label: 'Cuerpo masculino' },
];

function toText(v: number | undefined) {
  return v === undefined ? '' : String(v);
}

export default function Medidas() {
  const { profile, model, setProfile } = useProfile();
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'female');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(MEASUREMENTS.map((m) => [m.key, toText(profile?.measurements[m.key])])));
  const [showHow, setShowHow] = useState(false);
  const [showMore, setShowMore] = useState(() => MEASUREMENTS.some((m) => !m.basic && profile?.measurements[m.key] !== undefined));
  const [consent, setConsent] = useState(!!profile);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    const out: Body = {};
    for (const [k, v] of Object.entries(values)) {
      const n = parseFloat(v);
      if (v.trim() !== '' && Number.isFinite(n)) out[k] = n;
    }
    return out;
  }, [values]);

  const warnings = useMemo(() => {
    try {
      return validateMeasurements(parsed);
    } catch {
      return [];
    }
  }, [parsed]);

  // Estimación en vivo de las medidas que faltan (se ven como sugerencia).
  const estimate = useMemo(() => {
    if (!model || parsed.height === undefined || parsed.weight === undefined) return null;
    try {
      return predictBody(model, sex, parsed);
    } catch {
      return null;
    }
  }, [model, sex, parsed]);

  const save = async () => {
    setError(null);
    try {
      validateMeasurements(parsed);
    } catch (e) {
      setError(e instanceof MeasurementError ? e.message : 'Revisa las medidas.');
      return;
    }
    if (!consent) {
      setError('Para guardar tus medidas tienes que aceptar que se guarden en este dispositivo.');
      return;
    }
    const now = new Date().toISOString();
    await setProfile({
      version: 1, sex, measurements: parsed, preference: profile?.preference ?? 'regular',
      consentAt: profile?.consentAt ?? now, updatedAt: now,
    });
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const field = (key: string) => {
    const m = MEASUREMENTS.find((x) => x.key === key)!;
    const est = estimate && values[key] === '' ? estimate.measurements[key] : undefined;
    return (
      <NumberField
        key={key}
        label={m.name}
        unit={m.unit}
        value={values[key]}
        onChange={(v) => setValues((s) => ({ ...s, [key]: v }))}
        placeholder={est !== undefined ? `≈ ${fmtG(est)}` : undefined}
        estimated={est !== undefined}
        hint={showHow ? m.howTo : undefined}
      />
    );
  };

  return (
    <Screen>
      <Card>
        <H2>Base del maniquí</H2>
        <Segmented value={sex} options={SEXES} onChange={setSex} />
        <P small muted>Es solo la forma de partida del maniquí; tus medidas la ajustan.</P>
      </Card>

      <Card>
        <View style={styles.head}>
          <H2>Medidas básicas</H2>
          <Pressable onPress={() => setShowHow((s) => !s)} accessibilityRole="button">
            <Text style={styles.link}>{showHow ? 'Ocultar cómo medir' : 'Cómo medir'}</Text>
          </Pressable>
        </View>
        <P small muted>Con cinta métrica, sobre ropa interior o ropa fina. Altura y peso son imprescindibles.</P>
        {MEASUREMENTS.filter((m) => m.basic).map((m) => field(m.key))}
      </Card>

      <Card>
        <Pressable onPress={() => setShowMore((s) => !s)} accessibilityRole="button" style={styles.head}>
          <H2>Más medidas (opcional)</H2>
          <Text style={styles.link}>{showMore ? 'Ocultar' : 'Mostrar'}</Text>
        </Pressable>
        <P small muted>
          Si no las das, las estimamos (en verde, con «≈»). Hombros, brazo y muslo mejoran mucho camisas y pantalones.
        </P>
        {showMore ? MEASUREMENTS.filter((m) => !m.basic).map((m) => field(m.key)) : null}
      </Card>

      {warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}

      <Pressable
        onPress={() => setConsent((c) => !c)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        style={styles.consent}
      >
        <View style={[styles.box, consent && styles.boxOn]}>{consent ? <Text style={styles.tick}>✓</Text> : null}</View>
        <Text style={styles.consentText}>
          Acepto que mis medidas se guarden en este dispositivo para crear mi maniquí. No se envían a ningún
          servidor y puedo borrarlas cuando quiera.
        </Text>
      </Pressable>

      {error ? <Notice tone="warn">{error}</Notice> : null}
      <Button label={profile ? 'Guardar cambios' : 'Crear mi maniquí'} onPress={() => void save()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: color.accent, fontWeight: '700', fontSize: font.small },
  consent: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  box: {
    width: 24, height: 24, borderRadius: radius.sm / 2, borderWidth: 2, borderColor: color.accent,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  boxOn: { backgroundColor: color.accent },
  tick: { color: color.accentInk, fontWeight: '900', fontSize: 14 },
  consentText: { flex: 1, fontSize: font.small, color: color.ink, lineHeight: 19 },
});
