// Past deliveries: every kept day (history/<date>.json in the app's documents, which Clear cache leaves alone),
// newest first, each with its summary; tap one for its stops in delivery order. The search finds a street or a name
// across all days ("when was I last at Klingelpütz 33?").
import { router } from 'expo-router';
import { ChevronLeft, History } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { DaySummaryCard } from '@/features/history/DaySummaryCard';
import { stopTimes, summarize, type Day, type DayStop, type DaySummary, type StopTime } from '@/features/history/history';
import { readHistory } from '@/features/history/historyFile';
import { useSettings } from '@/features/settings/settings';
import { bare } from '@/features/planner/stops';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';

const hhmm = (ms: number) => new Date(ms).toTimeString().slice(0, 5);
const longDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function StopLine({ x }: { x: StopTime | { stop: DayStop; gapMin?: undefined; vsPlanMin?: undefined } }) {
  const { t } = useTranslation();
  const s = x.stop;
  return (
    <View className="flex-row gap-3 py-1.5">
      <Text className="text-muted-foreground w-12 text-sm" style={{ fontVariant: ['tabular-nums'] }}>{s.doneAt ? hhmm(s.doneAt) : '–'}</Text>
      <View className="flex-1">
        <Text className="text-sm font-medium">{s.street} {s.number}{s.express ? `  ·  Express ${s.express}` : ''}</Text>
        {!!s.name && <Text className="text-muted-foreground text-xs">{s.name}</Text>}
        {!s.doneAt && <Text className="text-destructive text-xs">{t('history.notDelivered')}</Text>}
      </View>
      <View className="w-16 items-end">
        {x.gapMin != null && <Text className="text-sm" style={{ fontVariant: ['tabular-nums'] }}>{t('history.gap', { n: x.gapMin })}</Text>}
        {x.vsPlanMin != null && x.vsPlanMin !== 0 && (
          <Text className={x.vsPlanMin > 15 ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'} style={{ fontVariant: ['tabular-nums'] }}>
            {x.vsPlanMin > 0 ? `+${x.vsPlanMin}` : x.vsPlanMin}
          </Text>
        )}
      </View>
    </View>
  );
}

function DayRow({ day, open, onToggle, match }: { day: Day; open: boolean; onToggle(): void; match: (s: DayStop) => boolean }) {
  // delivered in delivery order with their times, then the ones never delivered
  const rows = [...stopTimes(day), ...day.stops.filter(s => !s.doneAt).map(stop => ({ stop }))].filter(x => match(x.stop));
  return (
    <View className="mb-3 gap-1">
      <Pressable onPress={() => { haptic.select(); onToggle(); }} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <DaySummaryCard s={summarize(day)} title={longDate(day.date)} />
      </Pressable>
      {open && <View className="px-2">{rows.map(x => <StopLine key={x.stop.key} x={x} />)}</View>}
    </View>
  );
}

/** The mean day over full ones (10+ deliveries): what a single day is held against. */
function average(xs: DaySummary[]): { days: number; summary: DaySummary } | null {
  if (xs.length < 2) return null;
  const m = (f: (s: DaySummary) => number | undefined) => {
    const v = xs.map(f).filter((x): x is number => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : undefined;
  };
  const types = [...new Set(xs.flatMap(s => Object.keys(s.byType)))] as DayStop['type'][];
  return { days: xs.length, summary: {
    date: '', stops: Math.round(m(s => s.stops)!), delivered: Math.round(m(s => s.delivered)!), parcels: Math.round(m(s => s.parcels)!),
    express: 0, expressMissed: [], avgMin: m(s => s.avgMin), medianMin: m(s => s.medianMin), stopsPerHour: m(s => s.stopsPerHour),
    parcelsPerHour: m(s => s.parcelsPerHour), vsPlanMin: m(s => s.vsPlanMin) != null ? Math.round(m(s => s.vsPlanMin)!) : undefined,
    byType: Object.fromEntries(types.map(type => [type, m(s => s.byType[type])]).filter(([, v]) => v != null)),
  } };
}

export default function HistoryScreen() {
  const { t } = useTranslation();
  const { keepHistory } = useSettings();
  const days = useMemo(() => readHistory().reverse(), []);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const q = bare(query);
  const match = (s: DayStop) => !q || bare(`${s.street} ${s.number} ${s.name ?? ''}`).includes(q);
  const shown = q ? days.filter(d => d.stops.some(match)) : days;
  const usual = useMemo(() => average(days.map(summarize).filter(s => s.delivered >= 10)), [days]);
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title={t('history.title')} right={
        <Button variant="secondary" size="icon" className="rounded-full" onPress={() => router.back()} accessibilityLabel={t('history.back')}>
          <Icon as={ChevronLeft} size={20} />
        </Button>} />
      <FlatList
        data={shown}
        keyExtractor={d => d.date}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        ListHeaderComponent={
          <View className="mb-3 gap-2">
            <Input value={query} onChangeText={setQuery} placeholder={t('history.search')} autoCorrect={false} accessibilityLabel={t('history.search')} />
            {usual && !q && <DaySummaryCard s={usual.summary} title={t('history.usual', { n: usual.days })} />}
            <Text className="text-muted-foreground text-xs">{t('history.gapHint')}</Text>
            <Text className="text-muted-foreground text-xs">{keepHistory ? t('history.kept') : t('history.off')}</Text>
          </View>}
        ListEmptyComponent={<EmptyState icon={History} title={t('history.title')} body={t('history.empty')} />}
        // searching opens every day it found something in
        renderItem={({ item }) => <DayRow day={item} open={!!q || open === item.date} match={match} onToggle={() => setOpen(o => (o === item.date ? null : item.date))} />}
      />
    </View>
  );
}
