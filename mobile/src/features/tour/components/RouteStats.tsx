import { Clock, MapPin, Route, Sparkles } from 'lucide-react-native';
import { View } from 'react-native';
import { StatTile } from '@/components/StatTile';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { useTranslation } from '@/shared/i18n';
import { duration, type RouteView } from '../selectors';
import type { Plan } from '../types';

/** Distance, time and savings, then how far through the tour you are. */
export function RouteStats({ plan, view }: { plan: Plan; view: RouteView }) {
  const { t } = useTranslation();
  const pct = view.total ? (view.delivered / view.total) * 100 : 0;
  return (
    <View className="gap-3">
      <View className="flex-row gap-2.5">
        <StatTile icon={Route} value={`${plan.km.toFixed(1)} km`} label={t('common.distance')} />
        <StatTile icon={Clock} value={duration(plan.min)} label={t('common.estTime')} />
        {view.savedMin > 0
          ? <StatTile icon={Sparkles} value={duration(view.savedMin)} label={t('common.timeSaved')} tone="success" />
          : <StatTile icon={MapPin} value={String(view.upcoming.length + (view.next ? 1 : 0))} label={t('common.parkingStopsLabel')} />}
      </View>
      <View className="gap-2">
        <View className="flex-row justify-between">
          <Text className="text-sm font-semibold">{t('common.delivered')}</Text>
          <Text className="text-muted-foreground text-sm font-semibold" style={{ fontVariant: ['tabular-nums'] }}>{view.delivered} / {view.total}</Text>
        </View>
        <Progress value={pct} className="bg-success/15 h-2.5" indicatorClassName="bg-success" aria-label={t('route.progressLabel')} />
      </View>
      {(plan.pendingStart || plan.order === 'scanned') && (
        <Text className="text-muted-foreground text-xs">
          {[plan.order === 'scanned' && t('route.inScannerOrder'), plan.pendingStart && t('route.notStartedYet')].filter(Boolean).join(' ')}
        </Text>
      )}
      {plan.by?.startsWith('phone') && (
        <Text className="text-muted-foreground text-xs">
          {plan.by === 'phone-road' ? t('route.plannedPhoneRoad') : t('route.plannedPhoneEstimate', { note: plan.note ? ` (${plan.note})` : '' })}{t('route.roadworksPcOnly')}
        </Text>
      )}
    </View>
  );
}
