import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { filter } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { Feed } from '../../../core/feeds/feed.models';
import { FeedService } from '../../../core/feeds/feed.service';
import { HistoryPageLoader } from '../../../core/sections/section.models';
import { EntrySheetResult } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { HistoryListComponent } from '../../../shared/ui/history-list/history-list.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { FeedEntryComponent } from '../feed-entry/feed-entry.component';

/**
 * The Feed history page's list (spec 05): the selected baby's feeds page by page, newest first; an
 * entry edited or deleted from it is updated in place.
 */
@Component({
  selector: 'nala-feed-history',
  imports: [FeedEntryComponent, HistoryListComponent, SectionEntryDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feed-history.component.html',
})
export class FeedHistoryComponent {
  private readonly feeds = inject(FeedService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);
  private readonly list = viewChild<HistoryListComponent<Feed>>(HistoryListComponent);

  protected readonly loader = computed((): HistoryPageLoader<Feed> | null => {
    const babyId = this.store.selected()?.id;
    return babyId ? (cursor) => this.feeds.page(babyId, cursor) : null;
  });

  protected edit(feed: Feed): void {
    this.entrySheets
      .edit('feed', feed.kind, feed)
      .pipe(filter((result) => result !== undefined))
      .subscribe((result) => this.list()?.apply(result as EntrySheetResult<Feed>));
  }
}
