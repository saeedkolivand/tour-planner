import { CircleAlert, CircleCheck, ListChecks } from 'lucide-react-native';
import { View } from 'react-native';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { t, useTranslation } from '@/shared/i18n';
import type { coverage } from '../selectors';

type Coverage = ReturnType<typeof coverage>;

const COPY: Record<Coverage['status'], (c: Coverage) => string> = {
  unknown: () => t('coverage.unknown'),
  complete: () => t('coverage.complete'),
  missing: c => t('coverage.missing', { n: c.want - c.have }),
  extra: c => t('coverage.extra', { n: c.have - c.want }),
};

/** "Did I capture everything?" against the scanner's own count. */
export function CoverageCard({ c, expected, onExpected }: { c: Coverage; expected: string; onExpected(v: string): void }) {
  const { t } = useTranslation();
  const ok = c.status === 'complete';
  const warn = c.status === 'missing' || c.status === 'extra';
  return (
    <Card className="py-4">
      <CardContent className="gap-3 px-4">
        <View className="flex-row items-center gap-3">
          <Icon as={ok ? CircleCheck : warn ? CircleAlert : ListChecks} size={22} className={ok ? 'text-success' : warn ? 'text-express' : 'text-muted-foreground'} />
          <Text className="flex-1 text-lg font-bold" style={{ fontVariant: ['tabular-nums'] }}>
            {c.have}
            <Text className="text-muted-foreground text-lg font-semibold">{c.want ? ` ${t('coverage.of', { n: c.want })}` : ''} {(c.want || c.have) === 1 ? t('common.stop') : t('common.stops')}</Text>
          </Text>
          <Input value={expected} onChangeText={onExpected} keyboardType="numbers-and-punctuation" returnKeyType="done" maxLength={4} placeholder={t('coverage.countPlaceholder')} className="h-10 w-20 text-center"
            accessibilityLabel={t('coverage.expectedLabel')} />
        </View>
        {c.want > 0 && <Progress value={c.ratio * 100} aria-label={t('coverage.progressLabel')} className="h-2" indicatorClassName={cn(ok ? 'bg-success' : 'bg-primary')} />}
        <Text className={cn('text-sm', warn ? 'text-foreground font-medium' : 'text-muted-foreground')}>{COPY[c.status](c)}</Text>
      </CardContent>
    </Card>
  );
}
