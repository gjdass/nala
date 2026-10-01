import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import { translocoTesting } from '../../testing/transloco-testing';
import { AuthState } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { QueuedRequest } from './offline-queue.models';
import { OFFLINE_RETRY_MS, OfflineQueueService, QUEUE_STORAGE_KEY } from './offline-queue.service';

const as = (id: string | null): AuthState => ({
  setupRequired: false,
  smtpEnabled: false,
  user: id
    ? { id, email: `${id}@mail.com`, displayName: id, language: 'en', isAdmin: false }
    : null,
});

const networkError = { status: 0, statusText: 'Unknown Error' };

describe('OfflineQueueService', () => {
  let state: ReturnType<typeof signal<AuthState | null>>;
  let snackBar: { open: ReturnType<typeof vi.fn> };
  let http: HttpTestingController;
  let service: OfflineQueueService;

  const stored = (): QueuedRequest[] => JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) ?? '[]');
  const queued = (overrides: Partial<QueuedRequest>): QueuedRequest => ({
    id: crypto.randomUUID(),
    userId: 'anna',
    method: 'POST',
    url: '/api/feeds',
    body: { id: 'f1' },
    queuedAt: '2026-09-30T10:00:00.000Z',
    ...overrides,
  });
  const store = (list: QueuedRequest[]) =>
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(list));
  const start = () => {
    service = TestBed.inject(OfflineQueueService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  };
  const goOnline = () => window.dispatchEvent(new Event('online'));
  /** The snackbar is loaded on first use. */
  const snackTexts = async () => {
    await vi.dynamicImportSettled();
    return snackBar.open.mock.calls.map((call) => call[0]);
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    localStorage.clear();
    state = signal<AuthState | null>(as('anna'));
    snackBar = { open: vi.fn() };
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { state } },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('send()', () => {
    it('sends at once when nothing is queued, and answers with the server response', async () => {
      start();
      const outcome = firstValueFrom(service.send('POST', '/api/feeds', { id: 'f1' }));
      const req = http.expectOne('/api/feeds');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ id: 'f1' });
      req.flush({ id: 'f1' }, { status: 201, statusText: 'Created' });

      expect(await outcome).toEqual({ sent: { id: 'f1' } });
      expect(stored()).toEqual([]);
      expect(await snackTexts()).toEqual([]);
    });

    it('keeps the request on the device when the network is down, as the signed-in user', async () => {
      vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
      start();
      const outcome = firstValueFrom(service.send('PUT', '/api/feeds/f1', { notes: 'x' }));
      http.expectOne('/api/feeds/f1').flush(null, networkError);

      expect(await outcome).toEqual({ queued: true });
      expect(stored()).toEqual([
        {
          id: expect.any(String),
          userId: 'anna',
          method: 'PUT',
          url: '/api/feeds/f1',
          body: { notes: 'x' },
          queuedAt: '2026-09-30T10:00:00.000Z',
        },
      ]);
      expect(service.pending()).toBe(1);
      expect(await snackTexts()).toEqual([en.offline.queued]);
    });

    it.each([502, 503, 504])(
      'keeps the request when the API is unreachable (%i)',
      async (status) => {
        start();
        const outcome = firstValueFrom(service.send('DELETE', '/api/feeds/f1', null));
        http.expectOne('/api/feeds/f1').flush(null, { status, statusText: 'Unavailable' });

        expect(await outcome).toEqual({ queued: true });
        expect(stored()).toHaveLength(1);
      },
    );

    it('answers with the error when the server refuses the request', async () => {
      start();
      const outcome = firstValueFrom(service.send('POST', '/api/feeds', { id: 'f1' }));
      http
        .expectOne('/api/feeds')
        .flush({ errors: { amountMl: ['required'] } }, { status: 400, statusText: 'Bad Request' });

      const result = await outcome;
      expect('error' in result && result.error.status).toBe(400);
      expect(stored()).toEqual([]);
    });

    it('keeps the queued body when one is given, and sends the plain body online', async () => {
      start();
      const online = firstValueFrom(
        service.send(
          'POST',
          '/api/feeds/f1/breastfeed/start',
          { at: 't' },
          { queuedBody: { at: 't', queued: true } },
        ),
      );
      const req = http.expectOne('/api/feeds/f1/breastfeed/start');
      expect(req.request.body).toEqual({ at: 't' });
      req.flush({ id: 'f1' });
      await online;

      const offline = firstValueFrom(
        service.send(
          'POST',
          '/api/feeds/f1/breastfeed/start',
          { at: 'u' },
          { queuedBody: { at: 'u', queued: true } },
        ),
      );
      http.expectOne('/api/feeds/f1/breastfeed/start').flush(null, networkError);
      await offline;
      await firstValueFrom(
        service.send(
          'POST',
          '/api/feeds/f1/breastfeed/start',
          { at: 'v' },
          { queuedBody: { at: 'v', queued: true } },
        ),
      );

      expect(stored().map((r) => r.body)).toEqual([
        { at: 'u', queued: true },
        { at: 'v', queued: true },
      ]);
    });

    it('says a quiet request was kept only when it is the first one waiting', async () => {
      start();
      const first = firstValueFrom(
        service.send('POST', '/api/feeds/f1/breastfeed/stop', {}, { quiet: true }),
      );
      http.expectOne('/api/feeds/f1/breastfeed/stop').flush(null, networkError);
      await first;
      await firstValueFrom(
        service.send('POST', '/api/feeds/f1/breastfeed/stop', {}, { quiet: true }),
      );

      expect(await snackTexts()).toEqual([en.offline.queued]);
      expect(stored()).toHaveLength(2);
    });

    it("exposes the signed-in user's waiting requests, oldest first", () => {
      store([
        queued({ userId: 'anna', url: '/api/feeds/a' }),
        queued({ userId: 'ben', url: '/api/feeds/b' }),
        queued({ userId: 'anna', url: '/api/feeds/c' }),
      ]);
      state.set(as(null));
      start();

      expect(service.waiting()).toEqual([]);
      state.set(as('anna'));
      expect(service.waiting().map((r) => r.url)).toEqual(['/api/feeds/a', '/api/feeds/c']);
      TestBed.tick();
      http.expectOne('/api/feeds/a').flush(null, networkError);
    });

    it('queues behind the requests already waiting, so they reach the server in order', async () => {
      store([queued({ url: '/api/feeds', body: { id: 'f1' } })]);
      start();
      http.expectOne('/api/feeds').flush(null, networkError);

      const outcome = await firstValueFrom(service.send('DELETE', '/api/feeds/f1', null));

      expect(outcome).toEqual({ queued: true });
      http.expectNone('/api/feeds/f1');
      expect(stored().map((r) => `${r.method} ${r.url}`)).toEqual([
        'POST /api/feeds',
        'DELETE /api/feeds/f1',
      ]);
    });
  });

  describe('sending the queue', () => {
    it('sends the queue oldest first, one at a time, once back online', async () => {
      start();
      const first = firstValueFrom(service.send('POST', '/api/feeds', { id: 'f1' }));
      http.expectOne('/api/feeds').flush(null, networkError);
      await first;
      await firstValueFrom(service.send('PUT', '/api/feeds/f1', { notes: 'x' }));
      const sentBefore = service.sent();

      goOnline();
      const create = http.expectOne('/api/feeds');
      http.expectNone('/api/feeds/f1');
      create.flush({ id: 'f1' }, { status: 201, statusText: 'Created' });
      http.expectOne('/api/feeds/f1').flush({ id: 'f1' });

      expect(stored()).toEqual([]);
      expect(service.pending()).toBe(0);
      expect(service.sent()).toBeGreaterThan(sentBefore);
    });

    it('stops at the first network failure and keeps the rest for later', () => {
      store([queued({ url: '/api/feeds' }), queued({ method: 'DELETE', url: '/api/feeds/f1' })]);
      start();

      http.expectOne('/api/feeds').flush(null, networkError);

      http.expectNone('/api/feeds/f1');
      expect(stored()).toHaveLength(2);
    });

    it('sends what was kept on the device when the app starts again', () => {
      store([queued({ url: '/api/feeds', body: { id: 'f1' } })]);
      start();

      const req = http.expectOne('/api/feeds');
      expect(req.request.body).toEqual({ id: 'f1' });
      req.flush({ id: 'f1' }, { status: 201, statusText: 'Created' });
      expect(stored()).toEqual([]);
    });

    it('sends a finish tap kept from before "live or not" as a stop, then the start time and notes as an edit', async () => {
      store([
        queued({
          id: 'old',
          url: '/api/feeds/f3/breastfeed/finish',
          body: {
            startTime: '2026-09-30T09:55:00.000Z',
            notes: 'calm',
            at: '2026-09-30T10:09:00.000Z',
          },
        }),
      ]);
      start();

      expect(service.waiting().map((r) => [r.method, r.url, r.body, r.userId, r.queuedAt])).toEqual(
        [
          [
            'POST',
            '/api/feeds/f3/breastfeed/stop',
            { at: '2026-09-30T10:09:00.000Z' },
            'anna',
            '2026-09-30T10:00:00.000Z',
          ],
          [
            'PUT',
            '/api/feeds/f3',
            { startTime: '2026-09-30T09:55:00.000Z', notes: 'calm' },
            'anna',
            '2026-09-30T10:00:00.000Z',
          ],
        ],
      );
      const stop = http.expectOne('/api/feeds/f3/breastfeed/stop');
      expect(stop.request.body).toEqual({ at: '2026-09-30T10:09:00.000Z' });
      stop.flush({ id: 'f3' });
      await Promise.resolve();
      const edit = http.expectOne({ method: 'PUT', url: '/api/feeds/f3' });
      expect(edit.request.body).toEqual({ startTime: '2026-09-30T09:55:00.000Z', notes: 'calm' });
      edit.flush({ id: 'f3' });
      expect(stored()).toEqual([]);
    });

    it('drops a feed the server already has (re-sent create answered 200)', async () => {
      store([queued({ url: '/api/feeds', body: { id: 'f1' } })]);
      start();

      http.expectOne('/api/feeds').flush({ id: 'f1' }, { status: 200, statusText: 'OK' });

      expect(stored()).toEqual([]);
      expect(await snackTexts()).toEqual([]);
    });

    it('counts a delete of a feed that is already gone as done', async () => {
      store([queued({ method: 'DELETE', url: '/api/feeds/f1', body: null })]);
      start();

      http
        .expectOne('/api/feeds/f1')
        .flush({ code: 'feedNotFound' }, { status: 404, statusText: 'Not Found' });

      expect(stored()).toEqual([]);
      expect(await snackTexts()).toEqual([]);
    });

    it('drops a request the server refuses, tells the user, and goes on with the next', async () => {
      store([
        queued({ method: 'PUT', url: '/api/feeds/f1' }),
        queued({ method: 'PUT', url: '/api/feeds/f2' }),
      ]);
      start();

      http
        .expectOne('/api/feeds/f1')
        .flush({ code: 'feedNotFound' }, { status: 404, statusText: 'Not Found' });
      http.expectOne('/api/feeds/f2').flush({ id: 'f2' });

      expect(stored()).toEqual([]);
      expect(await snackTexts()).toEqual([en.offline.refused]);
    });

    it('keeps the queue when the session has expired', () => {
      store([queued({ url: '/api/feeds' })]);
      start();

      http.expectOne('/api/feeds').flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(stored()).toHaveLength(1);
    });

    it('sends nothing while signed out, then sends once the same user logs in again', () => {
      state.set(as(null));
      store([queued({ userId: 'anna', url: '/api/feeds' })]);
      start();
      http.expectNone('/api/feeds');
      goOnline();
      http.expectNone('/api/feeds');

      state.set(as('anna'));
      TestBed.tick();

      http.expectOne('/api/feeds').flush({ id: 'f1' }, { status: 201, statusText: 'Created' });
      expect(stored()).toEqual([]);
    });

    it("never sends another user's requests, and keeps them on the device", () => {
      store([queued({ userId: 'anna', url: '/api/feeds' })]);
      state.set(as('ben'));
      start();
      goOnline();

      http.expectNone('/api/feeds');
      expect(service.pending()).toBe(0);
      expect(stored()).toHaveLength(1);
    });

    it("queues a new request of another user without waiting behind the first user's", async () => {
      store([queued({ userId: 'anna', url: '/api/feeds' })]);
      state.set(as('ben'));
      start();

      const outcome = firstValueFrom(service.send('POST', '/api/feeds', { id: 'f9' }));
      http.expectOne('/api/feeds').flush({ id: 'f9' }, { status: 201, statusText: 'Created' });

      expect(await outcome).toEqual({ sent: { id: 'f9' } });
      expect(stored()).toHaveLength(1);
    });

    it('tries again every 30 seconds while requests are waiting', () => {
      store([queued({ url: '/api/feeds' })]);
      start();
      http.expectOne('/api/feeds').flush(null, networkError);

      vi.advanceTimersByTime(OFFLINE_RETRY_MS);
      http.expectOne('/api/feeds').flush({ id: 'f1' }, { status: 201, statusText: 'Created' });

      vi.advanceTimersByTime(OFFLINE_RETRY_MS);
      http.expectNone('/api/feeds');
      expect(OFFLINE_RETRY_MS).toBe(30_000);
    });

    it('tries again when the app is shown', () => {
      let visibility: DocumentVisibilityState = 'hidden';
      vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
      store([queued({ url: '/api/feeds' })]);
      start();
      http.expectOne('/api/feeds').flush(null, networkError);

      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));

      http.expectOne('/api/feeds').flush({ id: 'f1' }, { status: 201, statusText: 'Created' });
      expect(stored()).toEqual([]);
    });
  });
});
