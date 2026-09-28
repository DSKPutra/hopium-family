import { CheckCircle2, Info, XCircle } from 'lucide-react-native';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { Text } from './Text';

export type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 0,
          right: 0,
          alignItems: 'center',
          gap: 8,
          zIndex: 9999,
        }}
      >
        {items.map((t) => {
          const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : Info;
          const color =
            t.kind === 'success'
              ? colors.gain
              : t.kind === 'error'
                ? colors.loss
                : colors.secondary;
          return (
            <Animated.View
              key={t.id}
              entering={FadeInUp.springify().damping(18).stiffness(180)}
              exiting={FadeOutUp}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              className="border-border bg-surface mx-4 max-w-[480px] flex-row items-center gap-2.5 rounded-lg border px-4 py-3"
              style={{
                shadowColor: '#000',
                shadowOpacity: 0.3,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              }}
            >
              <Icon size={18} color={color} />
              <Text variant="small" weight="medium" className="shrink">
                {t.message}
              </Text>
            </Animated.View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
