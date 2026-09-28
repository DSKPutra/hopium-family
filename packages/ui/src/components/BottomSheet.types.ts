import type { ReactNode } from 'react';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  closeLabel: string;
  children: ReactNode;
  /** Keep content scrollable (long forms). */
  scrollable?: boolean;
  testID?: string;
}
