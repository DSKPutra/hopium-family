import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import VerifyOtp from '../../app/(auth)/verify-otp';
import { useUi } from '@/stores/ui';
import { renderWithProviders } from '@/testing/render';

const mockVerify = jest.fn(async (_email: string, _code: string) => undefined);
const mockReplace = jest.fn((_href: string) => undefined);

jest.mock('@/lib/services', () => ({
  getServices: () => ({
    backend: {
      verifyOtp: (email: string, code: string) => mockVerify(email, code),
      startEmailSignIn: jest.fn(async () => undefined),
    },
  }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: (href: string) => mockReplace(href), back: jest.fn() },
}));
jest.mock(
  'expo-router/head',
  () =>
    ({ children }: { children: React.ReactNode }) =>
      children,
);

beforeEach(() => {
  mockVerify.mockClear();
  mockReplace.mockClear();
});

describe('verify OTP', () => {
  it('accepts a pasted code in any box and verifies once complete', async () => {
    useUi.setState({ pendingEmail: 'qa@hopium.test' });
    await renderWithProviders(<VerifyOtp />);
    await fireEvent.changeText(screen.getByTestId('otp-3'), '48 29-13');
    await waitFor(() => expect(mockVerify).toHaveBeenCalledWith('qa@hopium.test', '482913'));
  });

  it('types digit by digit, replacing an already filled box', async () => {
    useUi.setState({ pendingEmail: 'qa@hopium.test' });
    await renderWithProviders(<VerifyOtp />);
    await fireEvent.changeText(screen.getByTestId('otp-0'), '1');
    // Typing over a filled box without selecting yields old + new digit.
    await fireEvent.changeText(screen.getByTestId('otp-0'), '17');
    for (const [i, d] of ['2', '3', '4', '5', '6'].entries())
      await fireEvent.changeText(screen.getByTestId(`otp-${i + 1}`), d);
    await waitFor(() => expect(mockVerify).toHaveBeenCalledWith('qa@hopium.test', '723456'));
  });

  it('sends the user back to sign-in when the email is gone (reload)', async () => {
    useUi.setState({ pendingEmail: '' });
    await renderWithProviders(<VerifyOtp />);
    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
    expect(mockVerify).not.toHaveBeenCalled();
  });
});
