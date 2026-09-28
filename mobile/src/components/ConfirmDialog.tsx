import type { ReactNode } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/shared/i18n';

/** Wraps a trigger so a destructive action always asks first. */
export function ConfirmDialog({ title, body, confirm, destructive, onConfirm, children }: {
  title: string; body: string; confirm: string; destructive?: boolean; onConfirm(): void; children: ReactNode;
}) {
  const { t } = useTranslation();
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
