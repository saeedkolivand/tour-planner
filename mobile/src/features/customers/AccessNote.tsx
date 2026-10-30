import { Camera, DoorOpen, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Stop } from '@/features/tour/types';
import { useTranslation } from '@/shared/i18n';
import { AccessDialog } from './AccessDialog';
import { photoUri, useCustomer } from './customers';

/**
 * How to get in at this stop's customer, on the Next Stop card: the first photo (tap: all of them, full screen) and
 * the note. Nothing remembered yet: an "Add how to get in" button when `hint`, else nothing.
 */
export function AccessNote({ stop, title, hint }: { stop: Stop; title?: string; hint?: boolean }) {
  const { t } = useTranslation();
  const { id, customer } = useCustomer(stop);
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);
  if (Platform.OS === 'web' || (!customer && !hint)) return null; // web: no documents folder to keep photos in
  const photos = customer?.photos ?? [];
  return (
    <>
      {customer ? (
        <View className="bg-muted gap-2 rounded-lg p-3">
          <View className="flex-row items-center gap-2">
            <Icon as={DoorOpen} size={16} className="text-muted-foreground" />
            <Text className="text-muted-foreground flex-1 text-sm font-semibold" numberOfLines={1}>{title ?? t('access.title')}</Text>
            <Pressable onPress={() => setEditing(true)} hitSlop={10} accessibilityRole="button" className="active:opacity-60">
              <Text className="text-primary text-sm font-semibold">{t('common.edit')}</Text>
            </Pressable>
          </View>
          {photos.length > 0 && (
            <Pressable onPress={() => setViewing(true)} accessibilityRole="imagebutton" accessibilityLabel={t('access.showPhotos', { count: photos.length })}>
              <Image source={{ uri: photoUri(photos[0]) }} className="h-40 w-full rounded-md" resizeMode="cover" />
              {photos.length > 1 && <Text className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">+{photos.length - 1}</Text>}
            </Pressable>
          )}
          {!!customer.note && <Text className="text-base leading-6">{customer.note}</Text>}
        </View>
      ) : (
        <Button variant="outline" onPress={() => setEditing(true)}>
          <Icon as={Camera} size={16} />
          <Text>{t('access.add')}</Text>
        </Button>
      )}
      {editing && <AccessDialog stop={stop} id={id} customer={customer} onClose={() => setEditing(false)} />}
      {viewing && <PhotoViewer uris={photos.map(photoUri)} onClose={() => setViewing(false)} />}
    </>
  );
}

/** The photos full screen, swiped through. */
function PhotoViewer({ uris, onClose }: { uris: string[]; onClose(): void }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View className="flex-1 bg-black">
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {uris.map(u => <Image key={u} source={{ uri: u }} style={{ width, height }} resizeMode="contain" />)}
        </ScrollView>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}
          className="absolute right-4 size-11 items-center justify-center rounded-full bg-white/20" style={{ top: top + 8 }}>
          <Icon as={X} size={22} className="text-white" />
        </Pressable>
      </View>
    </Modal>
  );
}
