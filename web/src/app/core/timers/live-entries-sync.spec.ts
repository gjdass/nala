import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthState } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { UserName } from '../entries/entry.models';
import { QueuedRequest } from '../offline/offline-queue.models';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { LiveEntriesSync, LiveEntry } from './live-entries-sync';
import { IDLE_INTERVAL_MS, LIVE_INTERVAL_MS } from './live-sync.service';

interface Entry extends LiveEntry {
  marks?: string[];
}

/** A section's sync as a test sees it: its list is `things` in `/api/live`, and each waiting request marks every entry. */
@Injectable({ providedIn: 'root' })
class EntrySync extends LiveEntriesSync<Entry> {
  constructor() {
    super('things');
  }

  protected override readonly overlay = (
    list: readonly Entry[],
    waiting: readonly QueuedRequest[],
    user: UserName,
  ): Entry[] => {
    const added = waiting
      .filter((request) => !list.some((entry) => entry.id === request.id))
      .map((request): Entry => ({ id: request.id, babyId: 'b1', endTime: null, marks: [user.id] }));
    return [...list, ...added].filter((entry) => entry.endTime === null);
  };
}

const signedIn: AuthState = {
  setupRequired: false,
  smtpEnabled: false,
  user: { id: 'u1', email: 'anna@mail.com', displayName: 'Anna', language: 'en', isAdmin: true },
};
const signedOut: AuthState = { ...signedIn, user: null };

describe('LiveEntriesSync', () => {
  let state: ReturnType<typeof signal<AuthState | null>>;
  let http: HttpTestingController;
  let service: EntrySync;
  let queue: {
    waiting: ReturnType<typeof signal<readonly QueuedRequest[]>>;
    sent: ReturnType<typeof signal<number>>;
  };

  const leas: Entry = { id: 'lea', babyId: 'b1', endTime: null };
  const toms: Entry = { id: 'tom', babyId: 'b2', endTime: null };
  const waiting = (id: string): QueuedRequest => ({
    id,
    userId: 'u1',
    method: 'POST',
    url: `/api/things/${id}/start`,
    body: {},
    queuedAt: '2026-09-30T10:00:00.000Z',
  });

  const start = async () => {
    service = TestBed.inject(EntrySync);
    TestBed.tick();
    await Promise.resolve();
  };
  const polls = () => http.match('/api/live');
  const answer = (list: Entry[]) => {
    const pending = polls();
    expect(pending).toHaveLength(1);
    pending[0].flush({ things: list, others: [] });
    TestBed.tick();
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
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

  it('receives its list from the shared live poll, under its key', async () => {
    await start();
    answer([leas, toms]);
    expect(service.inProgress()).toEqual([leas, toms]);

    vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    answer([toms]);
    expect(service.inProgress()).toEqual([toms]);
  });

  it('lets the shared poll slow down once nothing is live, and speed up as soon as an entry is', async () => {
    await start();
    answer([]);
    vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    expect(polls()).toHaveLength(0);

    service.put(leas);
    TestBed.tick();
    vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    expect(polls()).toHaveLength(1);
  });

  it('clears the list on sign-out', async () => {
    await start();
    answer([leas]);

    state.set(signedOut);
    TestBed.tick();

    expect(service.inProgress()).toEqual([]);
    vi.advanceTimersByTime(3 * IDLE_INTERVAL_MS);
    expect(polls()).toHaveLength(0);
  });

  it('asks the shared poller for a poll at once on refresh, and says when its list is in', async () => {
    await start();
    answer([]);
    let done = 0;

    service.refresh().subscribe(() => done++);
    answer([leas]);

    expect(done).toBe(1);
    expect(service.inProgress()).toEqual([leas]);
  });

  it('keeps the last list when a poll fails', async () => {
    await start();
    answer([leas]);
    vi.advanceTimersByTime(LIVE_INTERVAL_MS);

    polls()[0].error(new ProgressEvent('offline'));

    expect(service.inProgress()).toEqual([leas]);
  });

  it('applies a local action at once: put adds or replaces, a stopped entry is removed', async () => {
    await start();
    answer([leas]);

    const edited = { ...leas, marks: ['edited'] };
    service.put(edited);
    service.put(toms);
    expect(service.inProgress()).toEqual([edited, toms]);

    service.put({ ...toms, endTime: '2026-09-30T10:30:00Z' });
    expect(service.inProgress()).toEqual([edited]);

    service.remove('lea');
    expect(service.inProgress()).toEqual([]);
  });

  it('ignores a poll that started before a local action', async () => {
    await start();
    service.put(leas);

    answer([]);

    expect(service.inProgress()).toEqual([leas]);
    vi.advanceTimersByTime(LIVE_INTERVAL_MS);
    answer([]);
    expect(service.inProgress()).toEqual([]);
  });

  it('gives the live entry of a baby', async () => {
    await start();
    answer([leas, toms]);

    expect(service.forBaby('b2')).toEqual(toms);
    expect(service.forBaby('b3')).toBeNull();
  });

  describe('changes kept on the device (offline)', () => {
    it('applies the waiting changes as the user, also before the first poll answers', async () => {
      queue.waiting.set([waiting('offline')]);
      await start();

      expect(service.forBaby('b1')).toMatchObject({ id: 'offline', marks: ['u1'] });
      polls()[0].error(new ProgressEvent('offline'));
      expect(service.forBaby('b1')?.id).toBe('offline');
    });

    it('applies the waiting changes on top of each poll', async () => {
      queue.waiting.set([waiting('offline')]);
      await start();

      answer([toms]);

      expect(service.inProgress().map((e) => e.id)).toEqual(['tom', 'offline']);
    });

    it('applies a newly waiting change', async () => {
      await start();
      answer([]);

      queue.waiting.set([waiting('offline')]);
      TestBed.tick();

      expect(service.inProgress().map((e) => e.id)).toEqual(['offline']);
    });

    it('applies the waiting changes on request, on top of an entry it is given', async () => {
      await start();
      answer([]);

      service.applyWaiting({ id: 'reopened', babyId: 'b1', endTime: null });

      expect(service.inProgress().map((e) => e.id)).toEqual(['reopened']);
    });

    it('loads again as soon as the waiting changes were sent', async () => {
      await start();
      answer([]);

      queue.sent.set(1);
      TestBed.tick();

      expect(polls()).toHaveLength(1);
    });
  });
});
