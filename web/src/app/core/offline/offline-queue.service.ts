import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  DestroyRef,
  EnvironmentProviders,
  Injectable,
  Injector,
  computed,
  effect,
  inject,
  provideAppInitializer,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, catchError, map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { QueuedMethod, QueuedRequest, SendOptions, SendOutcome } from './offline-queue.models';

export const QUEUE_STORAGE_KEY = 'nala.offlineQueue';

/** How often requests kept on the device are tried again while some are waiting. */
export const OFFLINE_RETRY_MS = 30_000;

/** No answer at all (offline), or the API behind nginx is down. */
const UNREACHABLE = [0, 502, 503, 504];

const SNACKBAR_MS = 5000;

/**
 * The device's queue of entry changes made offline (spec 05 § Offline), shared by every section.
 * `send` sends a request at once; when the server can't be reached it is kept on the device (in
 * `localStorage`) with the signed-in user and its time, and a snackbar says so. Once one is waiting,
 * the user's next requests queue behind it, so they reach the server in order.
 *
 * The queue is sent oldest first, one request at a time, as its own user only: when that user is
 * signed in (app start, login), back online, the app shown, and every 30 s while some wait. A request
 * the server answers is done; a network failure, a server error or an expired session (401) stops
 * and keeps the rest; a refused one (other 4xx) is dropped with a snackbar, except a delete of an
 * entry already gone, which is done. Re-sending is harmless: entries carry client-generated ids.
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly storage = this.document.defaultView?.localStorage;
  /** Used when the device storage can't be: the queue then lasts for this session only. */
  private memory: QueuedRequest[] = [];
  private readonly queue = signal<readonly QueuedRequest[]>(this.read());
  private readonly userId = computed(() => this.auth.state()?.user?.id ?? null);
  private readonly sentCount = signal(0);
  private sending = false;
  private retry: ReturnType<typeof setInterval> | null = null;

  /** How many requests of the signed-in user wait on the device. */
  readonly pending = computed(() => this.waiting().length);

  /** The signed-in user's waiting requests, oldest first. */
  readonly waiting = computed((): readonly QueuedRequest[] => {
    const userId = this.userId();
    return userId ? this.queue().filter((r) => r.userId === userId) : [];
  });

  /** Bumped each time waiting requests reached the server: lists reload on it. */
  readonly sent = this.sentCount.asReadonly();

  constructor() {
    effect(() => {
      const userId = this.userId();
      untracked(() => userId && this.flush());
    });
    const window = this.document.defaultView;
    const onOnline = () => this.flush();
    const onVisibility = () => this.document.visibilityState === 'visible' && this.flush();
    window?.addEventListener('online', onOnline);
    this.document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      window?.removeEventListener('online', onOnline);
      this.document.removeEventListener('visibilitychange', onVisibility);
      this.stopRetrying();
    });
  }

  /**
   * Sends the request, or keeps it on the device when the server can't be reached (with
   * `options.queuedBody` as its body when given).
   */
  send<T>(
    method: QueuedMethod,
    url: string,
    body: unknown,
    options: SendOptions = {},
  ): Observable<SendOutcome<T>> {
    const keep = () => this.enqueue(method, url, options.queuedBody ?? body, options.quiet);
    if (this.pending() > 0) {
      return of(keep());
    }
    return this.http.request<T>(method, url, { body }).pipe(
      map((sent): SendOutcome<T> => ({ sent })),
      catchError((error: HttpErrorResponse) =>
        of<SendOutcome<T>>(
          UNREACHABLE.includes(error.status) && this.userId() ? keep() : { error },
        ),
      ),
    );
  }

  /** Sends the signed-in user's waiting requests, unless they are being sent already. */
  private flush(): void {
    if (this.sending || !this.userId()) {
      return;
    }
    this.sending = true;
    const drain = () =>
      new Promise<void>((done) =>
        this.sendNext(false, () => {
          this.sending = false;
          done();
        }),
      );
    const locks = this.document.defaultView?.navigator.locks;
    // Another tab of the app may be sending the same queue: one at a time.
    void (locks ? locks.request(QUEUE_STORAGE_KEY, drain) : drain());
  }

  private sendNext(anySent: boolean, done: () => void): void {
    this.queue.set(this.read());
    const userId = this.userId();
    const next = userId ? this.queue().find((r) => r.userId === userId) : undefined;
    if (!next) {
      this.finish(anySent);
      done();
      return;
    }
    this.http.request(next.method, next.url, { body: next.body }).subscribe({
      next: () => {
        this.drop(next.id);
        this.sendNext(true, done);
      },
      error: (error: HttpErrorResponse) => {
        const keep = error.status === 0 || error.status === 401 || error.status >= 500;
        if (keep) {
          this.finish(anySent);
          done();
          return;
        }
        this.drop(next.id);
        const alreadyGone = next.method === 'DELETE' && error.status === 404;
        if (!alreadyGone) {
          this.notify('offline.refused');
        }
        this.sendNext(true, done);
      },
    });
  }

  private finish(anySent: boolean): void {
    if (anySent) {
      this.sentCount.update((n) => n + 1);
    }
    if (this.pending() > 0) {
      this.retry ??= setInterval(() => this.flush(), OFFLINE_RETRY_MS);
    } else {
      this.stopRetrying();
    }
  }

  private enqueue(
    method: QueuedMethod,
    url: string,
    body: unknown,
    quiet = false,
  ): SendOutcome<never> {
    const first = this.pending() === 0;
    const request: QueuedRequest = {
      id: crypto.randomUUID(),
      userId: this.userId()!,
      method,
      url,
      body,
      queuedAt: new Date().toISOString(),
    };
    this.write([...this.read(), request]);
    this.retry ??= setInterval(() => this.flush(), OFFLINE_RETRY_MS);
    if (!quiet || first) {
      this.notify('offline.queued');
    }
    return { queued: true };
  }

  private drop(id: string): void {
    this.write(this.read().filter((r) => r.id !== id));
  }

  private stopRetrying(): void {
    if (this.retry !== null) {
      clearInterval(this.retry);
      this.retry = null;
    }
  }

  /** The snackbar is loaded on first use, keeping it out of the initial bundle. */
  private notify(key: string): void {
    void import('@angular/material/snack-bar').then(({ MatSnackBar }) =>
      this.injector
        .get(MatSnackBar)
        .open(this.transloco.translate(key), undefined, { duration: SNACKBAR_MS }),
    );
  }

  private read(): QueuedRequest[] {
    try {
      const stored = this.storage?.getItem(QUEUE_STORAGE_KEY);
      if (stored !== null && stored !== undefined) {
        const list: unknown = JSON.parse(stored);
        return Array.isArray(list) ? (list as QueuedRequest[]) : [];
      }
      return this.storage ? [] : this.memory;
    } catch {
      return this.memory;
    }
  }

  private write(list: QueuedRequest[]): void {
    this.memory = list;
    this.queue.set(list);
    try {
      if (list.length === 0) {
        this.storage?.removeItem(QUEUE_STORAGE_KEY);
      } else {
        this.storage?.setItem(QUEUE_STORAGE_KEY, JSON.stringify(list));
      }
    } catch {
      // Storage unavailable (private mode, blocked, full): kept for this session only.
    }
  }
}

/** Starts the offline queue with the app, so waiting requests are sent without opening a section. */
export function provideOfflineQueue(): EnvironmentProviders {
  return provideAppInitializer(() => void inject(OfflineQueueService));
}
