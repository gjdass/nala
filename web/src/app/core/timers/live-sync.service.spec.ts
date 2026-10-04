import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthState } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { QueuedRequest } from '../offline/offline-queue.models';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { IDLE_INTERVAL_MS, LIVE_INTERVAL_MS, LiveSyncService } from './live-sync.service';

const signedIn: AuthState = {
  setupRequired: false,
  smtpEnabled: false,
  user: { id: 'u1', email: 'anna@mail.com', displayName: 'Anna', language: 'en', isAdmin: true },
};
const signedOut: AuthState = { ...signedIn, user: null };

/** A section as the poller sees it: what it received, how often it was cleared or had its waiting changes applied. */
const fakeSection = () => {
  const live = signal<readonly unknown[]>([]);
  const received: unknown[][] = [];
  let version = 0;
  const section = {
    live,
    received,
    cleared: 0,
    applied: 0,
    /** A change made on this device: an answer to a request started before it is dropped. */
    change: () => version++,
    begin: () => {
      const startedAt = version;
      return (list: unknown[]) => {
        if (startedAt === version) {
          received.push(list);
        }
      };
    },
    applyWaiting: () => section.applied++,
    clear: () => section.cleared++,
  };
  return section;
};

describe('LiveSyncService', () => {
  let state: ReturnType<typeof signal<AuthState | null>>;
  let visibility: DocumentVisibilityState;
  let queue: {
    waiting: ReturnType<typeof signal<readonly QueuedRequest[]>>;
    sent: ReturnType<typeof signal<number>>;
  };
  let http: HttpTestingController;
  let service: LiveSyncService;
  let feeds: ReturnType<typeof fakeSection>;
  let sleeps: ReturnType<typeof fakeSection>;

  /** Registers both sections, as the app does when the running timers are first read. */
  const start = async () => {
    service = TestBed.inject(LiveSyncService);
    service.register('feeds', feeds);
    service.register('sleeps', sleeps);
    TestBed.tick();
    await Promise.resolve();
  };
  const requests = () => http.match('/api/live');
  const answer = (body: object) => {
    const pending = requests();
    expect(pending).toHaveLength(1);
    pending[0].flush(body);
  };
  const setVisibility = (next: DocumentVisibilityState) => {
    visibility = next;
    document.dispatchEvent(new Event('visibilitychange'));
  };
  const goLive = (section: ReturnType<typeof fakeSection>, entries: unknown[]) => {
    section.live.set(entries);
    TestBed.tick();
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    state = signal<AuthState | null>(signedIn);
    queue = { waiting: signal<readonly QueuedRequest[]>([]), sent: signal(0) };
    feeds = fakeSection();
    sleeps = fakeSection();
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

  it('polls /api/live once signed in and hands each section its list', async () => {
    await start();

    answer({ feeds: [{ id: 'f1' }], other: [] });

    expect(feeds.received).toEqual([[{ id: 'f1' }]]);
    expect(sleeps.received).toEqual([[]]);
    expect(feeds.applied).toBeGreaterThan(0);
  });

  it('polls every 30 s while nothing is live', async () => {
    await start();
    answer({ feeds: [], sleeps: [] });

    vi.advanceTimersByTime(IDLE_INTERVAL_MS - 1);
    expect(requests()).toHaveLength(0);
    vi.advanceTimersByTime(1);
    answer({ feeds: [], sleeps: [] });
    expect(IDLE_INTERVAL_MS).toBe(30000);
  });

  it('polls every 5 s while any section has a live entry, one request for every section', async () => {
    await start();
    answer({ feeds: [], sleeps: [] });
    goLive(sleeps, [{ id: 's1' }]);

    vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    answer({ feeds: [], sleeps: [{ id: 's1' }] });
    vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    answer({ feeds: [], sleeps: [{ id: 's1' }] });

    expect(sleeps.received).toHaveLength(3);
    expect(LIVE_INTERVAL_MS).toBe(5000);
  });

  it('switches to 5 s as soon as a live entry appears, back to 30 s once none is left', async () => {
    await start();
    answer({ feeds: [], sleeps: [] });

    goLive(feeds, [{ id: 'f1' }]);
    vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    answer({ feeds: [{ id: 'f1' }], sleeps: [] });

    goLive(feeds, []);
    vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    expect(requests()).toHaveLength(0);
    vi.advanceTimersByTime(IDLE_INTERVAL_MS - LIVE_INTERVAL_MS);
    answer({ feeds: [], sleeps: [] });
  });

  it('does nothing while signed out, and clears every section on sign-out', async () => {
    state.set(signedOut);
    await start();
    vi.advanceTimersByTime(3 * IDLE_INTERVAL_MS);
    expect(requests()).toHaveLength(0);

    state.set(signedIn);
    TestBed.tick();
    answer({ feeds: [], sleeps: [] });
    state.set(signedOut);
    TestBed.tick();

    expect(feeds.cleared).toBeGreaterThan(0);
    expect(sleeps.cleared).toBeGreaterThan(0);
    vi.advanceTimersByTime(3 * IDLE_INTERVAL_MS);
    expect(requests()).toHaveLength(0);
  });

  it('pauses while the app is hidden and polls at once when it is shown', async () => {
    await start();
    answer({ feeds: [], sleeps: [] });
    setVisibility('hidden');
    vi.advanceTimersByTime(3 * IDLE_INTERVAL_MS);
    expect(requests()).toHaveLength(0);

    setVisibility('visible');
    answer({ feeds: [], sleeps: [] });
    vi.advanceTimersByTime(IDLE_INTERVAL_MS);
    answer({ feeds: [], sleeps: [] });
  });

  it('polls at once once the waiting changes were sent', async () => {
    await start();
    answer({ feeds: [], sleeps: [] });

    queue.sent.set(1);
    TestBed.tick();

    answer({ feeds: [], sleeps: [] });
  });

  it('keeps every list when a call fails, and polls again on the next tick', async () => {
    await start();
    requests()[0].error(new ProgressEvent('offline'));

    expect(feeds.received).toEqual([]);
    expect(sleeps.received).toEqual([]);
    vi.advanceTimersByTime(IDLE_INTERVAL_MS);
    answer({ feeds: [], sleeps: [] });
  });

  it('drops the answer of a section changed on this device since the request started', async () => {
    await start();

    feeds.change();
    answer({ feeds: [{ id: 'old' }], sleeps: [{ id: 's1' }] });

    expect(feeds.received).toEqual([]);
    expect(sleeps.received).toEqual([[{ id: 's1' }]]);
  });

  it('polls at once for a section registering while it runs; sections registering together share one request', async () => {
    await start();
    answer({ feeds: [], sleeps: [] });

    const pumps = fakeSection();
    const other = fakeSection();
    service.register('pumps', pumps);
    service.register('other', other);
    await Promise.resolve();

    answer({ feeds: [], sleeps: [], pumps: [{ id: 'p1' }] });
    expect(pumps.received).toEqual([[{ id: 'p1' }]]);
    expect(other.received).toEqual([[]]);
  });

  it('polls at once on request, and says when every section has its list', async () => {
    await start();
    answer({ feeds: [], sleeps: [] });
    let done = 0;

    service.pollNow().subscribe(() => done++);
    expect(done).toBe(0);
    answer({ feeds: [], sleeps: [{ id: 's1' }] });

    expect(done).toBe(1);
    expect(sleeps.received.at(-1)).toEqual([{ id: 's1' }]);
  });

  it('says nothing when a requested poll fails', async () => {
    await start();
    answer({ feeds: [], sleeps: [] });
    let done = 0;

    service.pollNow().subscribe(() => done++);
    requests()[0].error(new ProgressEvent('offline'));

    expect(done).toBe(0);
  });
});
