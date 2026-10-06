import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { aHealthEntry } from '../../testing/health-entries';
import { translocoTesting } from '../../testing/transloco-testing';
import { AuthService } from '../auth/auth.service';
import { EntryDeleteResult, EntryResult } from '../entries/entry-result';
import { QUEUE_STORAGE_KEY } from '../offline/offline-queue.service';
import { HealthEntry, HealthEntryFields } from './health-entry.models';
import { HealthEntryService } from './health-entry.service';

describe('HealthEntryService', () => {
  let service: HealthEntryService;
  let http: HttpTestingController;

  const fields: HealthEntryFields = {
    time: '2026-10-03T10:00:00.000Z',
    name: 'Paracetamol',
    amount: 2.5,
    unit: 'ml',
    temperature: 38.5,
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
    service = TestBed.inject(HealthEntryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  describe('page()', () => {
    it('gets the first page of the baby', async () => {
      const page = firstValueFrom(service.page('b1', null));
      const req = http.expectOne((r) => r.url === '/api/babies/b1/health-entries');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('cursor')).toBe(false);
      req.flush({ entries: [aHealthEntry()], next: 'c2' });

      expect(await page).toEqual({ entries: [aHealthEntry()], next: 'c2' });
    });

    it('passes the cursor and the page size', () => {
      service.page('b1', 'c2', 10).subscribe();
      const req = http.expectOne((r) => r.url === '/api/babies/b1/health-entries');
      expect(req.request.params.get('cursor')).toBe('c2');
      expect(req.request.params.get('limit')).toBe('10');
      req.flush({ entries: [], next: null });
    });
  });

  describe('recent()', () => {
    it('gets the recent names of the baby', async () => {
      const recent = [{ name: 'Paracetamol', amount: 2.5, unit: 'ml' }];
      const result = firstValueFrom(service.recent('b1'));
      const req = http.expectOne('/api/babies/b1/health-entries/recent');
      expect(req.request.method).toBe('GET');
      req.flush(recent);

      expect(await result).toEqual(recent);
    });

    it('gives none when they cannot be loaded (offline or error)', async () => {
      const result = firstValueFrom(service.recent('b1'));
      http.expectOne('/api/babies/b1/health-entries/recent').flush(null, networkError);

      expect(await result).toEqual([]);
    });
  });

  describe('create()', () => {
    it('posts the health entry with the given client id', async () => {
      const result = firstValueFrom(service.create('b1', fields, 'm1'));
      const req = http.expectOne('/api/health-entries');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ id: 'm1', babyId: 'b1', ...fields });
      req.flush(aHealthEntry(), { status: 201, statusText: 'Created' });

      expect(await result).toEqual<EntryResult<HealthEntry>>({ ok: true, entry: aHealthEntry() });
    });

    it('posts a temperature without a name', () => {
      const temperatureOnly: HealthEntryFields = {
        ...fields,
        name: null,
        amount: null,
        unit: null,
        temperature: 38.5,
      };
      service.create('b1', temperatureOnly, 'm1').subscribe();
      const req = http.expectOne('/api/health-entries');
      expect(req.request.body).toEqual({ id: 'm1', babyId: 'b1', ...temperatureOnly });
      req.flush(aHealthEntry());
    });

    it('generates a client id when none is given', () => {
      service.create('b1', fields).subscribe();
      const req = http.expectOne('/api/health-entries');
      expect(req.request.body.id).toMatch(/^[0-9a-f-]{36}$/);
      req.flush(aHealthEntry());
    });

    it('maps a validation problem to field errors', async () => {
      const result = firstValueFrom(service.create('b1', fields, 'm1'));
      http
        .expectOne('/api/health-entries')
        .flush({ errors: { time: ['required'] } }, { status: 400, statusText: 'Bad Request' });

      expect(await result).toEqual<EntryResult<HealthEntry>>({
        ok: false,
        errors: { time: 'required' },
      });
    });

    it('keeps the health entry on the device with its client id when offline', async () => {
      const result = firstValueFrom(service.create('b1', fields, 'm1'));
      http.expectOne('/api/health-entries').flush(null, networkError);

      expect(await result).toEqual<EntryResult<HealthEntry>>({ ok: true, queued: true });
      expect(queuedBodies()).toEqual([{ id: 'm1', babyId: 'b1', ...fields }]);
    });
  });

  describe('update()', () => {
    it('puts the fields', async () => {
      const result = firstValueFrom(service.update('m1', fields));
      const req = http.expectOne('/api/health-entries/m1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(fields);
      req.flush(aHealthEntry());

      expect(await result).toEqual<EntryResult<HealthEntry>>({ ok: true, entry: aHealthEntry() });
    });

    it('maps a missing health entry to its code', async () => {
      const result = firstValueFrom(service.update('m1', fields));
      http
        .expectOne('/api/health-entries/m1')
        .flush({ code: 'healthEntryNotFound' }, { status: 404, statusText: 'Not Found' });

      expect(await result).toEqual<EntryResult<HealthEntry>>({
        ok: false,
        errors: { form: 'healthEntryNotFound' },
      });
    });

    it('keeps the edit on the device when offline', async () => {
      const result = firstValueFrom(service.update('m1', fields));
      http.expectOne('/api/health-entries/m1').flush(null, networkError);

      expect(await result).toEqual<EntryResult<HealthEntry>>({ ok: true, queued: true });
      expect(queuedBodies()).toEqual([fields]);
    });
  });

  describe('delete()', () => {
    it('deletes the health entry', async () => {
      const result = firstValueFrom(service.delete('m1'));
      const req = http.expectOne('/api/health-entries/m1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(await result).toEqual<EntryDeleteResult>({ ok: true });
    });

    it('keeps the delete on the device when offline', async () => {
      const result = firstValueFrom(service.delete('m1'));
      http.expectOne('/api/health-entries/m1').flush(null, networkError);

      expect(await result).toEqual<EntryDeleteResult>({ ok: true, queued: true });
    });
  });
});
