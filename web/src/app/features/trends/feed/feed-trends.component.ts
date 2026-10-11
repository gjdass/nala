import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HighlightDurationPipe } from '../../../core/time/highlight-duration';
import { FeedTrendDay } from '../../../core/trends/trends.models';
import { TrendsService } from '../../../core/trends/trends.service';
import { BarChartComponent } from '../../../shared/ui/bar-chart/bar-chart.component';
import { TrendsLoadStateComponent } from '../load-state/trends-load-state.component';
import { MetricCardComponent } from '../metric-card/metric-card.component';
import { formatCount, formatMl, formatPercent } from '../trends-format';
import { TrendsPeriod } from '../trends-period';
import { TrendsSection } from '../trends-section';
import { dailyAverage } from '../trends-stats';

const breastSeconds = (day: FeedTrendDay) => day.breastSeconds.left + day.breastSeconds.right;

/**
 * Feed's trends (spec 12): the Feeds card (stacked by kind), the Bottle card (ml by milk type), the
 * Breastfeeding card (per side, with the period's left / right split) and the Time between feeds card,
 * headlines averaged over the past data days. The average gap pools every gap of those days.
 */
@Component({
  selector: 'nala-feed-trends',
  imports: [BarChartComponent, MetricCardComponent, TranslocoPipe, TrendsLoadStateComponent],
  providers: [HighlightDurationPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feed-trends.component.html',
  styleUrl: '../trends-cards.scss',
})
export class FeedTrendsComponent extends TrendsSection<FeedTrendDay> {
  private readonly trends = inject(TrendsService);
  private readonly highlight = inject(HighlightDurationPipe);

  protected readonly formatCount = (value: number) => formatCount(value, this.lang());
  protected readonly formatMl = (value: number) => formatMl(value, this.lang());
  protected readonly formatDuration = (seconds: number) => this.highlight.transform(seconds);

  protected readonly feedsSeries = this.seriesOf([
    'trends.breastfeed',
    'trends.bottle',
    'trends.solids',
  ]);
  protected readonly bottleSeries = this.seriesOf(['feed.milkType.breastMilk', 'feed.milkType.formula']);
  protected readonly breastSeries = this.seriesOf(['trends.left', 'trends.right']);
  protected readonly gapSeries = this.seriesOf(['trends.cards.timeBetweenFeeds']);

  protected readonly feedsBars = computed(() =>
    this.bars((d) => [d.count.breastfeed, d.count.bottle, d.count.solids]),
  );
  protected readonly feedsHeadline = computed(() =>
    this.headline(
      dailyAverage(
        this.loaded(),
        (d) => d.count.breastfeed + d.count.bottle + d.count.solids,
        this.todayDate(),
      ),
      this.formatCount,
    ),
  );

  protected readonly bottleBars = computed(() =>
    this.bars((d) => [d.bottleMl.breastMilk, d.bottleMl.formula]),
  );
  protected readonly bottleHeadline = computed(() =>
    this.headline(
      dailyAverage(this.loaded(), (d) => d.bottleMl.breastMilk + d.bottleMl.formula, this.todayDate()),
      this.formatMl,
    ),
  );

  protected readonly breastBars = computed(() =>
    this.bars((d) => [d.breastSeconds.left, d.breastSeconds.right]),
  );
  protected readonly breastHeadline = computed(() =>
    this.headline(dailyAverage(this.loaded(), breastSeconds, this.todayDate()), this.formatDuration),
  );
  /** The period's left / right split over the past data days ("L 47% · R 53%"); none without breastfeeding. */
  protected readonly breastSplit = computed(() => {
    const past = this.loaded().filter((d) => d.date !== this.todayDate());
    const left = past.reduce((sum, d) => sum + d.breastSeconds.left, 0);
    const total = past.reduce((sum, d) => sum + breastSeconds(d), 0);
    if (total === 0) {
      return '';
    }
    const leftPercent = Math.round((left / total) * 100);
    return this.transloco.translate('trends.breastSplit', {
      left: formatPercent(leftPercent / 100, this.lang()),
      right: formatPercent((100 - leftPercent) / 100, this.lang()),
    });
  });

  protected readonly gapBars = computed(() =>
    this.bars((d) => (d.gapCount ? [d.gapSecondsSum / d.gapCount] : null)),
  );
  protected readonly gapEmpty = computed(() => this.loaded().every((d) => d.gapCount === 0));
  protected readonly gapHeadline = computed(() => {
    const past = this.loaded().filter((d) => d.date !== this.todayDate());
    const count = past.reduce((sum, d) => sum + d.gapCount, 0);
    const seconds = past.reduce((sum, d) => sum + d.gapSecondsSum, 0);
    return this.headline(count ? seconds / count : null, this.formatDuration);
  });

  protected load(babyId: string, period: TrendsPeriod) {
    return this.trends.feeds(babyId, period);
  }
}
