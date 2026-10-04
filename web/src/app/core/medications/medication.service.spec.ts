import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { aMedication } from '../../testing/medications';
import { translocoTesting } from '../../testing/transloco-testing';
import { AuthService } from '../auth/auth.service';
import { EntryDeleteResult, EntryResult } from '../entries/entry-result';
import { QUEUE_STORAGE_KEY } from '../offline/offline-queue.service';
import { Medication, MedicationFields } from './medication.models';
import { MedicationService } from './medication.service';

describe('MedicationService', () => {
  let service: MedicationService;
  let http: HttpTestingController;

  const fields: MedicationFields = {
    time: '2026-10-03T10:00:00.000Z',
    name: 'Paracetamol',
    amount: 2.5,
    unit: 'ml',
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
    service = TestBed.inject(MedicationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  describe('page()', () => {
    it('gets the first page of the baby', async () => {
      const page = firstValueFrom(service.page('b1', null));
      const req = http.expectOne((r) => r.url === '/api/babies/b1/medications');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('cursor')).toBe(false);
      req.flush({ entries: [aMedication()], next: 'c2' });

      expect(await page).toEqual({ entries: [aMedication()], next: 'c2' });
    });

    it('passes the cursor and the page size', () => {
      service.page('b1', 'c2', 10).subscribe();
      const req = http.expectOne((r) => r.url === '/api/babies/b1/medications');
      expect(req.request.params.get('cursor')).toBe('c2');
      expect(req.request.params.get('limit')).toBe('10');
      req.flush({ entries: [], next: null });
    });
  });

  describe('create()', () => {
    it('posts the medication with the given client id', async () => {
      const result = firstValueFrom(service.create('b1', fields, 'm1'));
      const req = http.expectOne('/api/medications');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ id: 'm1', babyId: 'b1', ...fields });
      req.flush(aMedication(), { status: 201, statusText: 'Created' });

      expect(await result).toEqual<EntryResult<Medication>>({ ok: true, entry: aMedication() });
    });

    it('generates a client id when none is given', () => {
      service.create('b1', fields).subscribe();
      const req = http.expectOne('/api/medications');
      expect(req.request.body.id).toMatch(/^[0-9a-f-]{36}$/);
      req.flush(aMedication());
    });

    it('maps a validation problem to field errors', async () => {
      const result = firstValueFrom(service.create('b1', fields, 'm1'));
      http
        .expectOne('/api/medications')
        .flush({ errors: { time: ['inFuture'] } }, { status: 400, statusText: 'Bad Request' });

      expect(await result).toEqual<EntryResult<Medication>>({
        ok: false,
        errors: { time: 'inFuture' },
      });
    });

    it('keeps the medication on the device with its client id when offline', async () => {
      const result = firstValueFrom(service.create('b1', fields, 'm1'));
      http.expectOne('/api/medications').flush(null, networkError);

      expect(await result).toEqual<EntryResult<Medication>>({ ok: true, queued: true });
      expect(queuedBodies()).toEqual([{ id: 'm1', babyId: 'b1', ...fields }]);
    });
  });

  describe('update()', () => {
    it('puts the fields', async () => {
      const result = firstValueFrom(service.update('m1', fields));
      const req = http.expectOne('/api/medications/m1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(fields);
      req.flush(aMedication());

      expect(await result).toEqual<EntryResult<Medication>>({ ok: true, entry: aMedication() });
    });

    it('maps a missing medication to its code', async () => {
      const result = firstValueFrom(service.update('m1', fields));
      http
        .expectOne('/api/medications/m1')
        .flush({ code: 'medicationNotFound' }, { status: 404, statusText: 'Not Found' });

      expect(await result).toEqual<EntryResult<Medication>>({
        ok: false,
        errors: { form: 'medicationNotFound' },
      });
    });

    it('keeps the edit on the device when offline', async () => {
      const result = firstValueFrom(service.update('m1', fields));
      http.expectOne('/api/medications/m1').flush(null, networkError);

      expect(await result).toEqual<EntryResult<Medication>>({ ok: true, queued: true });
      expect(queuedBodies()).toEqual([fields]);
    });
  });

  describe('delete()', () => {
    it('deletes the medication', async () => {
      const result = firstValueFrom(service.delete('m1'));
      const req = http.expectOne('/api/medications/m1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(await result).toEqual<EntryDeleteResult>({ ok: true });
    });

    it('keeps the delete on the device when offline', async () => {
      const result = firstValueFrom(service.delete('m1'));
      http.expectOne('/api/medications/m1').flush(null, networkError);

      expect(await result).toEqual<EntryDeleteResult>({ ok: true, queued: true });
    });
  });
});
