import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { applyQueued } from './breastfeed';
import { Feed, UserName } from './feed.models';
import { FeedService } from './feed.service';

/** How often other devices' changes are fetched (spec 05: within a few seconds). */
export const SYNC_INTERVAL_MS = 5000;

/**
 * The breastfeeds in progress of every baby, shared by every device (spec 05): polled every 5 s
 * while signed in and the app is visible, polled again as soon as it is shown, cleared on sign-out.
 * This device's own actions apply at once through `put` / `remove`; a poll that started before one
 * is ignored, so it can't bring back an older state. A failed poll keeps the last list.
 *
 * Timer taps kept on the device (offline, see `OfflineQueueService`) are applied on top of what the
 * server said, as the server will apply them: a breastfeed started offline runs and shows at once,
 * also after the app was reopened, until the queue has reached the server (then it polls at once).
 */
@Injectable({ providedIn: 'root' })
export class BreastfeedSyncService {
  private readonly feeds = inject(FeedService);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private readonly queue = inject(OfflineQueueService);
  private readonly user = computed((): UserName | null => {
    const user = this.auth.state()?.user;
    return user ? { id: user.id, displayName: user.displayName } : null;
  });
  private readonly list = signal<readonly Feed[]>([]);
  /** Bumped by every local change. */
  private version = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private request?: Subscription;

  readonly inProgress = this.list.asReadonly();

  constructor() {
    effect(() => {
      const signedIn = !!this.auth.state()?.user;
      untracked(() => (signedIn ? this.start() : this.stop()));
    });
    effect(() => {
      this.queue.waiting();
      untracked(() => this.applyWaiting());
    });
    // Changes kept on the device have reached the server: show what it has now.
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

  /** The baby's breastfeed in progress; null when none. */
  forBaby(babyId: string): Feed | null {
    return this.list().find((feed) => feed.babyId === babyId) ?? null;
  }

  /** A feed as this device just changed it: kept while in progress, dropped once saved. */
  put(feed: Feed): void {
    this.version++;
    this.list.update((list) => {
      const others = list.filter((f) => f.id !== feed.id);
      if (feed.endTime !== null) {
        return others;
      }
      const index = list.findIndex((f) => f.id === feed.id);
      return index < 0 ? [...list, feed] : list.map((f) => (f.id === feed.id ? feed : f));
    });
  }

  /**
   * Applies the timer taps waiting on the device now (their effects show at once), on top of `base`
   * when the list doesn't have that feed (a saved feed reopened offline).
   */
  applyWaiting(base?: Feed): void {
    const user = this.user();
    if (!user) {
      return;
    }
    this.list.update((list) =>
      applyQueued(
        base && !list.some((f) => f.id === base.id) ? [...list, base] : list,
        this.queue.waiting(),
        user,
      ),
    );
  }

  remove(id: string): void {
    this.version++;
    this.list.update((list) => list.filter((feed) => feed.id !== id));
  }

  private start(): void {
    if (!this.auth.state()?.user || !this.visible()) {
      return;
    }
    this.applyWaiting();
    this.refresh();
    this.timer ??= setInterval(() => this.refresh(), SYNC_INTERVAL_MS);
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
    this.version++;
    this.list.set([]);
  }

  private refresh(): void {
    this.request?.unsubscribe();
    const startedAt = this.version;
    this.request = this.feeds.inProgress().subscribe({
      next: (list) => {
        const user = this.user();
        if (startedAt === this.version && user) {
          this.list.set(applyQueued(list, this.queue.waiting(), user));
        }
      },
      // Offline or failing: keep what is shown, try again on the next tick.
      error: () => undefined,
    });
  }

  private visible(): boolean {
    return this.document.visibilityState === 'visible';
  }
}
