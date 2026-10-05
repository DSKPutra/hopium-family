import { useToast } from '@hopium/ui';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Platform, Share } from 'react-native';

/**
 * Native share sheet where available; on browsers without the Web Share API
 * the link is copied to the clipboard instead of throwing.
 */
export function useShare() {
  const { t } = useTranslation();
  const toast = useToast();
  return async (message: string, url: string): Promise<void> => {
    const text = `${message} ${url}`;
    if (Platform.OS !== 'web') {
      await Share.share({ message: text, url }).catch(() => undefined);
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: message, url });
        return;
      } catch (e) {
        // The user closing the share dialog is not a failure.
        if (e instanceof Error && e.name === 'AbortError') return;
      }
    }
    let copied = false;
    try {
      copied = await Clipboard.setStringAsync(url);
    } catch {
      copied = false;
    }
    // If the clipboard is unavailable (unfocused page, denied permission), show the link itself.
    toast.show(copied ? t('common.linkCopied') : url, copied ? 'success' : 'info');
  };
}
