import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { aBreastfeed } from '../../testing/feeds';
import { AuthState } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { BreastfeedSyncService, SYNC_INTERVAL_MS } from './breastfeed-sync.service';
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
const signedOut: AuthState = { ...signedIn, user: null };

describe('BreastfeedSyncService', () => {
  let state: ReturnType<typeof signal<AuthState | null>>;
  let polls: Subject<Feed[]>[];
  let feeds: { inProgress: ReturnType<typeof vi.fn> };
  let visibility: DocumentVisibilityState;
  let service: BreastfeedSyncService;

  const leas = aBreastfeed({ id: 'lea', babyId: 'b1', endTime: null });
  const toms = aBreastfeed({ id: 'tom', babyId: 'b2', endTime: null });

  const start = () => {
    service = TestBed.inject(BreastfeedSyncService);
    TestBed.tick();
  };
  const answer = (list: Feed[]) => polls.at(-1)!.next(list);
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
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads the breastfeeds in progress once signed in, then every 5 seconds', () => {
    start();
    expect(feeds.inProgress).toHaveBeenCalledTimes(1);
    answer([leas, toms]);
    expect(service.inProgress()).toEqual([leas, toms]);

    vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    expect(feeds.inProgress).toHaveBeenCalledTimes(2);
    answer([toms]);
    expect(service.inProgress()).toEqual([toms]);
    expect(SYNC_INTERVAL_MS).toBe(5000);
  });

  it('does nothing while signed out, and clears the list on sign-out', () => {
    state.set(signedOut);
    start();
    vi.advanceTimersByTime(3 * SYNC_INTERVAL_MS);
    expect(feeds.inProgress).not.toHaveBeenCalled();

    state.set(signedIn);
    TestBed.tick();
    answer([leas]);
    state.set(signedOut);
    TestBed.tick();

    expect(service.inProgress()).toEqual([]);
    vi.advanceTimersByTime(3 * SYNC_INTERVAL_MS);
    expect(feeds.inProgress).toHaveBeenCalledTimes(1);
  });

  it('stops while the app is hidden and loads again as soon as it is shown', () => {
    start();
    setVisibility('hidden');
    vi.advanceTimersByTime(3 * SYNC_INTERVAL_MS);
    expect(feeds.inProgress).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    expect(feeds.inProgress).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    expect(feeds.inProgress).toHaveBeenCalledTimes(3);
  });

  it('keeps the last list when a poll fails', () => {
    start();
    answer([leas]);
    vi.advanceTimersByTime(SYNC_INTERVAL_MS);

    polls.at(-1)!.error(new Error('offline'));

    expect(service.inProgress()).toEqual([leas]);
    vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    expect(feeds.inProgress).toHaveBeenCalledTimes(3);
  });

  it('applies a local action at once: put adds or replaces, a saved feed is removed', () => {
    start();
    answer([leas]);

    const switched = { ...leas, updatedAt: '2026-09-30T10:20:00Z' };
    service.put(switched);
    service.put(toms);
    expect(service.inProgress()).toEqual([switched, toms]);

    service.put({ ...toms, endTime: '2026-09-30T10:30:00Z' });
    expect(service.inProgress()).toEqual([switched]);

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

  it('gives the feed in progress of a baby', () => {
    start();
    answer([leas, toms]);

    expect(service.forBaby('b2')).toEqual(toms);
    expect(service.forBaby('b3')).toBeNull();
  });
});
