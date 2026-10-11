import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  ChoiceMenuComponent,
  ChoiceOption,
} from '../../../shared/ui/choice-menu/choice-menu.component';
import { MenuSection, splitByVisibility } from '../../../core/sections/section-menu';
import { TrendsSection } from '../trends-filters';
import { TRENDS_RANGES, TrendsRange } from '../trends-period';

/**
 * Trends' filter bar (spec 12): the Section and Range chips, each opening a single-choice menu, then
 * the period navigation (‹ label ›), on the same row and wrapping when it doesn't fit.
 */
@Component({
  selector: 'nala-trends-filter-bar',
  imports: [
    ChoiceMenuComponent,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatMenuModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trends-filter-bar.component.html',
  styleUrl: './trends-filter-bar.component.scss',
})
export class TrendsFilterBarComponent {
  readonly section = input.required<TrendsSection>();
  readonly range = input.required<TrendsRange>();
  /** The sections with trends, in the home order. */
  readonly sections = input.required<readonly MenuSection[]>();
  /** The current period's dates. */
  readonly label = input.required<string>();
  readonly canGoBack = input.required<boolean>();
  readonly canGoForward = input.required<boolean>();
  /** False when the period can't be moved (Since birth): the label stays, the arrows go. */
  readonly navigable = input.required<boolean>();

  readonly sectionChange = output<TrendsSection>();
  readonly rangeChange = output<TrendsRange>();
  readonly previous = output<void>();
  readonly next = output<void>();

  protected readonly sectionOptions = computed((): ChoiceOption<TrendsSection>[] => {
    const { visible, hidden } = splitByVisibility(this.sections());
    const options = (list: readonly MenuSection[], divided: boolean) =>
      list.map((s, i) => ({
        value: s.key as TrendsSection,
        labelKey: `sections.${s.key}`,
        icon: s.icon,
        dividerBefore: divided && i === 0,
      }));
    return [...options(visible, false), ...options(hidden, visible.length > 0)];
  });

  protected readonly rangeOptions: ChoiceOption<TrendsRange>[] = TRENDS_RANGES.map((r) => ({
    value: r,
    labelKey: `trends.range.${r}`,
  }));
}
