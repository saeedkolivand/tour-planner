import { Clock, Gauge, Package, Route as RouteIcon, Timer, Zap } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { duration } from '@/features/tour/selectors';
import { useTranslation, type Key } from '@/shared/i18n';
import { cn } from '@/lib/utils';
import type { DaySummary } from './history';

const hhmm = (ms: number) => new Date(ms).toTimeString().slice(0, 5);

function Line({ icon, children, warn }: { icon: typeof Clock; children: ReactNode; warn?: boolean }) {
  return (
    <View className="flex-row items-center gap-2">
      <Icon as={icon} size={16} className={warn ? 'text-destructive' : 'text-muted-foreground'} />
      <Text className={cn('flex-1 text-sm', warn && 'text-destructive font-medium')}>{children}</Text>
    </View>
  );
}

/** One day in numbers: delivered, parcels, first to last delivery, Express kept or missed, the plan. */
export function DaySummaryCard({ s, title }: { s: DaySummary; title?: string }) {
  const { t } = useTranslation();
  const missed = s.expressMissed.length;
  return (
    <View className="bg-card border-border gap-2 rounded-xl border p-4">
      {!!title && <Text className="text-lg font-bold">{title}</Text>}
      <Line icon={Package}>{t('history.delivered', { done: s.delivered, total: s.stops })} · {t('count.parcels', { count: s.parcels })}</Line>
      {s.first != null && s.last != null && (
        <Line icon={Clock}>{t('history.span', { from: hhmm(s.first), to: hhmm(s.last), dur: duration(Math.round((s.last - s.first) / 60_000)) })}</Line>
      )}
      {s.express > 0 && (
        <Line icon={Zap} warn={missed > 0}>
          {missed ? `${t('history.expressMissed', { n: missed, total: s.express })}: ${s.expressMissed.slice(0, 3).map(x => `${x.street} ${x.number}`).join(', ')}${missed > 3 ? ` ${t('history.more', { n: missed - 3 })}` : ''}`
            : t('history.expressOk', { n: s.express })}
        </Line>
      )}
      {s.avgMin != null && (
        <Line icon={Gauge}>{t('history.pace', { avg: s.avgMin, median: s.medianMin, sph: s.stopsPerHour ?? '–', pph: s.parcelsPerHour ?? '–' })}</Line>
      )}
      {s.driveMin != null && s.atStopMin != null && <Line icon={Timer}>{t('history.split', { drive: s.driveMin, at: s.atStopMin })}</Line>}
      {Object.keys(s.byType).length > 1 && (
        <Line icon={Timer}>{t('history.byType', { list: Object.entries(s.byType).map(([type, m]) => `${t(`stopType.${type}` as Key)} ${m} min`).join(' · ') })}</Line>
      )}
      {s.vsPlanMin != null && (
        <Line icon={Clock} warn={s.vsPlanMin > 15}>
          {s.vsPlanMin > 0 ? t('history.vsPlanLater', { n: s.vsPlanMin }) : s.vsPlanMin < 0 ? t('history.vsPlanEarlier', { n: -s.vsPlanMin }) : t('history.vsPlanOn')}
        </Line>
      )}
      {s.km != null && s.plannedMin != null && <Line icon={RouteIcon}>{t('history.planned', { km: s.km, dur: duration(s.plannedMin) })}</Line>}
    </View>
  );
}
