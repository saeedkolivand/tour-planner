import { router } from 'expo-router';
import { LocateFixed, PartyPopper, Route as RouteIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader, StatusBanner } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ReportClosureButton } from '@/features/roads/ReportClosureButton';
import { ClusterRow } from '@/features/tour/components/ClusterRow';
import { CompletedSection } from '@/features/tour/components/CompletedSection';
import { NextStopCard } from '@/features/tour/components/NextStopCard';
import { RouteMap } from '@/features/tour/components/RouteMap';
import { RouteStats } from '@/features/tour/components/RouteStats';
import { useTourState, useTourStore } from '@/features/tour/TourProvider';
import type { Plan, Stop } from '@/features/tour/types';
import { useDelivery } from '@/features/tour/useDelivery';
import { usePlanning } from '@/features/tour/usePlanning';
import { noPc, useSettings } from '@/features/settings/settings';

/**
 * Express / Paketshop stops the route can't reach in time: how many, the first three, then "+N more".
 * Only the stops with a deadline of their own (a late parking stop also holds ordinary addresses).
 */
function LateNote({ plan, stops }: { plan: Plan; stops: Stop[] }) {
  const late = stops.filter(s => s.key && plan.late?.includes(s.key) && (s.express || s.opens));
  if (!late.length) return null;
  const why = (s: Stop) => (s.express ? `Express ${s.express}` : `shop closes ${s.opens!.split('-')[1]}`);
  const shown = late.slice(0, 3).map(s => `#${s.no} ${s.street} ${s.number} (${why(s)})`).join(', ');
  return (
    <Text className="text-destructive text-sm font-medium">
      {late.length} {late.length === 1 ? 'stop' : 'stops'} can&apos;t be reached in time: {shown}{late.length > 3 ? ` +${late.length - 3} more` : ''}. Planned as early as the route allows.
    </Text>
  );
}

const Label = ({ children }: { children: string }) => <Text className="text-muted-foreground mt-2 text-xs font-bold uppercase tracking-widest">{children}</Text>;

export default function RouteScreen() {
  const store = useTourStore();
  const { tour, busy, error, offline } = useTourState();
  const { view, navigate, deliver, reopen, toggleStop, navLabel } = useDelivery();
  const plan = usePlanning();
  const settings = useSettings();
  const nextKeys = useMemo(() => new Set(view?.next?.stops.map(s => s.key)), [view]);
  const replan = (
    <View className="flex-row gap-2">
      {!noPc(settings) && <ReportClosureButton onReported={() => plan(true)} disabled={!!busy} />}
      <Button variant="secondary" size="icon" className="rounded-full" onPress={() => plan(true)} disabled={!!busy} accessibilityLabel="Re-plan the rest from here">
        <Icon as={LocateFixed} size={20} />
      </Button>
    </View>
  );

  if (!tour.plan || !view) {
    return (
      <View className="bg-background flex-1">
        <ScreenHeader title="Route" />
        <StatusBanner busy={busy} error={error} offline={offline} />
        <EmptyState icon={RouteIcon} title="No route yet" body="Capture your stops, then plan. The fastest order, grouped into park-and-walk stops, appears here."
          action={<Button size="xl" onPress={() => (tour.stops.length ? plan() : router.navigate('/'))} disabled={!!busy}>
            <Text>{tour.stops.length ? `Plan ${tour.stops.length} stops` : 'Capture stops'}</Text>
          </Button>} />
      </View>
    );
  }

  const p = tour.plan;
  return (
    <View className="bg-background flex-1">
      <ScreenHeader title="Route" subtitle={view.next ? `${view.upcoming.length + 1} parking stops left` : 'All done'} right={replan} />
      <StatusBanner busy={busy} error={error} offline={offline} />
      <FlatList
        data={view.upcoming}
        keyExtractor={u => u.cluster.stops[0].key ?? String(u.index)}
        contentContainerClassName="gap-2.5 px-5 pb-10"
        ListHeaderComponent={
          <View className="mb-1 gap-4">
            <RouteStats plan={p} view={view} />
            {view.next ? (
              <NextStopCard cluster={view.next} index={view.nextIndex} total={p.clusters.length} startedAt={view.etaBase} navLabel={navLabel}
                onNavigate={() => navigate(view.next!)} onDelivered={() => deliver(view.next!)} onToggleStop={toggleStop} />
            ) : (
              <EmptyState icon={PartyPopper} title="Tour complete" body={`All ${view.total} stops delivered. Nice work.`} />
            )}
            <LateNote plan={p} stops={tour.stops} />
            {p.ungeocoded.length > 0 && (
              <Text className="text-destructive text-sm font-medium">
                Not planned: {p.ungeocoded.map(s => (`${s.street} ${s.number}`.trim() || 'a stop without address') + (s.unreachable ? ' (no road there today: closure)' : '')).join(', ')}.
                {p.ungeocoded.some(s => !s.unreachable) ? ' Fix addresses on the Stops tab.' : ' Deliver on foot from a nearby stop.'}
              </Text>
            )}
            <RouteMap start={p.start} stops={tour.stops.filter(s => s.no != null)} nextKeys={nextKeys} onMove={store.pin} />
            {view.upcoming.length > 0 && <Label>Up next</Label>}
          </View>
        }
        renderItem={({ item }) => <ClusterRow cluster={item.cluster} index={item.index} startedAt={view.etaBase} onNavigate={navigate} onToggle={deliver} />}
        ListFooterComponent={<CompletedSection items={view.completed} startedAt={p.startedAt} onReopen={reopen} />}
      />
    </View>
  );
}
