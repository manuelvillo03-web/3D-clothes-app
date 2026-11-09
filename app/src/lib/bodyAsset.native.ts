/** Carga del maniquí en iOS y Android: el binario va dentro de la app. */
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { parseBodyModel, type BodyModelData } from '../core/bodyModel';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL = require('../../assets/models/body-model.bin');

let cached: Promise<BodyModelData> | null = null;

export function loadBodyModel(): Promise<BodyModelData> {
  if (!cached) {
    cached = (async () => {
      const asset = Asset.fromModule(MODEL);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      const buffer = await new File(uri).arrayBuffer();
      return parseBodyModel(buffer);
    })();
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}
