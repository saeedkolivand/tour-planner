import { cloneElement, type ReactElement, type ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { t as translate, useTranslation } from '@/shared/i18n';

/** Asks before a destructive action with the phone's own alert (red action on iPhone). */
export function confirmAlert(title: string, body: string, confirm: string, onConfirm: () => void, destructive = true) {
  Alert.alert(title, body, [
    { text: translate('common.cancel'), style: 'cancel' },
    { text: confirm, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

/** Wraps a trigger so a destructive action always asks first: the native alert on a phone, a dialog on the web preview. */
export function ConfirmDialog({ title, body, confirm, destructive, onConfirm, children }: {
  title: string; body: string; confirm: string; destructive?: boolean; onConfirm(): void; children: ReactNode;
}) {
  const { t } = useTranslation();
  if (Platform.OS !== 'web') {
    return cloneElement(children as ReactElement<{ onPress?(): void }>, { onPress: () => confirmAlert(title, body, confirm, onConfirm, destructive) });
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel><Text>{t('common.cancel')}</Text></AlertDialogCancel>
          <AlertDialogAction className={cn(destructive && 'bg-destructive')} onPress={onConfirm}><Text>{confirm}</Text></AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
