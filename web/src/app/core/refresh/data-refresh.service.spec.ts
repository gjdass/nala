import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthState } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { fakeOfflineQueue } from '../../testing/offline-queue';
import { DataRefreshService, RESUME_AWAY_MS } from './data-refresh.service';

const signedIn: AuthState = {
  setupRequired: false,
  smtpEnabled: false,
  user: { id: 'anna', email: 'anna@mail.com', displayName: 'Anna', language: 'en', isAdmin: false },
};

describe('DataRefreshService', () => {
  let visibility: DocumentVisibilityState;
  let state: ReturnType<typeof signal<AuthState | null>>;
  let queue: ReturnType<typeof fakeOfflineQueue>;
  let service: DataRefreshService;

  const start = () => {
    service = TestBed.inject(DataRefreshService);
    TestBed.tick();
  };
  const setVisibility = (value: DocumentVisibilityState) => {
    visibility = value;
    document.dispatchEvent(new Event('visibilitychange'));
  };
  /** Hides the app for `ms`, then shows it again. */
  const away = (ms: number) => {
    setVisibility('hidden');
    vi.advanceTimersByTime(ms);
    setVisibility('visible');
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] });
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    state = signal<AuthState | null>(signedIn);
    queue = fakeOfflineQueue();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { state } },
        { provide: OfflineQueueService, useValue: queue },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sends nothing on its own', () => {
    start();

    expect(service.reload()).toBe(0);
  });

  it('sends the signal when the user comes back after at least 30 s away', () => {
    start();

    away(RESUME_AWAY_MS);

    expect(service.reload()).toBe(1);
  });

  it('sends nothing when the user comes back sooner', () => {
    start();

    away(RESUME_AWAY_MS - 1);

    expect(service.reload()).toBe(0);
  });

  it('counts the time away from the last time the app was hidden', () => {
    start();
    away(RESUME_AWAY_MS);

    away(1000);

    expect(service.reload()).toBe(1);
  });

  it('sends nothing when shown without having been hidden', () => {
    start();
    vi.advanceTimersByTime(RESUME_AWAY_MS);

    setVisibility('visible');

    expect(service.reload()).toBe(0);
  });

  it('sends the signal when the network comes back', () => {
    start();

    window.dispatchEvent(new Event('online'));

    expect(service.reload()).toBe(1);
  });

  it('sends the signal once changes kept on the device have reached the server', () => {
    start();

    queue.sent.set(1);
    TestBed.tick();

    expect(service.reload()).toBe(1);
  });

  it('leaves it to the queue when changes wait on the device', () => {
    queue.pending.set(1);
    start();

    away(RESUME_AWAY_MS);
    window.dispatchEvent(new Event('online'));

    expect(service.reload()).toBe(0);
    queue.pending.set(0);
    queue.sent.set(1);
    TestBed.tick();
    expect(service.reload()).toBe(1);
  });

  it('sends nothing while signed out', () => {
    state.set({ ...signedIn, user: null });
    start();

    away(RESUME_AWAY_MS);
    window.dispatchEvent(new Event('online'));

    expect(service.reload()).toBe(0);
  });
});
