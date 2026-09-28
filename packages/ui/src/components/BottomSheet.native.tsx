import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import type { BottomSheetProps } from './BottomSheet.types';
import { IconButton } from './IconButton';
import { Text } from './Text';

export type { BottomSheetProps } from './BottomSheet.types';

export function BottomSheetProvider({ children }: { children: ReactNode }) {
  return <BottomSheetModalProvider>{children}</BottomSheetModalProvider>;
}

/** Native: @gorhom/bottom-sheet with dynamic sizing and a dimmed backdrop. */
export function BottomSheet({
  visible,
  onClose,
  title,
  closeLabel,
  children,
  scrollable,
  testID,
}: BottomSheetProps) {
  const ref = useRef<BottomSheetModal>(null);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [visible]);

  const backdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    [],
  );

  const Body = scrollable ? BottomSheetScrollView : BottomSheetView;
  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onClose}
      enableDynamicSizing
      maxDynamicContentSize={800}
      backdropComponent={backdrop}
      backgroundStyle={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
      }}
      handleIndicatorStyle={{ backgroundColor: colors.border, width: 44 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <Body testID={testID} style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
        {title ? (
          <View className="mb-3 flex-row items-center justify-between">
            <Text variant="h3">{title}</Text>
            <IconButton
              accessibilityLabel={closeLabel}
              icon={<X size={20} color={colors.text} />}
              onPress={onClose}
            />
          </View>
        ) : null}
        {children}
      </Body>
    </BottomSheetModal>
  );
}
