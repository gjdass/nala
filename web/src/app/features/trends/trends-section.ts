import { Directive, computed, inject, input } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { onReload } from '../../core/refresh/data-refresh.service';
import { formatDate } from '../../core/time/local-date';
import { BarDatum } from '../../shared/ui/bar-chart/bar-chart.component';
import { TrendsPeriod } from './trends-period';
import { bucketBars, bucketOf, firstDayOfWeek } from './trends-stats';

/**
 * What every Trends section (spec 12) shares: its data days for the baby and the period, loaded again
 * when either changes and on the reload signal (keeping the cards meanwhile), a bar per day, week or
 * month, and headlines that read "–" when no past data day is left.
 */
@Directive()
export abstract class TrendsSection<TDay extends { date: string }> {
  protected readonly transloco = inject(TranslocoService);
  protected readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly babyId = input.required<string>();
  readonly period = input.required<TrendsPeriod>();
  readonly today = input.required<Date>();

  protected readonly days = rxResource({
    params: () => ({ babyId: this.babyId(), period: this.period() }),
    stream: ({ params }) => this.load(params.babyId, params.period),
  });

  protected readonly todayDate = computed(() => formatDate(this.today()));
  protected readonly bucket = computed(() => bucketOf(this.period()));
  /** The loaded days; none while loading or on an error (the hidden cards still read them). */
  protected readonly loaded = computed(() => (this.days.hasValue() ? this.days.value() : []));

  constructor() {
    onReload(() => this.days.reload());
  }

  /** The section's data days of the period, in date order. */
  protected abstract load(babyId: string, period: TrendsPeriod): Observable<TDay[]>;

  /** A slot per day, week or month of the period; no bar without data or without a value. */
  protected bars(values: (day: TDay) => number[] | null): BarDatum[] {
    return bucketBars(
      this.period(),
      this.loaded(),
      values,
      this.todayDate(),
      this.bucket(),
      firstDayOfWeek(this.lang()),
    );
  }

  /** A headline's value, or "–" when no past data day is left to average. */
  protected headline(average: number | null, format: (value: number) => string): string {
    this.lang();
    return average === null ? this.transloco.translate('trends.noValue') : format(average);
  }

  /** The chart series, labelled in the current language. */
  protected seriesOf(keys: readonly string[]) {
    return computed(() => {
      this.lang();
      return keys.map((key) => ({ label: this.transloco.translate(key) }));
    });
  }
}
