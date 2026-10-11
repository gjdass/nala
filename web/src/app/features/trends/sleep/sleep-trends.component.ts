import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { onReload } from '../../../core/refresh/data-refresh.service';
import { formatDate } from '../../../core/time/local-date';
import { HighlightDurationPipe } from '../../../core/time/highlight-duration';
import { SleepTrendDay } from '../../../core/trends/trends.models';
import { TrendsService } from '../../../core/trends/trends.service';
import { BarChartComponent, BarDatum } from '../../../shared/ui/bar-chart/bar-chart.component';
import { MetricCardComponent } from '../metric-card/metric-card.component';
import { TrendsPeriod } from '../trends-period';
import { dailyAverage, periodDays } from '../trends-stats';

/**
 * Sleep's trends (spec 12): the Sleep card (night and day stacked) and the Longest sleep card (on the
 * days a sleep starts), one bar per day, headlines averaged over the past data days. Loads again when
 * the baby or the period changes and on the reload signal, keeping the cards meanwhile.
 */
@Component({
  selector: 'nala-sleep-trends',
  imports: [
    BarChartComponent,
    MatButtonModule,
    MatProgressSpinnerModule,
    MetricCardComponent,
    TranslocoPipe,
  ],
  providers: [HighlightDurationPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sleep-trends.component.html',
  styleUrl: '../trends-cards.scss',
})
export class SleepTrendsComponent {
  private readonly trends = inject(TrendsService);
  private readonly duration = inject(HighlightDurationPipe);
  private readonly transloco = inject(TranslocoService);
  protected readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly babyId = input.required<string>();
  readonly period = input.required<TrendsPeriod>();
  readonly today = input.required<Date>();

  protected readonly days = rxResource({
    params: () => ({ babyId: this.babyId(), period: this.period() }),
    stream: ({ params }) => this.trends.sleeps(params.babyId, params.period),
  });

  protected readonly format = (seconds: number) => this.duration.transform(seconds);

  protected readonly series = computed(() => {
    this.lang();
    return [
      { label: this.transloco.translate('trends.night') },
      { label: this.transloco.translate('trends.day') },
    ];
  });
  protected readonly longestSeries = computed(() => {
    this.lang();
    return [{ label: this.transloco.translate('trends.cards.longestSleep') }];
  });

  private readonly todayDate = computed(() => formatDate(this.today()));
  protected readonly loaded = computed(() => this.days.value() ?? []);

  protected readonly sleepBars = computed(() =>
    this.bars((day) => [day.nightSeconds, day.daySeconds]),
  );
  protected readonly sleepHeadline = computed(() =>
    this.headline(
      dailyAverage(this.loaded(), (d) => d.daySeconds + d.nightSeconds, this.todayDate()),
    ),
  );

  protected readonly longestBars = computed(() =>
    this.bars((day) => (day.longestSeconds === null ? null : [day.longestSeconds])),
  );
  protected readonly longestEmpty = computed(() =>
    this.loaded().every((day) => day.longestSeconds === null),
  );
  protected readonly longestHeadline = computed(() =>
    this.headline(dailyAverage(this.loaded(), (d) => d.longestSeconds, this.todayDate())),
  );

  constructor() {
    onReload(() => this.days.reload());
  }

  /** A slot per day of the period; no bar on a day without data or without a value. */
  private bars(values: (day: SleepTrendDay) => number[] | null): BarDatum[] {
    const byDate = new Map(this.loaded().map((day) => [day.date, day]));
    const today = this.todayDate();
    return periodDays(this.period()).map((date) => {
      const day = byDate.get(date);
      return { date, values: day ? values(day) : null, partial: date === today };
    });
  }

  private headline(average: number | null): string {
    this.lang();
    return average === null
      ? this.transloco.translate('trends.noValue')
      : this.duration.transform(average);
  }
}
