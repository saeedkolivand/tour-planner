import { Construction } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { Alert, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { currentHeading, currentPosition } from '@/services/location';
import { haptic } from '@/shared/haptics';
import { reportClosure } from './closures';

type Kind = 'closed' | 'oneway';

/**
 * "This street is closed" or "no entry this way" (a new one-way street): marks the road at the phone's
 * position, one-way in the direction the phone points, then re-plans the rest from here.
 */
export function ReportClosureButton({ onReported, disabled }: { onReported(): void; disabled?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState<Kind | null>(null);

  const report = async (kind: Kind) => {
    setSending(kind);
    try {
      const [at, heading] = await Promise.all([currentPosition(), kind === 'oneway' ? currentHeading() : undefined]);
      await reportClosure(at, note.trim() || (kind === 'oneway' ? t('closure.onewayNote') : ''), heading);
      haptic.success();
      setOpen(false); setNote('');
      onReported();
    } catch (e) {
      haptic.error();
      Alert.alert(t('closure.reportError'), (e as Error).message);
    } finally { setSending(null); }
  };

  return (
    <>
      <Button variant="secondary" size="icon" className="rounded-full" disabled={disabled} accessibilityLabel={t('closure.reportLabel')}
        onPress={() => { haptic.tap(); setOpen(true); }}>
        <Icon as={Construction} size={20} />
      </Button>
      {open && (
        <Sheet title={t('closure.title')} onDismiss={() => setOpen(false)} cancel={{ label: t('common.cancel'), onPress: () => setOpen(false) }}>
          <Text className="text-muted-foreground leading-6">
            {t('closure.closedDesc')}{'\n'}
            {t('closure.onewayDesc')}{'\n'}
            {t('closure.replanDesc')}
          </Text>
          <Input value={note} onChangeText={setNote} placeholder={t('closure.notePlaceholder')} accessibilityLabel={t('common.note')} />
          <View className="flex-row gap-2">
            <Button variant="destructive" size="lg" className="flex-1" onPress={() => report('closed')} disabled={!!sending}>
              <Text>{sending === 'closed' ? t('closure.reporting') : t('closure.closed')}</Text>
            </Button>
            <Button variant="secondary" size="lg" className="flex-1" onPress={() => report('oneway')} disabled={!!sending}>
              <Text>{sending === 'oneway' ? t('closure.reporting') : t('closure.onewayBtn')}</Text>
            </Button>
          </View>
        </Sheet>
      )}
    </>
  );
}
