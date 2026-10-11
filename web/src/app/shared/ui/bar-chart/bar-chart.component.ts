import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { parseDate } from '../../../core/time/local-date';

/** What a bar stands for: a day, or the daily average of a week or a month (keyed by its first day). */
export type BarBucket = 'day' | 'week' | 'month';

/** A day of a bar chart: one value per series (stacked), or null when the day has no data (no bar). */
export interface BarDatum {
  date: string;
  values: readonly number[] | null;
  /** Still incomplete (today): drawn lighter. */
  partial?: boolean;
}

export interface BarSeries {
  label: string;
}

interface Bar {
  date: string;
  x: number;
  partial: boolean;
  label: string;
  segments: { y: number; height: number; series: number }[];
}

/** viewBox units of a day's slot and of the plot's height; the SVG stretches to the chart's size. */
const SLOT = 10;
const BAR = 7;
const HEIGHT = 100;

/**
 * A bar chart of days, weeks or months (spec 12), hand-made SVG from the theme tokens of the scheme it
 * sits in: one slot per day (or week, month), a bar per data day with its series stacked (the first at the bottom), none on a day
 * without data, the partial (today) bar lighter. Tapping a bar (or Enter on it) shows its date and
 * values above the chart; tapping anywhere else hides them. Every bar has the same text as its label.
 */
@Component({
  selector: 'nala-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bar-chart.component.html',
  styleUrl: './bar-chart.component.scss',
  host: { '(document:click)': 'hideOutside($event)' },
})
export class BarChartComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);

  readonly bars = input.required<readonly BarDatum[]>();
  readonly series = input.required<readonly BarSeries[]>();
  readonly format = input.required<(value: number) => string>();
  readonly lang = input('en');
  readonly bucket = input<BarBucket>('day');

  protected readonly slot = SLOT;
  protected readonly barWidth = BAR;
  protected readonly barInset = (SLOT - BAR) / 2;
  protected readonly plotHeight = HEIGHT;

  protected readonly viewBox = computed(() => `0 0 ${this.bars().length * SLOT} ${HEIGHT}`);

  private readonly max = computed(() =>
    Math.max(0, ...this.bars().map((bar) => sum(bar.values ?? []))),
  );
  protected readonly maxLabel = computed(() => this.format()(this.max()));

  protected readonly drawn = computed((): Bar[] => {
    const max = this.max();
    const scale = (value: number) => (max > 0 ? (value / max) * HEIGHT : 0);
    return this.bars().flatMap((bar, index) => {
      if (!bar.values) {
        return [];
      }
      let top = HEIGHT;
      const segments = bar.values.map((value, series) => {
        const height = scale(value);
        top -= height;
        return { y: top, height, series };
      });
      return [
        {
          date: bar.date,
          x: index * SLOT,
          partial: !!bar.partial,
          label: this.describe(bar.date, bar.values),
          segments,
        },
      ];
    });
  });

  /**
   * Every slot on a week, else about five labels: days (and weeks) with the month on the first one and
   * at each change, months with the year on the first one and at each change.
   */
  protected readonly xLabels = computed(() => {
    const bars = this.bars();
    const step = bars.length <= 7 ? 1 : Math.ceil(bars.length / 5);
    const months = this.bucket() === 'month';
    const full = new Intl.DateTimeFormat(
      this.lang(),
      months ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric' },
    );
    const short = new Intl.DateTimeFormat(
      this.lang(),
      months ? { month: 'short' } : { day: 'numeric' },
    );
    const unit = (date: Date) => (months ? date.getFullYear() : date.getMonth());
    let previous = -1;
    return bars.flatMap((bar, index) => {
      if (index % step !== 0) {
        return [];
      }
      const date = parseDate(bar.date);
      const text = (unit(date) !== previous ? full : short).format(date);
      previous = unit(date);
      return [{ text, left: ((index + 0.5) / bars.length) * 100 }];
    });
  });

  /** The tapped bar, hidden again when the bars change. */
  protected readonly selected = linkedSignal<readonly BarDatum[], Bar | null>({
    source: this.bars,
    computation: () => null,
  });

  protected select(bar: Bar): void {
    this.selected.set(bar);
  }

  protected hideOutside(event: Event): void {
    const target = event.target as Element | null;
    if (!(target && this.host.nativeElement.contains(target) && target.closest('.bar'))) {
      this.selected.set(null);
    }
  }

  /**
   * "Fri, Oct 9: 13h (Night 10h, Day 3h)", "Week of Oct 4: 11h per day (…)", "July 2026: 11h per day
   * (…)", or without the parenthesis for a single series.
   */
  private describe(date: string, values: readonly number[]): string {
    const format = this.format();
    const bucket = this.bucket();
    const options: Record<BarBucket, Intl.DateTimeFormatOptions> = {
      day: { weekday: 'short', month: 'short', day: 'numeric' },
      week: { month: 'short', day: 'numeric' },
      month: { month: 'long', year: 'numeric' },
    };
    const when = new Intl.DateTimeFormat(this.lang(), options[bucket]).format(parseDate(date));
    const title =
      bucket === 'week' ? this.transloco.translate('trends.weekOf', { date: when }) : when;
    const perDay = bucket === 'day' ? '' : ` ${this.transloco.translate('trends.perDay')}`;
    const series = this.series();
    const parts =
      series.length > 1
        ? ` (${series.map((s, i) => `${s.label} ${format(values[i] ?? 0)}`).join(', ')})`
        : '';
    return `${title}: ${format(sum(values))}${perDay}${parts}`;
  }
}

const sum = (values: readonly number[]) => values.reduce((total, v) => total + v, 0);
