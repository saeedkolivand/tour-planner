import type { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Text } from '@/components/ui/text';
import { parseStops } from '@/features/planner/parseText';
import { bare } from '@/features/planner/stops';
import { ocr } from '@/services/scan';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';
import { log } from '@/shared/log';

const L = log('live-scan');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * The in-app camera reading by itself: a still about every second while the driver scrolls the scanner list slowly,
 * read on the phone right away. A frame is kept (`onKeep`) only when it shows a stop no earlier frame did; Done then
 * hands the kept frames to the usual reader, which reuses each read. Mounted while the camera is open: it starts fresh.
 * ponytail: a blurred frame's misread street is kept like any other; dedupe and street snapping tidy most of it.
 */
export function LiveScan({ camera, on, onKeep }: { camera: RefObject<CameraView | null>; on: boolean; onKeep(uri: string): void }) {
  const { t } = useTranslation();
  const seen = useRef(new Set<string>());
  const [found, setFound] = useState(0);
  useEffect(() => {
    if (!on) return;
    let live = true, frames = 0, kept = 0;
    (async () => {
      while (live) {
        const t0 = Date.now();
        const photo = await camera.current?.takePictureAsync({ quality: 0.7, skipProcessing: true, shutterSound: false }).catch(() => null);
        if (photo && live) {
          frames++;
          const keys = parseStops(await ocr(photo.uri).catch(() => '')).map(s => `${bare(s.street)} ${s.number}`);
          const fresh = keys.filter(k => !seen.current.has(k));
          fresh.forEach(k => seen.current.add(k));
          if (fresh.length) { kept++; setFound(seen.current.size); onKeep(photo.uri); haptic.tap(); }
          else try { new File(photo.uri).delete(); } catch { /* Settings → Clear cache gets it */ }
        }
        await sleep(Math.max(0, 1000 - (Date.now() - t0)));
      }
      L.info('paused', { frames, kept, stops: seen.current.size });
    })();
    return () => { live = false; };
  }, [on, camera, onKeep]);
  return <Text className="mt-3 text-center text-white/80">{on ? t('capture.liveFound', { count: found }) : t('capture.inAppHint')}</Text>;
}
