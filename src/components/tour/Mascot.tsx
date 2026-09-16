import React, { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

interface MascotProps {
  size?: number;
  /** Bump this to replay the greeting pop — e.g. the current tour step index. */
  poseKey?: number;
}

/**
 * Penny — the guide for the in-app tour. Drawn in SVG rather than shipped as
 * an asset so she inherits the brand teal and stays crisp at any size.
 */
export function Mascot({ size = 76, poseKey = 0 }: MascotProps) {
  const bob = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [bob]);

  useEffect(() => {
    pop.value = withSequence(
      withTiming(0.86, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1.06, { duration: 150, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) })
    );
  }, [poseKey, pop]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }, { scale: pop.value }],
  }));

  return (
    <Animated.View style={style}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="pennyBody" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2DD4BF" />
            <Stop offset="1" stopColor="#0E9488" />
          </LinearGradient>
        </Defs>

        {/* Ground shadow anchors her to the screen */}
        <Ellipse cx="50" cy="93" rx="25" ry="4.5" fill="#000000" opacity={0.12} />

        {/* Waving arm, behind the body so it reads as an arm not a blob */}
        <Path
          d="M74 46 Q88 40 90 24"
          stroke="#0E9488"
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx="90" cy="22" r="5" fill="#2DD4BF" />

        <Circle cx="50" cy="50" r="34" fill="url(#pennyBody)" />
        {/* Coin rim — she's a coin, subtly */}
        <Circle
          cx="50"
          cy="50"
          r="27"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.3}
          strokeWidth={2.5}
        />

        <Ellipse cx="39" cy="45" rx="6.5" ry="7.5" fill="#FFFFFF" />
        <Ellipse cx="61" cy="45" rx="6.5" ry="7.5" fill="#FFFFFF" />
        <Circle cx="40" cy="46.5" r="3.3" fill="#0B3B37" />
        <Circle cx="62" cy="46.5" r="3.3" fill="#0B3B37" />
        <Circle cx="41.3" cy="45" r="1.1" fill="#FFFFFF" />
        <Circle cx="63.3" cy="45" r="1.1" fill="#FFFFFF" />

        <Path
          d="M42 60 Q50 67 58 60"
          stroke="#0B3B37"
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />

        <Ellipse cx="31" cy="56" rx="4" ry="2.6" fill="#FFFFFF" opacity={0.22} />
        <Ellipse cx="69" cy="56" rx="4" ry="2.6" fill="#FFFFFF" opacity={0.22} />
      </Svg>
    </Animated.View>
  );
}
