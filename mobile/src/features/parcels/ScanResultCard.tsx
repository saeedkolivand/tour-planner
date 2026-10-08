import { CircleCheck, ListPlus, PackagePlus, PackageX } from 'lucide-react-native';
import { useTranslation } from '@/shared/i18n';
import { Pressable, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { StopBadges } from '../tour/components/StopBadges';
import type { Stop } from '../tour/types';
import type { Parcel } from './barcode';

export type ScanResult =
  | { kind: 'stop'; stop: Stop; parcel: Parcel; isNext: boolean }
  | { kind: 'pick'; candidates: Stop[]; parcel: Parcel }
  | { kind: 'unknown'; parcel: Parcel }
  | { kind: 'added'; parcel: Parcel; planned: boolean };

const address = (s: { street?: string; number?: string }) => `${s.street ?? ''} ${s.number ?? ''}`.trim();

/**
 * What a scan found, readable from a step away while loading the van: the loading number huge, then the
 * address; a parcel that isn't in today's tour is said plainly, never silently ignored.
 */
export function ScanResultCard({ result, onPick, onDelivered, onAdd }: {
  result: ScanResult; onPick(s: Stop): void; onDelivered(s: Stop): void; onAdd(): void;
}) {
  const { t } = useTranslation();
  if (result.kind === 'added') {
    return (
      <View className="bg-card flex-row items-center gap-4 rounded-3xl p-5" accessibilityLiveRegion="assertive">
        <Icon as={PackagePlus} size={40} className="text-success-ink" />
        <View className="flex-1 gap-1">
          <Text className="text-xl font-bold">{t('scan.addedTitle')}</Text>
          <Text className="text-muted-foreground">{address(result.parcel)}{result.planned ? ` · ${t('scan.replanHint')}` : ''}</Text>
        </View>
      </View>
    );
  }
  if (result.kind === 'unknown') {
    const addable = !!(result.parcel.street && result.parcel.number);
    return (
      <View className="bg-card gap-3 rounded-3xl p-5" accessibilityLiveRegion="assertive">
        <View className="flex-row items-center gap-4">
          <Icon as={PackageX} size={40} className="text-destructive" />
          <View className="flex-1 gap-1">
            <Text className="text-xl font-bold">{t('scan.notInTour')}</Text>
            <Text className="text-muted-foreground">{address(result.parcel) || t('scan.parcelId', { id: result.parcel.id })}{result.parcel.postcode ? ` · ${result.parcel.postcode}` : ''}</Text>
          </View>
        </View>
        {addable ? (
          <Button size="xl" onPress={onAdd}>
            <Icon as={ListPlus} size={20} className="text-primary-foreground" />
            <Text>{t('scan.addToTour')}</Text>
          </Button>
        ) : (
          <Text className="text-muted-foreground text-sm">{t('scan.needsSquareCode')}</Text>
        )}
      </View>
    );
  }
  if (result.kind === 'pick') {
    return (
      <View className="bg-card gap-3 rounded-3xl p-5">
        <Text className="text-lg font-bold">{t('scan.whichStop')}</Text>
        {result.candidates.slice(0, 6).map(s => (
          <Pressable key={s.key} onPress={() => onPick(s)} className="bg-muted active:bg-accent flex-row items-center gap-3 rounded-xl px-4 py-3" accessibilityRole="button">
            <Text className="w-20 text-2xl font-extrabold" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>#{s.no ?? '–'}</Text>
            <Text className="flex-1 text-base font-semibold" numberOfLines={1}>{address(s)}</Text>
          </Pressable>
        ))}
        {!!(result.parcel.street && result.parcel.number) && (
          <Button variant="outline" size="lg" onPress={onAdd}>
            <Icon as={ListPlus} size={18} />
            <Text>{t('scan.notListedAdd', { address: address(result.parcel) })}</Text>
          </Button>
        )}
      </View>
    );
  }
  const { stop, isNext } = result;
  return (
    <View className="bg-card gap-3 rounded-3xl p-5" accessibilityLiveRegion="assertive">
      <View className="flex-row items-center gap-4">
        <View className={`${stop.done ? 'bg-success' : 'bg-primary'} min-w-24 items-center rounded-2xl px-3 py-2`}>
          <Text className="text-5xl font-extrabold text-white" style={{ fontVariant: ['tabular-nums'] }}>{stop.no ?? '–'}</Text>
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
            {stop.done ? t('scan.alreadyDelivered') : isNext ? t('scan.nextStop') : t('scan.loadingNumber')}
          </Text>
          <Text className="text-2xl font-bold" numberOfLines={2}>{address(stop)}</Text>
          <StopBadges stop={stop} />
        </View>
      </View>
      {isNext && !stop.done && (
        <Button size="xl" variant="success" onPress={() => onDelivered(stop)}>
          <Icon as={CircleCheck} size={20} className="text-success-foreground" />
          <Text>{t('common.delivered')}</Text>
        </Button>
      )}
    </View>
  );
}
