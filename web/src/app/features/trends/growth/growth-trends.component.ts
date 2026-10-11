import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BabyAgePipe } from '../../../core/babies/baby-age.pipe';
import { MeasurementPipe } from '../../../core/growth-entries/measurement';
import { formatDate, parseDate } from '../../../core/time/local-date';
import { EntryDatePipe } from '../../../core/time/entry-time';
import { GrowthTrendPoint, GrowthTrends } from '../../../core/trends/trends.models';
import { TrendsService } from '../../../core/trends/trends.service';
import {
  LineChartComponent,
  LineMarker,
  LinePoint,
} from '../../../shared/ui/line-chart/line-chart.component';
import { TrendsLoadStateComponent } from '../load-state/trends-load-state.component';
import { MetricCardComponent } from '../metric-card/metric-card.component';
import { TrendsLoader } from '../trends-loader';
import { TrendsPeriod } from '../trends-period';

type Measure = 'weightG' | 'lengthCm' | 'headCircumferenceCm';

/** A measure's card: its points in the period and the headline (its latest value, then its date). */
interface GrowthCard {
  key: Measure;
  title: string;
  points: LinePoint[];
  headline: string;
  detail: string;
  format: (value: number) => string;
}

const MEASURES: readonly { key: Measure; title: string; unit: 'g' | 'cm' }[] = [
  { key: 'weightG', title: 'growth.card.weight', unit: 'g' },
  { key: 'lengthCm', title: 'growth.card.length', unit: 'cm' },
  { key: 'headCircumferenceCm', title: 'growth.card.head', unit: 'cm' },
];

/**
 * Growth's trends (spec 12): a line chart per measure (Weight, Length, Head) of the period's values,
 * the birth measurement first when in the period; each point reads its date, value and the baby's age
 * then. The milestones are markers on the Weight chart, which shows for them even without a weight.
 */
@Component({
  selector: 'nala-growth-trends',
  imports: [LineChartComponent, MetricCardComponent, TrendsLoadStateComponent],
  providers: [BabyAgePipe, EntryDatePipe, MeasurementPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './growth-trends.component.html',
  styleUrl: '../trends-cards.scss',
})
export class GrowthTrendsComponent extends TrendsLoader<GrowthTrends> {
  private readonly trends = inject(TrendsService);
  private readonly age = inject(BabyAgePipe);
  private readonly entryDate = inject(EntryDatePipe);
  private readonly measurement = inject(MeasurementPipe);

  /** The baby's birth date (`yyyy-MM-dd`), for the age at each point. */
  readonly birthDate = input.required<string>();

  protected readonly from = computed(() => formatDate(this.period().from));
  protected readonly to = computed(() => formatDate(this.period().to));

  protected readonly cards = computed((): GrowthCard[] => {
    this.lang();
    const measurements = this.data.hasValue() ? this.data.value().measurements : [];
    return MEASURES.map(({ key, title, unit }) => {
      const format = (value: number) => this.measurement.transform(value, unit);
      const measured = measurements.filter((m) => m[key] !== null);
      const latest = measured.at(-1);
      return {
        key,
        title: this.transloco.translate(title),
        format,
        points: measured.map((m) => ({
          date: m.date,
          value: m[key]!,
          label: `${this.dayLabel(m.date)}: ${format(m[key]!)} · ${this.ageAt(m)}`,
        })),
        headline: latest ? format(latest[key]!) : this.transloco.translate('trends.noValue'),
        detail: latest ? this.dateOf(latest) : '',
      };
    });
  });

  protected readonly milestones = computed((): LineMarker[] => {
    this.lang();
    const milestones = this.data.hasValue() ? this.data.value().milestones : [];
    return milestones.map((m) => ({
      date: m.date,
      label: `${this.dayLabel(m.date)}: ${
        m.milestone === 'custom' ? m.title : this.transloco.translate(`growth.milestone.${m.milestone}`)
      }`,
    }));
  });

  protected load(babyId: string, period: TrendsPeriod) {
    return this.trends.growth(babyId, period);
  }

  /** "Sat, Oct 3". */
  private dayLabel(date: string): string {
    return new Intl.DateTimeFormat(this.lang(), {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(parseDate(date));
  }

  private ageAt(point: GrowthTrendPoint): string {
    return point.birth
      ? this.transloco.translate('growth.card.birth')
      : this.age.transform(this.birthDate(), parseDate(point.date));
  }

  /** The headline's date: spec 04's entry date format, or "Birth". */
  private dateOf(point: GrowthTrendPoint): string {
    return point.birth
      ? this.transloco.translate('growth.card.birth')
      : this.entryDate.transform(parseDate(point.date));
  }
}
