import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { aBreastfeed, aSegment } from '../../testing/feeds';
import { QueuedRequest } from '../offline/offline-queue.models';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { AuthState } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { LiveEntriesSync, SYNC_INTERVAL_MS } from '../timers/live-entries-sync';
import { BreastfeedSyncService } from './breastfeed-sync.service';
import { Feed } from './feed.models';
import { FeedService } from './feed.service';

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
  let polls: Subject<Feed[]>[];
  let feeds: { inProgress: ReturnType<typeof vi.fn> };
  let visibility: DocumentVisibilityState;
  let service: BreastfeedSyncService;
  let queue: {
    waiting: ReturnType<typeof signal<readonly QueuedRequest[]>>;
    sent: ReturnType<typeof signal<number>>;
  };

  const leas = aBreastfeed({ id: 'lea', babyId: 'b1', endTime: null });
  const toms = aBreastfeed({ id: 'tom', babyId: 'b2', endTime: null });

  const start = () => {
    service = TestBed.inject(BreastfeedSyncService);
    TestBed.tick();
  };
  const answer = (list: Feed[]) => polls.at(-1)!.next(list);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    state = signal<AuthState | null>(signedIn);
    polls = [];
    queue = { waiting: signal<readonly QueuedRequest[]>([]), sent: signal(0) };
    feeds = {
      inProgress: vi.fn((): Observable<Feed[]> => {
        const poll = new Subject<Feed[]>();
        polls.push(poll);
        return poll;
      }),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: FeedService, useValue: feeds },
        { provide: AuthService, useValue: { state } },
        { provide: OfflineQueueService, useValue: queue },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runs on the shared live sync, loading the live breastfeeds every 5 seconds', () => {
    start();
    expect(service).toBeInstanceOf(LiveEntriesSync);
    expect(feeds.inProgress).toHaveBeenCalledTimes(1);
    answer([leas, toms]);
    expect(service.forBaby('b2')).toEqual(toms);

    vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    expect(feeds.inProgress).toHaveBeenCalledTimes(2);
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

    it('shows a breastfeed started offline, also after the app was reopened', () => {
      queue.waiting.set([queuedStart('offline', 'left', '2026-09-30T10:00:00.000Z')]);
      start();

      expect(service.forBaby('b1')).toMatchObject({
        id: 'offline',
        endTime: null,
        loggedBy: { id: 'u1', displayName: 'Anna' },
      });
      polls.at(-1)!.error(new Error('offline'));
      expect(service.forBaby('b1')?.id).toBe('offline');
    });

    it('applies the waiting taps on top of each poll', () => {
      queue.waiting.set([queuedStart('offline', 'left', '2026-09-30T10:00:00.000Z')]);
      start();

      answer([toms]);

      expect(service.inProgress().map((f) => f.id)).toEqual(['tom', 'offline']);
    });

    it('applies a newly queued tap', () => {
      start();
      answer([]);

      queue.waiting.set([queuedStart('offline', 'right', '2026-09-30T10:00:00.000Z')]);
      TestBed.tick();

      expect(service.forBaby('b1')?.segments.map((s) => s.side)).toEqual(['right']);
    });

    it('applies the waiting taps at once on request, reopening a saved feed it is given', () => {
      start();
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
