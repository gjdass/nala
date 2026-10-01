import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { aSleep } from '../../testing/sleeps';
import { translocoTesting } from '../../testing/transloco-testing';
import { AuthService } from '../auth/auth.service';
import { EntryDeleteResult, EntryResult } from '../entries/entry-result';
import { QUEUE_STORAGE_KEY } from '../offline/offline-queue.service';
import { Sleep, SleepFields } from './sleep.models';
import { SleepService } from './sleep.service';

describe('SleepService', () => {
  let service: SleepService;
  let http: HttpTestingController;

  const fields: SleepFields = {
    startTime: '2026-09-30T10:00:00.000Z',
    endTime: '2026-09-30T11:30:00.000Z',
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
    service = TestBed.inject(SleepService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  describe('page()', () => {
    it('gets the first page of the baby', async () => {
      const page = firstValueFrom(service.page('b1', null));
      const req = http.expectOne((r) => r.url === '/api/babies/b1/sleeps');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('cursor')).toBe(false);
      req.flush({ entries: [aSleep()], next: 'c2' });

      expect(await page).toEqual({ entries: [aSleep()], next: 'c2' });
    });

    it('passes the cursor and the page size', () => {
      service.page('b1', 'c2', 10).subscribe();
      const req = http.expectOne((r) => r.url === '/api/babies/b1/sleeps');
      expect(req.request.params.get('cursor')).toBe('c2');
      expect(req.request.params.get('limit')).toBe('10');
      req.flush({ entries: [], next: null });
    });

    it('errors when the page fails, so the history offers Try again', async () => {
      const page = firstValueFrom(service.page('b1', null));
      http
        .expectOne((r) => r.url === '/api/babies/b1/sleeps')
        .flush(null, { status: 503, statusText: 'Unavailable' });

      await expect(page).rejects.toBeTruthy();
    });
  });

  describe('create()', () => {
    it('posts the sleep with the given client id', async () => {
      const result = firstValueFrom(service.create('b1', fields, 's1'));
      const req = http.expectOne('/api/sleeps');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ id: 's1', babyId: 'b1', ...fields });
      req.flush(aSleep(), { status: 201, statusText: 'Created' });

      expect(await result).toEqual<EntryResult<Sleep>>({ ok: true, entry: aSleep() });
    });

    it('generates a client id when none is given', () => {
      service.create('b1', fields).subscribe();
      const req = http.expectOne('/api/sleeps');
      expect(req.request.body.id).toMatch(/^[0-9a-f-]{36}$/);
      req.flush(aSleep());
    });

    it('maps a validation problem to field errors', async () => {
      const result = firstValueFrom(service.create('b1', fields, 's1'));
      http
        .expectOne('/api/sleeps')
        .flush(
          { errors: { endTime: ['beforeStart'] } },
          { status: 400, statusText: 'Bad Request' },
        );

      expect(await result).toEqual<EntryResult<Sleep>>({
        ok: false,
        errors: { endTime: 'beforeStart' },
      });
    });

    it('keeps the sleep on the device with its client id when offline', async () => {
      const result = firstValueFrom(service.create('b1', fields, 's1'));
      http.expectOne('/api/sleeps').flush(null, networkError);

      expect(await result).toEqual<EntryResult<Sleep>>({ ok: true, queued: true });
      expect(queuedBodies()).toEqual([{ id: 's1', babyId: 'b1', ...fields }]);
    });
  });

  describe('update()', () => {
    it('puts the fields', async () => {
      const result = firstValueFrom(service.update('s1', fields));
      const req = http.expectOne('/api/sleeps/s1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(fields);
      req.flush(aSleep());

      expect(await result).toEqual<EntryResult<Sleep>>({ ok: true, entry: aSleep() });
    });

    it('maps a missing sleep to its code', async () => {
      const result = firstValueFrom(service.update('s1', fields));
      http
        .expectOne('/api/sleeps/s1')
        .flush({ code: 'sleepNotFound' }, { status: 404, statusText: 'Not Found' });

      expect(await result).toEqual<EntryResult<Sleep>>({
        ok: false,
        errors: { form: 'sleepNotFound' },
      });
    });

    it('keeps the edit on the device when offline', async () => {
      const result = firstValueFrom(service.update('s1', fields));
      http.expectOne('/api/sleeps/s1').flush(null, networkError);

      expect(await result).toEqual<EntryResult<Sleep>>({ ok: true, queued: true });
      expect(queuedBodies()).toEqual([fields]);
    });
  });

  describe('delete()', () => {
    it('deletes the sleep', async () => {
      const result = firstValueFrom(service.delete('s1'));
      const req = http.expectOne('/api/sleeps/s1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(await result).toEqual<EntryDeleteResult>({ ok: true });
    });

    it('keeps the delete on the device when offline', async () => {
      const result = firstValueFrom(service.delete('s1'));
      http.expectOne('/api/sleeps/s1').flush(null, networkError);

      expect(await result).toEqual<EntryDeleteResult>({ ok: true, queued: true });
    });
  });

  describe('get()', () => {
    it('gets the sleep', async () => {
      const result = firstValueFrom(service.get('s1'));
      http.expectOne('/api/sleeps/s1').flush(aSleep());

      expect(await result).toEqual(aSleep());
    });

    it('is null once the sleep no longer exists', async () => {
      const result = firstValueFrom(service.get('s1'));
      http
        .expectOne('/api/sleeps/s1')
        .flush({ code: 'sleepNotFound' }, { status: 404, statusText: 'Not Found' });

      expect(await result).toBeNull();
    });
  });
});
