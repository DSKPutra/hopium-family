import '@/i18n';

import { render, screen } from '@testing-library/react-native';

import Index from '../../app/index';
import { ThemeProvider } from '@/providers/ThemeProvider';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, SafeAreaProvider: View };
});

describe('Index screen', () => {
  it('renders the wordmark, tagline and demo pill', async () => {
    await render(
      <ThemeProvider>
        <Index />
      </ThemeProvider>,
    );
    expect(screen.getByRole('header')).toHaveTextContent('hopium.family');
    expect(screen.getByText('stay high on conviction.')).toBeOnTheScreen();
    expect(screen.getByText('demo mode')).toBeOnTheScreen();
  });
});
