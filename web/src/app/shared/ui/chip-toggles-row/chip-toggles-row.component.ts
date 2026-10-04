import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { TranslocoPipe } from '@jsverse/transloco';
import { map, merge, startWith, switchMap } from 'rxjs';
import { FormRowComponent } from '../form-row/form-row.component';

/**
 * Independent on/off toggles in an entry sheet (spec 04: filter chips for a multi choice, e.g. Wet /
 * Dirty): a form row with its label and one filter chip per control, in the order of `controls`. Each
 * chip is selected while its own boolean control is on; tapping it switches only that control, so
 * any number of chips can be on, none included. Each chip's text is `optionLabel + key` translated,
 * and its test id `name-key`.
 */
@Component({
  selector: 'nala-chip-toggles-row',
  imports: [FormRowComponent, MatChipsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chip-toggles-row.component.html',
  styleUrl: './chip-toggles-row.component.scss',
})
export class ChipTogglesRowComponent {
  readonly label = input.required<string>();
  /** Prefix of the chips' test ids. */
  readonly name = input.required<string>();
  /** Translation key prefix of the toggles (e.g. `diaper.toggle.`). */
  readonly optionLabel = input.required<string>();
  /** One boolean control per chip, by key. */
  readonly controls = input.required<Record<string, FormControl<boolean>>>();

  protected readonly keys = computed(() => Object.keys(this.controls()));

  /** The keys of the controls that are on. */
  protected readonly value = toSignal(
    toObservable(this.controls).pipe(
      switchMap((controls) =>
        merge(...Object.values(controls).map((control) => control.valueChanges)).pipe(
          startWith(null),
          map(() => Object.keys(controls).filter((key) => controls[key].value)),
        ),
      ),
    ),
    { initialValue: [] as string[] },
  );

  protected choose(change: MatChipListboxChange): void {
    const on = new Set(change.value as string[]);
    for (const [key, control] of Object.entries(this.controls())) {
      if (control.value !== on.has(key)) {
        control.setValue(on.has(key));
        control.markAsDirty();
        control.markAsTouched();
      }
    }
  }
}
