import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthState, SetupRequest, SetupResult } from './auth.models';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const admin: AuthState = {
    setupRequired: false,
    user: { id: 'u1', email: 'anna@mail.com', displayName: 'Anna', language: 'fr', isAdmin: true },
  };
  const request: SetupRequest = {
    email: 'anna@mail.com',
    displayName: 'Anna',
    password: 'correct horse',
    language: 'fr',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('load() requests GET /api/auth/state and exposes it', async () => {
    const result = firstValueFrom(service.load());
    const req = http.expectOne('/api/auth/state');
    expect(req.request.method).toBe('GET');
    req.flush({ setupRequired: true, user: null });

    expect(await result).toEqual({ setupRequired: true, user: null });
    expect(service.state()).toEqual({ setupRequired: true, user: null });
  });

  it('load() is cached once the state is known', async () => {
    const first = firstValueFrom(service.load());
    http.expectOne('/api/auth/state').flush(admin);
    await first;

    expect(await firstValueFrom(service.load())).toEqual(admin);
    http.expectNone('/api/auth/state');
  });

  it('setup() posts the request and stores the returned state', async () => {
    const result = firstValueFrom(service.setup(request));
    const req = http.expectOne('/api/auth/setup');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(admin);

    expect(await result).toEqual<SetupResult>({ ok: true });
    expect(service.state()).toEqual(admin);
  });

  it('setup() maps a 400 validation problem to field error codes', async () => {
    const result = firstValueFrom(service.setup(request));
    http
      .expectOne('/api/auth/setup')
      .flush(
        { errors: { email: ['invalid'], password: ['tooShort'] } },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(await result).toEqual<SetupResult>({
      ok: false,
      errors: { email: 'invalid', password: 'tooShort' },
    });
  });

  it('setup() refused with 403 reports alreadySetUp and marks setup as done', async () => {
    const result = firstValueFrom(service.setup(request));
    http.expectOne('/api/auth/setup').flush(null, { status: 403, statusText: 'Forbidden' });

    expect(await result).toEqual<SetupResult>({ ok: false, errors: { form: 'alreadySetUp' } });
    expect(service.state()).toEqual({ setupRequired: false, user: null });
  });

  it('setup() reports other failures as unknown', async () => {
    const result = firstValueFrom(service.setup(request));
    http.expectOne('/api/auth/setup').error(new ProgressEvent('error'));

    expect(await result).toEqual<SetupResult>({ ok: false, errors: { form: 'unknown' } });
  });
});
