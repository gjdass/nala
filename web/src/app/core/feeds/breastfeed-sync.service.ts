import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { Feed } from './feed.models';
import { FeedService } from './feed.service';

/** How often other devices' changes are fetched (spec 05: within a few seconds). */
export const SYNC_INTERVAL_MS = 5000;

/**
 * The breastfeeds in progress of every baby, shared by every device (spec 05): polled every 5 s
 * while signed in and the app is visible, polled again as soon as it is shown, cleared on sign-out.
 * This device's own actions apply at once through `put` / `remove`; a poll that started before one
 * is ignored, so it can't bring back an older state. A failed poll keeps the last list.
 */
@Injectable({ providedIn: 'root' })
export class BreastfeedSyncService {
  private readonly feeds = inject(FeedService);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
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

  remove(id: string): void {
    this.version++;
    this.list.update((list) => list.filter((feed) => feed.id !== id));
  }

  private start(): void {
    if (!this.auth.state()?.user || !this.visible()) {
      return;
    }
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
        if (startedAt === this.version) {
          this.list.set(list);
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
