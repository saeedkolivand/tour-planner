import { requireOptionalNativeModule } from 'expo';
import * as ImagePicker from 'expo-image-picker';
import type { ScanInput } from '@/features/tour/api';
import { log } from '@/shared/log';

const L = log('scan');

// On-device OCR (Apple Vision on iOS, ML Kit on Android) from expo-text-extractor's native module.
// Loaded optionally: the package's own import throws where the module isn't compiled in (Expo Go,
// web), and there the photo itself goes to the server, which reads it with its vision model.
const Ocr = requireOptionalNativeModule<{ isSupported: boolean; extractTextFromImage(path: string): Promise<string[]> }>('ExpoTextExtractor');
export const onDeviceOcr = !!Ocr?.isSupported;

/** Photographs or picks screenshots of the scanner list. null when the user cancels. */
export async function scan(source: 'camera' | 'library'): Promise<ScanInput | null> {
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    L.warn('permission denied', { source });
    throw new Error(`Allow ${source === 'camera' ? 'camera' : 'photo'} access in Settings`);
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    allowsMultipleSelection: source === 'library',
    quality: 0.8,
    base64: !onDeviceOcr, // only needed when the server does the reading
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled) { L.info('cancelled', { source }); return null; }

  if (Ocr && onDeviceOcr) {
    // one text per photo; the server works out which lines belong to which stop
    const t0 = Date.now();
    const texts = await Promise.all(res.assets.map(async a => (await Ocr.extractTextFromImage(a.uri.replace('file://', ''))).join('\n')));
    L.info('on-device OCR', { source, photos: texts.length, lines: texts.map(t => t.split('\n').length), ms: Date.now() - t0 });
    return { texts };
  }
  L.info('sending photos to server', { source, photos: res.assets.length, reason: Ocr ? 'OCR unsupported on device' : 'no native OCR in this build' });
  return { images: res.assets.map(a => `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}`) };
}
