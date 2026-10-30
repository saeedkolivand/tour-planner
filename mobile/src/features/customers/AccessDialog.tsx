import * as ImagePicker from 'expo-image-picker';
import { Camera, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import type { Stop } from '@/features/tour/types';
import { haptic } from '@/shared/haptics';
import { useTranslation } from '@/shared/i18n';
import { type Customer, photoUri, saveAccess } from './customers';

const MAX_PHOTOS = 3;

/** How to get the goods in at one customer: up to three photos of the door or box, and a line of text. */
export function AccessDialog({ stop, id, customer, onClose }: { stop: Stop; id?: string; customer?: Customer; onClose(): void }) {
  const { t } = useTranslation();
  const [initial] = useState(() => ({ keep: customer?.photos ?? [], taken: [] as string[], note: customer?.note ?? '' }));
  const [d, setD] = useState(initial);
  // the newest draft, in a ref too: the sheet can close with an early render's handler (as in StopEditDialog); the note
  // is uncontrolled (defaultValue), since a controlled TextInput on Android drops fast keystrokes
  const latest = useRef(initial);
  const set = (p: Partial<typeof initial>) => { latest.current = { ...latest.current, ...p }; setD(latest.current); };
  const changed = () => latest.current.taken.length > 0 || latest.current.keep.length !== initial.keep.length || latest.current.note !== initial.note;

  const shoot = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('permission.cameraSettings')); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.5 });
    if (!res.canceled && res.assets[0]) set({ taken: [...latest.current.taken, res.assets[0].uri] });
  };
  const save = () => {
    const { note, keep, taken } = latest.current;
    if (changed()) { saveAccess(stop, id, note, keep, taken); haptic.success(); }
    onClose();
  };
  const cancel = () => (!changed() ? onClose() : Alert.alert(t('stops.discardTitle'), undefined, [
    { text: t('common.keepEditing'), style: 'cancel' },
    { text: t('common.discard'), style: 'destructive', onPress: onClose },
  ]));

  const photos = [...d.keep.map(n => ({ uri: photoUri(n), drop: () => set({ keep: latest.current.keep.filter(x => x !== n) }) })),
    ...d.taken.map(u => ({ uri: u, drop: () => set({ taken: latest.current.taken.filter(x => x !== u) }) }))];
  return (
    <Sheet title={t('access.title')} onDismiss={save} cancel={{ label: t('common.cancel'), onPress: cancel }} action={{ label: t('common.save'), onPress: save }}>
      <Text className="text-muted-foreground">{[stop.name, `${stop.street} ${stop.number}`].filter(Boolean).join(' · ')}</Text>
      <View className="flex-row flex-wrap gap-3">
        {photos.map((p, i) => (
          <View key={p.uri}>
            <Image source={{ uri: p.uri }} className="size-28 rounded-lg" accessibilityLabel={t('access.photo', { n: i + 1 })} />
            <Pressable onPress={p.drop} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('access.removePhoto', { n: i + 1 })}
              className="absolute -right-2 -top-2 size-7 items-center justify-center rounded-full bg-black/70">
              <Icon as={X} size={16} className="text-white" />
            </Pressable>
          </View>
        ))}
      </View>
      {photos.length < MAX_PHOTOS && (
        <Button variant="outline" onPress={shoot}><Icon as={Camera} size={16} /><Text>{t('access.takePhoto')}</Text></Button>
      )}
      <View className="gap-2">
        <Label nativeID="access-note">{t('common.note')}</Label>
        <Input multiline className="min-h-24 py-3" textAlignVertical="top" defaultValue={initial.note} aria-labelledby="access-note"
          onChangeText={note => set({ note })} placeholder={t('access.notePlaceholder')} />
        <Text className="text-muted-foreground text-xs">{t('access.private')}</Text>
      </View>
    </Sheet>
  );
}
