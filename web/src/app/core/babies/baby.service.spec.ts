import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { BabiesResult, Baby, BabyFields, BabyResult } from './baby.models';
import { BabyService } from './baby.service';

describe('BabyService', () => {
  let service: BabyService;
  let http: HttpTestingController;

  const fields: BabyFields = {
    name: 'Lea',
    birthDate: '2026-09-01',
    sex: 'girl',
    birthWeightG: 3400,
    birthLengthCm: 50.5,
    birthHeadCircumferenceCm: null,
  };
  const lea: Baby = { id: 'b1', ...fields };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BabyService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('list()', () => {
    it('gets /api/babies', async () => {
      const result = firstValueFrom(service.list());
      const req = http.expectOne('/api/babies');
      expect(req.request.method).toBe('GET');
      req.flush([lea]);

      expect(await result).toEqual<BabiesResult>({ ok: true, babies: [lea] });
    });

    it('maps a failure to a form error', async () => {
      const result = firstValueFrom(service.list());
      http.expectOne('/api/babies').flush(null, { status: 503, statusText: 'Unavailable' });

      expect(await result).toEqual<BabiesResult>({ ok: false, errors: { form: 'unknown' } });
    });
  });

  describe('create()', () => {
    it('posts the fields and returns the created baby', async () => {
      const result = firstValueFrom(service.create(fields));
      const req = http.expectOne('/api/babies');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(fields);
      req.flush(lea, { status: 201, statusText: 'Created' });

      expect(await result).toEqual<BabyResult>({ ok: true, baby: lea });
    });

    it('maps a validation problem to field errors', async () => {
      const result = firstValueFrom(service.create(fields));
      http
        .expectOne('/api/babies')
        .flush(
          { errors: { name: ['tooLong'], birthDate: ['inFuture'] } },
          { status: 400, statusText: 'Bad Request' },
        );

      expect(await result).toEqual<BabyResult>({
        ok: false,
        errors: { name: 'tooLong', birthDate: 'inFuture' },
      });
    });
  });
});
