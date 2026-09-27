import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { authGuard, loginOnlyGuard, setupOnlyGuard } from './auth.guards';
import { AuthState } from './auth.models';
import { AuthService } from './auth.service';

describe('auth guards', () => {
  let load: () => Observable<AuthState>;

  const setupRequired: AuthState = { setupRequired: true, user: null };
  const signedOut: AuthState = { setupRequired: false, user: null };
  const signedIn: AuthState = {
    setupRequired: false,
    user: { id: 'u1', email: 'anna@mail.com', displayName: 'Anna', language: 'en', isAdmin: true },
  };

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

  describe('authGuard', () => {
    it('redirects to /setup while the instance has no user', async () => {
      load = () => of(setupRequired);
      expect(url(await run(authGuard))).toBe('/setup');
    });

    it('redirects to /login when signed out', async () => {
      load = () => of(signedOut);
      expect(url(await run(authGuard))).toBe('/login');
    });

    it('lets a signed-in user through', async () => {
      load = () => of(signedIn);
      expect(await run(authGuard)).toBe(true);
    });

    it('lets the route through when the state cannot be loaded (offline)', async () => {
      load = () => throwError(() => new Error('offline'));
      expect(await run(authGuard)).toBe(true);
    });
  });

  describe('loginOnlyGuard', () => {
    it('redirects to /setup while the instance has no user', async () => {
      load = () => of(setupRequired);
      expect(url(await run(loginOnlyGuard))).toBe('/setup');
    });

    it('shows the login screen when signed out', async () => {
      load = () => of(signedOut);
      expect(await run(loginOnlyGuard)).toBe(true);
    });

    it('redirects a signed-in user to /', async () => {
      load = () => of(signedIn);
      expect(url(await run(loginOnlyGuard))).toBe('/');
    });

    it('shows the login screen when the state cannot be loaded', async () => {
      load = () => throwError(() => new Error('offline'));
      expect(await run(loginOnlyGuard)).toBe(true);
    });
  });

  describe('setupOnlyGuard', () => {
    it('allows /setup while the instance has no user', async () => {
      load = () => of(setupRequired);
      expect(await run(setupOnlyGuard)).toBe(true);
    });

    it('redirects to / once setup is done', async () => {
      load = () => of(signedOut);
      expect(url(await run(setupOnlyGuard))).toBe('/');
    });

    it('redirects to / when the state cannot be loaded', async () => {
      load = () => throwError(() => new Error('offline'));
      expect(url(await run(setupOnlyGuard))).toBe('/');
    });
  });
});
