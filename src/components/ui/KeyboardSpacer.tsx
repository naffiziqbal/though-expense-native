import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform, type KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Current keyboard overlap height (0 when hidden), for layout max-height math. */
export function useKeyboardHeight(subtractBottomInset = true): number {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const liftFor = (keyboardHeight: number) =>
      Math.max(0, keyboardHeight - (subtractBottomInset ? insets.bottom : 0));

    const onShow = (e: KeyboardEvent) => {
      setHeight(liftFor(e.endCoordinates?.height ?? 0));
    };
    const onHide = () => setHeight(0);

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onShow
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      onHide
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom, subtractBottomInset]);

  return height;
}

/**
 * Keyboard lift driven by React Native core Keyboard events.
 *
 * SDK 53+ Android is always edge-to-edge, where `adjustResize` is ignored and
 * the window never resizes for the keyboard — so we measure the keyboard
 * ourselves and animate to exactly its height. No native-module dependency,
 * works identically in Expo Go and production builds.
 */
export function useKeyboardLift(bottomInset: number = 0) {
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateTo = (value: number, duration: number) =>
      Animated.timing(lift, {
        toValue: value,
        duration,
        easing: Easing.out(Easing.quad),
        // height animations can't use the native driver
        useNativeDriver: false,
      }).start();

    const onShow = (e: KeyboardEvent) => {
      const height = e.endCoordinates?.height ?? 0;
      // The keyboard already covers the bottom inset area; lift by the rest.
      animateTo(Math.max(0, height - bottomInset), Platform.OS === 'ios' ? e.duration || 250 : 220);
    };
    const onHide = (e: KeyboardEvent) => {
      animateTo(0, Platform.OS === 'ios' ? e?.duration || 250 : 180);
    };

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onShow
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      onHide
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [bottomInset, lift]);

  return lift;
}

/**
 * Drop-in spacer: place as the LAST sibling in a bottom-anchored layout and
 * it grows to the keyboard height, pushing the content above the keyboard.
 */
export function KeyboardSpacer({ subtractBottomInset = true }: { subtractBottomInset?: boolean }) {
  const insets = useSafeAreaInsets();
  const lift = useKeyboardLift(subtractBottomInset ? insets.bottom : 0);
  return <Animated.View style={{ height: lift }} />;
}
