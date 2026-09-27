// "Next stop" Live Activity: Lock Screen, Dynamic Island and, since iOS 26, the CarPlay Dashboard
// (CarPlay uses `bannerSmall`; no CarPlay entitlement needed). Display-only, updated by the app.
// The layout function is serialized into expo-widgets' runtime: it may only use its props and
// @expo/ui, so colors and helpers live inside it.
import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, clipShape, font, foregroundStyle, frame, minimumScaleFactor, monospacedDigit, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { NextStopProps } from './types';

const NextStopActivity = (p: NextStopProps, _env: LiveActivityEnvironment) => {
  'widget';
  const RED = '#E4003A', GREEN = '#22C55E', AMBER = '#F59E0B', ON_AMBER = '#451A03';
  const done = p.left === 0;
  const accent = done ? GREEN : RED;
  const icons: Record<string, 'building.2.fill' | 'arrow.uturn.backward.circle.fill' | 'storefront.fill'> = { business: 'building.2.fill', pickup: 'arrow.uturn.backward.circle.fill', shop: 'storefront.fill' };
  const icon = done ? 'checkmark.seal.fill' as const : icons[p.type] ?? 'house.fill' as const;
  const progress = p.total ? p.delivered / p.total : 0;
  const detail = done ? `All ${p.total} stops delivered` : [p.postcode, p.walk ? `+${p.walk} on foot` : ''].filter(Boolean).join('  ·  ');
  const counts = `${p.delivered} of ${p.total} delivered`;
  const left = done ? '' : `${p.left} ${p.left === 1 ? 'stop' : 'stops'} left`;

  const badge = (size: number) => (
    <Text modifiers={[font({ size, weight: 'heavy', design: 'rounded' }), monospacedDigit(), foregroundStyle('white'),
      padding({ horizontal: size * 0.32, vertical: size * 0.16 }), frame({ minWidth: size * 1.75 }), background(accent), clipShape('roundedRectangle', size * 0.38)]}>
      {done ? '✓' : String(p.no)}
    </Text>
  );
  const expressChip = p.express ? (
    <HStack spacing={3} modifiers={[padding({ horizontal: 7, vertical: 3 }), background(AMBER), clipShape('capsule')]}>
      <Image systemName="bolt.fill" size={10} color={ON_AMBER} />
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(ON_AMBER)]}>{`Express ${p.express}`}</Text>
    </HStack>
  ) : null;
  const caption = (text: string) => <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle('secondary'), monospacedDigit()]}>{text}</Text>;
  const eta = (size: number) => <Text modifiers={[font({ size, weight: 'semibold' }), monospacedDigit()]}>{done ? '' : `~${p.eta}`}</Text>;
  const address = (size: number) => (
    <Text modifiers={[font({ size, weight: 'bold' }), minimumScaleFactor(0.7)]}>{done ? 'Tour complete' : p.address}</Text>
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={10} modifiers={[padding({ horizontal: 16, vertical: 14 })]}>
        <HStack spacing={14}>
          {badge(30)}
          <VStack alignment="leading" spacing={3}>
            <HStack spacing={5}>
              <Image systemName={icon} size={11} color={accent} />
              <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(accent)]}>{done ? 'TOUR COMPLETE' : 'NEXT STOP'}</Text>
              <Spacer />
              {eta(14)}
            </HStack>
            {address(19)}
            <HStack spacing={6}>
              {expressChip}
              <Text modifiers={[font({ size: 13 }), foregroundStyle('secondary')]}>{detail}</Text>
            </HStack>
          </VStack>
        </HStack>
        <ProgressView value={progress} modifiers={[tint(GREEN)]} />
        <HStack>{caption(counts)}<Spacer />{caption(left)}</HStack>
      </VStack>
    ),
    // CarPlay Dashboard / Apple Watch: readable at arm's length, one line of context
    bannerSmall: (
      <HStack spacing={10} modifiers={[padding({ all: 10 })]}>
        {badge(22)}
        <VStack alignment="leading" spacing={2}>
          {address(15)}
          <HStack spacing={4}>
            {p.express ? <Image systemName="bolt.fill" size={10} color={AMBER} /> : null}
            {caption(done ? counts : `~${p.eta}  ·  ${left}`)}
          </HStack>
        </VStack>
        <Spacer />
      </HStack>
    ),
    compactLeading: (
      <HStack spacing={2}>
        <Text modifiers={[font({ weight: 'heavy', design: 'rounded' }), monospacedDigit(), foregroundStyle(accent)]}>{done ? '✓' : String(p.no)}</Text>
        {p.express && !done ? <Image systemName="bolt.fill" size={12} color={AMBER} /> : null}
      </HStack>
    ),
    compactTrailing: done ? <Image systemName="checkmark" color={GREEN} /> : eta(15),
    minimal: <Text modifiers={[font({ weight: 'heavy', design: 'rounded' }), foregroundStyle(accent)]}>{done ? '✓' : String(p.no)}</Text>,
    expandedLeading: <VStack modifiers={[padding({ leading: 4 })]}>{badge(26)}</VStack>,
    expandedTrailing: (
      <VStack alignment="trailing" spacing={1} modifiers={[padding({ trailing: 4 })]}>
        {caption(done ? '' : 'arrive')}{eta(17)}
      </VStack>
    ),
    expandedCenter: address(17),
    expandedBottom: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ horizontal: 4 })]}>
        <HStack spacing={6}>{expressChip}<Text modifiers={[font({ size: 13 }), foregroundStyle('secondary')]}>{detail}</Text></HStack>
        <ProgressView value={progress} modifiers={[tint(GREEN)]} />
        <HStack>{caption(counts)}<Spacer />{caption(left)}</HStack>
      </VStack>
    ),
  };
};

export default createLiveActivity('NextStopActivity', NextStopActivity);
