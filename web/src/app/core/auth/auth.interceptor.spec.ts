import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: { signedOut: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  const failWith = async (url: string, status: number) => {
    const result = firstValueFrom(http.get(url)).catch((error: unknown) => error);
    backend.expectOne(url).flush(null, { status, statusText: 'Error' });
    return result;
  };

  beforeEach(() => {
    auth = { signedOut: vi.fn() };
    router = { navigateByUrl: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('on a 401 from the API, signs out, goes to /login and still reports the error', async () => {
    const error = await failWith('/api/feeds', 401);

    expect(auth.signedOut).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(error).toMatchObject({ status: 401 });
  });

  it('leaves a failed login to the login screen', async () => {
    const result = firstValueFrom(http.post('/api/auth/login', {})).catch((e: unknown) => e);
    backend.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    await result;

    expect(auth.signedOut).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('ignores other errors', async () => {
    const error = await failWith('/api/feeds', 500);

    expect(auth.signedOut).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(error).toMatchObject({ status: 500 });
  });

  it('ignores 401s from outside the API', async () => {
    await failWith('/assets/x.json', 401);

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
