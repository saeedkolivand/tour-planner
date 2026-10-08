import { router } from 'expo-router';
import { History, LocateFixed, PartyPopper, Route as RouteIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import ReorderableList, { useReorderableDrag } from 'react-native-reorderable-list';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader, StatusBanner } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { DaySummaryCard } from '@/features/history/DaySummaryCard';
import { mergeDay, summarize } from '@/features/history/history';
import { readArrivals } from '@/features/history/historyFile';
import { ReportClosureButton } from '@/features/roads/ReportClosureButton';
import { ClusterRow } from '@/features/tour/components/ClusterRow';
import { CompletedSection } from '@/features/tour/components/CompletedSection';
import { MoveDialog } from '@/features/tour/components/MoveDialog';
import { NextStopCard } from '@/features/tour/components/NextStopCard';
import { NotPlannedSection } from '@/features/tour/components/NotPlannedSection';
import { StopEditDialog } from '@/features/tour/components/StopEditDialog';
import { RouteMap } from '@/features/tour/components/RouteMap';
import { RouteStats } from '@/features/tour/components/RouteStats';
import { useTourState, useTourStore } from '@/features/tour/TourProvider';
import type { Cluster, Plan, Stop } from '@/features/tour/types';
import { useDelivery } from '@/features/tour/useDelivery';
import { usePlanning } from '@/features/tour/usePlanning';
import { noPc, useSettings } from '@/features/settings/settings';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';

/**
 * Express / Paketshop stops the route can't reach in time: how many, the first three, then "+N more".
 * Only the stops with a deadline of their own (a late parking stop also holds ordinary addresses).
 */
function LateNote({ plan, stops }: { plan: Plan; stops: Stop[] }) {
  const { t } = useTranslation();
  // delivered ones are history, not a warning
  const late = stops.filter(s => s.key && !s.done && plan.late?.includes(s.key) && (s.express || s.opens));
  if (!late.length) return null;
  const why = (s: Stop) => (s.express ? t('common.expressValue', { value: s.express }) : t('route.shopCloses', { time: s.opens!.split('-')[1] }));
  const shown = late.slice(0, 3).map(s => `#${s.no} ${s.street} ${s.number} (${why(s)})`).join(', ');
  const more = late.length > 3 ? t('route.moreCount', { n: late.length - 3 }) : '';
  return (
    <Text className="text-destructive text-sm font-medium">
      {t(plan.order === 'scanned' ? 'route.lateNoteScanned' : 'route.lateNote', { stops: t('count.stops', { count: late.length }), list: shown, more })}
    </Text>
  );
}

/** A later parking stop in the Route list: hold to drag it elsewhere, tap to move it to a position. */
function UpcomingRow(props: Omit<Parameters<typeof ClusterRow>[0], 'onLongPress'>) {
  const drag = useReorderableDrag();
  return <View className="pb-2.5"><ClusterRow {...props} onLongPress={() => { haptic.select(); drag(); }} /></View>;
}

const Label = ({ children }: { children: string }) => <Text className="text-muted-foreground mt-2 text-xs font-bold uppercase tracking-widest">{children}</Text>;

export default function RouteScreen() {
  const { t } = useTranslation();
  const store = useTourStore();
  const { tour, busy, progress, error, offline } = useTourState();
  const { view, navigate, navigateAddress, deliver, reopen, toggleStop, navLabel } = useDelivery();
  // a stop the plan could not place, opened to fix its address
  const [editing, setEditing] = useState<string | null>(null);
  // a parking stop being moved to a position (its index in the plan)
  const [moving, setMoving] = useState<{ cluster: Cluster; index: number } | null>(null);
  const editIndex = editing ? tour.stops.findIndex(s => s.key === editing) : -1;
  const plan = usePlanning();
  const settings = useSettings();
  const scanned = settings.stopOrder === 'scanned';
  const nextKeys = useMemo(() => new Set(view?.next?.stops.map(s => s.key)), [view]);
  // the day in numbers once the last stop is delivered (the same figures Past deliveries keeps)
  const done = !!tour.plan && !!view && !view.next;
  // dated by the last Delivered tap, so it still reads right after midnight
  const today = useMemo(() => {
    const last = Math.max(0, ...tour.stops.map(s => s.doneAt ?? 0));
    const d = done && last ? mergeDay(null, tour, last, readArrivals()) : null;
    return d && summarize(d);
  }, [done, tour]);
  const replan = (
    <View className="flex-row gap-2">
      {!noPc(settings) && <ReportClosureButton onReported={() => plan(true)} disabled={!!busy} />}
      <Button variant="secondary" size="icon" className="rounded-full" onPress={() => plan(true)} disabled={!!busy} accessibilityLabel={t('route.replanLabel')}>
        <Icon as={LocateFixed} size={20} />
      </Button>
    </View>
  );

  if (!tour.plan || !view) {
    return (
      <View className="bg-background flex-1">
        <ScreenHeader title={t('tabs.route')} />
        <StatusBanner busy={busy} progress={progress} error={error} offline={offline} />
        <EmptyState icon={RouteIcon} title={t('route.emptyTitle')} body={scanned ? t('route.emptyBodyScanned') : t('route.emptyBody')}
          action={<Button size="xl" onPress={() => (tour.stops.length ? plan() : router.navigate('/'))} disabled={!!busy}>
            <Text>{tour.stops.length ? t(scanned ? 'route.startStopsBtn' : 'route.planStopsBtn', { count: tour.stops.length }) : t('route.captureStopsBtn')}</Text>
          </Button>} />
      </View>
    );
  }

  const p = tour.plan;
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title={t('tabs.route')} subtitle={view.next ? t('count.parkingStops', { count: view.upcoming.length + 1 }) : t('route.allDone')} right={replan} />
      <StatusBanner busy={busy} progress={progress} error={error} offline={offline} />
      <ReorderableList
        data={view.upcoming}
        keyExtractor={u => u.cluster.stops[0].key ?? String(u.index)}
        dragEnabled={!busy}
        onReorder={({ from, to }) => store.moveCluster(view.upcoming[from].index, view.upcoming[to].index)}
        // spacing on the rows, not as gap: the list measures its cells to drag them
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        ListHeaderComponent={
          <View className="mb-3.5 gap-4">
            <RouteStats plan={p} view={view} />
            {view.next ? (
              <NextStopCard cluster={view.next} index={view.nextIndex} total={p.clusters.length} startedAt={view.etaBase} navLabel={navLabel}
                onNavigate={() => navigate(view.next!)} onDelivered={() => deliver(view.next!)} onToggleStop={toggleStop} />
            ) : (
              <View className="gap-2">
                <EmptyState icon={PartyPopper} title={t('route.tourCompleteTitle')} body={t('route.tourCompleteBody', { n: view.total })} />
                {today && <DaySummaryCard s={today} title={t('history.doneTitle')} />}
                <Button variant="outline" onPress={() => router.push('/history')}><Icon as={History} size={16} /><Text>{t('history.open')}</Text></Button>
              </View>
            )}
            <LateNote plan={p} stops={tour.stops} />
            {/* the live copies: an address fixed since the plan shows as fixed, a tick shows as done */}
            <NotPlannedSection stops={p.ungeocoded.map(u => ({ ...u, ...tour.stops.find(s => s.key && s.key === u.key) }))}
              onEdit={s => s.key && setEditing(s.key)} onNavigate={navigateAddress} onToggle={toggleStop} />
            <RouteMap start={p.start} stops={tour.stops.filter(s => s.no != null)} nextKeys={nextKeys} onMove={store.pin} />
            {view.upcoming.length > 0 && <Label>{t('route.upNext')}</Label>}
            {tour.stops.some(s => s.seq != null) ? (
              <Text className="text-muted-foreground -mt-2 text-xs">
                {t('route.ownOrder')}{'  '}
                <Text className="text-primary text-xs font-semibold" onPress={() => { store.resetOrder(); plan(true); }}>{t('route.ownOrderReset')}</Text>
              </Text>
            ) : view.upcoming.length > 1 && <Text className="text-muted-foreground -mt-2 text-xs">{t('route.moveHint')}</Text>}
          </View>
        }
        renderItem={({ item }) => <UpcomingRow cluster={item.cluster} index={item.index} startedAt={view.etaBase} onNavigate={navigate} onToggle={deliver}
          onPress={() => setMoving(item)} />}
        ListFooterComponent={<CompletedSection items={view.completed} startedAt={p.startedAt} onReopen={reopen} />}
      />
      {moving && (
        <MoveDialog cluster={moving.cluster} at={moving.index + 1} first={view.nextIndex + 1} last={p.clusters.length}
          onMove={to => store.moveCluster(moving.index, to - 1)} onClose={() => setMoving(null)} />
      )}
      {editIndex >= 0 && (
        <StopEditDialog key={editing} stop={tour.stops[editIndex]} onClose={() => setEditing(null)}
          onSave={patch => store.editStop(editIndex, patch)} onDelete={() => store.removeStop(editIndex)} />
      )}
    </View>
  );
}
