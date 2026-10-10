import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AuthState } from './core/auth/auth.models';
import { SECTIONS } from './core/sections/section.models';
import { fakeSection } from './testing/fake-section';
import { ComingSoonPage } from './features/coming-soon/coming-soon.page';
import { HistoryPage } from './features/history/history.page';

describe('app routes', () => {
  let router: Router;
  let http: HttpTestingController;

  const signedOut: AuthState = { setupRequired: false, user: null, smtpEnabled: false };
  const signedIn: AuthState = {
    setupRequired: false,
    smtpEnabled: false,
    user: { id: 'u1', email: 'anna@mail.com', displayName: 'Anna', language: 'en', isAdmin: true },
  };

  const navigate = async (url: string, state: AuthState) => {
    const done = router.navigateByUrl(url);
    (await vi.waitFor(() => http.expectOne('/api/auth/state'))).flush(state);
    await done;
    return router.url;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SECTIONS, useValue: [fakeSection('feed')] },
      ],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
  });

  it('an empty instance opens the setup screen instead of the app', async () => {
    expect(await navigate('/', { setupRequired: true, user: null, smtpEnabled: false })).toBe(
      '/setup',
    );
  });

  it('the setup screen is no longer reachable once a user exists', async () => {
    expect(await navigate('/setup', signedIn)).toBe('/');
  });

  it('a signed-out visitor opening the app lands on the login screen', async () => {
    expect(await navigate('/', signedOut)).toBe('/login');
  });

  it('a signed-in user opening the login screen lands on the app', async () => {
    expect(await navigate('/login', signedIn)).toBe('/');
  });

  it('a signed-out visitor can open an invitation link', async () => {
    expect(await navigate('/invite/a-b_c', signedOut)).toBe('/invite/a-b_c');
  });

  it('a signed-in user opening an invitation link lands on the app', async () => {
    expect(await navigate('/invite/a-b_c', signedIn)).toBe('/');
  });

  it('an invitation link on an empty instance opens the setup screen', async () => {
    expect(
      await navigate('/invite/a-b_c', { setupRequired: true, user: null, smtpEnabled: false }),
    ).toBe('/setup');
  });

  it('a signed-out visitor can open a password reset link', async () => {
    expect(await navigate('/reset/a-b_c', signedOut)).toBe('/reset/a-b_c');
  });

  it('a signed-in user opening a password reset link lands on the app', async () => {
    expect(await navigate('/reset/a-b_c', signedIn)).toBe('/');
  });

  it('a signed-out visitor can open "Forgot password" when the instance can email', async () => {
    expect(await navigate('/forgot', { ...signedOut, smtpEnabled: true })).toBe('/forgot');
  });

  it('"Forgot password" leads to the login screen when the instance cannot email', async () => {
    expect(await navigate('/forgot', signedOut)).toBe('/login');
  });

  it('a signed-in user opening "Forgot password" lands on the app', async () => {
    expect(await navigate('/forgot', { ...signedIn, smtpEnabled: true })).toBe('/');
  });

  it('a signed-in user can open the settings', async () => {
    expect(await navigate('/settings', signedIn)).toBe('/settings');
  });

  it('a signed-out visitor opening the settings lands on the login screen', async () => {
    expect(await navigate('/settings', signedOut)).toBe('/login');
  });

  it('an old section history link opens History for that section', async () => {
    expect(await navigate('/history/feed', signedIn)).toBe('/history?section=feed');
  });

  it('an old history link of an unknown section leads to the app', async () => {
    expect(await navigate('/history/nope', signedIn)).toBe('/');
  });

  it('an old history link of a section not built yet leads to the app', async () => {
    expect(await navigate('/history/pump', signedIn)).toBe('/');
  });

  it('a signed-out visitor opening a history lands on the login screen', async () => {
    expect(await navigate('/history/feed', signedOut)).toBe('/login');
  });

  it.each(['/history', '/trends'])('a signed-in user can open %s', async (url) => {
    expect(await navigate(url, signedIn)).toBe(url);
  });

  it.each(['/history', '/trends'])(
    'a signed-out visitor opening %s lands on the login screen',
    async (url) => {
      expect(await navigate(url, signedOut)).toBe('/login');
    },
  );

  it.each([
    ['history', HistoryPage],
    ['trends', ComingSoonPage],
  ])('/%s shows its page', async (path, page) => {
    const route = routes.find((r) => r.path === path)!;

    expect(await route.loadComponent!()).toBe(page);
  });
});
