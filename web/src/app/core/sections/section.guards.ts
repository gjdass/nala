import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SECTIONS } from './section.models';

/** `:section` routes: only sections the app has built; anything else leads home. */
export const registeredSectionGuard: CanActivateFn = (route) => {
  const key = route.paramMap.get('section');
  return inject(SECTIONS).some((s) => s.key === key) || inject(Router).createUrlTree(['/']);
};
