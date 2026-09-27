import { useColorScheme } from 'nativewind';
import { LocateFixed, Maximize2 } from 'lucide-react-native';
import { memo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { currentPosition } from '@/services/location';
import { haptic } from '@/shared/haptics';
import { THEME } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { LatLon, Stop } from '../types';

const ll = (p: LatLon) => ({ latitude: p.lat, longitude: p.lon });

/** Numbered stop pins, the next one emphasised. Hold and drag a pin to correct a wrong position (remembered by the server). */
export const RouteMap = memo(function RouteMap({ start, stops, nextKeys, onMove }: { start: LatLon; stops: Stop[]; nextKeys: Set<string | undefined>; onMove(s: Stop, to: LatLon): void }) {
  const map = useRef<MapView>(null);
  const scheme = useColorScheme().colorScheme ?? 'light';
  const placed = stops.filter((x): x is Stop & LatLon => x.lat != null && x.lon != null);
  const [locating, setLocating] = useState(false);
  // the stops, not the depot: it's ~20 km out (Erftstadt), which squeezed the whole tour into one corner
  const fitTour = (animated = true) => map.current?.fitToCoordinates((placed.length ? placed : [start]).map(ll), { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated });
  const showMe = async () => {
    haptic.tap();
    setLocating(true);
    try {
      const me = await currentPosition();
      map.current?.animateToRegion({ ...ll(me), latitudeDelta: 0.008, longitudeDelta: 0.008 }, 400);
    } catch (e) { Alert.alert('Your position', (e as Error).message); }
    finally { setLocating(false); }
  };
  return (
    <View className="border-border overflow-hidden rounded-xl border" style={{ height: 260 }}>
      <MapView ref={map} style={{ flex: 1 }} showsUserLocation userInterfaceStyle={scheme}
        initialRegion={{ ...ll(start), latitudeDelta: 0.15, longitudeDelta: 0.15 }}
        onMapReady={() => fitTour(false)}>
        <Marker coordinate={ll(start)} pinColor={THEME[scheme].success} title="Start" />
        {placed.map(x => {
          const next = nextKeys.has(x.key);
          return (
            <Marker key={x.key} draggable coordinate={ll(x)} zIndex={next ? 10 : x.done ? 0 : 1}
              title={`#${x.no}  ${x.street} ${x.number}`} description="Hold and drag to fix the position"
              onDragEnd={e => onMove(x, { lat: e.nativeEvent.coordinate.latitude, lon: e.nativeEvent.coordinate.longitude })}>
              <View className={cn('items-center justify-center rounded-full border-2 border-white',
                next ? 'bg-primary size-9' : x.done ? 'bg-success size-6' : 'bg-foreground size-7')}>
                <Text className={cn('text-background font-bold', next ? 'text-sm text-white' : 'text-[10px]', x.done && 'text-white')}>{x.no}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>
      <View className="absolute right-2 top-2 gap-2">
        <Button variant="secondary" size="icon" className="rounded-full shadow-sm" onPress={showMe} disabled={locating} accessibilityLabel="Show my position">
          <Icon as={LocateFixed} size={20} className={locating ? 'text-muted-foreground' : 'text-primary'} />
        </Button>
        <Button variant="secondary" size="icon" className="rounded-full shadow-sm" onPress={() => { haptic.tap(); fitTour(); }} accessibilityLabel="Show the whole tour">
          <Icon as={Maximize2} size={18} />
        </Button>
      </View>
    </View>
  );
});
