import { CameraView, useCameraPermissions } from 'expo-camera';
import { Check, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';

/** Full-screen in-app camera: several photos of the scanner list, no system-camera cancel button. */
export function PhotoCapture({ open, onClose, onDone }: {
  open: boolean; onClose(): void; onDone(uris: string[]): void;
}) {
  const { t } = useTranslation();
  const [permission, request] = useCameraPermissions();
  const [uris, setUris] = useState<string[]>([]);
  const camera = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();

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
          <CameraView ref={camera} style={{ flex: 1 }} facing="back" />
        )}
        <View className="absolute inset-x-0 top-0 px-5" style={{ paddingTop: insets.top + 8 }}>
          <View className="flex-row items-center justify-between">
            <Button variant="secondary" size="icon" className="rounded-full bg-black/40" onPress={onClose} accessibilityLabel={t('common.close')}>
              <Icon as={X} size={20} className="text-white" />
            </Button>
          </View>
          {permission?.granted && (
            <Text className="mt-3 text-center text-white/80">{t('capture.inAppHint')}</Text>
          )}
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
