import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { aBreastfeed, aSegment } from '../../testing/feeds';
import { QueuedRequest } from '../offline/offline-queue.models';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { AuthState } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { LiveEntriesSync } from '../timers/live-entries-sync';
import { LIVE_INTERVAL_MS } from '../timers/live-sync.service';
import { BreastfeedSyncService } from './breastfeed-sync.service';
import { Feed } from './feed.models';

const signedIn: AuthState = {
  setupRequired: false,
  smtpEnabled: false,
  user: {
    id: 'u1',
    email: 'anna@mail.com',
    displayName: 'Anna',
    language: 'en',
    isAdmin: true,
  },
};

describe('BreastfeedSyncService', () => {
  let state: ReturnType<typeof signal<AuthState | null>>;
  let http: HttpTestingController;
  let visibility: DocumentVisibilityState;
  let service: BreastfeedSyncService;
  let queue: {
    waiting: ReturnType<typeof signal<readonly QueuedRequest[]>>;
    sent: ReturnType<typeof signal<number>>;
  };

  const leas = aBreastfeed({ id: 'lea', babyId: 'b1', endTime: null });
  const toms = aBreastfeed({ id: 'tom', babyId: 'b2', endTime: null });

  const start = async () => {
    service = TestBed.inject(BreastfeedSyncService);
    TestBed.tick();
    await Promise.resolve();
  };
  /** The server's answer to the shared live poll. */
  const answer = (list: Feed[]) => {
    http.expectOne('/api/live').flush({ feeds: list, sleeps: [] });
    TestBed.tick();
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    state = signal<AuthState | null>(signedIn);
    queue = { waiting: signal<readonly QueuedRequest[]>([]), sent: signal(0) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { state } },
        { provide: OfflineQueueService, useValue: queue },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs on the shared live sync, with the feeds of /api/live', async () => {
    await start();
    expect(service).toBeInstanceOf(LiveEntriesSync);
    answer([leas, toms]);
    expect(service.forBaby('b2')).toEqual(toms);

    vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    answer([toms]);
    expect(service.forBaby('b1')).toBeNull();
  });

  describe('taps kept on the device (offline)', () => {
    const queuedStart = (id: string, side: 'left' | 'right', at: string): QueuedRequest => ({
      id: `q-${id}-${at}`,
      userId: 'u1',
      method: 'POST',
      url: `/api/feeds/${id}/breastfeed/start`,
      body: { babyId: 'b1', segmentId: `s-${at}`, side, at, queued: true },
      queuedAt: at,
    });

    it('shows a breastfeed started offline, also after the app was reopened', async () => {
      queue.waiting.set([queuedStart('offline', 'left', '2026-09-30T10:00:00.000Z')]);
      await start();

      expect(service.forBaby('b1')).toMatchObject({
        id: 'offline',
        endTime: null,
        loggedBy: { id: 'u1', displayName: 'Anna' },
      });
      http.expectOne('/api/live').error(new ProgressEvent('offline'));
      expect(service.forBaby('b1')?.id).toBe('offline');
    });

    it('applies the waiting taps on top of each poll', async () => {
      queue.waiting.set([queuedStart('offline', 'left', '2026-09-30T10:00:00.000Z')]);
      await start();

      answer([toms]);

      expect(service.inProgress().map((f) => f.id)).toEqual(['tom', 'offline']);
    });

    it('applies a newly queued tap', async () => {
      await start();
      answer([]);

      queue.waiting.set([queuedStart('offline', 'right', '2026-09-30T10:00:00.000Z')]);
      TestBed.tick();

      expect(service.forBaby('b1')?.segments.map((s) => s.side)).toEqual(['right']);
    });

    it('applies the waiting taps at once on request, reopening a saved feed it is given', async () => {
      await start();
      answer([]);
      const saved = aBreastfeed({
        id: 'saved',
        segments: [aSegment('left', '2026-09-30T09:00:00Z', '2026-09-30T09:05:00Z')],
      });
      queue.waiting.set([queuedStart('saved', 'right', '2026-09-30T10:00:00.000Z')]);

      service.applyWaiting(saved);

      expect(service.forBaby('b1')).toMatchObject({ id: 'saved', endTime: null });
      expect(service.forBaby('b1')?.segments).toHaveLength(2);
    });
  });
});
