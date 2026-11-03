import { router } from 'expo-router';
import { ArrowLeft, Check, PackageCheck, Undo2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/Screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { AccessNote } from '@/features/customers/AccessNote';
import { isPharmacy } from '@/features/planner/phoenix';
import { useSettings } from '@/features/settings/settings';
import { useTourState } from '@/features/tour/TourProvider';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';
import { log } from '@/shared/log';

const L = log('load-van');

/**
 * Loading the van, last stop first (the supervisor's "load from the end"): one stop at a time, its loading number
 * huge, the parcel count and the door photo, so what goes in first is what comes out last. PHOENIX: the pharmacies
 * first, into the back of the van, then the opticians (ponytail: last-first too, until the driver's own order for them
 * arrives). Tap-through; a PHOENIX tote label can't be scanned yet (its format is unknown).
 */
export default function LoadScreen() {
  const { t } = useTranslation();
  const { tour } = useTourState();
  const split = useSettings().company === 'phoenix';
  const stops = useMemo(() => {
    const open = tour.stops.filter(s => s.no != null && !s.done).sort((a, b) => b.no! - a.no!);
    return split ? [...open.filter(s => isPharmacy(s.name)), ...open.filter(s => !isPharmacy(s.name))] : open;
  }, [tour.stops, split]);
  const [i, setI] = useState(0);
  const back = { label: t('tabs.route'), onPress: () => router.back() };
  const s = stops[i];
  const step = (d: number) => {
    haptic[d > 0 ? 'success' : 'select']();
    if (d > 0 && i + 1 === stops.length) L.info('van loaded', { stops: stops.length });
    setI(n => Math.max(0, n + d));
  };

  if (!s) {
    return (
      <View className="bg-background flex-1">
        <ScreenHeader title={t('load.title')} back={back} />
        <EmptyState icon={PackageCheck} title={t(stops.length ? 'load.doneTitle' : 'load.emptyTitle')} body={t(stops.length ? 'load.doneBody' : 'load.emptyBody')}
          action={<Button size="xl" onPress={() => router.back()}><Text>{t('tabs.route')}</Text></Button>} />
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title={t('load.title')} subtitle={t('load.subtitle')} back={back} />
      <ScrollView contentContainerClassName="gap-4 px-5 pb-10">
        <View className="gap-2">
          <Text className="text-muted-foreground text-sm font-semibold" style={{ fontVariant: ['tabular-nums'] }}>{t('load.progress', { done: i, total: stops.length })}</Text>
          <Progress value={(i / stops.length) * 100} className="h-2" aria-label={t('load.progressLabel')} />
        </View>
        {split && <Text className="text-lg font-bold">{t(isPharmacy(s.name) ? 'load.backPharmacies' : 'load.opticians')}</Text>}
        <View className="bg-foreground items-center rounded-2xl py-6" accessibilityLabel={t('route.loadingNumberLabel', { n: s.no })}>
          <Text className="text-background text-8xl font-black" style={{ fontVariant: ['tabular-nums'] }}>{s.no}</Text>
        </View>
        <View className="gap-1">
          <Text className="text-2xl font-bold">{s.name ?? `${s.street} ${s.number}`}</Text>
          {!!s.name && <Text className="text-muted-foreground text-base">{`${s.street} ${s.number}, ${s.city ?? s.postcode}`}</Text>}
          <View className="mt-1 flex-row flex-wrap gap-2">
            <Badge variant="secondary"><Text>{t('count.parcels', { count: s.parcels })}</Text></Badge>
            {s.type === 'pickup' && <Badge><Text>{t('load.pickup')}</Text></Badge>}
            {s.fresh && <Badge variant="outline"><Text>{t('load.fresh')}</Text></Badge>}
          </View>
        </View>
        <AccessNote stop={s} />
        <View className="flex-row gap-3">
          <Button variant="outline" size="xl" className="flex-1" onPress={() => step(-1)} disabled={i === 0} accessibilityLabel={t('load.back')}>
            <Icon as={i === 0 ? ArrowLeft : Undo2} size={18} /><Text>{t('load.back')}</Text>
          </Button>
          <Button size="xl" className="flex-[2]" onPress={() => step(1)}>
            <Icon as={Check} size={18} /><Text>{t('load.next')}</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
