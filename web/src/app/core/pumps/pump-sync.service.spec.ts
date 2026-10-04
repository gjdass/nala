import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { aPump } from '../../testing/pumps';
import { AuthState } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { QueuedRequest } from '../offline/offline-queue.models';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { LiveEntriesSync } from '../timers/live-entries-sync';
import { LIVE_INTERVAL_MS } from '../timers/live-sync.service';
import { Pump } from './pump.models';
import { PumpSyncService } from './pump-sync.service';

const signedIn: AuthState = {
  setupRequired: false,
  smtpEnabled: false,
  user: { id: 'u1', email: 'anna@mail.com', displayName: 'Anna', language: 'en', isAdmin: true },
};

describe('PumpSyncService', () => {
  let http: HttpTestingController;
  let service: PumpSyncService;

  const live = aPump({ id: 'lea', babyId: 'b1', endTime: null });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { state: signal<AuthState | null>(signedIn) } },
        {
          provide: OfflineQueueService,
          useValue: { waiting: signal<readonly QueuedRequest[]>([]), sent: signal(0) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const start = async () => {
    service = TestBed.inject(PumpSyncService);
    TestBed.tick();
    await Promise.resolve();
  };
  const answer = (list: Pump[]) => {
    http.expectOne('/api/live').flush({ feeds: [], sleeps: [], pumps: list });
    TestBed.tick();
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs on the shared live sync, with the pumps of /api/live', async () => {
    await start();
    expect(service).toBeInstanceOf(LiveEntriesSync);
    answer([live]);
    expect(service.forBaby('b1')).toEqual(live);

    vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    answer([]);
    expect(service.inProgress()).toEqual([]);
  });

  it('drops a session once stopped on this device', async () => {
    await start();
    answer([live]);

    service.put({ ...live, endTime: '2026-10-03T11:00:00Z' });

    expect(service.inProgress()).toEqual([]);
  });
});
