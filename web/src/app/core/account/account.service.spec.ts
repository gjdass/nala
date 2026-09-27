import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AccountResult, AuthState, CurrentUser } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;
  let auth: AuthService;
  let http: HttpTestingController;

  const anna: CurrentUser = {
    id: 'u1',
    email: 'anna@mail.com',
    displayName: 'Anna',
    language: 'en',
    isAdmin: true,
  };
  const signedIn: AuthState = { setupRequired: false, user: anna };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountService);
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    auth.state.set(signedIn);
  });

  afterEach(() => http.verify());

  describe('update()', () => {
    it('patches /api/account and stores the returned user', async () => {
      const result = firstValueFrom(service.update({ displayName: 'Anna B.', language: 'fr' }));
      const req = http.expectOne('/api/account');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ displayName: 'Anna B.', language: 'fr' });
      req.flush({ ...anna, displayName: 'Anna B.', language: 'fr' });

      expect(await result).toEqual<AccountResult>({ ok: true });
      expect(auth.state()).toEqual({
        setupRequired: false,
        user: { ...anna, displayName: 'Anna B.', language: 'fr' },
      });
    });

    it('maps a 400 validation problem to field error codes and keeps the user', async () => {
      const result = firstValueFrom(service.update({ displayName: '' }));
      http
        .expectOne('/api/account')
        .flush(
          { errors: { displayName: ['required'] } },
          { status: 400, statusText: 'Bad Request' },
        );

      expect(await result).toEqual<AccountResult>({
        ok: false,
        errors: { displayName: 'required' },
      });
      expect(auth.state()).toEqual(signedIn);
    });

    it('reports a network failure as unknown', async () => {
      const result = firstValueFrom(service.update({ language: 'fr' }));
      http.expectOne('/api/account').error(new ProgressEvent('error'));

      expect(await result).toEqual<AccountResult>({ ok: false, errors: { form: 'unknown' } });
    });
  });

  describe('changePassword()', () => {
    it('posts both passwords', async () => {
      const result = firstValueFrom(
        service.changePassword({ currentPassword: 'correct horse', newPassword: 'battery staple' }),
      );
      const req = http.expectOne('/api/account/password');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        currentPassword: 'correct horse',
        newPassword: 'battery staple',
      });
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(await result).toEqual<AccountResult>({ ok: true });
    });

    it('maps an incorrect current password to its field', async () => {
      const result = firstValueFrom(
        service.changePassword({ currentPassword: 'wrong', newPassword: 'battery staple' }),
      );
      http
        .expectOne('/api/account/password')
        .flush(
          { errors: { currentPassword: ['incorrect'] } },
          { status: 400, statusText: 'Bad Request' },
        );

      expect(await result).toEqual<AccountResult>({
        ok: false,
        errors: { currentPassword: 'incorrect' },
      });
    });
  });

  describe('deleteAccount()', () => {
    it('sends DELETE /api/account with the password and forgets the user', async () => {
      const result = firstValueFrom(service.deleteAccount({ password: 'correct horse' }));
      const req = http.expectOne('/api/account');
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual({ password: 'correct horse' });
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(await result).toEqual<AccountResult>({ ok: true });
      expect(auth.state()).toEqual({ setupRequired: false, user: null });
    });

    it('maps an incorrect password to its field and keeps the user', async () => {
      const result = firstValueFrom(service.deleteAccount({ password: 'wrong' }));
      http
        .expectOne('/api/account')
        .flush({ errors: { password: ['incorrect'] } }, { status: 400, statusText: 'Bad Request' });

      expect(await result).toEqual<AccountResult>({ ok: false, errors: { password: 'incorrect' } });
      expect(auth.state()).toEqual(signedIn);
    });

    it("maps the admin's refusal to its code", async () => {
      const result = firstValueFrom(service.deleteAccount({ password: 'correct horse' }));
      http
        .expectOne('/api/account')
        .flush({ code: 'adminCannotDelete' }, { status: 403, statusText: 'Forbidden' });

      expect(await result).toEqual<AccountResult>({
        ok: false,
        errors: { form: 'adminCannotDelete' },
      });
      expect(auth.state()).toEqual(signedIn);
    });
  });
});
