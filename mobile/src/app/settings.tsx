import { Eraser, RefreshCw, Share, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ScreenHeader, StatusBanner } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { clearGeocache } from '@/features/planner/phoneDeps';
import { ClosuresSection } from '@/features/roads/ClosuresSection';
import { ExpressMarginPicker } from '@/features/settings/components/ExpressMarginPicker';
import { LanguagePicker } from '@/features/settings/components/LanguagePicker';
import { RouteStylePicker } from '@/features/settings/components/RouteStylePicker';
import { NavAppPicker } from '@/features/settings/components/NavAppPicker';
import { SettingsDivider, SettingsSection, SwitchRow } from '@/features/settings/components/SettingsSection';
import { StopOrderPicker } from '@/features/settings/components/StopOrderPicker';
import { setSettings, useSettings } from '@/features/settings/settings';
import { useTourState, useTourStore } from '@/features/tour/TourProvider';
import { UpdateSection } from '@/features/updates/UpdateSection';
import { onDeviceOcr } from '@/services/scan';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';
import { cacheSize, clearFileCache } from '@/shared/fileCache';
import { log } from '@/shared/log';
import { exportLog } from '@/shared/logExport';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const s = useSettings();
  const store = useTourStore();
  const { tour, busy, progress, error, offline } = useTourState();
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
    <View className="bg-background flex-1">
      <ScreenHeader title={t('tabs.settings')} />
      <StatusBanner busy={busy} progress={progress} error={error} offline={offline} />
      <ScrollView contentContainerClassName="gap-6 px-5 pb-16" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <SettingsSection title={t('settings.language')}>
          <LanguagePicker value={s.language} onChange={language => setSettings({ language })} />
        </SettingsSection>

        <SettingsSection title={t('settings.startEnd')} footer={t('settings.startEndFooter')}>
          <Input defaultValue={s.depot} placeholder={t('settings.depotPlaceholder')} accessibilityLabel={t('settings.depotLabel')}
            onChangeText={depot => setSettings({ depot: depot.trim() })} />
          <SettingsDivider />
          <SwitchRow label={t('settings.returnToDepot')} hint={t('settings.returnToDepotHint')} value={s.endAtDepot} onChange={endAtDepot => setSettings({ endAtDepot })} />
          <SettingsDivider />
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-0.5">
              <Text className="font-medium">{t('settings.leaveAt')}</Text>
              <Text className="text-muted-foreground text-sm">{t('settings.leaveAtHint')}</Text>
            </View>
            <Input defaultValue={s.leaveAt} placeholder="08:30" keyboardType="numbers-and-punctuation" maxLength={5} className="w-24 text-center"
              accessibilityLabel={t('settings.leaveAtA11y')} onChangeText={leaveAt => setSettings({ leaveAt: leaveAt.trim() })} />
          </View>
        </SettingsSection>

        <SettingsSection title={t('settings.stopOrder')} footer={s.stopOrder === 'scanned' ? t('settings.orderScannedFooter') : t('settings.orderFastestFooter')}>
          <StopOrderPicker value={s.stopOrder} onChange={stopOrder => setSettings({ stopOrder })} />
        </SettingsSection>

        <SettingsSection title={t('settings.routeStyle')} footer={t('settings.routeStyleFooter')}>
          <RouteStylePicker value={s.routeStyle} onChange={routeStyle => setSettings({ routeStyle })} />
          <SettingsDivider />
          <SwitchRow label={t('settings.bothSides')} hint={s.bothSides ? t('settings.bothSidesOnHint') : t('settings.bothSidesOffHint')}
            value={s.bothSides} onChange={bothSides => setSettings({ bothSides })} />
        </SettingsSection>

        <SettingsSection title={t('settings.express')} footer={s.stopOrder === 'scanned' ? t('settings.expressScannedFooter') : t('settings.expressFooter')}>
          <SwitchRow label={t('settings.expressOnTime')} hint={t('settings.expressOnTimeHint')} value={s.expressOnTime} onChange={expressOnTime => setSettings({ expressOnTime })} />
          {s.expressOnTime && (
            <>
              <SettingsDivider />
              <View className="gap-2">
                <View className="gap-0.5">
                  <Text className="font-medium">{t('settings.expressMargin')}</Text>
                  <Text className="text-muted-foreground text-sm">{t('settings.expressMarginHint')}</Text>
                </View>
                <ExpressMarginPicker value={s.expressMarginMin} onChange={expressMarginMin => setSettings({ expressMarginMin })} />
              </View>
            </>
          )}
          <SettingsDivider />
          <SwitchRow label={t('settings.expressFirst')} hint={t('settings.expressFirstHint')} value={s.expressFirst} onChange={expressFirst => setSettings({ expressFirst })} />
        </SettingsSection>

        <SettingsSection title={Platform.OS === 'ios' ? t('settings.navCarPlay') : t('settings.navAndroidAuto')}
          footer={t('settings.navFooter', { screen: Platform.OS === 'ios' ? 'CarPlay' : 'Android Auto' })}>
          <NavAppPicker value={s.navApp} onChange={navApp => setSettings({ navApp })} />
          <SettingsDivider />
          <SwitchRow label={t('settings.autoNavigate')} hint={t('settings.autoNavigateHint')} value={s.autoNavigate} onChange={autoNavigate => setSettings({ autoNavigate })} />
        </SettingsSection>

        <ClosuresSection />

        <SettingsSection title={t('settings.planning')} footer={s.planner === 'auto'
          ? t('settings.planningAutoFooter', { where: onDeviceOcr && !s.serverOcr ? t('settings.onThisPhone') : t('settings.onThePc') })
          : t('settings.planningPhoneFooter')}>
          <SwitchRow label={t('settings.usePc')} hint={t('settings.usePcHint')} value={s.planner === 'auto'}
            onChange={on => setSettings({ planner: on ? 'auto' : 'phone' })} />
          {s.planner === 'auto' && (
            <>
              <SettingsDivider />
              <Input defaultValue={s.server} placeholder="https://your-pc.your-tailnet.ts.net" autoCapitalize="none" autoCorrect={false} keyboardType="url" accessibilityLabel={t('settings.serverUrl')}
                onChangeText={server => setSettings({ server: server.trim() })} />
              <Button variant="outline" onPress={store.load}>
                <Icon as={RefreshCw} size={16} />
                <Text>{t('settings.reconnect')}</Text>
              </Button>
              {onDeviceOcr && (
                <>
                  <SettingsDivider />
                  <SwitchRow label={t('settings.readPhotosOnPc')} hint={t('settings.readPhotosOnPcHint')} value={s.serverOcr} onChange={serverOcr => setSettings({ serverOcr })} />
                </>
              )}
            </>
          )}
        </SettingsSection>

        <SettingsSection title={t('settings.roadTimesTitle')} footer={s.orsKey
          ? t('settings.orsKeySavedFooter', { last4: s.orsKey.slice(-4) })
          : t('settings.orsKeyMissingFooter')}>
          <Input defaultValue={s.orsKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder={t('settings.orsPlaceholder')}
            accessibilityLabel={t('settings.orsPlaceholder')} onChangeText={orsKey => setSettings({ orsKey: orsKey.trim() })} />
        </SettingsSection>

        <SettingsSection title={t('settings.logTitle')} footer={t('settings.logFooter')}>
          <SwitchRow label={t('settings.keepHistory')} hint={t('settings.keepHistoryHint')} value={s.keepHistory} onChange={keepHistory => setSettings({ keepHistory })} />
          <SettingsDivider />
          <SwitchRow label={t('settings.detailedLog')} hint={t('settings.detailedLogHint')} value={s.detailedLog} onChange={detailedLog => setSettings({ detailedLog })} />
          <SettingsDivider />
          <Button variant="outline" onPress={shareLog} disabled={exporting}>
            <Icon as={Share} size={16} />
            <Text>{t('settings.exportLog')}</Text>
          </Button>
        </SettingsSection>

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

        <UpdateSection />
      </ScrollView>
    </View>
  );
}
