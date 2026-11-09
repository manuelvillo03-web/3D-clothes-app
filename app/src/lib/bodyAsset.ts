/** Carga del maniquí en la web: el binario se sirve junto a la app. */
import { Asset } from 'expo-asset';
import { parseBodyModel, type BodyModelData } from '../core/bodyModel';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL = require('../../assets/models/body-model.bin');

let cached: Promise<BodyModelData> | null = null;

export function loadBodyModel(): Promise<BodyModelData> {
  if (!cached) {
    cached = (async () => {
      const asset = Asset.fromModule(MODEL);
      const res = await fetch(asset.uri);
      if (!res.ok) throw new Error(`No se pudo descargar el maniquí (${res.status})`);
      return parseBodyModel(await res.arrayBuffer());
    })();
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}
