import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthCardComponent } from '../../../shared/ui/auth-card/auth-card.component';
import { email, errorCode } from '../auth.validators';

type Field = 'email' | 'password';

/** Email + password login; the error never says which of the two is wrong. */
@Component({
  selector: 'nala-login',
  imports: [
    AuthCardComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: email }),
    // No length rule here: it only applies when choosing a password.
    password: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  protected readonly pending = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected errorOf(field: Field): string | null {
    return errorCode(this.form.controls[field]);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    this.pending.set(true);
    this.formError.set(null);
    this.auth.login({ email: value.email.trim(), password: value.password }).subscribe((result) => {
      if (result.ok) {
        void this.router.navigateByUrl('/');
        return;
      }
      for (const [field, code] of Object.entries(result.errors)) {
        if (field === 'form') {
          this.formError.set(code ?? null);
        } else {
          this.form.get(field)?.setErrors({ server: code });
        }
      }
      this.pending.set(false);
    });
  }
}
