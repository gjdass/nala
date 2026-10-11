import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { parseDate } from '../../../core/time/local-date';

/** A measurement on a line chart: its date, its value and the text its tap shows. */
export interface LinePoint {
  date: string;
  value: number;
  label: string;
}

/** An event marked along the x axis (a milestone), with the text its tap shows. */
export interface LineMarker {
  date: string;
  label: string;
}

interface Drawn {
  key: string;
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const X_LABELS = 5;

/**
 * A line chart of dated values (spec 12), hand-made SVG from the theme tokens of the scheme it sits in:
 * the x axis runs from `from` to `to`, a point per value at its date, joined by a line from two points;
 * the y axis fits the values, the top labelled with the max and the bottom with the min. Markers sit
 * along the x axis. Tapping a point or a marker (or Enter on it) shows its label above the chart;
 * tapping anywhere else hides it. Coordinates are percentages, so the dots stay round at any width.
 */
@Component({
  selector: 'nala-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './line-chart.component.html',
  styleUrl: './line-chart.component.scss',
  host: { '(document:click)': 'hideOutside($event)' },
})
export class LineChartComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly points = input.required<readonly LinePoint[]>();
  readonly markers = input<readonly LineMarker[]>([]);
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  readonly format = input.required<(value: number) => string>();
  readonly lang = input('en');

  private readonly span = computed(() => dayNumber(this.to()) - dayNumber(this.from()));

  private readonly range = computed(() => {
    const values = this.points().map((p) => p.value);
    return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
  });
  protected readonly maxLabel = computed(() => {
    const range = this.range();
    return range ? this.format()(range.max) : null;
  });
  protected readonly minLabel = computed(() => {
    const range = this.range();
    return range ? this.format()(range.min) : null;
  });

  protected readonly drawnPoints = computed(() => {
    const range = this.range();
    return this.points().map((point, index) => ({
      key: `p${index}`,
      label: point.label,
      x: this.x(point.date),
      y:
        !range || range.max === range.min
          ? 50
          : ((range.max - point.value) / (range.max - range.min)) * 100,
    }));
  });

  protected readonly segments = computed(() =>
    this.drawnPoints()
      .slice(1)
      .map((point, index) => ({ from: this.drawnPoints()[index], to: point })),
  );

  protected readonly drawnMarkers = computed(() =>
    this.markers().map((marker, index) => ({
      key: `m${index}`,
      label: marker.label,
      x: this.x(marker.date),
    })),
  );

  /** About five dates spread over the period, the month on the first one and at each change. */
  protected readonly xLabels = computed(() => {
    const span = this.span();
    const from = parseDate(this.from());
    const full = new Intl.DateTimeFormat(this.lang(), { month: 'short', day: 'numeric' });
    const short = new Intl.DateTimeFormat(this.lang(), { day: 'numeric' });
    const offsets = [
      ...new Set(
        Array.from({ length: X_LABELS }, (_, i) => Math.round((i * span) / (X_LABELS - 1))),
      ),
    ];
    let month = -1;
    return offsets.map((offset) => {
      const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
      const text = (date.getMonth() !== month ? full : short).format(date);
      month = date.getMonth();
      return { text, left: span > 0 ? (offset / span) * 100 : 50 };
    });
  });

  /** The tapped point or marker, hidden again when the data changes. */
  protected readonly selected = linkedSignal<unknown, Drawn | null>({
    source: () => [this.points(), this.markers()],
    computation: () => null,
  });

  protected select(item: Drawn): void {
    this.selected.set(item);
  }

  protected hideOutside(event: Event): void {
    const target = event.target as Element | null;
    if (
      !(target && this.host.nativeElement.contains(target) && target.closest('.point, .marker'))
    ) {
      this.selected.set(null);
    }
  }

  /** A date's place across the period, in percent. */
  private x(date: string): number {
    const span = this.span();
    return span > 0 ? ((dayNumber(date) - dayNumber(this.from())) / span) * 100 : 50;
  }
}

/** A calendar date as a day count, so daylight saving changes don't shift positions. */
function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}
