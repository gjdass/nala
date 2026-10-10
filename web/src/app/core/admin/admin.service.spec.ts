import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AdminUser, AdminUsersResult, ResetLinkResult } from './admin.models';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let http: HttpTestingController;

  const ben: AdminUser = {
    id: 'u2',
    email: 'ben@mail.com',
    displayName: 'Ben',
    isAdmin: false,
    lastActivityAt: '2026-09-27T20:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('users()', () => {
    it('gets /api/admin/users', async () => {
      const result = firstValueFrom(service.users());
      const req = http.expectOne('/api/admin/users');
      expect(req.request.method).toBe('GET');
      req.flush([ben]);

      expect(await result).toEqual<AdminUsersResult>({ ok: true, users: [ben] });
    });

    it('maps a refusal to its code', async () => {
      const result = firstValueFrom(service.users());
      http
        .expectOne('/api/admin/users')
        .flush({ code: 'adminOnly' }, { status: 403, statusText: 'Forbidden' });

      expect(await result).toEqual<AdminUsersResult>({ ok: false, errors: { form: 'adminOnly' } });
    });
  });

  describe('createResetLink()', () => {
    it('posts to /reset-link and returns the token and expiry', async () => {
      const result = firstValueFrom(service.createResetLink('u2'));
      const req = http.expectOne('/api/admin/users/u2/reset-link');
      expect(req.request.method).toBe('POST');
      req.flush({ token: 'a-b_c', expiresAt: '2026-09-28T20:00:00Z' });

      expect(await result).toEqual<ResetLinkResult>({
        ok: true,
        link: { token: 'a-b_c', expiresAt: '2026-09-28T20:00:00Z' },
      });
    });

    it.each([
      [403, 'adminOnly'],
      [403, 'accountDisabled'],
      [404, 'userNotFound'],
    ])('maps a %s to its %s code', async (status, code) => {
      const result = firstValueFrom(service.createResetLink('u2'));
      http
        .expectOne('/api/admin/users/u2/reset-link')
        .flush({ code }, { status, statusText: 'Error' });

      expect(await result).toEqual<ResetLinkResult>({ ok: false, errors: { form: code } });
    });
  });
});
