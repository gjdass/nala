import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { MatPseudoCheckboxModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenu, MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';

/** An option of a choice menu. */
export interface ChoiceOption<T> {
  value: T;
  /** Translation key of the option's text. */
  labelKey: string;
  /** Material Symbols name, shown before the text. */
  icon?: string;
  /** A divider is drawn before this option. */
  dividerBefore?: boolean;
}

/**
 * A single-choice menu (`menuitemradio` rows with a minimal checkbox on the current one) that closes
 * once an option is picked. Open it from a trigger with `[matMenuTriggerFor]="choice.menu()"`.
 */
@Component({
  selector: 'nala-choice-menu',
  imports: [MatDividerModule, MatIconModule, MatMenuModule, MatPseudoCheckboxModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './choice-menu.component.html',
  styleUrl: './choice-menu.component.scss',
})
export class ChoiceMenuComponent<T> {
  readonly options = input.required<readonly ChoiceOption<T>[]>();
  readonly value = input.required<T>();
  /** Translation key of the menu's accessible name. */
  readonly ariaLabel = input.required<string>();
  /** `data-testid` of the option rows. */
  readonly optionTestId = input('choice-option');
  readonly valueChange = output<T>();

  readonly menu = viewChild.required<MatMenu>('menu');
}
