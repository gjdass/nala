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

/** The five percentile values of a reference at a date, drawn as bands behind the line. */
export interface LineBandSample {
  date: string;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
}

interface Drawn {
  key: string;
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const X_LABELS = 5;
/** Two band labels closer than this (percent of the plot's height, about a label's line) overlap. */
const LABEL_GAP = 10;
/** Band labels stay this far (percent of the plot's height) inside its top and bottom edges. */
const LABEL_INSET = 6;

/**
 * A line chart of dated values (spec 12), hand-made SVG from the theme tokens of the scheme it sits in:
 * the x axis runs from `from` to `to`, a point per value at its date, joined by a line from two points;
 * the y axis fits the values, the top labelled with the max and the bottom with the min. Markers sit
 * along the x axis. Tapping a point or a marker (or Enter on it) shows its label above the chart;
 * tapping anywhere else hides it. Coordinates are percentages, so the dots stay round at any width.
 * Optional percentile `bands` are drawn behind the line (outer 3rd–97th and inner 15th–85th fills, a
 * dashed median, "3" / "50" / "97" at the right edge), hidden from assistive technologies; with them
 * the y axis fits the values and the outer band.
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
  readonly bands = input<readonly LineBandSample[] | null>(null);
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  readonly format = input.required<(value: number) => string>();
  readonly lang = input('en');

  private readonly span = computed(() => dayNumber(this.to()) - dayNumber(this.from()));

  private readonly range = computed(() => {
    const values = this.points().map((p) => p.value);
    const bands = this.bands() ?? [];
    const lows = [...values, ...bands.map((b) => b.p3)];
    const highs = [...values, ...bands.map((b) => b.p97)];
    return lows.length ? { min: Math.min(...lows), max: Math.max(...highs) } : null;
  });
  protected readonly maxLabel = computed(() => {
    const range = this.range();
    return range ? this.format()(range.max) : null;
  });
  protected readonly minLabel = computed(() => {
    const range = this.range();
    return range ? this.format()(range.min) : null;
  });

  protected readonly drawnPoints = computed(() =>
    this.points().map((point, index) => ({
      key: `p${index}`,
      label: point.label,
      x: this.x(point.date),
      y: this.y(point.value),
    })),
  );

  /** The bands' paths in the plot's 0–100 box, and their labels at the right edge. */
  protected readonly drawnBands = computed(() => {
    const bands = this.bands();
    if (!bands?.length) {
      return null;
    }
    const at = (key: keyof Omit<LineBandSample, 'date'>) =>
      bands.map((b) => `${round(this.x(b.date))} ${round(this.y(b[key]))}`);
    const fill = (top: keyof LineBandSample, bottom: keyof LineBandSample) => {
      const upper = at(top as 'p97');
      const lower = at(bottom as 'p3').reverse();
      return `M ${upper.join(' L ')} L ${lower.join(' L ')} Z`;
    };
    const last = bands[bands.length - 1];
    const label = (text: string, value: number) => ({
      text,
      y: round(Math.min(100 - LABEL_INSET, Math.max(LABEL_INSET, this.y(value)))),
    });
    let labels = [label('97', last.p97), label('50', last.p50), label('3', last.p3)];
    const clashes = (a: { y: number }, b: { y: number }) => Math.abs(a.y - b.y) < LABEL_GAP;
    if (clashes(labels[1], labels[0]) || clashes(labels[1], labels[2])) {
      labels = [labels[0], labels[2]];
    }
    if (clashes(labels[0], labels[labels.length - 1]) && labels.length > 1) {
      labels = [labels[0]];
    }
    return {
      outer: fill('p97', 'p3'),
      inner: fill('p85', 'p15'),
      median: `M ${at('p50').join(' L ')}`,
      labelX: round(this.x(last.date)),
      labels,
    };
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
    if (!(
      target &&
      this.host.nativeElement.contains(target) &&
      target.closest('.point, .marker')
    )) {
      this.selected.set(null);
    }
  }

  /** A value's height in the plot, in percent from the top: centred when there's a single value. */
  private y(value: number): number {
    const range = this.range();
    return !range || range.max === range.min
      ? 50
      : ((range.max - value) / (range.max - range.min)) * 100;
  }

  /** A date's place across the period, in percent. */
  private x(date: string): number {
    const span = this.span();
    return span > 0 ? ((dayNumber(date) - dayNumber(this.from())) / span) * 100 : 50;
  }
}

/** Path coordinates to two decimals, so the markup stays short. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A calendar date as a day count, so daylight saving changes don't shift positions. */
function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}
