import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule, ValidatorFn } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { errorCode } from '../../../core/forms/error-code';

/** Same rule as the API (`Nala.Core/Families/FamilyName`): trimmed, 1 to 50 characters. */
export const FAMILY_NAME_MAX_LENGTH = 50;

export const familyName: ValidatorFn = (control) => {
  const value = ((control.value ?? '') as string).trim();
  if (!value) {
    return { required: true };
  }
  return value.length <= FAMILY_NAME_MAX_LENGTH ? null : { tooLong: true };
};

export function createFamilyNameControl(value = ''): FormControl<string> {
  return new FormControl(value, { nonNullable: true, validators: familyName });
}

/** A family's name field (setup, invitation to create a family, rename), errors `families.errors.name.<code>`. */
@Component({
  selector: 'nala-family-name-field',
  imports: [MatFormFieldModule, MatInputModule, ReactiveFormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './family-name-field.component.html',
  styleUrl: './family-name-field.component.scss',
})
export class FamilyNameFieldComponent {
  readonly control = input.required<FormControl<string>>();

  protected readonly errorCode = errorCode;
}
