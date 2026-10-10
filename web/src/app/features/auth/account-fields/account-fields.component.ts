import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { displayName, email, errorCode, newPassword } from '../auth.validators';

export type AccountForm = FormGroup<{
  email: FormControl<string>;
  displayName: FormControl<string>;
  password: FormControl<string>;
}>;

/** The fields that create an account, with the same rules as the API. */
export function createAccountForm(): AccountForm {
  return new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: email }),
    displayName: new FormControl('', { nonNullable: true, validators: displayName }),
    password: new FormControl('', { nonNullable: true, validators: newPassword }),
  });
}

/** Email, display name and new password fields of an account form (first-run setup, invitation registration). */
@Component({
  selector: 'nala-account-fields',
  imports: [MatFormFieldModule, MatInputModule, ReactiveFormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-fields.component.html',
  styleUrl: './account-fields.component.scss',
})
export class AccountFieldsComponent {
  readonly form = input.required<AccountForm>();
  /** Translation key of the message for an email that already has an account. */
  readonly emailTakenKey = input('auth.errors.email.taken');

  protected emailErrorKey(code: string): string {
    return code === 'taken' ? this.emailTakenKey() : `auth.errors.email.${code}`;
  }

  protected errorOf(control: AbstractControl): string | null {
    return errorCode(control);
  }
}
