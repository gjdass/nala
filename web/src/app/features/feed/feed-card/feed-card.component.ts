import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable, Subscription, filter } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { isStillFeeding, runningSide, sideSeconds } from '../../../core/feeds/breastfeed';
import { BreastfeedSyncService } from '../../../core/feeds/breastfeed-sync.service';
import { BreastSide, Feed, FeedResult } from '../../../core/feeds/feed.models';
import { FeedService } from '../../../core/feeds/feed.service';
import { OfflineQueueService } from '../../../core/offline/offline-queue.service';
import { loadRecentEntries } from '../../../core/sections/recent-entries';
import { NowService } from '../../../core/time/now.service';
import { TimeSincePipe } from '../../../core/time/time-since';
import { BannerComponent } from '../../../shared/ui/banner/banner.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { SplitTimerComponent } from '../../../shared/ui/split-timer/split-timer.component';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { FeedEntryComponent } from '../feed-entry/feed-entry.component';

/**
 * The Feed card on home (spec 05): the selected baby's feeds of the last 24 hours (at least the 3
 * most recent) in the shared section card, a live breastfeed included with its live total, with
 * "Last feeding" and the time since the latest feed started, on the right the side the latest
 * breastfeed that isn't live ended on ("last side", hidden without one), or an empty state without any
 * feed. A breastfeed live for more than 3 hours shows "Still feeding?", whose Review opens it.
 *
 * While the baby has a live breastfeed (on any device, see `BreastfeedSyncService`), the highlight is
 * replaced by "Feeding" (opens the sheet) and both sides' live durations with their Start/Stop: the
 * running side's Stop stops the feed (an ordinary feed again), the other side's Start switches
 * (offline too: the tap is kept on the device and shows at once). The card reloads when a feed
 * becomes live and once it is stopped or deleted anywhere.
 * Reloads after an entry is added, edited or deleted, when another baby is selected, and once
 * changes kept on the device (offline) have been sent.
 */
@Component({
  selector: 'nala-feed-card',
  imports: [
    BannerComponent,
    EmptyStateComponent,
    FeedEntryComponent,
    MatButtonModule,
    MatIconModule,
    SectionCardComponent,
    SectionEntryDirective,
    SplitTimerComponent,
    TimeSincePipe,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feed-card.component.html',
  styleUrl: './feed-card.component.scss',
})
export class FeedCardComponent {
  private readonly feeds = inject(FeedService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);
  private readonly now = inject(NowService).now;
  private readonly sync = inject(BreastfeedSyncService);
  private readonly queue = inject(OfflineQueueService);

  /** Newest first; null while loading. */
  private readonly loaded = signal<readonly Feed[] | null>(null);
  /** The loaded feeds, a live one as the shared state has it now (switched or edited on any device). */
  protected readonly entries = computed(
    () =>
      this.loaded()?.map((feed) => this.sync.inProgress().find((f) => f.id === feed.id) ?? feed) ??
      null,
  );
  protected readonly lastSide = signal<BreastSide | null>(null);
  /** The selected baby's live breastfeed. */
  protected readonly inProgress = computed(() => {
    const baby = this.store.selected();
    return baby ? this.sync.forBaby(baby.id) : null;
  });
  protected readonly running = computed(() => {
    const feed = this.inProgress();
    return feed ? runningSide(feed) : null;
  });
  protected readonly left = computed(() => this.seconds('left'));
  protected readonly right = computed(() => this.seconds('right'));
  /** Sending a Start or Stop. */
  protected readonly busy = signal(false);
  protected readonly stillFeeding = computed(() => {
    const feed = this.inProgress();
    return feed && isStillFeeding(feed, this.now()) ? feed : null;
  });
  private request?: Subscription;
  private stateRequest?: Subscription;

  constructor() {
    effect(() => {
      const baby = this.store.selected();
      untracked(() => {
        this.loaded.set(null);
        this.lastSide.set(null);
        if (baby) {
          this.load(baby.id);
        }
      });
    });
    // Changes kept on the device (offline) have reached the server.
    let sent = this.queue.sent();
    effect(() => {
      const now = this.queue.sent();
      untracked(() => {
        if (now !== sent) {
          sent = now;
          this.reload();
        }
      });
    });
    // Started, stopped or deleted on any device: listed from its first Start, then its entry and the
    // last side change.
    let shown: { babyId: string; id: string | null } | null = null;
    effect(() => {
      const babyId = this.store.selected()?.id ?? null;
      const id = this.inProgress()?.id ?? null;
      untracked(() => {
        if (babyId && shown?.babyId === babyId && shown.id !== id) {
          this.load(babyId);
        }
        shown = babyId ? { babyId, id } : null;
      });
    });
  }

  protected start(side: BreastSide): void {
    const feed = this.inProgress()!;
    this.send(feed, this.feeds.startSide(feed.id, feed.babyId, side, new Date().toISOString()));
  }

  protected stop(): void {
    const feed = this.inProgress()!;
    this.send(feed, this.feeds.stopSide(feed.id, new Date().toISOString()));
  }

  protected reload(): void {
    const baby = this.store.selected();
    if (baby) {
      this.load(baby.id);
    }
  }

  protected edit(feed: Feed): void {
    this.entrySheets
      .edit('feed', feed.kind, feed)
      .pipe(filter((result) => result !== undefined))
      .subscribe(() => this.reload());
  }

  private load(babyId: string): void {
    this.request?.unsubscribe();
    this.request = loadRecentEntries(
      (cursor) => this.feeds.page(babyId, cursor),
      (feed) => feed.startTime,
      new Date(),
    ).subscribe({ next: (entries) => this.loaded.set(entries) });
    this.stateRequest?.unsubscribe();
    this.stateRequest = this.feeds.breastfeedState(babyId).subscribe((state) => {
      this.lastSide.set(state.lastSide);
    });
  }

  /** Sends a tap on `feed`: applies the answer, or the tap itself once kept on the device (offline). */
  private send(feed: Feed, request: Observable<FeedResult>): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    request.subscribe((result) => {
      this.busy.set(false);
      if (result.ok && result.queued) {
        this.sync.applyWaiting(feed);
      } else if (result.ok) {
        this.sync.put(result.feed);
      }
    });
  }

  private seconds(side: BreastSide): number {
    const feed = this.inProgress();
    return feed ? Math.floor(sideSeconds(feed, side, this.now())) : 0;
  }
}
