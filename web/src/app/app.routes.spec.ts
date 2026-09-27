import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';

describe('app routes', () => {
  let router: Router;
  let http: HttpTestingController;

  const navigate = async (url: string, state: object) => {
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
    expect(await navigate('/setup', { setupRequired: false, user: null })).toBe('/');
  });
});
