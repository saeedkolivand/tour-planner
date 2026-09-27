import { Camera, Images, ScanText } from 'lucide-react-native';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { onDeviceOcr } from '@/services/scan';

/** The first thing on screen: photograph the scanner list (or pick screenshots). */
export function CaptureCard({ onCamera, onLibrary, busy, message }: {
  onCamera(): void; onLibrary(): void; busy: boolean; message?: string;
}) {
  return (
    <Card className="border-0 bg-primary py-5">
      <CardContent className="gap-4 px-5">
        <View className="flex-row items-center gap-3">
          <View className="size-11 items-center justify-center rounded-md bg-white/15">
            <Icon as={ScanText} size={22} className="text-primary-foreground" />
          </View>
          <View className="flex-1">
            <Text className="text-primary-foreground text-lg font-bold">Capture the scanner list</Text>
            <Text className="text-primary-foreground/80 text-sm">
              {onDeviceOcr ? 'Read on this phone. Photos never leave it.' : 'Photos are read on your PC.'}
            </Text>
          </View>
        </View>
        <View className="flex-row gap-2.5">
          <Button size="xl" className="flex-1 bg-white active:bg-white/90" onPress={onCamera} disabled={busy} accessibilityLabel="Photograph the scanner">
            <Icon as={Camera} size={20} className="text-primary" />
            <Text className="text-primary">Camera</Text>
          </Button>
          <Button size="xl" className="flex-1 bg-white/15 active:bg-white/25" onPress={onLibrary} disabled={busy} accessibilityLabel="Pick screenshots">
            <Icon as={Images} size={20} className="text-primary-foreground" />
            <Text className="text-primary-foreground" numberOfLines={1} adjustsFontSizeToFit>Screenshots</Text>
          </Button>
        </View>
        {!!message && <Text className="text-primary-foreground/90 text-sm font-medium" accessibilityLiveRegion="polite">{message}</Text>}
      </CardContent>
    </Card>
  );
}
