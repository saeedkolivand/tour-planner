// Our own OCR: the text of each line AND where it sits on the photo (Apple Vision on iOS, ML Kit on Android). The
// position is what puts the scanner's right column (slot, PRIO, "by 18:00") on its row; expo-text-extractor has none.
import { requireOptionalNativeModule } from 'expo';

/** One recognised line; x, y, w, h are fractions of the upright photo, from its top-left corner. */
export interface OcrLine { text: string; x: number; y: number; w: number; h: number }

const M = requireOptionalNativeModule<{ recognize(path: string): Promise<OcrLine[]> }>('ScannerOcr');

/** Null where this build has no module (Expo Go, web, an older app). */
export const recognize = M ? (uri: string) => M.recognize(uri.replace('file://', '')) : null;
