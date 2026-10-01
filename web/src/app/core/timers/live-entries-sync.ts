import { DOCUMENT } from '@angular/common';
import { DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { UserName } from '../entries/entry.models';
import { QueuedRequest } from '../offline/offline-queue.models';
import { OfflineQueueService } from '../offline/offline-queue.service';

/** How often other devices' changes are fetched (spec 04 Timers: within a few seconds). */
export const SYNC_INTERVAL_MS = 5000;

/** What the shared sync needs of a live entry (spec 04 Timers): live while it has no end time. */
export interface LiveEntry {
  id: string;
  babyId: string;
  endTime: string | null;
}

/** Applies the changes waiting on the device (oldest first) to the live entries, as `user`. */
export type LiveOverlay<T> = (
  list: readonly T[],
  waiting: readonly QueuedRequest[],
  user: UserName,
) => T[];

/**
 * The live entries of a section with timers, of every baby, shared by every device (spec 04 Timers,
 * used by Feed's breastfeeds and Sleep): `load`ed every 5 s while signed in and the app is visible,
 * again as soon as it is shown, cleared on sign-out. This device's own actions apply at once through
 * `put` / `remove`; a load that started before one is ignored, so it can't bring back an older state.
 * A failed load keeps the last list.
 *
 * Changes kept on the device (offline, see `OfflineQueueService`) are applied on top of what the
 * server said by the section's `overlay`, as the server will apply them, until the queue has reached
 * the server (then it loads at once). Without an overlay, they show once sent.
 */
export abstract class LiveEntriesSync<T extends LiveEntry> {
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private readonly queue = inject(OfflineQueueService);
  private readonly user = computed((): UserName | null => {
    const user = this.auth.state()?.user;
    return user ? { id: user.id, displayName: user.displayName } : null;
  });
  private readonly list = signal<readonly T[]>([]);
  /** Bumped by every local change. */
  private version = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private request?: Subscription;

  /** Every baby's live entries, oldest start first. */
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

  /** Every baby's live entries, as the server has them now. */
  protected abstract load(): Observable<T[]>;

  /**
   * `list` once the changes waiting on the device (oldest first) are applied, as `user`; live
   * entries only. By default, waiting changes show once sent.
   */
  protected readonly overlay: LiveOverlay<T> = (list) =>
    list.filter((entry) => entry.endTime === null);

  /** The baby's live entry (the oldest with two); null when none. */
  forBaby(babyId: string): T | null {
    return this.list().find((entry) => entry.babyId === babyId) ?? null;
  }

  /** An entry as this device just changed it: kept while live, dropped once stopped. */
  put(entry: T): void {
    this.version++;
    this.list.update((list) => {
      const others = list.filter((e) => e.id !== entry.id);
      if (entry.endTime !== null) {
        return others;
      }
      const index = list.findIndex((e) => e.id === entry.id);
      return index < 0 ? [...list, entry] : list.map((e) => (e.id === entry.id ? entry : e));
    });
  }

  /**
   * Applies the changes waiting on the device now (their effects show at once), on top of `base`
   * when the list doesn't have that entry (a stopped entry made live again offline).
   */
  applyWaiting(base?: T): void {
    const user = this.user();
    if (!user) {
      return;
    }
    this.list.update((list) =>
      this.overlay(
        base && !list.some((e) => e.id === base.id) ? [...list, base] : list,
        this.queue.waiting(),
        user,
      ),
    );
  }

  remove(id: string): void {
    this.version++;
    this.list.update((list) => list.filter((entry) => entry.id !== id));
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
    this.request = this.load().subscribe({
      next: (list) => {
        const user = this.user();
        if (startedAt === this.version && user) {
          this.list.set(this.overlay(list, this.queue.waiting(), user));
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
