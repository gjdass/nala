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
    TestBed.configureTestingModule({
      providers: [
        { provide: SleepService, useValue: sleeps },
        { provide: AuthService, useValue: { state: signal<AuthState | null>(signedIn) } },
        {
          provide: OfflineQueueService,
          useValue: { waiting: signal<readonly QueuedRequest[]>([]), sent: signal(0) },
        },
      ],
    });
    service = TestBed.inject(SleepSyncService);
    TestBed.tick();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs on the shared live sync, loading the live sleeps every 5 seconds', () => {
    expect(service).toBeInstanceOf(LiveEntriesSync);
    expect(sleeps.inProgress).toHaveBeenCalledTimes(1);
    polls.at(-1)!.next([live]);
    expect(service.forBaby('b1')).toEqual(live);

    vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    expect(sleeps.inProgress).toHaveBeenCalledTimes(2);
  });

  it('drops a sleep once stopped on this device', () => {
    polls.at(-1)!.next([live]);

    service.put({ ...live, endTime: '2026-09-30T11:00:00Z' });

    expect(service.inProgress()).toEqual([]);
  });
});
