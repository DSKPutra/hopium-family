import { EmptyState, ErrorState, SkeletonList } from '@hopium/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/lib/errors';

interface QueryStateProps<T> {
  query: Pick<UseQueryResult<T>, 'data' | 'isLoading' | 'error' | 'refetch'>;
  isEmpty?: (data: T) => boolean;
  empty?: {
    title: string;
    body?: string;
    actionLabel?: string;
    onAction?: () => void;
    icon?: ReactNode;
  };
  loading?: ReactNode;
  children: (data: T) => ReactNode;
}

/** Standard loading (skeleton) / error (retry) / empty / success states. */
export function QueryState<T>({ query, isEmpty, empty, loading, children }: QueryStateProps<T>) {
  const { t } = useTranslation();
  if (query.isLoading) return <>{loading ?? <SkeletonList count={5} />}</>;
  if (query.error)
    return (
      <ErrorState
        title={t('errors.title')}
        message={errorMessage(t, query.error)}
        retryLabel={t('common.retry')}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.data === undefined) return <>{loading ?? <SkeletonList count={5} />}</>;
  if (empty && isEmpty?.(query.data)) return <EmptyState {...empty} />;
  return <>{children(query.data)}</>;
}
