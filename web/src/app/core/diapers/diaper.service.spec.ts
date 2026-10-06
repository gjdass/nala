import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { aDiaper } from '../../testing/diapers';
import { translocoTesting } from '../../testing/transloco-testing';
import { AuthService } from '../auth/auth.service';
import { EntryDeleteResult, EntryResult } from '../entries/entry-result';
import { QUEUE_STORAGE_KEY } from '../offline/offline-queue.service';
import { Diaper, DiaperFields } from './diaper.models';
import { DiaperService } from './diaper.service';

describe('DiaperService', () => {
  let service: DiaperService;
  let http: HttpTestingController;

  const fields: DiaperFields = {
    time: '2026-10-03T10:00:00.000Z',
    wet: true,
    dirty: true,
    rash: false,
    color: 'brown',
    consistency: 'soft',
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
    service = TestBed.inject(DiaperService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  describe('page()', () => {
    it('gets the first page of the baby', async () => {
      const page = firstValueFrom(service.page('b1', null));
      const req = http.expectOne((r) => r.url === '/api/babies/b1/diapers');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('cursor')).toBe(false);
      req.flush({ entries: [aDiaper()], next: 'c2' });

      expect(await page).toEqual({ entries: [aDiaper()], next: 'c2' });
    });

    it('passes the cursor and the page size', () => {
      service.page('b1', 'c2', 10).subscribe();
      const req = http.expectOne((r) => r.url === '/api/babies/b1/diapers');
      expect(req.request.params.get('cursor')).toBe('c2');
      expect(req.request.params.get('limit')).toBe('10');
      req.flush({ entries: [], next: null });
    });
  });

  describe('create()', () => {
    it('posts the diaper with the given client id', async () => {
      const result = firstValueFrom(service.create('b1', fields, 'd1'));
      const req = http.expectOne('/api/diapers');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ id: 'd1', babyId: 'b1', ...fields });
      req.flush(aDiaper(), { status: 201, statusText: 'Created' });

      expect(await result).toEqual<EntryResult<Diaper>>({ ok: true, entry: aDiaper() });
    });

    it('generates a client id when none is given', () => {
      service.create('b1', fields).subscribe();
      const req = http.expectOne('/api/diapers');
      expect(req.request.body.id).toMatch(/^[0-9a-f-]{36}$/);
      req.flush(aDiaper());
    });

    it('maps a validation problem to field errors', async () => {
      const result = firstValueFrom(service.create('b1', fields, 'd1'));
      http
        .expectOne('/api/diapers')
        .flush({ errors: { time: ['required'] } }, { status: 400, statusText: 'Bad Request' });

      expect(await result).toEqual<EntryResult<Diaper>>({
        ok: false,
        errors: { time: 'required' },
      });
    });

    it('keeps the diaper on the device with its client id when offline', async () => {
      const result = firstValueFrom(service.create('b1', fields, 'd1'));
      http.expectOne('/api/diapers').flush(null, networkError);

      expect(await result).toEqual<EntryResult<Diaper>>({ ok: true, queued: true });
      expect(queuedBodies()).toEqual([{ id: 'd1', babyId: 'b1', ...fields }]);
    });
  });

  describe('update()', () => {
    it('puts the fields', async () => {
      const result = firstValueFrom(service.update('d1', fields));
      const req = http.expectOne('/api/diapers/d1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(fields);
      req.flush(aDiaper());

      expect(await result).toEqual<EntryResult<Diaper>>({ ok: true, entry: aDiaper() });
    });

    it('maps a missing diaper to its code', async () => {
      const result = firstValueFrom(service.update('d1', fields));
      http
        .expectOne('/api/diapers/d1')
        .flush({ code: 'diaperNotFound' }, { status: 404, statusText: 'Not Found' });

      expect(await result).toEqual<EntryResult<Diaper>>({
        ok: false,
        errors: { form: 'diaperNotFound' },
      });
    });

    it('keeps the edit on the device when offline', async () => {
      const result = firstValueFrom(service.update('d1', fields));
      http.expectOne('/api/diapers/d1').flush(null, networkError);

      expect(await result).toEqual<EntryResult<Diaper>>({ ok: true, queued: true });
      expect(queuedBodies()).toEqual([fields]);
    });
  });

  describe('delete()', () => {
    it('deletes the diaper', async () => {
      const result = firstValueFrom(service.delete('d1'));
      const req = http.expectOne('/api/diapers/d1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(await result).toEqual<EntryDeleteResult>({ ok: true });
    });

    it('keeps the delete on the device when offline', async () => {
      const result = firstValueFrom(service.delete('d1'));
      http.expectOne('/api/diapers/d1').flush(null, networkError);

      expect(await result).toEqual<EntryDeleteResult>({ ok: true, queued: true });
    });
  });
});
