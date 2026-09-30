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
 * translated, and its test id `name-option`.
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
  /** Translation key prefix of the options (e.g. `feed.mealType.`). */
  readonly optionLabel = input.required<string>();
  readonly options = input.required<readonly T[]>();
  readonly control = input.required<FormControl<T | null>>();

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
