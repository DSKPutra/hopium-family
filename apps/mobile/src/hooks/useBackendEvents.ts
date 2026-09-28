import { useConfetti, useToast, haptics } from '@hopium/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { tKey } from '@/lib/errors';
import { presentLocalNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/queryKeys';
import { useServices } from './useServices';

/**
 * Bridges backend realtime events into the query cache and UI: new posts pill,
 * unread badges, confetti on milestones and OS notifications for alerts.
 */
export function useBackendEvents(): { newPosts: number; resetNewPosts: () => void } {
  const { backend } = useServices();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const confetti = useConfetti();
  const toast = useToast();
  const [newPosts, setNewPosts] = useState(0);

  useEffect(() => {
    let meId: string | null = null;
    void backend.getSession().then((s) => (meId = s?.userId ?? null));
    return backend.subscribe((e) => {
      switch (e.type) {
        case 'session':
          void backend.getSession().then((s) => (meId = s?.userId ?? null));
          void qc.invalidateQueries({ queryKey: queryKeys.session });
          void qc.invalidateQueries({ queryKey: queryKeys.me });
          break;
        case 'profile':
          void qc.invalidateQueries({ queryKey: queryKeys.me });
          void qc.invalidateQueries({ queryKey: queryKeys.region });
          break;
        case 'feed:new':
          if (e.authorId !== meId) setNewPosts((n) => n + 1);
          else void qc.invalidateQueries({ queryKey: ['feed'] });
          void qc.invalidateQueries({ queryKey: queryKeys.legends });
          break;
        case 'notification':
          void qc.invalidateQueries({ queryKey: queryKeys.notifications });
          if (e.notification.type === 'liquidation_risk' || e.notification.type === 'liquidated')
            haptics.warning();
          if (e.push) {
            void presentLocalNotification(
              tKey(t, e.notification.titleKey, e.notification.params),
              tKey(t, e.notification.bodyKey, e.notification.params),
              e.notification.data.href,
            );
          }
          break;
        case 'positions':
          void qc.invalidateQueries({ queryKey: queryKeys.positions });
          void qc.invalidateQueries({ queryKey: queryKeys.positionHistory });
          void qc.invalidateQueries({ queryKey: queryKeys.portfolio });
          break;
        case 'balances':
        case 'orders':
          void qc.invalidateQueries({ queryKey: queryKeys.portfolio });
          void qc.invalidateQueries({ queryKey: ['holding'] });
          void qc.invalidateQueries({ queryKey: queryKeys.orders });
          void qc.invalidateQueries({ queryKey: ['activity'] });
          break;
        case 'kyc':
          void qc.invalidateQueries({ queryKey: queryKeys.kyc });
          void qc.invalidateQueries({ queryKey: queryKeys.me });
          break;
        case 'thesis:resolved':
          void qc.invalidateQueries({ queryKey: queryKeys.thesis(e.thesis.id) });
          if (e.mine && e.thesis.status === 'hit')
            toast.show(t('theses.hitToast', { symbol: e.thesis.symbol }), 'success');
          break;
        case 'milestone':
          if (e.kind === 'first_trade' || e.kind === 'rank_up' || e.kind === 'thesis_hit')
            confetti.fire();
          if (e.kind === 'rank_up')
            toast.show(t('leaderboard.rankUp', { rank: e.params.rank ?? '' }), 'success');
          break;
        default:
          break;
      }
    });
  }, [backend, qc, t, confetti, toast]);

  return { newPosts, resetNewPosts: () => setNewPosts(0) };
}
