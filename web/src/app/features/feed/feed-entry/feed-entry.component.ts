import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { sideSeconds } from '../../../core/feeds/breastfeed';
import { Feed } from '../../../core/feeds/feed.models';
import { DurationPipe } from '../../../core/time/duration';
import { EntryListItemComponent } from '../../../shared/ui/entry-list-item/entry-list-item.component';
import { FEED_KIND_ICONS } from '../feed-kinds';

/**
 * A feed as an entry list item (spec 05), in the feed card and history: its kind icon, start time and
 * summary: "Formula · 120 ml" for a bottle; for a breastfeed, the duration bar, the total and the
 * per-side split ("L 5m · R 3m 30s", an unused side left out); for solids, the meal type and reaction after the time
 * ("12:00 PM Lunch · Liked") and the food on up to 2 lines. Tapping it emits `open`.
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

  protected readonly icons = FEED_KIND_ICONS;

  /** Seconds per side of a breastfeed (listed ones are saved, so every segment has its end). */
  protected readonly sides = computed(() => {
    const feed = this.feed();
    const now = Date.now();
    return { left: sideSeconds(feed, 'left', now), right: sideSeconds(feed, 'right', now) };
  });
}
