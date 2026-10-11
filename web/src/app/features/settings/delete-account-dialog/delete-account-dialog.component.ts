import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AccountService } from '../../../core/account/account.service';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { CurrentFamilyService } from '../../../core/families/current-family.service';
import { errorCode } from '../../auth/auth.validators';

/**
 * Confirms account deletion with the password; closes with `true` once the account is deleted. A family admin is first
 * warned that the families they administer, listed with their babies, will be deleted with them (spec 02).
 */
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
  private readonly families = inject(CurrentFamilyService);
  private readonly babies = inject(SelectedBabyService);

  /** The families the user administers, in the families order, each with its babies' names. */
  protected readonly doomedFamilies = computed(() =>
    (this.families.families() ?? [])
      .filter((family) => family.isAdmin)
      .map((family) => ({
        id: family.id,
        name: family.name,
        babies: (this.babies.babies() ?? [])
          .filter((baby) => baby.familyId === family.id)
          .map((baby) => baby.name),
      })),
  );

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
