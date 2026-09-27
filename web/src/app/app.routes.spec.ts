import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AuthState } from './core/auth/auth.models';

describe('app routes', () => {
  let router: Router;
  let http: HttpTestingController;

  const signedOut: AuthState = { setupRequired: false, user: null };
  const signedIn: AuthState = {
    setupRequired: false,
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
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
  });

  it('an empty instance opens the setup screen instead of the app', async () => {
    expect(await navigate('/', { setupRequired: true, user: null })).toBe('/setup');
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
});
