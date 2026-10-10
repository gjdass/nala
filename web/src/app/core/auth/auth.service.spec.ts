import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  AuthState,
  ForgotPasswordResult,
  InvitationLookup,
  LoginResult,
  RegisterResult,
  ResetLinkLookup,
  ResetPasswordResult,
  SetupRequest,
  SetupResult,
} from './auth.models';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const admin: AuthState = {
    setupRequired: false,
    smtpEnabled: false,
    user: { id: 'u1', email: 'anna@mail.com', displayName: 'Anna', language: 'fr', isAdmin: true },
  };
  const request: SetupRequest = {
    email: 'anna@mail.com',
    displayName: 'Anna',
    password: 'correct horse',
    language: 'fr',
    familyName: 'Martins',
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
    req.flush({ setupRequired: true, user: null, smtpEnabled: false });

    expect(await result).toEqual({ setupRequired: true, user: null, smtpEnabled: false });
    expect(service.state()).toEqual({ setupRequired: true, user: null, smtpEnabled: false });
  });

  it('load() is cached once the state is known', async () => {
    const first = firstValueFrom(service.load());
    http.expectOne('/api/auth/state').flush(admin);
    await first;

    expect(await firstValueFrom(service.load())).toEqual(admin);
    http.expectNone('/api/auth/state');
  });

  it('load() shares one request between concurrent callers', async () => {
    const first = firstValueFrom(service.load());
    const second = firstValueFrom(service.load());
    http.expectOne('/api/auth/state').flush(admin);

    expect(await first).toEqual(admin);
    expect(await second).toEqual(admin);
  });

  it('load() asks again after a failed request', async () => {
    const failed = firstValueFrom(service.load());
    http.expectOne('/api/auth/state').error(new ProgressEvent('error'));
    await expect(failed).rejects.toBeDefined();

    const retried = firstValueFrom(service.load());
    http.expectOne('/api/auth/state').flush(admin);
    expect(await retried).toEqual(admin);
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
    expect(service.state()).toEqual({ setupRequired: false, user: null, smtpEnabled: false });
  });

  it('setup() reports other failures as unknown', async () => {
    const result = firstValueFrom(service.setup(request));
    http.expectOne('/api/auth/setup').error(new ProgressEvent('error'));

    expect(await result).toEqual<SetupResult>({ ok: false, errors: { form: 'unknown' } });
  });

  describe('login()', () => {
    const credentials = { email: 'anna@mail.com', password: 'correct horse' };

    it('posts the credentials and stores the returned state', async () => {
      const result = firstValueFrom(service.login(credentials));
      const req = http.expectOne('/api/auth/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);
      req.flush(admin);

      expect(await result).toEqual<LoginResult>({ ok: true });
      expect(service.state()).toEqual(admin);
    });

    it.each([
      [401, 'invalidCredentials'],
      [429, 'tooManyAttempts'],
      [403, 'accountDisabled'],
      [500, 'unknown'],
    ])('maps a %i to the %s form error', async (status, code) => {
      const result = firstValueFrom(service.login(credentials));
      http.expectOne('/api/auth/login').flush({ code }, { status, statusText: 'Error' });

      expect(await result).toEqual<LoginResult>({ ok: false, errors: { form: code } });
      expect(service.state()).toBeNull();
    });

    it('maps a 400 validation problem to field error codes', async () => {
      const result = firstValueFrom(service.login(credentials));
      http
        .expectOne('/api/auth/login')
        .flush({ errors: { password: ['required'] } }, { status: 400, statusText: 'Bad Request' });

      expect(await result).toEqual<LoginResult>({ ok: false, errors: { password: 'required' } });
    });

    it('reports a network failure as unknown', async () => {
      const result = firstValueFrom(service.login(credentials));
      http.expectOne('/api/auth/login').error(new ProgressEvent('error'));

      expect(await result).toEqual<LoginResult>({ ok: false, errors: { form: 'unknown' } });
    });
  });

  describe('lookupInvitation()', () => {
    it('gets the invitation by its token', async () => {
      const result = firstValueFrom(service.lookupInvitation('a-b_c'));
      const req = http.expectOne('/api/auth/invitations/a-b_c');
      expect(req.request.method).toBe('GET');
      req.flush({ invitedBy: 'Anna', expiresAt: '2026-10-04T20:00:00Z' });

      expect(await result).toEqual<InvitationLookup>({
        ok: true,
        invitation: { invitedBy: 'Anna', expiresAt: '2026-10-04T20:00:00Z' },
      });
    });

    it.each([
      [404, 'invitationUnknown'],
      [410, 'invitationExpired'],
      [410, 'invitationUsed'],
      [410, 'invitationRevoked'],
    ])('maps a %i to its %s code', async (status, code) => {
      const result = firstValueFrom(service.lookupInvitation('t'));
      http.expectOne('/api/auth/invitations/t').flush({ code }, { status, statusText: 'Error' });

      expect(await result).toEqual<InvitationLookup>({ ok: false, code });
    });

    it('reports a network failure as unknown', async () => {
      const result = firstValueFrom(service.lookupInvitation('t'));
      http.expectOne('/api/auth/invitations/t').error(new ProgressEvent('error'));

      expect(await result).toEqual<InvitationLookup>({ ok: false, code: 'unknown' });
    });
  });

  describe('register()', () => {
    const member: AuthState = {
      setupRequired: false,
      smtpEnabled: false,
      user: { id: 'u2', email: 'ben@mail.com', displayName: 'Ben', language: 'fr', isAdmin: false },
    };
    const registration = { email: 'ben@mail.com', displayName: 'Ben', password: 'correct horse', language: 'fr' as const };

    it('posts the account to the invitation and stores the returned state', async () => {
      const result = firstValueFrom(service.register('tok', registration));
      const req = http.expectOne('/api/auth/invitations/tok/register');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(registration);
      req.flush(member);

      expect(await result).toEqual<RegisterResult>({ ok: true });
      expect(service.state()).toEqual(member);
    });

    it('maps a 400 validation problem to field error codes', async () => {
      const result = firstValueFrom(service.register('tok', registration));
      http
        .expectOne('/api/auth/invitations/tok/register')
        .flush({ errors: { email: ['taken'] } }, { status: 400, statusText: 'Bad Request' });

      expect(await result).toEqual<RegisterResult>({ ok: false, errors: { email: 'taken' } });
      expect(service.state()).toBeNull();
    });

    it.each([
      [404, 'invitationUnknown'],
      [410, 'invitationUsed'],
    ])('maps a %i to the %s form error', async (status, code) => {
      const result = firstValueFrom(service.register('tok', registration));
      http
        .expectOne('/api/auth/invitations/tok/register')
        .flush({ code }, { status, statusText: 'Error' });

      expect(await result).toEqual<RegisterResult>({ ok: false, errors: { form: code } });
    });
  });

  describe('lookupResetLink()', () => {
    it('gets the reset link by its token', async () => {
      const result = firstValueFrom(service.lookupResetLink('a-b_c'));
      const req = http.expectOne('/api/auth/password-resets/a-b_c');
      expect(req.request.method).toBe('GET');
      req.flush({ email: 'ben@mail.com', expiresAt: '2026-09-28T20:00:00Z' });

      expect(await result).toEqual<ResetLinkLookup>({
        ok: true,
        link: { email: 'ben@mail.com', expiresAt: '2026-09-28T20:00:00Z' },
      });
    });

    it.each([
      [404, 'resetLinkUnknown'],
      [410, 'resetLinkExpired'],
      [410, 'resetLinkUsed'],
      [403, 'accountDisabled'],
    ])('maps a %i to its %s code', async (status, code) => {
      const result = firstValueFrom(service.lookupResetLink('t'));
      http.expectOne('/api/auth/password-resets/t').flush({ code }, { status, statusText: 'Error' });

      expect(await result).toEqual<ResetLinkLookup>({ ok: false, code });
    });

    it('reports a network failure as unknown', async () => {
      const result = firstValueFrom(service.lookupResetLink('t'));
      http.expectOne('/api/auth/password-resets/t').error(new ProgressEvent('error'));

      expect(await result).toEqual<ResetLinkLookup>({ ok: false, code: 'unknown' });
    });
  });

  describe('resetPassword()', () => {
    const ben: AuthState = {
      setupRequired: false,
      smtpEnabled: false,
      user: { id: 'u2', email: 'ben@mail.com', displayName: 'Ben', language: 'en', isAdmin: false },
    };

    it('posts the new password to the link and stores the returned state', async () => {
      const result = firstValueFrom(service.resetPassword('tok', { password: 'battery staple' }));
      const req = http.expectOne('/api/auth/password-resets/tok');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ password: 'battery staple' });
      req.flush(ben);

      expect(await result).toEqual<ResetPasswordResult>({ ok: true });
      expect(service.state()).toEqual(ben);
    });

    it('maps a 400 validation problem to field error codes', async () => {
      const result = firstValueFrom(service.resetPassword('tok', { password: 'short' }));
      http
        .expectOne('/api/auth/password-resets/tok')
        .flush({ errors: { password: ['tooShort'] } }, { status: 400, statusText: 'Bad Request' });

      expect(await result).toEqual<ResetPasswordResult>({
        ok: false,
        errors: { password: 'tooShort' },
      });
      expect(service.state()).toBeNull();
    });

    it('maps a 410 to its form code', async () => {
      const result = firstValueFrom(service.resetPassword('tok', { password: 'battery staple' }));
      http
        .expectOne('/api/auth/password-resets/tok')
        .flush({ code: 'resetLinkUsed' }, { status: 410, statusText: 'Gone' });

      expect(await result).toEqual<ResetPasswordResult>({
        ok: false,
        errors: { form: 'resetLinkUsed' },
      });
    });
  });

  describe('requestPasswordReset()', () => {
    it('posts the email and reports ok on 202', async () => {
      const result = firstValueFrom(service.requestPasswordReset({ email: 'anna@mail.com' }));
      const req = http.expectOne('/api/auth/password-resets');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'anna@mail.com' });
      req.flush(null, { status: 202, statusText: 'Accepted' });

      expect(await result).toEqual<ForgotPasswordResult>({ ok: true });
    });

    it('maps a 400 validation problem to field error codes', async () => {
      const result = firstValueFrom(service.requestPasswordReset({ email: 'anna' }));
      http
        .expectOne('/api/auth/password-resets')
        .flush({ errors: { email: ['invalid'] } }, { status: 400, statusText: 'Bad Request' });

      expect(await result).toEqual<ForgotPasswordResult>({ ok: false, errors: { email: 'invalid' } });
    });

    it('maps a 404 to emailResetDisabled', async () => {
      const result = firstValueFrom(service.requestPasswordReset({ email: 'anna@mail.com' }));
      http
        .expectOne('/api/auth/password-resets')
        .flush({ code: 'emailResetDisabled' }, { status: 404, statusText: 'Not Found' });

      expect(await result).toEqual<ForgotPasswordResult>({
        ok: false,
        errors: { form: 'emailResetDisabled' },
      });
    });
  });

  it('signedOut() keeps whether the instance can email reset links', () => {
    service.state.set({ ...admin, smtpEnabled: true });

    service.signedOut();

    expect(service.state()).toEqual({ setupRequired: false, user: null, smtpEnabled: true });
  });

  it('logout() posts to /api/auth/logout and forgets the user', async () => {
    service.state.set(admin);

    const result = firstValueFrom(service.logout());
    const req = http.expectOne('/api/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await result;

    expect(service.state()).toEqual({ setupRequired: false, user: null, smtpEnabled: false });
  });

  it('signedOut() forgets the user, the instance stays set up', () => {
    service.state.set(admin);

    service.signedOut();

    expect(service.state()).toEqual({ setupRequired: false, user: null, smtpEnabled: false });
  });
});
