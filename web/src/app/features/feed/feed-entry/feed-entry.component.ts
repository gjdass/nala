import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Feed } from '../../../core/feeds/feed.models';
import { EntryListItemComponent } from '../../../shared/ui/entry-list-item/entry-list-item.component';
import { FEED_KIND_ICONS } from '../feed-kinds';

/**
 * A feed as an entry list item (spec 05), in the feed card and history: its kind icon, start time and
 * summary: "Formula · 120 ml" for a bottle; for solids, the meal type and reaction after the time
 * ("12:00 PM Lunch · Liked") and the food on up to 2 lines. Tapping it emits `open`.
 */
@Component({
  selector: 'nala-feed-entry',
  imports: [EntryListItemComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feed-entry.component.html',
  styleUrl: './feed-entry.component.scss',
})
export class FeedEntryComponent {
  readonly feed = input.required<Feed>();
  readonly open = output<void>();

  protected readonly icons = FEED_KIND_ICONS;
}
