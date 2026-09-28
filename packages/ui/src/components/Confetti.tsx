import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const COLORS = ['#3DFFA8', '#8B5CFF', '#FFD166', '#FF4D6D', '#F5F3FF'];
const COUNT = 70;

interface ConfettiApi {
  fire: () => void;
}
const ConfettiContext = createContext<ConfettiApi | null>(null);

function Piece({
  index,
  width,
  height,
  burst,
}: {
  index: number;
  width: number;
  height: number;
  burst: number;
}) {
  const seed = (index * 9301 + burst * 49297) % 233280;
  const rand = (n: number) => ((seed * (n + 1) * 7919) % 1000) / 1000;
  const x0 = width / 2 + (rand(1) - 0.5) * 80;
  const x1 = rand(2) * width;
  const t = useSharedValue(0);
  t.value = withDelay(
    rand(3) * 180,
    withTiming(1, { duration: 1400 + rand(4) * 1000, easing: Easing.out(Easing.quad) }),
  );
  const size = 6 + rand(5) * 6;
  const color = COLORS[index % COLORS.length];
  const style = useAnimatedStyle(() => {
    const p = t.value;
    const lift = -height * 0.35 * Math.sin(Math.min(p * 2, 1) * Math.PI * 0.5);
    return {
      opacity: p < 0.85 ? 1 : 1 - (p - 0.85) / 0.15,
      transform: [
        { translateX: x0 + (x1 - x0) * p },
        { translateY: height * 0.55 + lift + height * 0.6 * p * p },
        { rotate: `${p * 720 * (rand(6) > 0.5 ? 1 : -1)}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size * 0.5,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/** Reanimated confetti that also runs on web. Fire on first trade, rank-up and thesis hit. */
export function ConfettiProvider({ children }: { children: ReactNode }) {
  const [burst, setBurst] = useState(0);
  const [active, setActive] = useState(false);
  const { width, height } = useWindowDimensions();
  const fire = useCallback(() => {
    setBurst((b) => b + 1);
    setActive(true);
    setTimeout(() => setActive(false), 2800);
  }, []);
  const api = useMemo(() => ({ fire }), [fire]);
  return (
    <ConfettiContext.Provider value={api}>
      {children}
      {active ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 }}
          accessibilityElementsHidden
        >
          {Array.from({ length: COUNT }, (_, i) => (
            <Piece key={`${burst}-${i}`} index={i} width={width} height={height} burst={burst} />
          ))}
        </View>
      ) : null}
    </ConfettiContext.Provider>
  );
}

export function useConfetti(): ConfettiApi {
  const ctx = useContext(ConfettiContext);
  if (!ctx) throw new Error('useConfetti must be used inside <ConfettiProvider>');
  return ctx;
}
