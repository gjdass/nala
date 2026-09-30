import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { aBottle, aSolids } from '../../testing/feeds';
import {
  BottleDefaults,
  BottleFields,
  FeedDeleteResult,
  FeedResult,
  SolidsFields,
} from './feed.models';
import { FeedService } from './feed.service';

describe('FeedService', () => {
  let service: FeedService;
  let http: HttpTestingController;

  const fields: BottleFields = {
    startTime: '2026-09-30T10:00:00.000Z',
    milkType: 'formula',
    amountMl: 120,
    notes: null,
  };
  const solids: SolidsFields = {
    startTime: '2026-09-30T12:00:00.000Z',
    mealType: 'lunch',
    food: 'Carrot purée',
    reaction: null,
    notes: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FeedService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('page()', () => {
    it('gets the first page of the baby', async () => {
      const page = firstValueFrom(service.page('b1', null));
      const req = http.expectOne((r) => r.url === '/api/babies/b1/feeds');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('cursor')).toBe(false);
      req.flush({ entries: [aBottle()], next: 'c2' });

      expect(await page).toEqual({ entries: [aBottle()], next: 'c2' });
    });

    it('passes the cursor and the page size', async () => {
      const page = firstValueFrom(service.page('b1', 'c2', 10));
      const req = http.expectOne((r) => r.url === '/api/babies/b1/feeds');
      expect(req.request.params.get('cursor')).toBe('c2');
      expect(req.request.params.get('limit')).toBe('10');
      req.flush({ entries: [], next: null });

      expect(await page).toEqual({ entries: [], next: null });
    });

    it('errors when the page fails, so the history offers Try again', async () => {
      const page = firstValueFrom(service.page('b1', null));
      http
        .expectOne((r) => r.url === '/api/babies/b1/feeds')
        .flush(null, { status: 503, statusText: 'Unavailable' });

      await expect(page).rejects.toBeTruthy();
    });
  });

  describe('create()', () => {
    it('posts a bottle with the given client id', async () => {
      const result = firstValueFrom(service.create('b1', 'bottle', fields, 'f1'));
      const req = http.expectOne('/api/feeds');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ id: 'f1', babyId: 'b1', kind: 'bottle', ...fields });
      req.flush(aBottle(), { status: 201, statusText: 'Created' });

      expect(await result).toEqual<FeedResult>({ ok: true, feed: aBottle() });
    });

    it('posts solids with their kind', async () => {
      const result = firstValueFrom(service.create('b1', 'solids', solids, 'f2'));
      const req = http.expectOne('/api/feeds');
      expect(req.request.body).toEqual({ id: 'f2', babyId: 'b1', kind: 'solids', ...solids });
      req.flush(aSolids(), { status: 201, statusText: 'Created' });

      expect(await result).toEqual<FeedResult>({ ok: true, feed: aSolids() });
    });

    it('generates a client id when none is given', () => {
      service.create('b1', 'bottle', fields).subscribe();
      const req = http.expectOne('/api/feeds');
      expect(req.request.body.id).toMatch(/^[0-9a-f-]{36}$/);
      req.flush(aBottle());
    });

    it('maps a validation problem to field errors', async () => {
      const result = firstValueFrom(service.create('b1', 'bottle', fields, 'f1'));
      http
        .expectOne('/api/feeds')
        .flush(
          { errors: { amountMl: ['outOfRange'] } },
          { status: 400, statusText: 'Bad Request' },
        );

      expect(await result).toEqual<FeedResult>({ ok: false, errors: { amountMl: 'outOfRange' } });
    });
  });

  describe('update()', () => {
    it('puts the fields', async () => {
      const result = firstValueFrom(service.update('f1', solids));
      const req = http.expectOne('/api/feeds/f1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(solids);
      req.flush(aSolids());

      expect(await result).toEqual<FeedResult>({ ok: true, feed: aSolids() });
    });

    it('maps a missing feed to its code', async () => {
      const result = firstValueFrom(service.update('f1', fields));
      http
        .expectOne('/api/feeds/f1')
        .flush({ code: 'feedNotFound' }, { status: 404, statusText: 'Not Found' });

      expect(await result).toEqual<FeedResult>({ ok: false, errors: { form: 'feedNotFound' } });
    });
  });

  describe('delete()', () => {
    it('deletes the feed', async () => {
      const result = firstValueFrom(service.delete('f1'));
      const req = http.expectOne('/api/feeds/f1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(await result).toEqual<FeedDeleteResult>({ ok: true });
    });

    it('maps a failure to a form error', async () => {
      const result = firstValueFrom(service.delete('f1'));
      http.expectOne('/api/feeds/f1').flush(null, { status: 503, statusText: 'Unavailable' });

      expect(await result).toEqual<FeedDeleteResult>({ ok: false, errors: { form: 'unknown' } });
    });
  });

  describe('bottleDefaults()', () => {
    it('gets the baby bottle defaults', async () => {
      const defaults: BottleDefaults = {
        milkType: 'formula',
        lastAmountMl: { breastMilk: 90, formula: 120 },
      };
      const result = firstValueFrom(service.bottleDefaults('b1'));
      http.expectOne('/api/babies/b1/feeds/bottle-defaults').flush(defaults);

      expect(await result).toEqual(defaults);
    });

    it('has no defaults when they cannot be loaded', async () => {
      const result = firstValueFrom(service.bottleDefaults('b1'));
      http
        .expectOne('/api/babies/b1/feeds/bottle-defaults')
        .flush(null, { status: 503, statusText: 'Unavailable' });

      expect(await result).toEqual<BottleDefaults>({
        milkType: null,
        lastAmountMl: { breastMilk: null, formula: null },
      });
    });
  });
});
