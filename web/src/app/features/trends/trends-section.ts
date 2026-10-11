import { Directive, computed } from '@angular/core';
import { formatDate } from '../../core/time/local-date';
import { BarDatum } from '../../shared/ui/bar-chart/bar-chart.component';
import { TrendsLoader } from './trends-loader';
import { bucketBars, bucketOf, firstDayOfWeek } from './trends-stats';

/**
 * What every bucketed Trends section (spec 12) shares on top of its loading: its data days, a bar per
 * day, week or month, and headlines that read "–" when no past data day is left.
 */
@Directive()
export abstract class TrendsSection<TDay extends { date: string }> extends TrendsLoader<TDay[]> {
  protected readonly todayDate = computed(() => formatDate(this.today()));
  protected readonly bucket = computed(() => bucketOf(this.period()));
  /** The loaded days; none while loading or on an error (the hidden cards still read them). */
  protected readonly loaded = computed(() => (this.data.hasValue() ? this.data.value() : []));

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
