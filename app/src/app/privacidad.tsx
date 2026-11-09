import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Card, H2, Notice, P, Screen } from '../components/ui';
import { useCatalog } from '../lib/catalog';
import { useProfile } from '../lib/profile';

export default function Privacidad() {
  const { wipe } = useProfile();
  const { reset } = useCatalog();
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <Screen>
      <Card>
        <H2>Tus medidas no salen de tu móvil</H2>
        <P>
          Las medidas del cuerpo, tu maniquí, tu armario y las prendas que añades se guardan solo en este dispositivo.
          El maniquí se calcula aquí mismo: no hay ningún servidor que reciba tus medidas.
        </P>
        <P>
          No calculamos ni mostramos índice de masa corporal, grasa corporal ni nada parecido. Solo usamos las medidas
          para comparar tallas.
        </P>
      </Card>
      <Card>
        <H2>Lo único que se conecta a internet</H2>
        <P>
          El catálogo compartido de prendas. La app descarga las tablas de tallas publicadas y, si tú lo marcas al añadir
          una prenda, envía esa tabla para que la revisemos. Nunca se envía nada sobre tu cuerpo.
        </P>
        <P small muted>Los datos del catálogo se alojan en la Unión Europea (Supabase, región de París).</P>
      </Card>
      <Card>
        <H2>Borrar mis datos</H2>
        <P small muted>Borra tus medidas, tu armario y tus prendas de este dispositivo. No se puede deshacer.</P>
        {done ? <Notice>Datos borrados.</Notice> : confirm ? (
          <>
            <Notice tone="warn">¿Seguro? Se borrará todo lo que la app guarda en este dispositivo.</Notice>
            <Button kind="danger" label="Sí, borrar todo" onPress={async () => {
              await wipe();
              reset();
              setDone(true);
              setConfirm(false);
              router.replace('/');
            }} />
            <Button kind="ghost" label="Cancelar" onPress={() => setConfirm(false)} />
          </>
        ) : (
          <Button kind="danger" label="Borrar todos mis datos" onPress={() => setConfirm(true)} />
        )}
      </Card>
    </Screen>
  );
}
