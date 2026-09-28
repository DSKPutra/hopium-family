import { getServices, type Services } from '@/lib/services';

export function useServices(): Services {
  return getServices();
}
