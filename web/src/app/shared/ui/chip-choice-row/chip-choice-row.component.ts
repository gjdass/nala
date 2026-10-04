import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { TranslocoPipe } from '@jsverse/transloco';
import { startWith, switchMap } from 'rxjs';
import { FormRowComponent } from '../form-row/form-row.component';

/**
 * An optional single choice in an entry sheet (spec 04: filter chips, e.g. meal type, reaction): a form
 * row with its label and one filter chip per option. Tapping a chip selects it; tapping the selected
 * one clears the choice, and the control gets null. Each chip's text is `optionLabel + option`
 * translated, or the option as it is without an `optionLabel` (e.g. free-text names), and its test id
 * `name-option`. With a `dotToken` (a CSS custom-property prefix, e.g.
 * `--nala-stool-`), each chip also shows a small dot in the colour `var(<dotToken><option>)`, kept in
 * the label so it stays visible next to the selected chip's checkmark. An `error` shows under the chips.
 * Not `clearable`, tapping the selected chip keeps it.
 */
@Component({
  selector: 'nala-chip-choice-row',
  imports: [FormRowComponent, MatChipsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chip-choice-row.component.html',
  styleUrl: './chip-choice-row.component.scss',
})
export class ChipChoiceRowComponent<T extends string = string> {
  readonly label = input.required<string>();
  /** Prefix of the chips' test ids. */
  readonly name = input.required<string>();
  /** Translation key prefix of the options (e.g. `feed.mealType.`); null shows the options as they are. */
  readonly optionLabel = input<string | null>(null);
  readonly options = input.required<readonly T[]>();
  readonly control = input.required<FormControl<T | null>>();
  /** CSS custom-property prefix of a colour dot per option; no dots when null. */
  readonly dotToken = input<string | null>(null);
  /** False keeps the choice when the selected chip is tapped again (it then never becomes null by a tap). */
  readonly clearable = input(true);
  /** Shown under the chips when set (e.g. a unit required by an amount). */
  readonly error = input<string | null>(null);

  protected readonly value = toSignal(
    toObservable(this.control).pipe(
      switchMap((control) => control.valueChanges.pipe(startWith(control.value))),
    ),
  );

  protected choose(change: MatChipListboxChange): void {
    const control = this.control();
    control.setValue((change.value as T | undefined) ?? null);
    control.markAsDirty();
    control.markAsTouched();
  }
}
