import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subscription, filter } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { isStillFeeding } from '../../../core/feeds/breastfeed';
import { BreastfeedSyncService } from '../../../core/feeds/breastfeed-sync.service';
import { BreastSide, Feed } from '../../../core/feeds/feed.models';
import { FeedService } from '../../../core/feeds/feed.service';
import { onReload } from '../../../core/refresh/data-refresh.service';
import { loadRecentEntries } from '../../../core/sections/recent-entries';
import { NowService } from '../../../core/time/now.service';
import { TimeSincePipe } from '../../../core/time/time-since';
import { BannerComponent } from '../../../shared/ui/banner/banner.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
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
 * A live breastfeed (on any device, see `BreastfeedSyncService`) changes nothing in the highlight
 * (no timer on the card, spec 04): it is listed with its live total and the timer button opens it.
 * The card reloads when a feed becomes live and once it is stopped or deleted anywhere.
 * Reloads after an entry is added, edited or deleted, when another baby is selected, and
 * on the reload signal (spec 04 Refresh on return).
 */
@Component({
  selector: 'nala-feed-card',
  imports: [
    BannerComponent,
    EmptyStateComponent,
    FeedEntryComponent,
    MatIconModule,
    SectionCardComponent,
    SectionEntryDirective,
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
    onReload(() => this.reload());
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
}
