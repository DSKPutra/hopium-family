import { breakpoints } from '@hopium/ui';
import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isDesktop: width >= breakpoints.desktop,
    isTablet: width >= breakpoints.tablet && width < breakpoints.desktop,
    isWide: width >= breakpoints.tablet,
  };
}
