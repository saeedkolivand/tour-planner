import { Check, MapPinOff, Navigation, RotateCcw } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';
import type { Stop } from '../types';

/**
 * Stops the plan could not place (address not found, or no road today): never dropped silently. Tap one to fix its
 * address; navigation still finds it by the address, and it can be ticked off like any other stop.
 */
export function NotPlannedSection({ stops, onEdit, onNavigate, onToggle }: {
  stops: Stop[]; onEdit(s: Stop): void; onNavigate(s: Stop): void; onToggle(s: Stop): void;
}) {
  const { t } = useTranslation();
  if (!stops.length) return null;
  const anyAddress = stops.some(s => !s.unreachable);
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Icon as={MapPinOff} size={16} className="text-destructive" />
        <Text className="text-destructive text-sm font-semibold">{t('route.notPlannedTitle', { count: stops.length })}</Text>
      </View>
      {stops.map((s, i) => {
        const address = `${s.street} ${s.number}`.trim() || t('route.noAddressStop');
        return (
          <Pressable key={s.key ?? i} disabled={!s.key} onPress={() => { haptic.tap(); onEdit(s); }}
            className={cn('bg-card border-destructive/30 active:bg-muted flex-row items-center gap-3 rounded-lg border px-3 py-2', s.done && 'opacity-50')}
            accessibilityRole="button" accessibilityLabel={address} accessibilityHint={t('route.notPlannedEditHint')}>
            <View className="flex-1 gap-0.5">
              <Text className={cn('font-semibold', s.done && 'line-through')} numberOfLines={1}>{address}</Text>
              <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                {[s.postcode, s.name, s.unreachable && t('route.noRoadClosure').trim()].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {!s.done && !!s.street && (
              <Button variant="ghost" size="icon" onPress={() => onNavigate(s)} accessibilityLabel={t('route.navigateToAddress', { address })}>
                <Icon as={Navigation} size={18} className="text-primary" />
              </Button>
            )}
            {!!s.key && (
              <Button variant="ghost" size="icon" onPress={() => onToggle(s)} accessibilityLabel={s.done ? t('route.markNotDelivered') : t('route.markDelivered')}>
                <Icon as={s.done ? RotateCcw : Check} size={18} className={s.done ? 'text-muted-foreground' : 'text-success'} />
              </Button>
            )}
          </Pressable>
        );
      })}
      <Text className="text-muted-foreground text-xs">{anyAddress ? t('route.notPlannedHint') : t('route.deliverOnFoot').trim()}</Text>
    </View>
  );
}
