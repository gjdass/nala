import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/**
 * One number field of a `nala-number-fields-row`; `name` is its input's test id. Its own `suffix`,
 * `min`, `max`, `step` (1 by default; a decimal step brings the decimal keyboard) and `error` replace
 * the row's, e.g. Growth's kg / cm / cm in one row (spec 10).
 */
export interface NumberField {
  name: string;
  label: string;
  control: FormControl<number | null>;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
}

/**
 * Number fields side by side in one row of an entry sheet (spec 08: Left ml / Right ml, spec 10: Growth's
 * measurements): an outlined M3 text field per field, with its label, the numeric keyboard and the unit
 * `suffix`; an invalid field shows `error` under it. Each field may carry its own unit, bounds, step and error.
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

  protected inputMode(field: NumberField): string {
    return Number.isInteger(field.step ?? 1) ? 'numeric' : 'decimal';
  }
}
