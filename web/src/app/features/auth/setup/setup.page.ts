import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { Lang } from '../../../core/i18n/initial-lang';
import { AuthCardComponent } from '../../../shared/ui/auth-card/auth-card.component';
import { displayName, email, errorCode, newPassword } from '../auth.validators';

type Field = 'email' | 'displayName' | 'password';

/** First-run setup: creates the instance's admin account, then opens the app. */
@Component({
  selector: 'nala-setup',
  imports: [
    AuthCardComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './setup.page.html',
  styleUrl: './setup.page.scss',
})
export class SetupPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: email }),
    displayName: new FormControl('', { nonNullable: true, validators: displayName }),
    password: new FormControl('', { nonNullable: true, validators: newPassword }),
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
    this.auth
      .setup({
        email: value.email.trim(),
        displayName: value.displayName.trim(),
        password: value.password,
        language: this.transloco.getActiveLang() as Lang,
      })
      .subscribe((result) => {
        if (result.ok || result.errors['form'] === 'alreadySetUp') {
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
