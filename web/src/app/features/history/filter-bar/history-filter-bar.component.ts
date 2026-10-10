import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatPseudoCheckboxModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { SectionKey } from '../../../core/sections/section.models';
import { HISTORY_WINDOWS, HistoryWindow } from '../history-filters';

/** A section in the sections menu, in the home order. */
export interface FilterBarSection {
  key: SectionKey;
  /** Material Symbols name. */
  icon: string;
  /** Visible on home: listed first; the hidden ones follow after a divider. */
  visible: boolean;
}

/**
 * History's filter bar (spec 11): two filter chips opening a menu each. The time window's menu is a
 * single choice and closes once one is picked; the sections' menu of checkboxes stays open while
 * sections are picked, and the last selected section can't be unselected.
 */
@Component({
  selector: 'nala-history-filter-bar',
  imports: [
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatPseudoCheckboxModule,
    NgTemplateOutlet,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history-filter-bar.component.html',
  styleUrl: './history-filter-bar.component.scss',
})
export class HistoryFilterBarComponent {
  readonly window = input.required<HistoryWindow>();
  readonly selected = input.required<readonly SectionKey[]>();
  /** Every registered section, in the home order. */
  readonly sections = input.required<readonly FilterBarSection[]>();
  readonly windowChange = output<HistoryWindow>();
  /** The new selection, in the menu's order. */
  readonly selectedChange = output<SectionKey[]>();

  protected readonly windows = HISTORY_WINDOWS;
  protected readonly visible = computed(() => this.sections().filter((s) => s.visible));
  protected readonly hidden = computed(() => this.sections().filter((s) => !s.visible));

  protected isSelected(key: SectionKey): boolean {
    return this.selected().includes(key);
  }

  /** The only selected section stays selected. */
  protected locked(key: SectionKey): boolean {
    return this.selected().length === 1 && this.isSelected(key);
  }

  /** Toggles a section without closing the menu. */
  protected toggle(event: Event, key: SectionKey): void {
    event.stopPropagation();
    if (this.locked(key)) {
      return;
    }
    const selected = this.isSelected(key);
    this.selectedChange.emit(
      this.sections()
        .map((s) => s.key)
        .filter((k) => (k === key ? !selected : this.isSelected(k))),
    );
  }
}
