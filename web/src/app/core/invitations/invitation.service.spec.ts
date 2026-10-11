import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  CreateInvitationResult,
  PendingInvitation,
  PendingInvitationsResult,
  RevokeInvitationResult,
  SendInvitationResult,
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
    it("posts to the family's invitations and returns the token and expiry", async () => {
      const result = firstValueFrom(service.create('f1'));
      const req = http.expectOne('/api/families/f1/invitations');
      expect(req.request.method).toBe('POST');
      req.flush({ token: 'tok', expiresAt: '2026-10-04T20:00:00Z' });

      expect(await result).toEqual<CreateInvitationResult>({
        ok: true,
        invitation: { token: 'tok', expiresAt: '2026-10-04T20:00:00Z' },
      });
    });

    it('maps a failure to a form error', async () => {
      const result = firstValueFrom(service.create('f1'));
      http.expectOne('/api/families/f1/invitations').flush(null, { status: 500, statusText: 'Server Error' });

      expect(await result).toEqual<CreateInvitationResult>({
        ok: false,
        errors: { form: 'unknown' },
      });
    });
  });

  describe('pending()', () => {
    it("gets the family's invitations", async () => {
      const result = firstValueFrom(service.pending('f1'));
      const req = http.expectOne('/api/families/f1/invitations');
      expect(req.request.method).toBe('GET');
      req.flush([pending]);

      expect(await result).toEqual<PendingInvitationsResult>({ ok: true, invitations: [pending] });
    });

    it('maps a failure to a form error', async () => {
      const result = firstValueFrom(service.pending('f1'));
      http.expectOne('/api/families/f1/invitations').error(new ProgressEvent('error'));

      expect(await result).toEqual<PendingInvitationsResult>({
        ok: false,
        errors: { form: 'unknown' },
      });
    });
  });

  describe('revoke()', () => {
    it("posts to the family's invitations/{id}/revoke", async () => {
      const result = firstValueFrom(service.revoke('f1', 'i1'));
      const req = http.expectOne('/api/families/f1/invitations/i1/revoke');
      expect(req.request.method).toBe('POST');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(await result).toEqual<RevokeInvitationResult>({ ok: true });
    });

    it.each([
      [410, 'invitationUsed'],
      [410, 'invitationExpired'],
      [404, 'invitationUnknown'],
    ])('maps a %s to its code %s', async (status, code) => {
      const result = firstValueFrom(service.revoke('f1', 'i1'));
      http.expectOne('/api/families/f1/invitations/i1/revoke').flush({ code }, { status, statusText: 'Error' });

      expect(await result).toEqual<RevokeInvitationResult>({ ok: false, errors: { form: code } });
    });
  });

  describe('sendByEmail()', () => {
    it("posts the email to the family's invitations/email", async () => {
      const result = firstValueFrom(service.sendByEmail('f1', 'ben@mail.com'));
      const req = http.expectOne('/api/families/f1/invitations/email');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'ben@mail.com' });
      req.flush({ expiresAt: '2026-10-04T20:00:00Z' }, { status: 202, statusText: 'Accepted' });

      expect(await result).toEqual<SendInvitationResult>({
        ok: true,
        expiresAt: '2026-10-04T20:00:00Z',
      });
    });

    it('maps a validation problem to field errors', async () => {
      const result = firstValueFrom(service.sendByEmail('f1', 'anna@mail.com'));
      http
        .expectOne('/api/families/f1/invitations/email')
        .flush({ errors: { email: ['alreadyMember'] } }, { status: 400, statusText: 'Bad Request' });

      expect(await result).toEqual<SendInvitationResult>({
        ok: false,
        errors: { email: 'alreadyMember' },
      });
    });

    it.each(['emailInviteDisabled', 'familyNotFound'])('maps a 404 %s to its code', async (code) => {
      const result = firstValueFrom(service.sendByEmail('f1', 'ben@mail.com'));
      http
        .expectOne('/api/families/f1/invitations/email')
        .flush({ code }, { status: 404, statusText: 'Not Found' });

      expect(await result).toEqual<SendInvitationResult>({ ok: false, errors: { form: code } });
    });
  });

  describe('new-family invitations (no family)', () => {
    it('creates, lists, revokes and emails through the admin endpoints', async () => {
      const created = firstValueFrom(service.create(null));
      const create = http.expectOne('/api/admin/invitations');
      expect(create.request.method).toBe('POST');
      create.flush({ token: 'tok', expiresAt: '2026-10-04T20:00:00Z' });
      expect(await created).toEqual<CreateInvitationResult>({
        ok: true,
        invitation: { token: 'tok', expiresAt: '2026-10-04T20:00:00Z' },
      });

      const listed = firstValueFrom(service.pending(null));
      const list = http.expectOne('/api/admin/invitations');
      expect(list.request.method).toBe('GET');
      list.flush([pending]);
      expect(await listed).toEqual<PendingInvitationsResult>({ ok: true, invitations: [pending] });

      const revoked = firstValueFrom(service.revoke(null, 'i1'));
      http.expectOne('/api/admin/invitations/i1/revoke').flush(null, { status: 204, statusText: 'No Content' });
      expect(await revoked).toEqual<RevokeInvitationResult>({ ok: true });

      const sent = firstValueFrom(service.sendByEmail(null, 'carl@mail.com'));
      const email = http.expectOne('/api/admin/invitations/email');
      expect(email.request.body).toEqual({ email: 'carl@mail.com' });
      email.flush({ expiresAt: '2026-10-04T20:00:00Z' }, { status: 202, statusText: 'Accepted' });
      expect(await sent).toEqual<SendInvitationResult>({ ok: true, expiresAt: '2026-10-04T20:00:00Z' });
    });

    it('maps a 403 to the adminOnly form error', async () => {
      const result = firstValueFrom(service.create(null));
      http
        .expectOne('/api/admin/invitations')
        .flush({ code: 'adminOnly' }, { status: 403, statusText: 'Forbidden' });

      expect(await result).toEqual<CreateInvitationResult>({ ok: false, errors: { form: 'adminOnly' } });
    });
  });
});
