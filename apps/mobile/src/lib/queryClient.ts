import { AppError } from '@hopium/core';
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      retry: (count, err) => {
        if (
          err instanceof AppError &&
          ['not_found', 'not_authenticated', 'region_restricted', 'kyc_required'].includes(err.code)
        )
          return false;
        return count < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
