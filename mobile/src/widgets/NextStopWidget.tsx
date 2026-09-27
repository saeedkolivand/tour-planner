// "Next stop" widget. Small: Home Screen and the CarPlay widget screen (iOS 26+, no entitlement needed).
// Medium: Home Screen with the full detail. Tapping opens the Route tab.
// Serialized into expo-widgets' runtime like the Live Activity: props and @expo/ui only.
import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background, clipShape, containerBackground, font, foregroundStyle, minimumScaleFactor, monospacedDigit, padding, tint, widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { NextStopProps } from './types';

const NextStopWidget = (p: NextStopProps, env: WidgetEnvironment) => {
  'widget';
  const RED = '#E4003A', GREEN = '#22C55E', AMBER = '#F59E0B', ON_AMBER = '#451A03';
  const done = p.left === 0;
  const accent = done ? GREEN : RED;
  const progress = p.total ? p.delivered / p.total : 0;
  // containerBackground is mandatory for widgets since iOS 17; a material follows light/dark and CarPlay
  const root = [widgetURL('tourplanner://route'), containerBackground({ type: 'material', material: 'regular' }, 'widget')];

  const header = (
    <HStack spacing={5}>
      <Image systemName={done ? 'checkmark.seal.fill' : 'shippingbox.fill'} size={11} color={accent} />
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(accent)]}>{done ? 'DONE' : 'NEXT'}</Text>
      <Spacer />
      <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle('secondary'), monospacedDigit()]}>{done ? '' : `${p.left} left`}</Text>
    </HStack>
  );
  const number = (
    <Text modifiers={[font({ size: 46, weight: 'heavy', design: 'rounded' }), monospacedDigit(), minimumScaleFactor(0.6)]}>{done ? '✓' : String(p.no)}</Text>
  );
  const expressChip = p.express ? (
    <HStack spacing={3} modifiers={[padding({ horizontal: 7, vertical: 3 }), background(AMBER), clipShape('capsule')]}>
      <Image systemName="bolt.fill" size={10} color={ON_AMBER} />
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(ON_AMBER)]}>{`Express ${p.express}`}</Text>
    </HStack>
  ) : null;
  const bar = <ProgressView value={progress} modifiers={[tint(GREEN)]} />;
  const address = done ? 'All stops delivered' : p.address;

  if (env.widgetFamily !== 'systemMedium') {
    return (
      <VStack alignment="leading" spacing={3} modifiers={root}>
        {header}
        <Spacer />
        <HStack alignment="lastTextBaseline" spacing={6}>
          {number}
          {p.express ? <Image systemName="bolt.fill" size={16} color={AMBER} /> : null}
        </HStack>
        <Text modifiers={[font({ size: 14, weight: 'semibold' }), minimumScaleFactor(0.75)]}>{address}</Text>
        {bar}
      </VStack>
    );
  }
  return (
    <HStack spacing={16} modifiers={root}>
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(accent)]}>{done ? 'DONE' : 'NEXT'}</Text>
        {number}
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('secondary'), monospacedDigit()]}>{done ? '' : `~${p.eta}`}</Text>
      </VStack>
      <VStack alignment="leading" spacing={5}>
        <Text modifiers={[font({ size: 17, weight: 'bold' }), minimumScaleFactor(0.7)]}>{address}</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle('secondary')]}>
          {[p.postcode, p.walk ? `+${p.walk} on foot` : ''].filter(Boolean).join('  ·  ')}
        </Text>
        {expressChip}
        <Spacer />
        {bar}
        <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle('secondary'), monospacedDigit()]}>
          {`${p.delivered} of ${p.total} delivered${done ? '' : `  ·  ${p.left} left`}`}
        </Text>
      </VStack>
    </HStack>
  );
};

export default createWidget('NextStopWidget', NextStopWidget);
