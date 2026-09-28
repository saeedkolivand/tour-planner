import Constants from 'expo-constants';
import { Download, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';
import { log } from '@/shared/log';
import { isNewer, latestRelease, RELEASES, type Release } from './release';

const L = log('updates');
const current = Constants.expoConfig?.version ?? '0.0.0';

/** Settings: the installed version, and whether GitHub has a newer release (checked when the screen opens). */
export function UpdateSection() {
  const { t } = useTranslation();
  const [state, setState] = useState<{ kind: 'checking' } | { kind: 'error' } | { kind: 'done'; latest: Release }>({ kind: 'checking' });

  // state starts as 'checking'; the button resets it before calling this, so the effect never sets state synchronously
  const check = useCallback(async () => {
    try {
      const latest = await latestRelease();
      L.info('checked', { current, latest: latest.version });
      setState({ kind: 'done', latest });
    } catch (e) { L.warn('check failed', { error: e }); setState({ kind: 'error' }); }
  }, []);
  useEffect(() => { void check(); }, [check]);

  const update = state.kind === 'done' && isNewer(state.latest.version, current) ? state.latest : null;
  // Android installs a downloaded APK itself; iOS needs the .ipa sideloaded from a PC, so open the release page there
  const open = () => { haptic.tap(); void Linking.openURL((Platform.OS === 'android' && update?.apk) || update?.url || RELEASES); };

  const footer = state.kind === 'checking' ? t('settings.updateChecking')
    : state.kind === 'error' ? t('settings.updateFailed')
    : update ? t(Platform.OS === 'android' ? 'settings.updateHintAndroid' : 'settings.updateHintIos')
    : t('settings.upToDate');
  return (
    <SettingsSection title={t('settings.updates')} footer={footer}>
      <Text className="font-medium">{t('settings.version', { v: current })}</Text>
      {update ? (
        <Button onPress={open}>
          <Icon as={Download} size={16} className="text-primary-foreground" />
          <Text>{t('settings.getUpdate', { v: update.version })}</Text>
        </Button>
      ) : (
        <Button variant="outline" onPress={() => { haptic.tap(); setState({ kind: 'checking' }); void check(); }} disabled={state.kind === 'checking'}>
          <Icon as={RefreshCw} size={16} />
          <Text>{t('settings.checkUpdates')}</Text>
        </Button>
      )}
    </SettingsSection>
  );
}
