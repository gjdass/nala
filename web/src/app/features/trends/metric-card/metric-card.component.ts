import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { sectionScheme } from '../../../core/sections/section-scheme';
import { SectionKey } from '../../../core/sections/section.models';

/**
 * A Trends metric card (spec 12), in its section's colour scheme: the title, the headline for the whole
 * period ("per day" by default) and the projected chart, or "Nothing logged in this period" when the
 * period has no data day.
 */
@Component({
  selector: 'nala-metric-card',
  imports: [MatCardModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './metric-card.component.html',
  styleUrl: './metric-card.component.scss',
})
export class MetricCardComponent {
  readonly section = input.required<SectionKey>();
  readonly title = input.required<string>();
  readonly headline = input('');
  readonly perDay = input(true);
  readonly empty = input(false);

  protected readonly scheme = computed(() => sectionScheme(this.section()));
}
