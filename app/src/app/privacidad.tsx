import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Notice, Screen, Txt, type IconName } from '../components/ui';
import { useCatalog } from '../lib/catalog';
import { useProfile } from '../lib/profile';
import { color, space } from '../lib/theme';

const FACTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'phone-portrait-outline', title: 'Tus medidas no salen de tu móvil',
    body: 'Las medidas del cuerpo, tu maniquí, tu armario y las prendas que añades se guardan solo en este dispositivo. El maniquí se calcula aquí mismo: ningún servidor recibe tus medidas.',
  },
  {
    icon: 'person-remove-outline', title: 'Sin cuenta y sin rastreo',
    body: 'No hay registro, ni correo, ni publicidad, ni herramientas de analítica. No calculamos índice de masa corporal ni nada parecido: las medidas solo sirven para comparar tallas.',
  },
  {
    icon: 'cloud-outline', title: 'Lo único que se conecta a internet',
    body: 'El catálogo compartido de prendas, alojado en la Unión Europea. La app descarga las tablas de tallas y, solo si tú lo marcas, envía la tabla de una prenda que añades o tu respuesta anónima sobre cómo te quedó una talla.',
  },
];

export default function Privacidad() {
  const { wipe } = useProfile();
  const { reset } = useCatalog();
  const [confirm, setConfirm] = useState(false);

  return (
    <Screen back title="Privacidad">
      {FACTS.map((f) => (
        <Card key={f.title}>
          <View style={styles.head}>
            <View style={styles.icon}><Ionicons name={f.icon} size={20} color={color.indigo} /></View>
            <Txt variant="h3" style={{ flex: 1 }}>{f.title}</Txt>
          </View>
          <Txt tone="muted">{f.body}</Txt>
        </Card>
      ))}
      <Card>
        <Txt variant="h3">Borrar mis datos</Txt>
        <Txt variant="small" tone="muted">Borra tus medidas, tu armario, tus prendas y tu historial de este dispositivo. No se puede deshacer.</Txt>
        {confirm ? (
          <>
            <Notice tone="warn">¿Seguro? Se borrará todo lo que la app guarda en este dispositivo.</Notice>
            <Button kind="danger" label="Sí, borrar todo" onPress={async () => {
              await wipe();
              reset();
              router.replace('/bienvenida');
            }} />
            <Button kind="ghost" label="Cancelar" onPress={() => setConfirm(false)} />
          </>
        ) : (
          <Button kind="danger" icon="trash-outline" label="Borrar todos mis datos" onPress={() => setConfirm(true)} />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: color.indigoSoft, alignItems: 'center', justifyContent: 'center' },
});
