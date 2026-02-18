/**
 * Store intended route from deep link when user is not authenticated.
 * After login/signup, navigate to this route.
 */

let pendingRoute: string | null = null;

export function setPendingRoute(route: string | null): void {
  pendingRoute = route;
}

export function getAndClearPendingRoute(): string | null {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
}

export function getPendingRoute(): string | null {
  return pendingRoute;
}

/** If there is a pending content route (post/reel), return it and clear it. Otherwise return null. */
export function getAndClearPendingRouteIfContent(): string | null {
  if (pendingRoute && (pendingRoute.startsWith('/post/') || pendingRoute.startsWith('/reel/'))) {
    const r = pendingRoute;
    pendingRoute = null;
    return r;
  }
  return null;
}
