import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { BabiesResult, Baby, BabyDeleteResult, BabyFields, BabyResult } from './baby.models';
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

  describe('update()', () => {
    it('puts every field and returns the updated baby', async () => {
      const result = firstValueFrom(service.update('b1', fields));
      const req = http.expectOne('/api/babies/b1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(fields);
      req.flush(lea);

      expect(await result).toEqual<BabyResult>({ ok: true, baby: lea });
    });

    it('maps a validation problem to field errors', async () => {
      const result = firstValueFrom(service.update('b1', fields));
      http
        .expectOne('/api/babies/b1')
        .flush({ errors: { name: ['required'] } }, { status: 400, statusText: 'Bad Request' });

      expect(await result).toEqual<BabyResult>({ ok: false, errors: { name: 'required' } });
    });

    it('maps an unknown baby to a form error', async () => {
      const result = firstValueFrom(service.update('b1', fields));
      http
        .expectOne('/api/babies/b1')
        .flush({ code: 'babyNotFound' }, { status: 404, statusText: 'Not Found' });

      expect(await result).toEqual<BabyResult>({ ok: false, errors: { form: 'babyNotFound' } });
    });
  });

  describe('delete()', () => {
    it('deletes /api/babies/{id}', async () => {
      const result = firstValueFrom(service.delete('b1'));
      const req = http.expectOne('/api/babies/b1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(await result).toEqual<BabyDeleteResult>({ ok: true });
    });

    it('maps a refusal to a form error', async () => {
      const result = firstValueFrom(service.delete('b1'));
      http
        .expectOne('/api/babies/b1')
        .flush({ code: 'adminOnly' }, { status: 403, statusText: 'Forbidden' });

      expect(await result).toEqual<BabyDeleteResult>({ ok: false, errors: { form: 'adminOnly' } });
    });
  });
});
