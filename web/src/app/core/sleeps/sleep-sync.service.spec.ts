import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { aSleep } from '../../testing/sleeps';
import { AuthState } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { QueuedRequest } from '../offline/offline-queue.models';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { LiveEntriesSync } from '../timers/live-entries-sync';
import { LIVE_INTERVAL_MS } from '../timers/live-sync.service';
import { Sleep } from './sleep.models';
import { SleepSyncService } from './sleep-sync.service';

const signedIn: AuthState = {
  setupRequired: false,
  smtpEnabled: false,
  user: { id: 'u1', email: 'anna@mail.com', displayName: 'Anna', language: 'en', isAdmin: true },
};

describe('SleepSyncService', () => {
  let http: HttpTestingController;
  let service: SleepSyncService;
  let queue: {
    waiting: ReturnType<typeof signal<readonly QueuedRequest[]>>;
    sent: ReturnType<typeof signal<number>>;
  };

  const live = aSleep({ id: 'lea', babyId: 'b1', endTime: null });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    queue = { waiting: signal<readonly QueuedRequest[]>([]), sent: signal(0) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { state: signal<AuthState | null>(signedIn) } },
        { provide: OfflineQueueService, useValue: queue },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  /** The app starts (or is reopened). */
  const start = async () => {
    service = TestBed.inject(SleepSyncService);
    TestBed.tick();
    await Promise.resolve();
  };
  /** The server's answer to the shared live poll. */
  const answer = (list: Sleep[]) => {
    http.expectOne('/api/live').flush({ feeds: [], sleeps: list });
    TestBed.tick();
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs on the shared live sync, with the sleeps of /api/live', async () => {
    await start();
    expect(service).toBeInstanceOf(LiveEntriesSync);
    answer([live]);
    expect(service.forBaby('b1')).toEqual(live);

    vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    answer([]);
    expect(service.inProgress()).toEqual([]);
  });

  it('drops a sleep once stopped on this device', async () => {
    await start();
    answer([live]);

    service.put({ ...live, endTime: '2026-09-30T11:00:00Z' });

    expect(service.inProgress()).toEqual([]);
  });

  describe('taps kept on the device (offline)', () => {
    const queuedStart = (id: string, at: string): QueuedRequest => ({
      id: `q-${id}-${at}`,
      userId: 'u1',
      method: 'POST',
      url: `/api/sleeps/${id}/start`,
      body: { babyId: 'b1', at, queued: true },
      queuedAt: at,
    });

    it('shows a sleep started offline, also after the app was reopened', async () => {
      queue.waiting.set([queuedStart('offline', '2026-09-30T10:00:00.000Z')]);
      await start();

      expect(service.forBaby('b1')).toMatchObject({
        id: 'offline',
        startTime: '2026-09-30T10:00:00.000Z',
        endTime: null,
        loggedBy: { id: 'u1', displayName: 'Anna' },
      });
      http.expectOne('/api/live').error(new ProgressEvent('offline'));
      expect(service.forBaby('b1')?.id).toBe('offline');
    });

    it('applies the waiting taps on top of what the server answers', async () => {
      queue.waiting.set([queuedStart('offline', '2026-09-30T12:00:00.000Z')]);
      await start();

      answer([live]);

      expect(service.inProgress().map((s) => s.id)).toEqual(['lea', 'offline']);
    });

    it('applies the waiting taps at once on request, making a stopped sleep it is given live again', async () => {
      await start();
      answer([]);
      const stopped = aSleep({ id: 'stopped' });
      queue.waiting.set([queuedStart('stopped', '2026-09-30T12:00:00.000Z')]);

      service.applyWaiting(stopped);

      expect(service.forBaby('b1')).toMatchObject({ id: 'stopped', endTime: null });
    });
  });
});
