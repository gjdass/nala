import { computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { UserName } from '../entries/entry.models';
import { QueuedRequest } from '../offline/offline-queue.models';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { LiveSyncService } from './live-sync.service';

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
 * used by Feed's breastfeeds and Sleep). They come from the shared poller (`LiveSyncService`): the
 * section's list in `/api/live` is named by its `liveKey`. This device's own actions apply at once
 * through `put` / `remove`; an answer to a request that started before one is ignored, so it can't
 * bring back an older state. Cleared on sign-out.
 *
 * Changes kept on the device (offline, see `OfflineQueueService`) are applied on top of what the
 * server said by the section's `overlay`, as the server will apply them, until the queue has reached
 * the server (then the poller polls at once). Without an overlay, they show once sent.
 */
export abstract class LiveEntriesSync<T extends LiveEntry> {
  private readonly auth = inject(AuthService);
  private readonly queue = inject(OfflineQueueService);
  private readonly user = computed((): UserName | null => {
    const user = this.auth.state()?.user;
    return user ? { id: user.id, displayName: user.displayName } : null;
  });
  private readonly live = inject(LiveSyncService);
  private readonly list = signal<readonly T[]>([]);
  /** Bumped by every local change. */
  private version = 0;

  /** Every baby's live entries, oldest start first. */
  readonly inProgress = this.list.asReadonly();

  /** `liveKey`: the name of the section's list in `/api/live` (e.g. `feeds`). */
  constructor(liveKey: string) {
    effect(() => {
      this.queue.waiting();
      untracked(() => this.applyWaiting());
    });
    this.live.register(liveKey, {
      live: this.inProgress,
      begin: () => {
        const startedAt = this.version;
        return (list) => {
          const user = this.user();
          if (startedAt === this.version && user) {
            this.list.set(this.overlay(list as T[], this.queue.waiting(), user));
          }
        };
      },
      applyWaiting: () => this.applyWaiting(),
      clear: () => {
        this.version++;
        this.list.set([]);
      },
    });
  }

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

  /** Asks the shared poller for the server's lists now; emits once they are in (nothing on failure). */
  refresh(): Observable<void> {
    return this.live.pollNow();
  }

  remove(id: string): void {
    this.version++;
    this.list.update((list) => list.filter((entry) => entry.id !== id));
  }
}
