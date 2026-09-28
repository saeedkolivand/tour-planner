// Android: MapLibre on OpenFreeMap's vector tiles (OpenStreetMap data): no API key, no billing, no cap.
// iOS keeps Apple Maps (RouteMap.tsx); same props and behaviour: numbered pins, drag to fix, fit, locate.
import { Camera, Map, NativeUserLocation, ViewAnnotation, type CameraRef, type LngLat, type LngLatBounds } from '@maplibre/maplibre-react-native';
import { LocateFixed, Maximize2 } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { memo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { currentPosition } from '@/services/location';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/lib/utils';
import type { LatLon, Stop } from '../types';

const STYLE = { light: 'https://tiles.openfreemap.org/styles/liberty', dark: 'https://tiles.openfreemap.org/styles/dark' };
const PAD = { top: 40, right: 40, bottom: 40, left: 40 };
const ll = (p: LatLon): LngLat => [p.lon, p.lat];
const bounds = (pts: LatLon[]): LngLatBounds => {
  const lons = pts.map(p => p.lon), lats = pts.map(p => p.lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
};

export const RouteMap = memo(function RouteMap({ start, stops, nextKeys, onMove }: { start: LatLon; stops: Stop[]; nextKeys: Set<string | undefined>; onMove(s: Stop, to: LatLon): void }) {
  const { t } = useTranslation();
  const camera = useRef<CameraRef>(null);
  const scheme = useColorScheme().colorScheme ?? 'light';
  const placed = stops.filter((x): x is Stop & LatLon => x.lat != null && x.lon != null);
  const [locating, setLocating] = useState(false);
  // the stops, not the depot: it's ~20 km out, which squeezed the whole tour into one corner
  const fitTour = (animated = true) => {
    if (placed.length < 2) camera.current?.flyTo({ center: ll(placed[0] ?? start), zoom: 14, duration: animated ? 400 : 0 });
    else camera.current?.fitBounds(bounds(placed), { padding: PAD, duration: animated ? 400 : 0 });
  };
  const showMe = async () => {
    haptic.tap();
    setLocating(true);
    try {
      const me = await currentPosition();
      camera.current?.flyTo({ center: ll(me), zoom: 16, duration: 400 });
    } catch (e) { Alert.alert(t('map.yourPosition'), (e as Error).message); }
    finally { setLocating(false); }
  };
  return (
    <View className="border-border overflow-hidden rounded-xl border" style={{ height: 260 }}>
      <Map style={{ flex: 1 }} mapStyle={STYLE[scheme]} logo={false} compass={false} onDidFinishLoadingMap={() => fitTour(false)}>
        <Camera ref={camera} initialViewState={{ center: ll(start), zoom: 11 }} />
        <NativeUserLocation />
        <ViewAnnotation id="start" lngLat={ll(start)} title={t('map.start')}>
          <View className="bg-success size-5 rounded-full border-2 border-white" />
        </ViewAnnotation>
        {placed.map(x => {
          const next = nextKeys.has(x.key);
          const id = x.key ?? `${x.lat},${x.lon}`;
          return (
            <ViewAnnotation key={id} id={id} lngLat={ll(x)} draggable title={`#${x.no}  ${x.street} ${x.number}`} snippet={t('map.dragHint')}
              onDragEnd={e => onMove(x, { lat: e.nativeEvent.lngLat[1], lon: e.nativeEvent.lngLat[0] })}>
              <View className={cn('items-center justify-center rounded-full border-2 border-white',
                next ? 'bg-primary size-9' : x.done ? 'bg-success size-6' : 'bg-foreground size-7')}>
                <Text className={cn('text-background font-bold', next ? 'text-sm text-white' : 'text-[10px]', x.done && 'text-white')}>{x.no}</Text>
              </View>
            </ViewAnnotation>
          );
        })}
      </Map>
      <View className="absolute right-2 top-2 gap-2">
        <Button variant="secondary" size="icon" className="rounded-full shadow-sm" onPress={showMe} disabled={locating} accessibilityLabel={t('map.showMe')}>
          <Icon as={LocateFixed} size={20} className={locating ? 'text-muted-foreground' : 'text-primary'} />
        </Button>
        <Button variant="secondary" size="icon" className="rounded-full shadow-sm" onPress={() => { haptic.tap(); fitTour(); }} accessibilityLabel={t('map.showTour')}>
          <Icon as={Maximize2} size={18} />
        </Button>
      </View>
    </View>
  );
});
