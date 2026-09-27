import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { setupOnlyGuard, setupRequiredGuard } from './auth.guards';
import { AuthState } from './auth.models';
import { AuthService } from './auth.service';

describe('auth guards', () => {
  let load: () => Observable<AuthState>;

  const run = async (guard: typeof setupOnlyGuard) => {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  };
  const url = (result: boolean | UrlTree) =>
    result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { load: () => load() } }],
    });
  });

  describe('setupRequiredGuard', () => {
    it('redirects to /setup while the instance has no user', async () => {
      load = () => of({ setupRequired: true, user: null });
      expect(url(await run(setupRequiredGuard))).toBe('/setup');
    });

    it('lets the route through once setup is done', async () => {
      load = () => of({ setupRequired: false, user: null });
      expect(await run(setupRequiredGuard)).toBe(true);
    });

    it('lets the route through when the state cannot be loaded', async () => {
      load = () => throwError(() => new Error('offline'));
      expect(await run(setupRequiredGuard)).toBe(true);
    });
  });

  describe('setupOnlyGuard', () => {
    it('allows /setup while the instance has no user', async () => {
      load = () => of({ setupRequired: true, user: null });
      expect(await run(setupOnlyGuard)).toBe(true);
    });

    it('redirects to / once setup is done', async () => {
      load = () => of({ setupRequired: false, user: null });
      expect(url(await run(setupOnlyGuard))).toBe('/');
    });

    it('redirects to / when the state cannot be loaded', async () => {
      load = () => throwError(() => new Error('offline'));
      expect(url(await run(setupOnlyGuard))).toBe('/');
    });
  });
});
