import type { Router } from 'expo-router';

export const DATING_HOME_ROUTE = '/dating' as const;

export function navigateToDatingHome(router: Router) {
  router.replace(DATING_HOME_ROUTE);
}
