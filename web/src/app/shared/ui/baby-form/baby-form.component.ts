import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { Baby, BabyFields, Sex } from '../../../core/babies/baby.models';

// Same rules as the API (Nala.Core/Babies/BabyFields). Error keys are the API's codes, so both map
// to babies.errors.<field>.<code>.

export const BABY_NAME_MAX_LENGTH = 50;

export type BabyForm = FormGroup<{
  name: FormControl<string>;
  birthDate: FormControl<Date | null>;
  sex: FormControl<Sex>;
  birthWeightG: FormControl<number | null>;
  birthLengthCm: FormControl<number | null>;
  birthHeadCircumferenceCm: FormControl<number | null>;
}>;

type MeasurementField = 'birthWeightG' | 'birthLengthCm' | 'birthHeadCircumferenceCm';

const MEASUREMENTS: { field: MeasurementField; unit: 'g' | 'cm' }[] = [
  { field: 'birthWeightG', unit: 'g' },
  { field: 'birthLengthCm', unit: 'cm' },
  { field: 'birthHeadCircumferenceCm', unit: 'cm' },
];

const name: ValidatorFn = (control): ValidationErrors | null => {
  const value = ((control.value ?? '') as string).trim();
  if (!value) {
    return { required: true };
  }
  return value.length <= BABY_NAME_MAX_LENGTH ? null : { tooLong: true };
};

/** Not after the device's local today. */
const birthDate: ValidatorFn = (control): ValidationErrors | null => {
  const value = control.value as Date | null;
  if (!value) {
    return { required: true };
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return value.getTime() <= today.getTime() ? null : { inFuture: true };
};

/** Optional; within [min, max] with at most `decimals` decimals. */
function measurement(min: number, max: number, decimals: number): ValidatorFn {
  return (control): ValidationErrors | null => {
    const value = control.value as number | null;
    if (value === null || value === undefined) {
      return null;
    }
    const factor = 10 ** decimals;
    if (Math.abs(Math.round(value * factor) - value * factor) > 1e-6) {
      return { invalid: true };
    }
    return value >= min && value <= max ? null : { outOfRange: true };
  };
}

/** Empty to add a baby, pre-filled with `baby` to edit it. */
export function createBabyForm(baby?: Baby): BabyForm {
  return new FormGroup({
    name: new FormControl(baby?.name ?? '', { nonNullable: true, validators: name }),
    birthDate: new FormControl<Date | null>(baby ? localDate(baby.birthDate) : null, {
      validators: birthDate,
    }),
    sex: new FormControl<Sex>(baby?.sex ?? 'unspecified', { nonNullable: true }),
    birthWeightG: new FormControl<number | null>(baby?.birthWeightG ?? null, {
      validators: measurement(300, 7000, 0),
    }),
    birthLengthCm: new FormControl<number | null>(baby?.birthLengthCm ?? null, {
      validators: measurement(20, 70, 1),
    }),
    birthHeadCircumferenceCm: new FormControl<number | null>(
      baby?.birthHeadCircumferenceCm ?? null,
      { validators: measurement(15, 50, 1) },
    ),
  });
}

/** Local midnight of a `yyyy-MM-dd` date, as the datepicker holds it. */
function localDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** `yyyy-MM-dd` from the date's local calendar day. */
function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The API fields of a valid form. */
export function babyFields(form: BabyForm): BabyFields {
  const value = form.getRawValue();
  return {
    name: value.name.trim(),
    birthDate: isoDate(value.birthDate!),
    sex: value.sex,
    birthWeightG: value.birthWeightG ?? null,
    birthLengthCm: value.birthLengthCm ?? null,
    birthHeadCircumferenceCm: value.birthHeadCircumferenceCm ?? null,
  };
}

/** The codes this form shows; the datepicker's own keys (e.g. `matDatepickerMax`) duplicate them. */
const CODES = ['required', 'tooLong', 'inFuture', 'outOfRange', 'invalid'];

/** Name, birth date, sex and birth measurements of a baby (add and edit). */
@Component({
  selector: 'nala-baby-form',
  imports: [
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './baby-form.component.html',
  styleUrl: './baby-form.component.scss',
})
export class BabyFormComponent {
  readonly form = input.required<BabyForm>();

  protected readonly sexes: Sex[] = ['girl', 'boy', 'unspecified'];
  protected readonly measurements = MEASUREMENTS;

  /** The calendar can't go past today. */
  protected readonly today = new Date();

  /** A server code set as `{ server: code }` first, else the form's own code. */
  protected errorOf(control: AbstractControl): string | null {
    const errors = control.errors;
    if (!errors) {
      return null;
    }
    if ('server' in errors) {
      return errors['server'] as string;
    }
    return CODES.find((code) => code in errors) ?? null;
  }
}
