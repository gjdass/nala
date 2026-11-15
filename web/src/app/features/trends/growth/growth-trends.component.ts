import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { BabyAgePipe } from '../../../core/babies/baby-age.pipe';
import { Sex } from '../../../core/babies/baby.models';
import {
  GrowthMeasure,
  GrowthReference,
  REFERENCE_MAX_AGE_DAYS,
  percentilesAt,
} from '../../../core/growth-reference/growth-reference';
import { GrowthReferenceService } from '../../../core/growth-reference/growth-reference.service';
import { MeasurementPipe } from '../../../core/growth-entries/measurement';
import { formatDate, parseDate } from '../../../core/time/local-date';
import { EntryDatePipe } from '../../../core/time/entry-time';
import { GrowthTrendPoint, GrowthTrends } from '../../../core/trends/trends.models';
import { onReload } from '../../../core/refresh/data-refresh.service';
import { TrendsService } from '../../../core/trends/trends.service';
import {
  LineBandSample,
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
  /** The WHO percentile bands behind the line, or null when none are drawn. */
  bands: LineBandSample[] | null;
}

const MEASURES: readonly {
  key: Measure;
  title: string;
  unit: 'g' | 'cm';
  reference: GrowthMeasure;
  /** From the reference's unit (kg or cm) to the points' (g or cm). */
  scale: number;
}[] = [
  { key: 'weightG', title: 'growth.card.weight', unit: 'g', reference: 'weight', scale: 1000 },
  { key: 'lengthCm', title: 'growth.card.length', unit: 'cm', reference: 'length', scale: 1 },
  {
    key: 'headCircumferenceCm',
    title: 'growth.card.head',
    unit: 'cm',
    reference: 'head',
    scale: 1,
  },
];

/** About how many dates the bands are sampled at across the period. */
const BAND_SAMPLES = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Growth's trends (spec 12): a line chart per measure (Weight, Length, Head) of the period's values,
 * the birth measurement first when in the period; each point reads its date, value and the baby's age
 * then. The milestones are markers on the Weight chart, which shows for them even without a weight.
 * For a girl or a boy, each chart with a point shows the WHO percentile bands of their sex behind the
 * line, from the birth date and up to 1826 days of age, with one caption under the cards; for an
 * unspecified sex, a hint to set it. Turning the percentiles off hides them all. The reference loads
 * only when bands are to be drawn; when it can't, the charts show without bands.
 */
@Component({
  selector: 'nala-growth-trends',
  imports: [LineChartComponent, MetricCardComponent, TrendsLoadStateComponent, TranslocoPipe],
  providers: [BabyAgePipe, EntryDatePipe, MeasurementPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './growth-trends.component.html',
  styleUrls: ['../trends-cards.scss', './growth-trends.component.scss'],
})
export class GrowthTrendsComponent extends TrendsLoader<GrowthTrends> {
  private readonly trends = inject(TrendsService);
  private readonly age = inject(BabyAgePipe);
  private readonly entryDate = inject(EntryDatePipe);
  private readonly measurement = inject(MeasurementPipe);
  private readonly growthReference = inject(GrowthReferenceService);

  /** The baby's birth date (`yyyy-MM-dd`), for the age at each point and the bands. */
  readonly birthDate = input.required<string>();
  /** The baby's sex, which picks the percentile reference (none for an unspecified sex). */
  readonly sex = input.required<Sex>();
  /** The baby's name, for the hint to set the sex. */
  readonly name = input.required<string>();
  /** The Percentiles chip: off, no bands, caption nor hint, and the reference isn't loaded. */
  readonly percentiles = input(true);

  /** The reference's sex when bands are to be drawn, else null. */
  protected readonly referenceSex = computed(() => {
    const sex = this.sex();
    return !this.percentiles() || sex === 'unspecified' ? null : sex;
  });

  /** The hint to set the sex: percentiles on, but no reference to pick. */
  protected readonly sexHint = computed(() => this.percentiles() && this.sex() === 'unspecified');

  /** The WHO reference, loaded only when bands are to be drawn. */
  private readonly reference = rxResource({
    params: () => (this.referenceSex() ? true : undefined),
    stream: () => this.growthReference.reference(),
  });

  constructor() {
    super();
    onReload(() => {
      if (this.reference.error()) {
        this.reference.reload();
      }
    });
  }

  protected readonly from = computed(() => formatDate(this.period().from));
  protected readonly to = computed(() => formatDate(this.period().to));

  protected readonly cards = computed((): GrowthCard[] => {
    this.lang();
    const measurements = this.data.hasValue() ? this.data.value().measurements : [];
    return MEASURES.map(({ key, title, unit, reference, scale }) => {
      const format = (value: number) => this.measurement.transform(value, unit);
      const measured = measurements.filter((m) => m[key] !== null);
      const latest = measured.at(-1);
      return {
        key,
        title: this.transloco.translate(title),
        format,
        bands: measured.length ? this.bands(reference, scale) : null,
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
        m.milestone === 'custom'
          ? m.title
          : this.transloco.translate(`growth.milestone.${m.milestone}`)
      }`,
    }));
  });

  /** Whether a chart draws bands: then one caption under all the cards says what they are. */
  protected readonly hasBands = computed(() => this.cards().some((card) => card.bands));

  /** The caption under the cards when a chart has bands: the source and the sex. */
  protected readonly caption = computed(() => {
    this.lang();
    const sex = this.referenceSex();
    return sex ? this.transloco.translate(`trends.percentiles.caption.${sex}`) : '';
  });

  protected load(babyId: string, period: TrendsPeriod) {
    return this.trends.growth(babyId, period);
  }

  /**
   * A measure's percentile values at about 60 dates across the period, from the birth date at the
   * earliest up to the reference's last age, in the points' unit; null when nothing is to be drawn.
   */
  private bands(measure: GrowthMeasure, scale: number): LineBandSample[] | null {
    const sex = this.referenceSex();
    const reference: GrowthReference | undefined = this.reference.hasValue()
      ? this.reference.value()
      : undefined;
    if (!sex || !reference) {
      return null;
    }
    const birth = dayNumber(this.birthDate());
    const first = Math.max(dayNumber(this.from()), birth);
    const last = Math.min(dayNumber(this.to()), birth + REFERENCE_MAX_AGE_DAYS);
    if (first > last) {
      return null;
    }
    const span = last - first;
    const days = [
      ...new Set(
        Array.from(
          { length: BAND_SAMPLES },
          (_, i) => first + Math.round((i * span) / (BAND_SAMPLES - 1)),
        ),
      ),
    ];
    return days.flatMap((day) => {
      const values = percentilesAt(reference, sex, measure, day - birth);
      return values
        ? [
            {
              date: new Date(day * DAY_MS).toISOString().slice(0, 10),
              p3: values.p3 * scale,
              p15: values.p15 * scale,
              p50: values.p50 * scale,
              p85: values.p85 * scale,
              p97: values.p97 * scale,
            },
          ]
        : [];
    });
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

/** A calendar date (`yyyy-MM-dd`) as a day count, so daylight saving changes don't shift ages. */
function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}
