import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { Lang } from '../../../core/i18n/initial-lang';
import { AuthCardComponent } from '../../../shared/ui/auth-card/auth-card.component';
import {
  createFamilyNameControl,
  FamilyNameFieldComponent,
} from '../../../shared/ui/family-name-field/family-name-field.component';
import {
  AccountFieldsComponent,
  createAccountForm,
} from '../account-fields/account-fields.component';

/** First-run setup: creates the instance's admin account and its first family, then opens the app. */
@Component({
  selector: 'nala-setup',
  imports: [
    AccountFieldsComponent,
    AuthCardComponent,
    FamilyNameFieldComponent,
    MatButtonModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './setup.page.html',
})
export class SetupPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  protected readonly form = createAccountForm();
  protected readonly familyName = createFamilyNameControl();
  protected readonly pending = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected submit(): void {
    this.form.markAllAsTouched();
    this.familyName.markAsTouched();
    if (this.form.invalid || this.familyName.invalid || this.pending()) {
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
        familyName: this.familyName.value.trim(),
      })
      .subscribe((result) => {
        if (result.ok || result.errors['form'] === 'alreadySetUp') {
          void this.router.navigateByUrl('/');
          return;
        }
        for (const [field, code] of Object.entries(result.errors)) {
          if (field === 'form') {
            this.formError.set(code ?? null);
          } else if (field === 'familyName') {
            this.familyName.setErrors({ server: code });
          } else {
            this.form.get(field)?.setErrors({ server: code });
          }
        }
        this.pending.set(false);
      });
  }
}
