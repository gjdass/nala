import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DiaperTrendDay } from '../../../core/trends/trends.models';
import { TrendsService } from '../../../core/trends/trends.service';
import { BarChartComponent } from '../../../shared/ui/bar-chart/bar-chart.component';
import { TrendsLoadStateComponent } from '../load-state/trends-load-state.component';
import { MetricCardComponent } from '../metric-card/metric-card.component';
import { formatCount } from '../trends-format';
import { TrendsPeriod } from '../trends-period';
import { TrendsSection } from '../trends-section';
import { dailyAverage } from '../trends-stats';

/**
 * Diaper's trends (spec 12): the Diapers card, wet and dirty side by side (a wet and dirty diaper counts
 * in both), its headline both daily averages over the past data days ("6.4 wet · 2.1 dirty per day").
 */
@Component({
  selector: 'nala-diaper-trends',
  imports: [BarChartComponent, MetricCardComponent, TranslocoPipe, TrendsLoadStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diaper-trends.component.html',
  styleUrl: '../trends-cards.scss',
})
export class DiaperTrendsComponent extends TrendsSection<DiaperTrendDay> {
  private readonly trends = inject(TrendsService);

  protected readonly format = (value: number) => formatCount(value, this.lang());

  protected readonly series = this.seriesOf(['trends.wet', 'trends.dirty']);

  protected readonly diaperBars = computed(() => this.bars((day) => [day.wet, day.dirty]));
  protected readonly diaperHeadline = computed(() => {
    const today = this.todayDate();
    const wet = dailyAverage(this.loaded(), (d) => d.wet, today);
    const dirty = dailyAverage(this.loaded(), (d) => d.dirty, today);
    return wet === null || dirty === null
      ? this.headline(null, this.format)
      : this.transloco.translate('trends.diaperHeadline', {
          wet: this.format(wet),
          dirty: this.format(dirty),
        });
  });

  protected load(babyId: string, period: TrendsPeriod) {
    return this.trends.diapers(babyId, period);
  }
}
