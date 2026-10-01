import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { AuthState } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { UserName } from '../entries/entry.models';
import { QueuedRequest } from '../offline/offline-queue.models';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { LiveEntriesSync, LiveEntry, SYNC_INTERVAL_MS } from './live-entries-sync';

interface Entry extends LiveEntry {
  marks?: string[];
}

const LOAD = new InjectionToken<() => Observable<Entry[]>>('LOAD');

/** A section's sync as a test sees it: what it loads comes from `LOAD`, and each waiting request marks every entry. */
@Injectable({ providedIn: 'root' })
class EntrySync extends LiveEntriesSync<Entry> {
  private readonly loader = inject(LOAD);

  protected load(): Observable<Entry[]> {
    return this.loader();
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
  let polls: Subject<Entry[]>[];
  let load: ReturnType<typeof vi.fn>;
  let visibility: DocumentVisibilityState;
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

  const start = () => {
    service = TestBed.inject(EntrySync);
    TestBed.tick();
  };
  const answer = (list: Entry[]) => polls.at(-1)!.next(list);
  const setVisibility = (next: DocumentVisibilityState) => {
    visibility = next;
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    state = signal<AuthState | null>(signedIn);
    polls = [];
    queue = { waiting: signal<readonly QueuedRequest[]>([]), sent: signal(0) };
    load = vi.fn((): Observable<Entry[]> => {
      const poll = new Subject<Entry[]>();
      polls.push(poll);
      return poll;
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: LOAD, useValue: load },
        { provide: AuthService, useValue: { state } },
        { provide: OfflineQueueService, useValue: queue },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads the live entries once signed in, then every 5 seconds', () => {
    start();
    expect(load).toHaveBeenCalledTimes(1);
    answer([leas, toms]);
    expect(service.inProgress()).toEqual([leas, toms]);

    vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(2);
    answer([toms]);
    expect(service.inProgress()).toEqual([toms]);
    expect(SYNC_INTERVAL_MS).toBe(5000);
  });

  it('does nothing while signed out, and clears the list on sign-out', () => {
    state.set(signedOut);
    start();
    vi.advanceTimersByTime(3 * SYNC_INTERVAL_MS);
    expect(load).not.toHaveBeenCalled();

    state.set(signedIn);
    TestBed.tick();
    answer([leas]);
    state.set(signedOut);
    TestBed.tick();

    expect(service.inProgress()).toEqual([]);
    vi.advanceTimersByTime(3 * SYNC_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('stops while the app is hidden and loads again as soon as it is shown', () => {
    start();
    setVisibility('hidden');
    vi.advanceTimersByTime(3 * SYNC_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    expect(load).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('keeps the last list when a poll fails', () => {
    start();
    answer([leas]);
    vi.advanceTimersByTime(SYNC_INTERVAL_MS);

    polls.at(-1)!.error(new Error('offline'));

    expect(service.inProgress()).toEqual([leas]);
    vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('applies a local action at once: put adds or replaces, a stopped entry is removed', () => {
    start();
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

  it('ignores a poll that started before a local action', () => {
    start();
    service.put(leas);

    answer([]);

    expect(service.inProgress()).toEqual([leas]);
    vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    answer([]);
    expect(service.inProgress()).toEqual([]);
  });

  it('gives the live entry of a baby', () => {
    start();
    answer([leas, toms]);

    expect(service.forBaby('b2')).toEqual(toms);
    expect(service.forBaby('b3')).toBeNull();
  });

  describe('changes kept on the device (offline)', () => {
    it('applies the waiting changes as the user, also before the first poll answers', () => {
      queue.waiting.set([waiting('offline')]);
      start();

      expect(service.forBaby('b1')).toMatchObject({ id: 'offline', marks: ['u1'] });
      polls.at(-1)!.error(new Error('offline'));
      expect(service.forBaby('b1')?.id).toBe('offline');
    });

    it('applies the waiting changes on top of each poll', () => {
      queue.waiting.set([waiting('offline')]);
      start();

      answer([toms]);

      expect(service.inProgress().map((e) => e.id)).toEqual(['tom', 'offline']);
    });

    it('applies a newly waiting change', () => {
      start();
      answer([]);

      queue.waiting.set([waiting('offline')]);
      TestBed.tick();

      expect(service.inProgress().map((e) => e.id)).toEqual(['offline']);
    });

    it('applies the waiting changes on request, on top of an entry it is given', () => {
      start();
      answer([]);

      service.applyWaiting({ id: 'reopened', babyId: 'b1', endTime: null });

      expect(service.inProgress().map((e) => e.id)).toEqual(['reopened']);
    });

    it('loads again as soon as the waiting changes were sent', () => {
      start();
      answer([]);
      expect(load).toHaveBeenCalledTimes(1);

      queue.sent.set(1);
      TestBed.tick();

      expect(load).toHaveBeenCalledTimes(2);
    });
  });
});
