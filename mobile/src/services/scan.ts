import { requireOptionalNativeModule } from 'expo';
import * as ImagePicker from 'expo-image-picker';
import { getSettings, noPc } from '@/features/settings/settings';
import type { ScanInput } from '@/features/tour/api';
import { log } from '@/shared/log';

const L = log('scan');

// On-device OCR (Apple Vision on iOS, ML Kit on Android) from expo-text-extractor's native module.
// Loaded optionally: the package's own import throws where the module isn't compiled in (Expo Go,
// web), and there the photo itself goes to the server, which reads it with its vision model.
const Ocr = requireOptionalNativeModule<{ isSupported: boolean; extractTextFromImage(path: string): Promise<string[]> }>('ExpoTextExtractor');
export const onDeviceOcr = !!Ocr?.isSupported;

async function toDataUrl(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Runs on-device OCR, or prepares base64 for the server, on already-captured photo file uris. */
export async function readPhotos(uris: string[]): Promise<ScanInput> {
  // ponytail: the PC reads photos only when it is in use at all; phone-only mode ignores the toggle
  const toPc = getSettings().serverOcr && !noPc();
  if (Ocr && onDeviceOcr && !toPc) {
    const t0 = Date.now();
    const texts = await Promise.all(uris.map(async uri => (await Ocr.extractTextFromImage(uri.replace('file://', ''))).join('\n')));
    L.info('on-device OCR', { photos: texts.length, lines: texts.map(t => t.split('\n').length), ms: Date.now() - t0 });
    return { texts };
  }
  L.info('sending photos to server', { photos: uris.length, reason: toPc ? 'chosen in Settings' : Ocr ? 'OCR unsupported on device' : 'no native OCR in this build' });
  const images = await Promise.all(uris.map(toDataUrl));
  return { images };
}

/** Picks screenshots of the scanner list from the photo library. null when the user cancels. */
export async function pickScreenshots(): Promise<ScanInput | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    L.warn('permission denied', { source: 'library' });
    throw new Error('Allow photo access in Settings');
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsMultipleSelection: true, quality: 0.8 });
  if (res.canceled) { L.info('cancelled', { source: 'library' }); return null; }
  return readPhotos(res.assets.map(a => a.uri));
}
