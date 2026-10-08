import { CameraView, useCameraPermissions } from 'expo-camera';
import { Check, ScanText, X } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { setSettings, useSettings } from '@/features/settings/settings';
import { onDeviceOcr } from '@/services/scan';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';
import { LiveScan } from './LiveScan';

/** Full-screen in-app camera: several photos of the scanner list (or Auto: it takes them itself), no system-camera cancel button. */
export function PhotoCapture({ open, onClose, onDone }: {
  open: boolean; onClose(): void; onDone(uris: string[]): void;
}) {
  const { t } = useTranslation();
  const [permission, request] = useCameraPermissions();
  const [uris, setUris] = useState<string[]>([]);
  const camera = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const auto = useSettings().liveScan && onDeviceOcr;
  const keep = useCallback((uri: string) => setUris(u => [...u, uri]), []);

  // reset the roll when the modal opens or closes (adjusting state on a prop change, not in an effect)
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) { setWasOpen(open); if (uris.length) setUris([]); }

  const shoot = async () => {
    haptic.tap();
    const photo = await camera.current?.takePictureAsync({ quality: 0.8, skipProcessing: true });
    if (photo) setUris(u => [...u, photo.uri]);
  };

  return (
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        {open && permission?.granted && (
          <CameraView ref={camera} style={{ flex: 1 }} facing="back" animateShutter={!auto} />
        )}
        <View className="absolute inset-x-0 top-0 px-5" style={{ paddingTop: insets.top + 8 }}>
          <View className="flex-row items-center justify-between">
            <Button variant="secondary" size="icon" className="rounded-full bg-black/40" onPress={onClose} accessibilityLabel={t('common.close')}>
              <Icon as={X} size={20} className="text-white" />
            </Button>
            {onDeviceOcr && permission?.granted && (
              <Button variant={auto ? 'default' : 'secondary'} className="h-11 rounded-full px-4" onPress={() => { haptic.select(); setSettings({ liveScan: !auto }); }}
                accessibilityRole="switch" accessibilityState={{ checked: auto }} accessibilityLabel={t('capture.autoLabel')}>
                <Icon as={ScanText} size={18} className={auto ? 'text-primary-foreground' : undefined} />
                <Text>{t('capture.auto')}</Text>
              </Button>
            )}
          </View>
          {open && permission?.granted && <LiveScan camera={camera} on={auto} onKeep={keep} />}
        </View>
        {!permission?.granted && (
          <View className="flex-1 items-center justify-center gap-4 px-8">
            <Text className="text-center text-white">
              {permission?.canAskAgain === false ? t('permission.cameraSettings') : t('permission.cameraNeeded')}
            </Text>
            {permission?.canAskAgain !== false && (
              <Button size="xl" onPress={request}><Text>{t('permission.allowCamera')}</Text></Button>
            )}
          </View>
        )}
        {permission?.granted && (
          <View className="absolute inset-x-0 bottom-0 flex-row items-center justify-between px-6" style={{ paddingBottom: insets.bottom + 16 }}>
            <View className="w-14">
              {!!uris.length && <Image source={{ uri: uris[uris.length - 1] }} className="size-12 rounded-lg border border-white/40" />}
            </View>
            <Pressable onPress={shoot} accessibilityLabel={t('capture.takePhoto')} className="size-20 items-center justify-center rounded-full bg-white/30">
              <View className="size-16 rounded-full bg-white" />
            </Pressable>
            <Button size="xl" className="w-24" disabled={!uris.length} onPress={() => onDone(uris)} accessibilityLabel={`${t('common.done')}, ${t('count.photos', { count: uris.length })}`}>
              <Icon as={Check} size={18} />
              <Text>{uris.length}</Text>
            </Button>
          </View>
        )}
      </View>
    </Modal>
  );
}
