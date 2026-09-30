import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subscription, filter } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { BreastSide, Feed } from '../../../core/feeds/feed.models';
import { FeedService } from '../../../core/feeds/feed.service';
import { TimeSincePipe } from '../../../core/time/time-since';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import {
  RECENT_ENTRIES,
  SectionCardComponent,
} from '../../../shared/ui/section-card/section-card.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { FeedEntryComponent } from '../feed-entry/feed-entry.component';

/**
 * The Feed card on home (spec 05): the selected baby's recent feeds in the shared section card, with
 * "Last feeding" and the time since the latest feed started, on the right the side the latest saved
 * breastfeed ended on ("last side", hidden without one), or an empty state without any feed.
 * Reloads after an entry is added, edited or deleted, and when another baby is selected.
 */
@Component({
  selector: 'nala-feed-card',
  imports: [
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

  /** Newest first; null while loading. */
  protected readonly entries = signal<readonly Feed[] | null>(null);
  protected readonly lastSide = signal<BreastSide | null>(null);
  private request?: Subscription;
  private stateRequest?: Subscription;

  constructor() {
    effect(() => {
      const baby = this.store.selected();
      untracked(() => {
        this.entries.set(null);
        this.lastSide.set(null);
        if (baby) {
          this.load(baby.id);
        }
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
    this.request = this.feeds
      .page(babyId, null, RECENT_ENTRIES)
      .subscribe({ next: (page) => this.entries.set(page.entries) });
    this.stateRequest?.unsubscribe();
    this.stateRequest = this.feeds
      .breastfeedState(babyId)
      .subscribe((state) => this.lastSide.set(state.lastSide));
  }
}
