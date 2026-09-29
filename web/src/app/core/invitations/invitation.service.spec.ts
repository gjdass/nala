import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  CreateInvitationResult,
  PendingInvitation,
  PendingInvitationsResult,
  RevokeInvitationResult,
} from './invitation.models';
import { InvitationService } from './invitation.service';

describe('InvitationService', () => {
  let service: InvitationService;
  let http: HttpTestingController;

  const pending: PendingInvitation = {
    id: 'i1',
    createdBy: 'Anna',
    createdAt: '2026-09-27T20:00:00Z',
    expiresAt: '2026-10-04T20:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InvitationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('create()', () => {
    it('posts to /api/invitations and returns the token and expiry', async () => {
      const result = firstValueFrom(service.create());
      const req = http.expectOne('/api/invitations');
      expect(req.request.method).toBe('POST');
      req.flush({ token: 'tok', expiresAt: '2026-10-04T20:00:00Z' });

      expect(await result).toEqual<CreateInvitationResult>({
        ok: true,
        invitation: { token: 'tok', expiresAt: '2026-10-04T20:00:00Z' },
      });
    });

    it('maps a failure to a form error', async () => {
      const result = firstValueFrom(service.create());
      http.expectOne('/api/invitations').flush(null, { status: 500, statusText: 'Server Error' });

      expect(await result).toEqual<CreateInvitationResult>({
        ok: false,
        errors: { form: 'unknown' },
      });
    });
  });

  describe('pending()', () => {
    it('gets /api/invitations', async () => {
      const result = firstValueFrom(service.pending());
      const req = http.expectOne('/api/invitations');
      expect(req.request.method).toBe('GET');
      req.flush([pending]);

      expect(await result).toEqual<PendingInvitationsResult>({ ok: true, invitations: [pending] });
    });

    it('maps a failure to a form error', async () => {
      const result = firstValueFrom(service.pending());
      http.expectOne('/api/invitations').error(new ProgressEvent('error'));

      expect(await result).toEqual<PendingInvitationsResult>({
        ok: false,
        errors: { form: 'unknown' },
      });
    });
  });

  describe('revoke()', () => {
    it('posts to /api/invitations/{id}/revoke', async () => {
      const result = firstValueFrom(service.revoke('i1'));
      const req = http.expectOne('/api/invitations/i1/revoke');
      expect(req.request.method).toBe('POST');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(await result).toEqual<RevokeInvitationResult>({ ok: true });
    });

    it.each([
      [410, 'invitationUsed'],
      [410, 'invitationExpired'],
      [404, 'invitationUnknown'],
    ])('maps a %s to its code %s', async (status, code) => {
      const result = firstValueFrom(service.revoke('i1'));
      http.expectOne('/api/invitations/i1/revoke').flush({ code }, { status, statusText: 'Error' });

      expect(await result).toEqual<RevokeInvitationResult>({ ok: false, errors: { form: code } });
    });
  });
});
