import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subject, Subscription, take } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { OfflineQueueService } from '../offline/offline-queue.service';

/** How often `/api/live` is polled while any section has a live entry (spec 04 Live sync). */
export const LIVE_INTERVAL_MS = 5000;
/** How often `/api/live` is polled while no section has a live entry. */
export const IDLE_INTERVAL_MS = 30000;

/** A section with timers, as the shared poller sees it (e.g. `LiveEntriesSync`). */
export interface LiveSection {
  /** The section's live entries now: while any section has one, the poll is fast. */
  live: Signal<readonly unknown[]>;
  /** A request starts: returns what takes the section's list from its answer. */
  begin(): (list: unknown[]) => void;
  /** Applies the changes waiting on the device, before polling (again). */
  applyWaiting(): void;
  /** Signed out: forgets every live entry. */
  clear(): void;
}

/**
 * The one poller of every section's live entries (spec 04 Live sync): `GET /api/live` every 5 s while
 * any section has a live entry, every 30 s otherwise, each registered section getting its list
 * (`register(key)`, the list's name in the answer). Runs while signed in and the app is visible;
 * polls at once on sign-in, when the app is shown again, once the offline queue has been sent and
 * when a section registers (sections registering together share one request), or on `pollNow`.
 * A failed call changes nothing; sign-out clears every section.
 */
@Injectable({ providedIn: 'root' })
export class LiveSyncService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private readonly queue = inject(OfflineQueueService);
  private readonly sections = signal<readonly (readonly [string, LiveSection])[]>([]);
  private readonly anyLive = computed(() =>
    this.sections().some(([, section]) => section.live().length > 0),
  );
  private timer: ReturnType<typeof setInterval> | null = null;
  private request?: Subscription;
  private pollQueued = false;
  /** Each answer, once handed to every section. */
  private readonly polled = new Subject<void>();

  constructor() {
    effect(() => {
      const signedIn = !!this.auth.state()?.user;
      untracked(() => (signedIn ? this.start() : this.stop()));
    });
    effect(() => {
      this.anyLive();
      untracked(() => {
        if (this.timer !== null) {
          this.schedule();
        }
      });
    });
    // Changes kept on the device (offline) have reached the server: show what it has now.
    let sent = this.queue.sent();
    effect(() => {
      const now = this.queue.sent();
      untracked(() => {
        if (now !== sent) {
          sent = now;
          this.start();
        }
      });
    });
    const onVisibility = () => (this.visible() ? this.start() : this.pause());
    this.document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onVisibility);
      this.pause();
    });
  }

  /** Hands `section` the `key` list of every answer; polls at once when already running. */
  register(key: string, section: LiveSection): void {
    this.sections.update((sections) => [...sections, [key, section] as const]);
    if (this.timer !== null && !this.pollQueued) {
      this.pollQueued = true;
      queueMicrotask(() => {
        this.pollQueued = false;
        if (this.timer !== null) {
          this.refresh();
        }
      });
    }
  }

  /**
   * Polls at once (e.g. a sheet looking for a live entry the server refused to duplicate); emits
   * once every section has the answer. A failed call emits nothing.
   */
  pollNow(): Observable<void> {
    this.refresh();
    return this.polled.pipe(take(1));
  }

  private start(): void {
    if (!this.auth.state()?.user || !this.visible()) {
      return;
    }
    for (const [, section] of this.sections()) {
      section.applyWaiting();
    }
    this.refresh();
    this.schedule();
  }

  /** (Re)starts the interval at the speed the live entries ask for. */
  private schedule(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
    }
    const period = untracked(this.anyLive) ? LIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
    this.timer = setInterval(() => this.refresh(), period);
  }

  private pause(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.request?.unsubscribe();
  }

  private stop(): void {
    this.pause();
    for (const [, section] of this.sections()) {
      section.clear();
    }
  }

  private refresh(): void {
    this.request?.unsubscribe();
    const receivers = this.sections().map(([key, section]) => [key, section.begin()] as const);
    this.request = this.http.get<Record<string, unknown[] | undefined>>('/api/live').subscribe({
      next: (live) => {
        for (const [key, receive] of receivers) {
          receive(live[key] ?? []);
        }
        this.polled.next();
      },
      // Offline or failing: keep what is shown, try again on the next tick.
      error: () => undefined,
    });
  }

  private visible(): boolean {
    return this.document.visibilityState === 'visible';
  }
}
