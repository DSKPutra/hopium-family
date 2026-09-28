import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { cn } from '../cn';
import { useTheme } from '../theme';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  className?: string;
  contentClassName?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  testID?: string;
}

/** Safe-area screen shell with optional scroll + pull-to-refresh and a sticky footer. */
export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  className,
  contentClassName,
  refreshing = false,
  onRefresh,
  footer,
  keyboardShouldPersistTaps = 'handled',
  testID,
}: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} className={cn('bg-bg flex-1', className)} testID={testID}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName={cn(
            'w-full max-w-[680px] self-center px-4 pb-10',
            contentClassName,
          )}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View className={cn('w-full max-w-[680px] flex-1 self-center px-4', contentClassName)}>
          {children}
        </View>
      )}
      {footer ? (
        <View className="border-border bg-bg w-full max-w-[680px] self-center border-t px-4 pb-4 pt-3">
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
