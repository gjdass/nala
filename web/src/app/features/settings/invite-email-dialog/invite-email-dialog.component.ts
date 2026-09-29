import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { InvitationService } from '../../../core/invitations/invitation.service';
import { email, errorCode } from '../../auth/auth.validators';

/** Emails an invitation link to an address; closes with that address once sent. */
@Component({
  selector: 'nala-invite-email-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invite-email-dialog.component.html',
  styleUrl: './invite-email-dialog.component.scss',
})
export class InviteEmailDialogComponent {
  private readonly invitations = inject(InvitationService);
  private readonly dialogRef =
    inject<MatDialogRef<InviteEmailDialogComponent, string>>(MatDialogRef);

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: email }),
  });
  private readonly email = this.form.controls.email;
  protected readonly sending = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected emailError(): string | null {
    return errorCode(this.email);
  }

  protected send(): void {
    this.form.markAllAsTouched();
    if (this.email.invalid || this.sending()) {
      return;
    }
    const address = this.email.value.trim();
    this.sending.set(true);
    this.formError.set(null);
    this.invitations.sendByEmail(address).subscribe((result) => {
      this.sending.set(false);
      if (result.ok) {
        this.dialogRef.close(address);
      } else if (result.errors['email']) {
        this.email.setErrors({ server: result.errors['email'] });
      } else {
        this.formError.set('unknown');
      }
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
