import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { Flashlight, FlashlightOff, ListPlus, ScanBarcode, X } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { parseParcel, type Parcel } from '@/features/parcels/barcode';
import { matchStop } from '@/features/parcels/matchStop';
import { setSettings, useSettings } from '@/features/settings/settings';
import { ScanResultCard, type ScanResult } from '@/features/parcels/ScanResultCard';
import { routeView } from '@/features/tour/selectors';
import { useTourStore } from '@/features/tour/TourProvider';
import type { Stop } from '@/features/tour/types';
import { haptic } from '@/shared/haptics';
import { log } from '@/shared/log';

const L = log('parcel-scan');
// The label's square Aztec code has the whole address; the long Code 128 has postcode + parcel number.
const TYPES = ['aztec', 'code128'] as const;

/**
 * Scan a parcel label: its loading number, big (loading the van), or "next stop / Delivered" (at the door).
 * The camera only runs while this tab is open.
 */
export default function ScanScreen() {
  const store = useTourStore();
  const focused = useIsFocused();
  const [permission, request] = useCameraPermissions();
  const { autoAddScans } = useSettings();
  const [torch, setTorch] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [count, setCount] = useState(0);
  const last = useRef({ data: '', at: 0, id: '' });

  const show = useCallback((stop: Stop, parcel: ScanResult['parcel']) => {
    const view = routeView(store.getState().tour);
    if (stop.key) store.linkParcel(stop.key, parcel.id);
    setResult({ kind: 'stop', stop, parcel, isNext: !!view?.next?.stops.some(s => s.key === stop.key) });
  }, [store]);

  const add = useCallback((parcel: Parcel) => {
    if (!parcel.street || !parcel.number) return false;
    store.addParcelStop({ ...parcel, street: parcel.street, number: parcel.number });
    haptic.success();
    setResult({ kind: 'added', parcel, planned: !!store.getState().tour.plan });
    return true;
  }, [store]);

  const onScan = useCallback(({ type, data }: BarcodeScanningResult) => {
    const now = Date.now();
    if (data === last.current.data && now - last.current.at < 3000) return; // the same label stays in view
    last.current = { ...last.current, data, at: now };
    const parcel = parseParcel(data);
    if (!parcel) return;
    // both codes of one label arrive a moment apart: count the parcel once, let the Aztec (full address) win
    const same = parcel.id === last.current.id;
    last.current.id = parcel.id;
    if (same && !parcel.street) return;
    if (!same) setCount(c => c + 1);
    const m = matchStop(store.getState().tour.stops, parcel, parcel.street ? `${parcel.street} ${parcel.number ?? ''}` : '');
    L.info('scanned', { type, id: parcel.id, postcode: parcel.postcode, service: parcel.service, match: !m ? 'none' : 'stop' in m ? m.stop.no : `${m.candidates.length} candidates` });
    if (m && 'stop' in m) { haptic.success(); show(m.stop, parcel); }
    else if (m) { haptic.warn(); setResult({ kind: 'pick', candidates: m.candidates, parcel }); }
    else if (!(autoAddScans && add(parcel))) { haptic.error(); setResult({ kind: 'unknown', parcel }); }
  }, [store, show, add, autoAddScans]);

  if (!permission) return <View className="bg-background flex-1" />;
  if (!permission.granted) {
    return (
      <View className="bg-background flex-1">
        <ScreenHeader title="Scan" />
        <EmptyState icon={ScanBarcode} title="Scan parcel labels" body="Point the camera at a DPD label to see its loading number while you load, or to check it's the right parcel at the door."
          action={<Button size="xl" onPress={request}><Text>Allow camera</Text></Button>} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {focused && (
        <CameraView style={{ flex: 1 }} facing="back" enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: [...TYPES] }} onBarcodeScanned={onScan} />
      )}
      <View className="absolute inset-x-0 top-0" pointerEvents="box-none">
        <ScreenHeader title="Scan" subtitle={count ? `${count} parcel${count === 1 ? '' : 's'} scanned` : 'Point at the label'}
          right={
            <View className="flex-row gap-2">
              {/* Auto-add: every label not in the tour joins it, for building the tour while loading */}
              <Button variant={autoAddScans ? 'default' : 'secondary'} className="h-11 rounded-full px-4" onPress={() => { haptic.select(); setSettings({ autoAddScans: !autoAddScans }); }}
                accessibilityRole="switch" accessibilityState={{ checked: autoAddScans }} accessibilityLabel="Add new labels to the tour automatically">
                <Icon as={ListPlus} size={18} className={autoAddScans ? 'text-primary-foreground' : undefined} />
                <Text>Auto-add</Text>
              </Button>
              <Button variant="secondary" size="icon" className="rounded-full" onPress={() => setTorch(t => !t)} accessibilityLabel={torch ? 'Light off' : 'Light on'}>
                <Icon as={torch ? FlashlightOff : Flashlight} size={20} />
              </Button>
            </View>
          } />
      </View>
      {result && (
        <View className="absolute inset-x-0 bottom-4 px-4">
          <ScanResultCard result={result}
            onPick={s => { haptic.success(); show(s, result.parcel); }}
            onDelivered={s => { if (s.key) { haptic.success(); store.setDone([s.key], true); setResult(null); } }}
            onAdd={() => add(result.parcel)} />
          <Button variant="secondary" size="icon" className="absolute -top-3 right-2 rounded-full" onPress={() => { haptic.select(); setResult(null); }} accessibilityLabel="Dismiss">
            <Icon as={X} size={20} />
          </Button>
        </View>
      )}
    </View>
  );
}
