import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/** App routes: an instance without any user goes to first-run setup. */
export const setupRequiredGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .load()
    .pipe(
      map((state) => (state.setupRequired ? router.createUrlTree(['/setup']) : true)),
      // Unknown state (API down): let the app open and show it.
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
