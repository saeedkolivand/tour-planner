// The opening animation, over the app on a cold start: the still splash (the road check, expo-splash-screen) hands
// over to this identical first frame; a van drives along the check painting its markings, then the screen tears
// open along the check and its halves fly apart, the app underneath. About a second; a plain fade with Reduce Motion.
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, Polygon, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { DASH, GAP, glide, halves, MARK, MARK_START, ROAD, TOTAL, vanPose } from './geometry';

// kept up until this layer has drawn its first frame (module scope: before anything could hide it); Reduce Motion is
// asked now too, so the animation can start the moment the layer is on screen
SplashScreen.preventAutoHideAsync().catch(() => {});
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then(on => { reduceMotion = on; }, () => {});

const IMAGE_WIDTH = 220; // app.json expo-splash-screen imageWidth: the still image spans the 2048 grid at this width
const S = IMAGE_WIDTH / 2048;
const ROUTE = 'M580 1060 L900 1380 L1500 700';
const COLORS = { light: { bg: '#DC0032', fg: '#FFFFFF' }, dark: { bg: '#0A0A0C', fg: '#F02850' } };
const AnimatedPath = Animated.createAnimatedComponent(Path);
const splitEase = (t: number) => { 'worklet'; return t ** 2.2; };

function Van({ fg, bg }: { fg: string; bg: string }) {
  const r = 110; // grid units, centred on 0,0, facing right
  return (
    <G>
      <Rect x={-2.1 * r} y={-1.2 * r} width={2.8 * r} height={1.7 * r} rx={0.25 * r} fill={fg} />
      <Rect x={0.4 * r} y={-0.6 * r} width={1.6 * r} height={1.1 * r} rx={0.35 * r} fill={fg} />
      <Polygon points={`${0.7 * r},${-0.45 * r} ${1.4 * r},${-0.45 * r} ${1.75 * r},${-0.05 * r} ${0.7 * r},${-0.05 * r}`} fill={bg} />
      {[-1.3 * r, 1.1 * r].map(cx => (
        <G key={cx}><Circle cx={cx} cy={0.7 * r} r={0.5 * r} fill={bg} /><Circle cx={cx} cy={0.7 * r} r={0.33 * r} fill={fg} /></G>
      ))}
    </G>
  );
}

export function AnimatedSplash() {
  const scheme = useColorScheme().colorScheme === 'dark' ? 'dark' : 'light';
  const { bg, fg } = COLORS[scheme];
  const { width: W, height: H } = useWindowDimensions();
  const [done, setDone] = useState(false);
  const drive = useSharedValue(0), split = useSharedValue(0), fade = useSharedValue(1);

  // each half: the screen and a margin (it only needs to cover the screen until it starts to fly off)
  const M = 0.15, box = { x: 1024 - ((0.5 + M) * W) / S, y: 1024 - ((0.5 + M) * H) / S, w: ((1 + 2 * M) * W) / S, h: ((1 + 2 * M) * H) / S };
  const { upper, lower, pivot } = halves(box);
  const origin = [(pivot[0] - box.x) * S, (pivot[1] - box.y) * S, 0];

  const start = () => {
    SplashScreen.hideAsync().catch(() => {}); // this layer looks the same, so no need to wait for it
    const finish = () => setDone(true);
    if (reduceMotion) {
      fade.value = withTiming(0, { duration: 250 }, f => { if (f) scheduleOnRN(finish); });
      return;
    }
    drive.value = withTiming(1, { duration: 650, easing: glide }, f => {
      if (!f) return;
      split.value = withDelay(80, withTiming(1, { duration: 380, easing: splitEase }, g => { if (g) scheduleOnRN(finish); }));
    });
  };

  // the markings appear behind the van: a cover in the road's colour hides the part not yet driven
  const cover = useAnimatedProps(() => ({ strokeDashoffset: -drive.value * TOTAL }));
  const useHalf = (sign: 1 | -1) => useAnimatedStyle(() => {
    const e = split.value;
    return {
      transform: sign < 0
        ? [{ translateX: -0.55 * e * W }, { translateY: -0.8 * e * H }, { rotate: `${-9 * e}deg` }]
        : [{ translateX: 0.5 * e * W }, { translateY: 0.8 * e * H }, { rotate: `${7 * e}deg` }],
    };
  });
  const upperStyle = useHalf(-1), lowerStyle = useHalf(1);
  const vanStyle = useAnimatedStyle(() => {
    const p = vanPose(drive.value);
    return { transform: [{ translateX: (p.x - box.x) * S - 50 }, { translateY: (p.y - box.y) * S - 50 }, { rotate: `${p.deg}deg` }] };
  });
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (done) return null;
  const view = `${box.x} ${box.y} ${box.w} ${box.h}`;
  const scene = (clip: string) => (
    <Svg width={(1 + 2 * M) * W} height={(1 + 2 * M) * H} viewBox={view}>
      <Defs><ClipPath id={clip}><Polygon points={clip === 'up' ? upper : lower} /></ClipPath></Defs>
      <G clipPath={`url(#${clip})`}>
        <Rect x={box.x} y={box.y} width={box.w} height={box.h} fill={bg} />
        <Path d={ROUTE} stroke={fg} strokeWidth={ROAD} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d={ROUTE} stroke={bg} strokeWidth={MARK} strokeDasharray={[DASH, GAP]} strokeDashoffset={-MARK_START} strokeLinecap="round" fill="none" />
        <AnimatedPath d={ROUTE} stroke={fg} strokeWidth={MARK + 8} strokeDasharray={[2 * TOTAL, 2 * TOTAL]} animatedProps={cover} fill="none" />
      </G>
    </Svg>
  );
  const halfBox = { position: 'absolute' as const, left: -M * W, top: -M * H, width: (1 + 2 * M) * W, height: (1 + 2 * M) * H, transformOrigin: origin };
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fadeStyle]} onLayout={start}>
      <Animated.View style={[halfBox, lowerStyle]}>{scene('down')}</Animated.View>
      <Animated.View style={[halfBox, upperStyle]}>
        {scene('up')}
        {/* the van rides on the upper half, so it flies off with it */}
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 100, height: 100 }, vanStyle]}>
          <Svg width={100} height={100} viewBox={`${-50 / S} ${-50 / S} ${100 / S} ${100 / S}`}><Van fg={fg} bg={bg} /></Svg>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
