import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Feed } from '../../core/feeds/feed.models';
import { FeedService } from '../../core/feeds/feed.service';
import { HistorySource } from '../../core/history/history-source.models';
import { HistoryPage } from '../../core/sections/section.models';
import { FeedEntryComponent } from './feed-entry/feed-entry.component';

/** The Feed section (spec 05) as History lists it (spec 11): timed by its start, opened in its kind's sheet. */
@Injectable({ providedIn: 'root' })
export class FeedHistorySource implements HistorySource<Feed> {
  private readonly api = inject(FeedService);
  readonly item = FeedEntryComponent;

  page(babyId: string, cursor: string | null, limit: number): Observable<HistoryPage<Feed>> {
    return this.api.page(babyId, cursor, limit);
  }

  time(entry: Feed): Date {
    return new Date(entry.startTime);
  }

  kind(entry: Feed): string {
    return entry.kind;
  }

  inputs(entry: Feed): Record<string, unknown> {
    return { feed: entry };
  }
}
