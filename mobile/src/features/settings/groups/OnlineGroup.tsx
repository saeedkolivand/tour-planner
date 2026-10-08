import { RefreshCw } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ClosuresSection } from '@/features/roads/ClosuresSection';
import { SettingsDivider, SettingsSection, SwitchRow } from '@/features/settings/components/SettingsSection';
import { setSettings, useSettings } from '@/features/settings/settings';
import { useTourStore } from '@/features/tour/TourProvider';
import { onDeviceOcr } from '@/services/scan';
import { useTranslation } from '@/shared/i18n';

/** The PC (when used) and the online services the phone may ask: road times, the order, addresses. */
export function OnlineGroup() {
  const { t } = useTranslation();
  const s = useSettings();
  const store = useTourStore();
  return (
    <>
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

      <ClosuresSection />

      <SettingsSection title={t('settings.roadTimesTitle')} footer={s.orsKey
        ? t('settings.orsKeySavedFooter', { last4: s.orsKey.slice(-4) })
        : t('settings.orsKeyMissingFooter')}>
        <Input defaultValue={s.orsKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder={t('settings.orsPlaceholder')}
          accessibilityLabel={t('settings.orsPlaceholder')} onChangeText={orsKey => setSettings({ orsKey: orsKey.trim() })} />
      </SettingsSection>

      <SettingsSection title={t('settings.geoapifyPlaceholder')} footer={t('settings.geoapifyFooter')}>
        <Input defaultValue={s.geoapifyKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder={t('settings.geoapifyPlaceholder')}
          accessibilityLabel={t('settings.geoapifyPlaceholder')} onChangeText={geoapifyKey => setSettings({ geoapifyKey: geoapifyKey.trim() })} />
      </SettingsSection>
    </>
  );
}
