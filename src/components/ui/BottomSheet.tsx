import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from './KeyboardSpacer';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const SHEET_CHROME = 72;

export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardBottom = useKeyboardHeight(false);
  const [screen, setScreen] = useState(() => Dimensions.get('screen'));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ screen: next }) => {
      setScreen(next);
    });
    return () => sub.remove();
  }, []);

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  /** RN Modal on Android often stays full physical height while the activity resizes — anchor to screen, not window. */
  const overlayHeight = screen.height;
  const overlayWidth = screen.width;

  const sheetMaxHeight = useMemo(() => {
    const topClearance = insets.top + spacing.s3;
    const available = overlayHeight - keyboardBottom - topClearance;
    return Math.max(200, Math.min(520, available));
  }, [overlayHeight, keyboardBottom, insets.top]);

  const scrollMaxHeight = Math.max(100, sheetMaxHeight - SHEET_CHROME);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
      navigationBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={{ width: overlayWidth, height: overlayHeight }}>
        <Pressable style={[styles.backdrop, { height: overlayHeight }]} onPress={close} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bgSurface,
              paddingBottom: Math.max(insets.bottom, spacing.s4),
              bottom: keyboardBottom,
              maxHeight: sheetMaxHeight,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {title}
            </Text>
            <Pressable onPress={close} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={{ maxHeight: scrollMaxHeight }}
            contentContainerStyle={{ paddingBottom: spacing.s2 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s4,
    gap: spacing.s3,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.s3,
  },
  title: {
    flex: 1,
    fontSize: fontSize.lg,
    fontFamily: fonts.semibold,
  },
});
