import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/** One number field of a `nala-number-fields-row`; `name` is its input's test id. */
export interface NumberField {
  name: string;
  label: string;
  control: FormControl<number | null>;
}

/**
 * Number fields side by side in one row of an entry sheet (spec 08: Left ml / Right ml, later Growth's
 * measurements): an outlined M3 text field per field, with its label, the numeric keyboard and the unit
 * `suffix`; an invalid field shows `error` under it.
 */
@Component({
  selector: 'nala-number-fields-row',
  imports: [MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './number-fields-row.component.html',
  styleUrl: './number-fields-row.component.scss',
})
export class NumberFieldsRowComponent {
  readonly fields = input.required<readonly NumberField[]>();
  readonly suffix = input('');
  readonly min = input<number | null>(null);
  readonly max = input<number | null>(null);
  readonly error = input('');
}
