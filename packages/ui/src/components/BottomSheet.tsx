import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { breakpoints } from '../tokens';
import { useTheme } from '../theme';
import type { BottomSheetProps } from './BottomSheet.types';
import { IconButton } from './IconButton';
import { Text } from './Text';

export type { BottomSheetProps } from './BottomSheet.types';

export function BottomSheetProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * Web: a bottom drawer on narrow screens and a centered dialog on tablet and
 * desktop (gorhom's sheet is native-only).
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  closeLabel,
  children,
  testID,
}: BottomSheetProps) {
  const { colors, scheme } = useTheme();
  const { width, height } = useWindowDimensions();
  const dialog = width >= breakpoints.tablet;
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View
        style={
          {
            flex: 1,
            justifyContent: dialog ? 'center' : 'flex-end',
            alignItems: 'center',
            colorScheme: scheme,
          } as object
        }
      >
        <Animated.View
          entering={FadeIn.duration(150)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            onPress={onClose}
            style={{ flex: 1 }}
          />
        </Animated.View>
        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          entering={SlideInDown.springify().damping(18).stiffness(180)}
          style={{
            width: dialog ? 480 : '100%',
            maxHeight: height * 0.9,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 24,
            borderBottomLeftRadius: dialog ? 24 : 0,
            borderBottomRightRadius: dialog ? 24 : 0,
          }}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="mb-3 flex-row items-center justify-between">
              {title ? <Text variant="h3">{title}</Text> : <View />}
              <IconButton
                accessibilityLabel={closeLabel}
                icon={<X size={20} color={colors.text} />}
                onPress={onClose}
              />
            </View>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
