import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthCardComponent } from '../../../shared/ui/auth-card/auth-card.component';
import { errorCode, newPassword } from '../auth.validators';

type View =
  | { kind: 'loading' }
  | { kind: 'form'; email: string }
  /** The link can't be used: `code` is a form error (`resetLinkExpired`…, or `unknown` when offline). */
  | { kind: 'unavailable'; code: string };

/** A form error that means the link itself can no longer be used. */
const isLinkRefusal = (code: string) => code.startsWith('resetLink');

/** Opened from a password reset link: sets the new password, consumes the link, then opens the app signed in. */
@Component({
  selector: 'nala-reset-password',
  imports: [
    AuthCardComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reset-password.page.html',
  styleUrl: './reset-password.page.scss',
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

  protected readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: newPassword }),
  });
  private readonly password = this.form.controls.password;
  protected readonly view = signal<View>({ kind: 'loading' });
  protected readonly pending = signal(false);
  protected readonly formError = signal<string | null>(null);

  constructor() {
    this.auth
      .lookupResetLink(this.token)
      .subscribe((lookup) =>
        this.view.set(
          lookup.ok
            ? { kind: 'form', email: lookup.link.email }
            : { kind: 'unavailable', code: lookup.code },
        ),
      );
  }

  protected passwordError(): string | null {
    return errorCode(this.password);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.formError.set(null);
    this.auth.resetPassword(this.token, { password: this.password.value }).subscribe((result) => {
      if (result.ok) {
        void this.router.navigateByUrl('/');
        return;
      }
      this.pending.set(false);
      const code = result.errors['form'];
      if (result.errors['password']) {
        this.password.setErrors({ server: result.errors['password'] });
      } else if (code && isLinkRefusal(code)) {
        // Used or expired since the page opened.
        this.view.set({ kind: 'unavailable', code });
      } else {
        this.formError.set(code ?? 'unknown');
      }
    });
  }
}
