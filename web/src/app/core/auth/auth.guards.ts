import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/** App routes: first-run setup on an empty instance, the login screen when signed out. */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .load()
    .pipe(
      map((state) => {
        if (state.setupRequired) {
          return router.createUrlTree(['/setup']);
        }
        return state.user ? true : router.createUrlTree(['/login']);
      }),
      // Unknown state (offline, API down): let the app shell open.
      catchError(() => of(true)),
    );
};

/** Login and invitation screens: only for signed-out visitors of a set-up instance. */
export const signedOutGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .load()
    .pipe(
      map((state) => {
        if (state.setupRequired) {
          return router.createUrlTree(['/setup']);
        }
        return state.user ? router.createUrlTree(['/']) : true;
      }),
      catchError(() => of(true)),
    );
};

/** The setup screen is only reachable while the instance has no user. */
export const setupOnlyGuard: CanActivateFn = () => {
  const router = inject(Router);
  const home = router.createUrlTree(['/']);
  return inject(AuthService)
    .load()
    .pipe(
      map((state) => (state.setupRequired ? true : home)),
      catchError(() => of(home)),
    );
};

