import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { aGrowthEntry } from '../../testing/growth-entries';
import { translocoTesting } from '../../testing/transloco-testing';
import { AuthService } from '../auth/auth.service';
import { EntryDeleteResult, EntryResult } from '../entries/entry-result';
import { QUEUE_STORAGE_KEY } from '../offline/offline-queue.service';
import { GrowthEntry, GrowthLatest, MeasurementFields } from './growth-entry.models';
import { GrowthEntryService } from './growth-entry.service';

describe('GrowthEntryService', () => {
  let service: GrowthEntryService;
  let http: HttpTestingController;

  const fields: MeasurementFields = {
    date: '2026-09-28',
    weightG: 4250,
    lengthCm: 55.5,
    headCircumferenceCm: null,
    notes: null,
  };
  const networkError = { status: 0, statusText: 'Unknown Error' };
  const queuedBodies = () =>
    (JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) ?? '[]') as { body: unknown }[]).map(
      (r) => r.body,
    );

  beforeEach(() => {
    localStorage.clear();
    const user = { id: 'u1', email: 'anna@mail.com', displayName: 'Anna', language: 'en' };
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { state: signal({ user }) } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
    service = TestBed.inject(GrowthEntryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  describe('page()', () => {
    it('gets the first page of the baby', async () => {
      const page = firstValueFrom(service.page('b1', null));
      const req = http.expectOne((r) => r.url === '/api/babies/b1/growth-entries');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('cursor')).toBe(false);
      req.flush({ entries: [aGrowthEntry()], next: 'c2' });

      expect(await page).toEqual({ entries: [aGrowthEntry()], next: 'c2' });
    });

    it('passes the cursor and the page size', () => {
      service.page('b1', 'c2', 10).subscribe();
      const req = http.expectOne((r) => r.url === '/api/babies/b1/growth-entries');
      expect(req.request.params.get('cursor')).toBe('c2');
      expect(req.request.params.get('limit')).toBe('10');
      req.flush({ entries: [], next: null });
    });
  });

  describe('latest()', () => {
    it('gets the latest value of each measure of the baby', async () => {
      const latest: GrowthLatest = {
        weight: { value: 4250, date: '2026-09-28', birth: false },
        length: { value: 49.5, date: '2026-09-01', birth: true },
        headCircumference: null,
      };
      const result = firstValueFrom(service.latest('b1'));
      const req = http.expectOne('/api/babies/b1/growth-entries/latest');
      expect(req.request.method).toBe('GET');
      req.flush(latest);

      expect(await result).toEqual(latest);
    });

    it('gives null when they cannot be loaded (offline or error)', async () => {
      const result = firstValueFrom(service.latest('b1'));
      http.expectOne('/api/babies/b1/growth-entries/latest').flush(null, networkError);

      expect(await result).toBeNull();
    });
  });

  describe('create()', () => {
    it('posts the measurement with its kind and the given client id', async () => {
      const result = firstValueFrom(service.create('b1', 'measurement', fields, 'g1'));
      const req = http.expectOne('/api/growth-entries');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ id: 'g1', babyId: 'b1', kind: 'measurement', ...fields });
      req.flush(aGrowthEntry(), { status: 201, statusText: 'Created' });

      expect(await result).toEqual<EntryResult<GrowthEntry>>({ ok: true, entry: aGrowthEntry() });
    });

    it('generates a client id when none is given', () => {
      service.create('b1', 'measurement', fields).subscribe();
      const req = http.expectOne('/api/growth-entries');
      expect(req.request.body.id).toMatch(/^[0-9a-f-]{36}$/);
      req.flush(aGrowthEntry());
    });

    it('maps a validation problem to field errors', async () => {
      const result = firstValueFrom(service.create('b1', 'measurement', fields, 'g1'));
      http
        .expectOne('/api/growth-entries')
        .flush({ errors: { date: ['beforeBirth'] } }, { status: 400, statusText: 'Bad Request' });

      expect(await result).toEqual<EntryResult<GrowthEntry>>({
        ok: false,
        errors: { date: 'beforeBirth' },
      });
    });

    it('keeps the entry on the device with its client id when offline', async () => {
      const result = firstValueFrom(service.create('b1', 'measurement', fields, 'g1'));
      http.expectOne('/api/growth-entries').flush(null, networkError);

      expect(await result).toEqual<EntryResult<GrowthEntry>>({ ok: true, queued: true });
      expect(queuedBodies()).toEqual([{ id: 'g1', babyId: 'b1', kind: 'measurement', ...fields }]);
    });
  });

  describe('update()', () => {
    it('puts the fields', async () => {
      const result = firstValueFrom(service.update('g1', fields));
      const req = http.expectOne('/api/growth-entries/g1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(fields);
      req.flush(aGrowthEntry());

      expect(await result).toEqual<EntryResult<GrowthEntry>>({ ok: true, entry: aGrowthEntry() });
    });

    it('maps a missing entry to its code', async () => {
      const result = firstValueFrom(service.update('g1', fields));
      http
        .expectOne('/api/growth-entries/g1')
        .flush({ code: 'growthEntryNotFound' }, { status: 404, statusText: 'Not Found' });

      expect(await result).toEqual<EntryResult<GrowthEntry>>({
        ok: false,
        errors: { form: 'growthEntryNotFound' },
      });
    });

    it('keeps the edit on the device when offline', async () => {
      const result = firstValueFrom(service.update('g1', fields));
      http.expectOne('/api/growth-entries/g1').flush(null, networkError);

      expect(await result).toEqual<EntryResult<GrowthEntry>>({ ok: true, queued: true });
      expect(queuedBodies()).toEqual([fields]);
    });
  });

  describe('delete()', () => {
    it('deletes the entry', async () => {
      const result = firstValueFrom(service.delete('g1'));
      const req = http.expectOne('/api/growth-entries/g1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(await result).toEqual<EntryDeleteResult>({ ok: true });
    });

    it('keeps the delete on the device when offline', async () => {
      const result = firstValueFrom(service.delete('g1'));
      http.expectOne('/api/growth-entries/g1').flush(null, networkError);

      expect(await result).toEqual<EntryDeleteResult>({ ok: true, queued: true });
    });
  });
});
