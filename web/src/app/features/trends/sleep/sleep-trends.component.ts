import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HighlightDurationPipe } from '../../../core/time/highlight-duration';
import { SleepTrendDay } from '../../../core/trends/trends.models';
import { TrendsService } from '../../../core/trends/trends.service';
import { BarChartComponent } from '../../../shared/ui/bar-chart/bar-chart.component';
import { TrendsLoadStateComponent } from '../load-state/trends-load-state.component';
import { MetricCardComponent } from '../metric-card/metric-card.component';
import { TrendsPeriod } from '../trends-period';
import { TrendsSection } from '../trends-section';
import { dailyAverage } from '../trends-stats';

/**
 * Sleep's trends (spec 12): the Sleep card (night and day stacked) and the Longest sleep card (on the
 * days a sleep starts), headlines averaged over the past data days.
 */
@Component({
  selector: 'nala-sleep-trends',
  imports: [BarChartComponent, MetricCardComponent, TranslocoPipe, TrendsLoadStateComponent],
  providers: [HighlightDurationPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sleep-trends.component.html',
  styleUrl: '../trends-cards.scss',
})
export class SleepTrendsComponent extends TrendsSection<SleepTrendDay> {
  private readonly trends = inject(TrendsService);
  private readonly duration = inject(HighlightDurationPipe);

  protected readonly format = (seconds: number) => this.duration.transform(seconds);

  protected readonly series = this.seriesOf(['trends.night', 'trends.day']);
  protected readonly longestSeries = this.seriesOf(['trends.cards.longestSleep']);

  protected readonly sleepBars = computed(() =>
    this.bars((day) => [day.nightSeconds, day.daySeconds]),
  );
  protected readonly sleepHeadline = computed(() =>
    this.headline(
      dailyAverage(this.loaded(), (d) => d.daySeconds + d.nightSeconds, this.todayDate()),
      this.format,
    ),
  );

  protected readonly longestBars = computed(() =>
    this.bars((day) => (day.longestSeconds === null ? null : [day.longestSeconds])),
  );
  protected readonly longestEmpty = computed(() =>
    this.loaded().every((day) => day.longestSeconds === null),
  );
  protected readonly longestHeadline = computed(() =>
    this.headline(
      dailyAverage(this.loaded(), (d) => d.longestSeconds, this.todayDate()),
      this.format,
    ),
  );

  protected load(babyId: string, period: TrendsPeriod) {
    return this.trends.sleeps(babyId, period);
  }
}
