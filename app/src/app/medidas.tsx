import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BodyViewer, StagePlaceholder } from '../components/BodyViewer';
import { Button, Card, Loading, Notice, NumberField, Screen, Segmented, Txt } from '../components/ui';
import { markerFor } from '../core/bodyMarkers';
import { buildVertices, predictBody, type Sex } from '../core/bodyModel';
import { BY_KEY, MEASUREMENTS, MeasurementError, fmtG, validateMeasurements, type Body } from '../core/measurements';
import { useProfile } from '../lib/profile';
import { es } from '../lib/format';
import { color, family, noOutline, radius, space } from '../lib/theme';

const SEXES: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Femenino' },
  { value: 'male', label: 'Masculino' },
];
const DEFAULT: Record<Sex, Body> = { female: { height: 165, weight: 62 }, male: { height: 177, weight: 77 } };
const STEPS = ['base', 'chest', 'waist', 'hip', 'inseam', 'final'] as const;
const WHY: Record<string, string> = {
  chest: 'Decide la talla de camisetas, camisas, jerséis y chaquetas.',
  waist: 'Decide la talla de pantalones y faldas, y cómo sienta un vestido.',
  hip: 'Es donde más aprietan los pantalones cuando la talla se queda corta.',
  inseam: 'Dice si un pantalón te queda largo o pesquero.',
};

const toText = (v: number | undefined) => (v === undefined ? '' : String(v));
const round1 = (v: number) => fmtG(Math.round(v * 10) / 10);

export default function Medidas() {
  const { profile, model, setProfile } = useProfile();
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'female');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(MEASUREMENTS.map((m) => [m.key, toText(profile?.measurements[m.key])])));
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(() => MEASUREMENTS.some((m) => !m.basic && profile?.measurements[m.key] !== undefined));
  const [consent, setConsent] = useState(!!profile);
  const [error, setError] = useState<string | null>(null);
  const wizard = !profile;
  const current = wizard ? STEPS[step] : null;
  const shownKey = wizard ? (current === 'base' ? 'height' : current === 'final' ? focus : current) : focus;

  const parsed = useMemo(() => {
    const out: Body = {};
    for (const [k, v] of Object.entries(values)) {
      const n = parseFloat(v);
      if (v.trim() !== '' && Number.isFinite(n) && n > 0) out[k] = n;
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

  // Maniquí en vivo: con altura y peso creíbles ya es el del usuario; antes, uno medio.
  const live = useMemo(() => {
    if (!model) return null;
    const plausible = parsed.height >= 120 && parsed.height <= 230 && parsed.weight >= 30 && parsed.weight <= 250;
    try {
      const p = predictBody(model, sex, plausible ? parsed : DEFAULT[sex]);
      const vertices = buildVertices(model, p.coefficients);
      return { prediction: p, vertices, mine: plausible, bodyHeight: (p.measurements.height ?? 170) / 100 };
    } catch {
      return null;
    }
  }, [model, sex, parsed]);

  const marker = useMemo(
    () => (live && model && shownKey ? markerFor(model, live.vertices, live.prediction.measurements, shownKey) : null),
    [live, model, shownKey],
  );

  const set = (key: string, v: string) => setValues((s) => ({ ...s, [key]: v }));
  const estimateOf = (key: string) => (live?.mine && values[key] === '' ? live.prediction.measurements[key] : undefined);

  const save = async () => {
    setError(null);
    try {
      validateMeasurements(parsed);
    } catch (e) {
      setError(e instanceof MeasurementError ? e.message : 'Revisa las medidas.');
      return;
    }
    if (!consent) {
      setError('Marca la casilla para guardar tus medidas en este dispositivo.');
      return;
    }
    const now = new Date().toISOString();
    await setProfile({
      version: 1, sex, measurements: parsed, preference: profile?.preference ?? 'regular',
      consentAt: profile?.consentAt ?? now, updatedAt: now,
    });
    if (wizard || !router.canGoBack()) router.replace('/');
    else router.back();
  };

  const next = () => {
    setError(null);
    if (current === 'base') {
      try {
        validateMeasurements({ height: parsed.height, weight: parsed.weight } as Body);
      } catch {
        setError('Para empezar necesitamos tu altura y tu peso.');
        return;
      }
      if (!(parsed.height >= 120 && parsed.height <= 230 && parsed.weight >= 30 && parsed.weight <= 250)) {
        setError('Revisa la altura (en cm) y el peso (en kg): no parecen correctos.');
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const caption = shownKey && BY_KEY[shownKey] && shownKey !== 'weight' && shownKey !== 'height' ? (() => {
    const given = parsed[shownKey];
    const est = estimateOf(shownKey);
    const v = given ?? est;
    if (v === undefined) return null;
    return (
      <View style={styles.caption}>
        <Text style={styles.captionLabel}>{BY_KEY[shownKey].name}</Text>
        <Text style={styles.captionValue}>{given === undefined ? '≈ ' : ''}{es(round1(v))} cm</Text>
      </View>
    );
  })() : null;

  const stage = live ? (
    <BodyViewer model={model!} vertices={live.vertices} bodyHeight={live.bodyHeight} marker={marker}
      height={wizard ? 250 : 300} caption={caption} controls={!wizard || current === 'final'} />
  ) : (
    <StagePlaceholder height={wizard ? 250 : 300}><Loading label="Preparando el maniquí…" tone="onIndigo" /></StagePlaceholder>
  );

  const field = (key: string) => {
    const m = BY_KEY[key];
    const est = estimateOf(key);
    const sd = live?.prediction.uncertainty[key];
    return (
      <NumberField
        key={key}
        label={m.name}
        unit={m.unit}
        value={values[key]}
        onChange={(v) => set(key, v)}
        onFocus={() => setFocus(key)}
        active={focus === key}
        placeholder={est !== undefined ? `≈ ${fmtG(Math.round(est))}` : undefined}
        estimated={est !== undefined}
        hint={focus === key ? `${m.howTo}${est !== undefined && sd ? ` Si la dejas vacía usamos ≈ ${es(round1(est))} ${m.unit} (±${es(round1(sd))}).` : ''}` : undefined}
      />
    );
  };

  const consentBox = (
    <Pressable onPress={() => setConsent((c) => !c)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} style={styles.consent}>
      <View style={[styles.box, consent && styles.boxOn]}>{consent ? <Ionicons name="checkmark" size={16} color={color.tape} /> : null}</View>
      <Text style={styles.consentText}>
        Acepto que mis medidas se guarden en este dispositivo para crear mi maniquí. No se envían a ningún servidor y
        puedo borrarlas cuando quiera.
      </Text>
    </Pressable>
  );

  const more = (
    <Card>
      <Pressable onPress={() => setShowMore((s) => !s)} accessibilityRole="button" accessibilityState={{ expanded: showMore }} style={styles.head}>
        <View style={{ flex: 1 }}>
          <Txt variant="h3">Más medidas, si quieres afinar</Txt>
          <Txt variant="small" tone="muted">Hombros, brazo y muslo mejoran camisas y pantalones.</Txt>
        </View>
        <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={20} color={color.muted} />
      </Pressable>
      {showMore ? MEASUREMENTS.filter((m) => !m.basic).map((m) => field(m.key)) : null}
    </Card>
  );

  // ------------------------------------------------------------ asistente
  if (wizard) {
    const m = current && current !== 'base' && current !== 'final' ? BY_KEY[current] : null;
    const est = m ? estimateOf(m.key) : undefined;
    const sd = m ? live?.prediction.uncertainty[m.key] : undefined;
    const empty = m ? values[m.key] === '' : false;
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen
          back
          title={`Paso ${step + 1} de ${STEPS.length}`}
          footer={
            <View style={styles.footerRow}>
              {step > 0 ? <Button kind="secondary" label="Atrás" onPress={() => { setError(null); setStep((s) => s - 1); }} style={{ flex: 1 }} /> : null}
              {current === 'final'
                ? <Button label="Crear mi maniquí" onPress={() => void save()} style={{ flex: 2 }} />
                : <Button label={m && empty ? 'No la sé, saltar' : 'Siguiente'} kind={m && empty ? 'dark' : 'primary'} onPress={next} style={{ flex: 2 }} />}
            </View>
          }
        >
          <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: STEPS.length, now: step + 1 }}>
            <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
          </View>
          {stage}

          {current === 'base' ? (
            <>
              <View style={{ gap: 4 }}>
                <Txt variant="title">Empecemos por lo básico</Txt>
                <Txt tone="muted">
                  Con la altura y el peso ya sale un primer maniquí; luego lo ajustas con la cinta. Está pensado para
                  cuerpos adultos.
                </Txt>
              </View>
              <Card>
                <Txt variant="label">Forma de partida del maniquí</Txt>
                <Segmented value={sex} options={SEXES} onChange={setSex} />
                {field('height')}
                {field('weight')}
              </Card>
            </>
          ) : null}

          {m ? (
            <Card>
              <View style={{ gap: 2 }}>
                <Txt variant="title">{m.name}</Txt>
                <Txt variant="small" tone="muted">{WHY[m.key]}</Txt>
              </View>
              <View style={styles.bigRow}>
                <TextInput
                  key={m.key}
                  accessibilityLabel={`${m.name} en centímetros`}
                  value={values[m.key]}
                  onChangeText={(t) => set(m.key, t.replace(',', '.').replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder={est !== undefined ? `≈ ${fmtG(Math.round(est))}` : '0'}
                  placeholderTextColor={color.faint}
                  maxLength={5}
                  style={[styles.bigInput, noOutline]}
                />
                <Text style={styles.bigUnit}>cm</Text>
              </View>
              <View style={styles.how}>
                <Ionicons name="information-circle-outline" size={18} color={color.indigo} style={{ marginTop: 2 }} />
                <Text style={styles.howText}>{m.howTo}</Text>
              </View>
              {empty && est !== undefined && sd ? (
                <Txt variant="small" tone="muted">
                  Si no tienes cinta a mano, sáltala: usaremos ≈ {es(round1(est))} cm (±{es(round1(sd))}) y podrás corregirla después.
                </Txt>
              ) : null}
            </Card>
          ) : null}

          {current === 'final' ? (
            <>
              <View style={{ gap: 4 }}>
                <Txt variant="title">Tu maniquí está listo</Txt>
                <Txt tone="muted">Gíralo y comprueba que se parece a ti. Puedes cambiar cualquier medida cuando quieras.</Txt>
              </View>
              {more}
              {consentBox}
            </>
          ) : null}

          {warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}
          {error ? <Notice tone="warn">{error}</Notice> : null}
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  // --------------------------------------------------------------- edición
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen back title="Mis medidas" footer={<Button label="Guardar cambios" onPress={() => void save()} />}>
        {stage}
        <Txt variant="small" tone="muted">Toca una medida para ver en el maniquí por dónde pasa la cinta y cómo tomarla.</Txt>
        <Card>
          <Txt variant="label">Forma de partida del maniquí</Txt>
          <Segmented value={sex} options={SEXES} onChange={setSex} />
          {MEASUREMENTS.filter((m) => m.basic).map((m) => field(m.key))}
        </Card>
        {more}
        {warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}
        {error ? <Notice tone="warn">{error}</Notice> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  footerRow: { flexDirection: 'row', gap: space.sm },
  progress: { height: 8, borderRadius: 4, backgroundColor: color.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: color.tape, borderRadius: 4 },
  caption: { backgroundColor: color.tape, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'flex-end' },
  captionLabel: { fontFamily: family.semibold, fontSize: 11, color: color.tapeInk },
  captionValue: { fontFamily: family.numBold, fontSize: 24, lineHeight: 26, color: color.tapeInk },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: space.sm },
  bigInput: {
    fontFamily: family.numBold, fontSize: 64, lineHeight: 70, color: color.ink, textAlign: 'center', width: 190,
    borderBottomWidth: 3, borderBottomColor: color.tape, paddingVertical: 0,
  },
  bigUnit: { fontFamily: family.num, fontSize: 24, color: color.muted },
  how: { flexDirection: 'row', gap: space.sm, backgroundColor: color.indigoSoft, borderRadius: radius.md, padding: space.md },
  howText: { flex: 1, fontFamily: family.body, fontSize: 14, lineHeight: 20, color: color.ink },
  consent: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  box: {
    width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: color.indigo,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  boxOn: { backgroundColor: color.indigo },
  consentText: { flex: 1, fontFamily: family.body, fontSize: 13, color: color.ink, lineHeight: 19 },
});
