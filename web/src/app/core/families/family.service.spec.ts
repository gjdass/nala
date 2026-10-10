import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FamiliesResult, Family, FamilyResult } from './family.models';
import { FamilyService } from './family.service';

describe('FamilyService', () => {
  let service: FamilyService;
  let http: HttpTestingController;

  const martins: Family = { id: 'f1', name: 'Martins', isAdmin: true };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FamilyService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the families from /api/families', async () => {
    const result = firstValueFrom(service.list());
    const req = http.expectOne('/api/families');
    expect(req.request.method).toBe('GET');
    req.flush([martins]);

    expect(await result).toEqual<FamiliesResult>({ ok: true, families: [martins] });
  });

  it('maps a failure to a form error', async () => {
    const result = firstValueFrom(service.list());
    http.expectOne('/api/families').flush(null, { status: 503, statusText: 'Unavailable' });

    expect(await result).toEqual<FamiliesResult>({ ok: false, errors: { form: 'unknown' } });
  });

  it('renames a family with PATCH /api/families/{id}', async () => {
    const result = firstValueFrom(service.rename('f1', 'The Martins'));
    const req = http.expectOne('/api/families/f1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'The Martins' });
    req.flush({ ...martins, name: 'The Martins' });

    expect(await result).toEqual<FamilyResult>({
      ok: true,
      family: { ...martins, name: 'The Martins' },
    });
  });

  it('maps a refused name to its field code', async () => {
    const result = firstValueFrom(service.rename('f1', 'x'));
    http
      .expectOne('/api/families/f1')
      .flush({ errors: { name: ['tooLong'] } }, { status: 400, statusText: 'Bad Request' });

    expect(await result).toEqual<FamilyResult>({ ok: false, errors: { name: 'tooLong' } });
  });

  it('maps a member refused as not the family admin to its code', async () => {
    const result = firstValueFrom(service.rename('f1', 'x'));
    http
      .expectOne('/api/families/f1')
      .flush({ code: 'familyAdminOnly' }, { status: 403, statusText: 'Forbidden' });

    expect(await result).toEqual<FamilyResult>({ ok: false, errors: { form: 'familyAdminOnly' } });
  });
});
