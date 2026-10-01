import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { sideSeconds } from '../../../core/feeds/breastfeed';
import { Feed } from '../../../core/feeds/feed.models';
import { DurationPipe } from '../../../core/time/duration';
import { NowService } from '../../../core/time/now.service';
import { EntryListItemComponent } from '../../../shared/ui/entry-list-item/entry-list-item.component';
import { FEED_KIND_ICONS } from '../feed-kinds';

/**
 * A feed as an entry list item (spec 05), in the feed card and history: its kind icon, start time and
 * summary: "Formula · 120 ml" for a bottle; for a breastfeed, the total and the per-side split
 * ("Total 8m 30s · L 5m · R 3m 30s", an unused side left out); for solids, the meal type and reaction after
 * the time ("12:00 PM · Lunch · Liked") and the food on one line. Tapping it emits `open`.
 */
@Component({
  selector: 'nala-feed-entry',
  imports: [DurationPipe, EntryListItemComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feed-entry.component.html',
  styleUrl: './feed-entry.component.scss',
})
export class FeedEntryComponent {
  readonly feed = input.required<Feed>();
  readonly open = output<void>();

  private readonly now = inject(NowService).now;

  protected readonly icons = FEED_KIND_ICONS;

  /** Seconds per side of a breastfeed; a live one's running side ticks. */
  protected readonly sides = computed(() => {
    const feed = this.feed();
    const now = this.now();
    return {
      left: Math.floor(sideSeconds(feed, 'left', now)),
      right: Math.floor(sideSeconds(feed, 'right', now)),
    };
  });
}
