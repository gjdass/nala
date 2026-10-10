import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Member, MembersResult, RemoveMemberResult } from './member.models';
import { MemberService } from './member.service';

describe('MemberService', () => {
  let service: MemberService;
  let http: HttpTestingController;
  let changes: number;

  const anna: Member = { id: 'u1', displayName: 'Anna', email: 'anna@mail.com', isAdmin: true };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MemberService);
    http = TestBed.inject(HttpTestingController);
    changes = 0;
    service.changed$.subscribe(() => changes++);
  });

  afterEach(() => http.verify());

  describe('list()', () => {
    it('gets the members of the family', async () => {
      const result = firstValueFrom(service.list('f1'));
      const req = http.expectOne('/api/families/f1/members');
      expect(req.request.method).toBe('GET');
      req.flush([anna]);

      expect(await result).toEqual<MembersResult>({ ok: true, members: [anna] });
    });

    it('reports a network failure as unknown', async () => {
      const result = firstValueFrom(service.list('f1'));
      http.expectOne('/api/families/f1/members').error(new ProgressEvent('error'));

      expect(await result).toEqual<MembersResult>({ ok: false, errors: { form: 'unknown' } });
    });
  });

  describe('remove()', () => {
    it('posts to the family member\'s /remove and announces the change', async () => {
      const result = firstValueFrom(service.remove('f1', 'u2'));
      const req = http.expectOne('/api/families/f1/members/u2/remove');
      expect(req.request.method).toBe('POST');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(await result).toEqual<RemoveMemberResult>({ ok: true });
      expect(changes).toBe(1);
    });

    it.each([
      [404, 'familyNotFound'],
      [403, 'familyAdminOnly'],
      [404, 'userNotFound'],
      [403, 'adminCannotRemove'],
    ])('maps a %s to its %s code, without announcing a change', async (status, code) => {
      const result = firstValueFrom(service.remove('f1', 'u2'));
      http.expectOne('/api/families/f1/members/u2/remove').flush({ code }, { status, statusText: 'Error' });

      expect(await result).toEqual<RemoveMemberResult>({ ok: false, errors: { form: code } });
      expect(changes).toBe(0);
    });

    it('reports a network failure as unknown', async () => {
      const result = firstValueFrom(service.remove('f1', 'u2'));
      http.expectOne('/api/families/f1/members/u2/remove').error(new ProgressEvent('error'));

      expect(await result).toEqual<RemoveMemberResult>({ ok: false, errors: { form: 'unknown' } });
    });
  });
});
