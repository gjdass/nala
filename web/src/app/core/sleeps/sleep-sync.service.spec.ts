import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { aSleep } from '../../testing/sleeps';
import { AuthState } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { QueuedRequest } from '../offline/offline-queue.models';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { LiveEntriesSync, SYNC_INTERVAL_MS } from '../timers/live-entries-sync';
import { Sleep } from './sleep.models';
import { SleepService } from './sleep.service';
import { SleepSyncService } from './sleep-sync.service';

const signedIn: AuthState = {
  setupRequired: false,
  smtpEnabled: false,
  user: { id: 'u1', email: 'anna@mail.com', displayName: 'Anna', language: 'en', isAdmin: true },
};

describe('SleepSyncService', () => {
  let polls: Subject<Sleep[]>[];
  let sleeps: { inProgress: ReturnType<typeof vi.fn> };
  let service: SleepSyncService;
  let queue: {
    waiting: ReturnType<typeof signal<readonly QueuedRequest[]>>;
    sent: ReturnType<typeof signal<number>>;
  };

  const live = aSleep({ id: 'lea', babyId: 'b1', endTime: null });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    polls = [];
    sleeps = {
      inProgress: vi.fn((): Observable<Sleep[]> => {
        const poll = new Subject<Sleep[]>();
        polls.push(poll);
        return poll;
      }),
    };
    queue = { waiting: signal<readonly QueuedRequest[]>([]), sent: signal(0) };
    TestBed.configureTestingModule({
      providers: [
        { provide: SleepService, useValue: sleeps },
        { provide: AuthService, useValue: { state: signal<AuthState | null>(signedIn) } },
        { provide: OfflineQueueService, useValue: queue },
      ],
    });
  });

  /** The app starts (or is reopened). */
  const start = () => {
    service = TestBed.inject(SleepSyncService);
    TestBed.tick();
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs on the shared live sync, loading the live sleeps every 5 seconds', () => {
    start();
    expect(service).toBeInstanceOf(LiveEntriesSync);
    expect(sleeps.inProgress).toHaveBeenCalledTimes(1);
    polls.at(-1)!.next([live]);
    expect(service.forBaby('b1')).toEqual(live);

    vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    expect(sleeps.inProgress).toHaveBeenCalledTimes(2);
  });

  it('drops a sleep once stopped on this device', () => {
    start();
    polls.at(-1)!.next([live]);

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

    it('shows a sleep started offline, also after the app was reopened', () => {
      queue.waiting.set([queuedStart('offline', '2026-09-30T10:00:00.000Z')]);
      start();

      expect(service.forBaby('b1')).toMatchObject({
        id: 'offline',
        startTime: '2026-09-30T10:00:00.000Z',
        endTime: null,
        loggedBy: { id: 'u1', displayName: 'Anna' },
      });
      polls.at(-1)!.error(new Error('offline'));
      expect(service.forBaby('b1')?.id).toBe('offline');
    });

    it('applies the waiting taps on top of what the server answers', () => {
      queue.waiting.set([queuedStart('offline', '2026-09-30T12:00:00.000Z')]);
      start();

      polls.at(-1)!.next([live]);

      expect(service.inProgress().map((s) => s.id)).toEqual(['lea', 'offline']);
    });

    it('applies the waiting taps at once on request, making a stopped sleep it is given live again', () => {
      start();
      polls.at(-1)!.next([]);
      const stopped = aSleep({ id: 'stopped' });
      queue.waiting.set([queuedStart('stopped', '2026-09-30T12:00:00.000Z')]);

      service.applyWaiting(stopped);

      expect(service.forBaby('b1')).toMatchObject({ id: 'stopped', endTime: null });
    });
  });
});
