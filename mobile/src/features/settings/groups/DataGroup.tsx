import { router } from 'expo-router';
import { Eraser, History, Share, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert } from 'react-native';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { clearGeocache } from '@/features/planner/phoneDeps';
import { SettingsDivider, SettingsSection, SwitchRow } from '@/features/settings/components/SettingsSection';
import { setSettings, useSettings } from '@/features/settings/settings';
import { useTourState, useTourStore } from '@/features/tour/TourProvider';
import { cacheSize, clearFileCache } from '@/shared/fileCache';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';
import { log } from '@/shared/log';
import { exportLog } from '@/shared/logExport';

/** Today's tour, the cache, the tour history and the log. */
export function DataGroup() {
  const { t } = useTranslation();
  const s = useSettings();
  const store = useTourStore();
  const { tour } = useTourState();
  const [exporting, setExporting] = useState(false);
  const [cacheMb, setCacheMb] = useState(() => Math.round(cacheSize() / 1e6));
  const clearCache = async () => {
    await clearGeocache();
    const freed = clearFileCache();
    log('settings').info('cache cleared', { photosMb: Math.round(freed / 1e6) });
    setCacheMb(Math.round(cacheSize() / 1e6));
    haptic.success();
  };
  const shareLog = async () => {
    haptic.tap();
    setExporting(true);
    try { await exportLog(tour); } catch (e) { haptic.error(); Alert.alert(t('settings.exportFailed'), (e as Error).message); }
    finally { setExporting(false); }
  };
  return (
    <>
      <SettingsSection title={t('settings.tourSection')}>
        <ConfirmDialog title={t('settings.clearTourTitle')} body={t('settings.clearTourBody', { n: tour.stops.length })}
          confirm={t('settings.clearTour')} destructive onConfirm={store.clear}>
          <Button variant="outline" disabled={!tour.stops.length}>
            <Icon as={Trash2} size={16} className="text-destructive" />
            <Text className="text-destructive">{t('settings.clearTour')}</Text>
          </Button>
        </ConfirmDialog>
        <SettingsDivider />
        <ConfirmDialog title={t('settings.clearCacheTitle')} body={t('settings.clearCacheBody')}
          confirm={t('settings.clearCache')} destructive onConfirm={clearCache}>
          <Button variant="outline">
            <Icon as={Eraser} size={16} />
            <Text>{t('settings.clearCacheSize', { mb: cacheMb })}</Text>
          </Button>
        </ConfirmDialog>
      </SettingsSection>

      <SettingsSection title={t('settings.logTitle')} footer={t('settings.logFooter')}>
        <SwitchRow label={t('settings.keepHistory')} hint={t('settings.keepHistoryHint')} value={s.keepHistory} onChange={keepHistory => setSettings({ keepHistory })} />
        <Button variant="outline" onPress={() => router.push('/history')}>
          <Icon as={History} size={16} />
          <Text>{t('history.open')}</Text>
        </Button>
        <SettingsDivider />
        <SwitchRow label={t('settings.detailedLog')} hint={t('settings.detailedLogHint')} value={s.detailedLog} onChange={detailedLog => setSettings({ detailedLog })} />
        <SettingsDivider />
        <Button variant="outline" onPress={shareLog} disabled={exporting}>
          <Icon as={Share} size={16} />
          <Text>{t('settings.exportLog')}</Text>
        </Button>
      </SettingsSection>
    </>
  );
}
