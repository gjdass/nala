import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthCardComponent } from '../../../shared/ui/auth-card/auth-card.component';
import { email, errorCode } from '../auth.validators';

/** "Forgot password": asks for the account email; the confirmation never tells whether it has an account. */
@Component({
  selector: 'nala-forgot-password',
  imports: [
    AuthCardComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forgot-password.page.html',
  styleUrl: './forgot-password.page.scss',
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: email }),
  });
  private readonly email = this.form.controls.email;
  protected readonly pending = signal(false);
  protected readonly formError = signal<string | null>(null);
  /** The email the link was requested for, once the request is sent. */
  protected readonly sentTo = signal<string | null>(null);

  protected emailError(): string | null {
    return errorCode(this.email);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.pending()) {
      return;
    }
    const value = this.email.value.trim();
    this.pending.set(true);
    this.formError.set(null);
    this.auth.requestPasswordReset({ email: value }).subscribe((result) => {
      this.pending.set(false);
      if (result.ok) {
        this.sentTo.set(value);
      } else if (result.errors['email']) {
        this.email.setErrors({ server: result.errors['email'] });
      } else {
        this.formError.set(result.errors['form'] ?? 'unknown');
      }
    });
  }
}
