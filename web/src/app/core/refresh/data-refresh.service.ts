import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { OfflineQueueService } from '../offline/offline-queue.service';

/** How long the app must stay hidden for coming back to it to reload the data. */
export const RESUME_AWAY_MS = 30_000;

/**
 * The app-wide reload signal (spec 04 Refresh on return): each bump of `reload` means "reload your
 * data". Bumped while signed in when the user comes back to the app after at least 30 s away, when
 * the network comes back, and once changes kept on the device (offline) have reached the server.
 * While changes wait on the device, coming back sends nothing: the queue is sent first, and its
 * arrival bumps the signal.
 */
@Injectable({ providedIn: 'root' })
export class DataRefreshService {
  private readonly auth = inject(AuthService);
  private readonly queue = inject(OfflineQueueService);
  private readonly document = inject(DOCUMENT);
  private readonly count = signal(0);
  private hiddenAt: number | null = null;

  /** Bumped each time the sections should reload their data. */
  readonly reload = this.count.asReadonly();

  constructor() {
    let sent = this.queue.sent();
    effect(() => {
      const now = this.queue.sent();
      untracked(() => {
        if (now !== sent) {
          sent = now;
          this.bump();
        }
      });
    });
    const window = this.document.defaultView;
    const onOnline = () => this.resume();
    const onVisibility = () => {
      if (this.document.visibilityState !== 'visible') {
        this.hiddenAt = Date.now();
        return;
      }
      const hiddenAt = this.hiddenAt;
      this.hiddenAt = null;
      if (hiddenAt !== null && Date.now() - hiddenAt >= RESUME_AWAY_MS) {
        this.resume();
      }
    };
    window?.addEventListener('online', onOnline);
    this.document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      window?.removeEventListener('online', onOnline);
      this.document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  /** The user is back: reload, unless the queue's arrival will. */
  private resume(): void {
    if (this.queue.pending() === 0) {
      this.bump();
    }
  }

  private bump(): void {
    if (this.auth.state()?.user) {
      this.count.update((n) => n + 1);
    }
  }
}

/** Calls `reload` on each reload signal (not at once). Call it in an injection context. */
export function onReload(reload: () => void): void {
  const signal = inject(DataRefreshService).reload;
  let seen = signal();
  effect(() => {
    const now = signal();
    untracked(() => {
      if (now !== seen) {
        seen = now;
        reload();
      }
    });
  });
}
