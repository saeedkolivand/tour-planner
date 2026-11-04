import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, View } from 'react-native';
import { ScreenHeader } from '@/components/Screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { routeDeps, routeSize } from '@/features/customers/routeStore';
import { isPharmacy } from '@/features/planner/phoenix';
import { useSettings } from '@/features/settings/settings';
import { useTourState } from '@/features/tour/TourProvider';
import type { Stop } from '@/features/tour/types';
import { cn } from '@/lib/utils';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';
import { log } from '@/shared/log';

const L = log('load-van');
const id = (s: Stop) => s.key ?? `${s.street} ${s.number} ${s.name ?? ''}`;

/**
 * Loading: tonight's stops last-first, each with its package count; tap one when it's in. PHOENIX: the van
 * (pharmacies) and the optician box, apart. The order is the plan's once there is one, before that the fixed route's.
 * ponytail: ticks live while the screen is open; keep them across visits if leaving halfway proves common.
 */
export default function LoadScreen() {
  const { t } = useTranslation();
  const { tour } = useTourState();
  const phoenix = useSettings().company === 'phoenix';
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  const sections = useMemo(() => {
    const planned = new Map((tour.plan?.clusters ?? []).flatMap(c => c.stops).map((s, i) => [id(s), i]));
    const rank = (s: Stop) => planned.get(id(s)) ?? (routeSize() ? routeDeps.match(s)?.rank : undefined) ?? s.no;
    // last stop first; a row the route doesn't know (yet) last, to be placed by hand
    const open = tour.stops.filter(s => !s.done).map(s => ({ s, r: rank(s) })).sort((a, b) => (b.r ?? -1) - (a.r ?? -1));
    if (!phoenix) return [{ title: t('load.van'), data: open }];
    return [
      { title: t('load.van'), data: open.filter(x => isPharmacy(x.s.name)) },
      { title: t('load.box'), data: open.filter(x => !isPharmacy(x.s.name)) },
    ].filter(x => x.data.length);
  }, [tour.stops, tour.plan, phoenix, t]);

  const toggle = (s: Stop) => {
    haptic.select();
    setTicked(prev => {
      const next = new Set(prev);
      if (!next.delete(id(s))) next.add(id(s));
      for (const sec of sections) if (sec.data.every(x => next.has(id(x.s)))) L.info('loaded', { section: sec.title, stops: sec.data.length });
      return next;
    });
  };

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title={t('load.title')} subtitle={t('load.subtitle')} back={{ label: t('load.back'), onPress: () => router.back() }} />
      <SectionList
        sections={sections}
        keyExtractor={x => id(x.s)}
        contentContainerClassName="gap-2 px-5 pb-16"
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text className="text-muted-foreground mt-4 mb-1 text-sm font-bold uppercase tracking-widest">
            {`${section.title} · ${section.data.filter(x => ticked.has(id(x.s))).length}/${section.data.length}`}
          </Text>
        )}
        renderItem={({ item: { s, r } }) => {
          const done = ticked.has(id(s));
          return (
            <Pressable onPress={() => toggle(s)} accessibilityRole="checkbox" accessibilityState={{ checked: done }}
              accessibilityLabel={`${s.name ?? s.street}, ${t('count.parcels', { count: s.parcels })}`}
              className={cn('bg-card border-border min-h-16 flex-row items-center gap-3 rounded-xl border px-4 active:opacity-70', done && 'opacity-40')}>
              <View className={cn('size-7 items-center justify-center rounded-full border-2', done ? 'bg-primary border-primary' : 'border-muted-foreground')}>
                {done && <Icon as={Check} size={16} className="text-primary-foreground" />}
              </View>
              <View className="flex-1">
                <Text className={cn('text-lg font-semibold', done && 'line-through')} numberOfLines={1}>{s.name ?? `${s.street} ${s.number}`}</Text>
                {(r == null || s.type === 'pickup') && (
                  <Text className="text-muted-foreground text-xs">{[r == null && t('load.notOnRoute'), s.type === 'pickup' && t('load.pickup')].filter(Boolean).join(' · ')}</Text>
                )}
              </View>
              <Text className="text-3xl font-black" style={{ fontVariant: ['tabular-nums'] }}>{s.parcels}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text className="text-muted-foreground mt-8 text-center">{t('load.emptyBody')}</Text>}
      />
    </View>
  );
}
