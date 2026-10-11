import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PumpTrendDay } from '../../../core/trends/trends.models';
import { TrendsService } from '../../../core/trends/trends.service';
import { BarChartComponent } from '../../../shared/ui/bar-chart/bar-chart.component';
import { TrendsLoadStateComponent } from '../load-state/trends-load-state.component';
import { MetricCardComponent } from '../metric-card/metric-card.component';
import { formatCount, formatMl } from '../trends-format';
import { TrendsPeriod } from '../trends-period';
import { TrendsSection } from '../trends-section';
import { dailyAverage } from '../trends-stats';

/**
 * Pump's trends (spec 12): the Pumped card (ml, left and right stacked) and the Sessions card, on the day
 * each session starts, headlines averaged over the past data days.
 */
@Component({
  selector: 'nala-pump-trends',
  imports: [BarChartComponent, MetricCardComponent, TranslocoPipe, TrendsLoadStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pump-trends.component.html',
  styleUrl: '../trends-cards.scss',
})
export class PumpTrendsComponent extends TrendsSection<PumpTrendDay> {
  private readonly trends = inject(TrendsService);

  protected readonly formatMl = (value: number) => formatMl(value, this.lang());
  protected readonly formatCount = (value: number) => formatCount(value, this.lang());

  protected readonly pumpedSeries = this.seriesOf(['trends.left', 'trends.right']);
  protected readonly sessionsSeries = this.seriesOf(['trends.cards.sessions']);

  protected readonly pumpedBars = computed(() => this.bars((day) => [day.leftMl, day.rightMl]));
  protected readonly pumpedHeadline = computed(() =>
    this.headline(
      dailyAverage(this.loaded(), (d) => d.leftMl + d.rightMl, this.todayDate()),
      this.formatMl,
    ),
  );

  protected readonly sessionsBars = computed(() => this.bars((day) => [day.sessions]));
  protected readonly sessionsHeadline = computed(() =>
    this.headline(
      dailyAverage(this.loaded(), (d) => d.sessions, this.todayDate()),
      this.formatCount,
    ),
  );

  protected load(babyId: string, period: TrendsPeriod) {
    return this.trends.pumps(babyId, period);
  }
}
