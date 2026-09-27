import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AccountService } from '../../../core/account/account.service';
import { errorCode } from '../../auth/auth.validators';

/** Confirms account deletion with the password; closes with `true` once the account is deleted. */
@Component({
  selector: 'nala-delete-account-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delete-account-dialog.component.html',
  styleUrl: './delete-account-dialog.component.scss',
})
export class DeleteAccountDialogComponent {
  private readonly account = inject(AccountService);
  private readonly dialogRef =
    inject<MatDialogRef<DeleteAccountDialogComponent, boolean>>(MatDialogRef);

  protected readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  private readonly password = this.form.controls.password;
  protected readonly deleting = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected passwordError(): string | null {
    return errorCode(this.password);
  }

  protected confirm(): void {
    this.form.markAllAsTouched();
    if (this.password.invalid || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.formError.set(null);
    this.account.deleteAccount({ password: this.password.value }).subscribe((result) => {
      this.deleting.set(false);
      if (result.ok) {
        this.dialogRef.close(true);
      } else if (result.errors['password']) {
        this.password.setErrors({ server: result.errors['password'] });
      } else {
        this.formError.set(result.errors['form'] ?? 'unknown');
      }
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
