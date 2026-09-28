import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { haptic } from '@/shared/haptics';
import type { Stop } from '../types';
import { TypePicker } from './TypePicker';
import { useTranslation } from '@/shared/i18n';

type Draft = Pick<Stop, 'street' | 'number' | 'postcode' | 'type' | 'parcels'>;

/** Edits one stop. Mount with key={index} so each open starts from the stop's current values. */
export function StopEditDialog({ stop, onSave, onDelete, onClose }: {
  stop: Stop; onSave(patch: Partial<Stop>): void; onDelete(): void; onClose(): void;
}) {
  const { t } = useTranslation();
  const [initial] = useState<Draft>(() => ({ street: stop.street, number: stop.number, postcode: stop.postcode, type: stop.type, parcels: stop.parcels }));
  const [d, setD] = useState(initial);
  // The newest draft, kept in a ref and updated on every keystroke: the dialog keeps the close handler from an
  // early render, and a close right after typing must not lose the last characters.
  const latest = useRef(initial);
  const set = (p: Partial<Draft>) => { latest.current = { ...latest.current, ...p }; setD(latest.current); };
  const save = () => {
    const patch = Object.fromEntries(Object.entries(latest.current).filter(([k, v]) => stop[k as keyof Draft] !== v));
    if (Object.keys(patch).length) onSave(patch);
    haptic.success();
    onClose();
  };

  // closing any way (tap outside, ✕, back) keeps what was typed: a mis-tap must not lose an address
  return (
    <Dialog open onOpenChange={open => !open && save()}>
      <DialogContent className="w-[92vw] max-w-md gap-5">
        <DialogHeader><DialogTitle>{stop.no != null ? t('stops.stopNumber', { n: stop.no }) : t('stops.editTitle')}</DialogTitle></DialogHeader>
        <View className="gap-2">
          <Label nativeID="street">{t('stops.address')}</Label>
          <View className="flex-row gap-2">
            <Input className="flex-[3]" value={d.street} onChangeText={street => set({ street })} placeholder={t('common.street')} aria-labelledby="street" accessibilityLabel={t('common.street')} />
            <Input className="flex-1" value={d.number} onChangeText={number => set({ number })} placeholder={t('common.houseNo')} accessibilityLabel={t('common.houseNumber')} />
          </View>
          {/* numbers-and-punctuation: the number pad has no Done key on iOS, so the keyboard could hide Save */}
          <Input value={d.postcode} onChangeText={postcode => set({ postcode })} placeholder={t('common.postcode')} keyboardType="numbers-and-punctuation" returnKeyType="done" maxLength={5} accessibilityLabel={t('common.postcode')} />
        </View>
        <View className="gap-2">
          <Label>{t('common.type')}</Label>
          <TypePicker value={d.type} onChange={type => set({ type })} />
        </View>
        <View className="flex-row items-center justify-between">
          <Label>{t('stops.parcelsLabel')}</Label>
          <View className="flex-row items-center gap-3">
            <Button variant="outline" size="icon" onPress={() => { haptic.select(); set({ parcels: Math.max(1, d.parcels - 1) }); }} accessibilityLabel={t('stops.parcelMinus')}>
              <Icon as={Minus} size={18} />
            </Button>
            <Text className="w-8 text-center text-xl font-bold" style={{ fontVariant: ['tabular-nums'] }}>{d.parcels}</Text>
            <Button variant="outline" size="icon" onPress={() => { haptic.select(); set({ parcels: d.parcels + 1 }); }} accessibilityLabel={t('stops.parcelPlus')}>
              <Icon as={Plus} size={18} />
            </Button>
          </View>
        </View>
        <DialogFooter className="flex-row gap-2">
          <ConfirmDialog title={t('stops.removeConfirmTitle')} body={t('stops.removeConfirmBody', { address: `${stop.street} ${stop.number}` })} confirm={t('common.remove')} destructive onConfirm={() => { onDelete(); onClose(); }}>
            <Button variant="outline" size="lg" accessibilityLabel={t('stops.removeStop')}><Icon as={Trash2} size={18} className="text-destructive" /></Button>
          </ConfirmDialog>
          <Button size="lg" className="flex-1" onPress={save}><Text>{t('common.save')}</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
