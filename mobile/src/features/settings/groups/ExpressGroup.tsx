import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { ExpressMarginPicker } from '@/features/settings/components/ExpressMarginPicker';
import { SettingsDivider, SettingsSection, SwitchRow } from '@/features/settings/components/SettingsSection';
import { setSettings, useSettings } from '@/features/settings/settings';
import { useTranslation } from '@/shared/i18n';

/** Express deadlines in the plan, and the reminders and arrival details on the way. */
export function ExpressGroup() {
  const { t } = useTranslation();
  const s = useSettings();
  return (
    <>
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

      <SettingsSection title={t('settings.alerts')} footer={t('settings.alertsFooter')}>
        <SwitchRow label={t('settings.expressAlerts')} hint={t('settings.expressAlertsHint')} value={s.expressAlerts} onChange={expressAlerts => setSettings({ expressAlerts })} />
        <SettingsDivider />
        <SwitchRow label={t('settings.arrivalAlerts')} hint={t('settings.arrivalAlertsHint')} value={s.arrivalAlerts} onChange={arrivalAlerts => setSettings({ arrivalAlerts })} />
      </SettingsSection>
    </>
  );
}
