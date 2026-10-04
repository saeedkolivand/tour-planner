import { router } from 'expo-router';
import { ListOrdered, Plus, ScanLine, Sparkles } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader, StatusBanner } from '@/components/Screen';
import { StickyAction } from '@/components/StickyAction';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ScanInput } from '@/features/tour/api';
import { CaptureCard } from '@/features/tour/components/CaptureCard';
import { CoverageCard } from '@/features/tour/components/CoverageCard';
import { PhotoCapture } from '@/features/tour/components/PhotoCapture';
import { StopEditDialog } from '@/features/tour/components/StopEditDialog';
import { StopListItem } from '@/features/tour/components/StopListItem';
import { coverage } from '@/features/tour/selectors';
import { useTourState, useTourStore } from '@/features/tour/TourProvider';
import { usePlanning } from '@/features/tour/usePlanning';
import { useSettings } from '@/features/settings/settings';
import { pickScreenshots, readPhotos } from '@/services/scan';
import { haptic } from '@/shared/haptics';
import { useTranslation, type Lang } from '@/shared/i18n';

const today = (lang: Lang) => new Date().toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

export default function StopsScreen() {
  const { t, lang } = useTranslation();
  const store = useTourStore();
  const { tour, busy, error, offline } = useTourState();
  const plan = usePlanning();
  const { stopOrder } = useSettings();
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [camera, setCamera] = useState(false);
  const cov = useMemo(() => coverage(tour), [tour]);

  const capture = async (input: Promise<ScanInput | null>) => {
    haptic.tap();
    try {
      const r = await input.then(i => i && store.scan(i));
      if (!r) return;
      (r.error ? haptic.warn : haptic.success)();
      setMsg(r.error ? t('scan.someFailed', { error: r.error })
        : t('scan.foundSummary', { rows: t('count.rows', { count: r.found }), newStopsPhrase: t('count.newStops', { count: r.added }) }));
    } catch (e) { haptic.error(); setMsg((e as Error).message); }
  };
  const addStop = () => { store.addStop(); setEditing(tour.stops.length); };
  // a stop added with + and closed without an address is dropped: it can't be planned, only clutter
  // stable across renders (the rows are memoized); they read the stop at the moment of the swipe
  const confirmDelete = useCallback((i: number) => {
    const st = store.getState().tour.stops[i];
    if (!st) return;
    haptic.warn();
    Alert.alert(t('stops.removeConfirmTitle'), `${st.street} ${st.number}`.trim() || t('stops.newStop'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.remove'), style: 'destructive', onPress: () => store.removeStop(i) },
    ]);
  }, [store, t]);
  const moreParcels = useCallback((i: number) => {
    const st = store.getState().tour.stops[i];
    if (!st) return;
    haptic.success();
    store.editStop(i, { parcels: st.parcels + 1 });
  }, [store]);

  const closeEditor = () => {
    const s = editing != null ? store.getState().tour.stops[editing] : undefined;
    if (editing != null && s && !s.key && !s.street.trim() && !s.number.trim()) store.removeStop(editing);
    setEditing(null);
  };
  const planAndGo = async () => { if (await plan()) router.navigate('/route'); };

  return (
    <View className="bg-background flex-1">
      <ScreenHeader title={t('stops.title')} subtitle={today(lang)} right={
        <Button variant="secondary" size="icon" className="rounded-full" onPress={addStop} accessibilityLabel={t('stops.addByHand')}>
          <Icon as={Plus} size={20} />
        </Button>
      } />
      <StatusBanner busy={busy} error={error} offline={offline} />
      <FlatList
        data={tour.stops}
        keyExtractor={(s, i) => s.key ?? `new-${i}`}
        contentContainerClassName="gap-2.5 px-5 pb-40"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="mb-1 gap-3">
            <CaptureCard onCamera={() => { haptic.tap(); setCamera(true); }} onLibrary={() => capture(pickScreenshots())} busy={!!busy} message={msg} />
            {tour.stops.length > 0 && <CoverageCard c={cov} expected={tour.expected} onExpected={store.setExpected} />}
            {tour.stops.length > 0 && <Text className="text-muted-foreground mt-2 text-xs font-bold uppercase tracking-widest">{t('stops.captured')}</Text>}
          </View>
        }
        renderItem={({ item, index }) => <StopListItem stop={item} index={index} onOpen={setEditing} onDelete={confirmDelete} onMoreParcels={moreParcels} />}
        ListEmptyComponent={<EmptyState icon={ScanLine} title={t('stops.emptyTitle')} body={t('stops.emptyBody')} />}
      />
      {tour.stops.length > 0 && (
        <StickyAction label={`${stopOrder === 'scanned' ? t('stops.startScanned') : t('stops.planRoute')} · ${t('count.stops', { count: tour.stops.length })}`}
          icon={stopOrder === 'scanned' ? ListOrdered : Sparkles} onPress={planAndGo} disabled={!!busy} />
      )}
      {editing != null && tour.stops[editing] && (
        <StopEditDialog key={editing} stop={tour.stops[editing]} onClose={closeEditor}
          onSave={p => store.editStop(editing, p)} onDelete={() => store.removeStop(editing)} />
      )}
      <PhotoCapture open={camera} onClose={() => setCamera(false)} onDone={uris => { setCamera(false); capture(readPhotos(uris)); }} />
    </View>
  );
}
