import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { aPump } from '../../testing/pumps';
import { translocoTesting } from '../../testing/transloco-testing';
import { AuthService } from '../auth/auth.service';
import { EntryDeleteResult, EntryResult } from '../entries/entry-result';
import { QUEUE_STORAGE_KEY } from '../offline/offline-queue.service';
import { Pump, PumpFields } from './pump.models';
import { PumpService } from './pump.service';

describe('PumpService', () => {
  let service: PumpService;
  let http: HttpTestingController;

  const fields: PumpFields = {
    startTime: '2026-10-03T10:00:00.000Z',
    endTime: '2026-10-03T10:20:00.000Z',
    leftMl: 90,
    rightMl: null,
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
    service = TestBed.inject(PumpService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  describe('page()', () => {
    it('gets the first page of the baby', async () => {
      const page = firstValueFrom(service.page('b1', null));
      const req = http.expectOne((r) => r.url === '/api/babies/b1/pumps');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('cursor')).toBe(false);
      req.flush({ entries: [aPump()], next: 'c2' });

      expect(await page).toEqual({ entries: [aPump()], next: 'c2' });
    });

    it('passes the cursor and the page size', () => {
      service.page('b1', 'c2', 10).subscribe();
      const req = http.expectOne((r) => r.url === '/api/babies/b1/pumps');
      expect(req.request.params.get('cursor')).toBe('c2');
      expect(req.request.params.get('limit')).toBe('10');
      req.flush({ entries: [], next: null });
    });
  });

  describe('create()', () => {
    it('posts the pump with the given client id', async () => {
      const result = firstValueFrom(service.create('b1', fields, 'p1'));
      const req = http.expectOne('/api/pumps');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ id: 'p1', babyId: 'b1', ...fields });
      req.flush(aPump(), { status: 201, statusText: 'Created' });

      expect(await result).toEqual<EntryResult<Pump>>({ ok: true, entry: aPump() });
    });

    it('generates a client id when none is given', () => {
      service.create('b1', fields).subscribe();
      const req = http.expectOne('/api/pumps');
      expect(req.request.body.id).toMatch(/^[0-9a-f-]{36}$/);
      req.flush(aPump());
    });

    it('maps a validation problem to field errors', async () => {
      const result = firstValueFrom(service.create('b1', fields, 'p1'));
      http
        .expectOne('/api/pumps')
        .flush({ errors: { leftMl: ['outOfRange'] } }, { status: 400, statusText: 'Bad Request' });

      expect(await result).toEqual<EntryResult<Pump>>({
        ok: false,
        errors: { leftMl: 'outOfRange' },
      });
    });

    it('keeps the pump on the device with its client id when offline', async () => {
      const result = firstValueFrom(service.create('b1', fields, 'p1'));
      http.expectOne('/api/pumps').flush(null, networkError);

      expect(await result).toEqual<EntryResult<Pump>>({ ok: true, queued: true });
      expect(queuedBodies()).toEqual([{ id: 'p1', babyId: 'b1', ...fields }]);
    });
  });

  describe('update()', () => {
    it('puts the fields', async () => {
      const result = firstValueFrom(service.update('p1', fields));
      const req = http.expectOne('/api/pumps/p1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(fields);
      req.flush(aPump());

      expect(await result).toEqual<EntryResult<Pump>>({ ok: true, entry: aPump() });
    });

    it('maps a missing session to its code', async () => {
      const result = firstValueFrom(service.update('p1', fields));
      http
        .expectOne('/api/pumps/p1')
        .flush({ code: 'pumpNotFound' }, { status: 404, statusText: 'Not Found' });

      expect(await result).toEqual<EntryResult<Pump>>({
        ok: false,
        errors: { form: 'pumpNotFound' },
      });
    });

    it('keeps the edit on the device when offline', async () => {
      const result = firstValueFrom(service.update('p1', fields));
      http.expectOne('/api/pumps/p1').flush(null, networkError);

      expect(await result).toEqual<EntryResult<Pump>>({ ok: true, queued: true });
      expect(queuedBodies()).toEqual([fields]);
    });
  });

  describe('delete()', () => {
    it('deletes the pump', async () => {
      const result = firstValueFrom(service.delete('p1'));
      const req = http.expectOne('/api/pumps/p1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(await result).toEqual<EntryDeleteResult>({ ok: true });
    });

    it('keeps the delete on the device when offline', async () => {
      const result = firstValueFrom(service.delete('p1'));
      http.expectOne('/api/pumps/p1').flush(null, networkError);

      expect(await result).toEqual<EntryDeleteResult>({ ok: true, queued: true });
    });
  });
});
