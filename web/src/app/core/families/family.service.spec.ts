import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FamiliesResult, Family } from './family.models';
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
});
