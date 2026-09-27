import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { Lang } from '../../../core/i18n/initial-lang';
import { AuthCardComponent } from '../../../shared/ui/auth-card/auth-card.component';
import {
  AccountFieldsComponent,
  createAccountForm,
} from '../account-fields/account-fields.component';

type View =
  | { kind: 'loading' }
  | { kind: 'form'; invitedBy: string }
  /** The link can't be used: `code` is a form error (`invitationExpired`…, or `unknown` when offline). */
  | { kind: 'unavailable'; code: string };

/** Opened from an invitation link: creates the account, consumes the invitation, then opens the app. */
@Component({
  selector: 'nala-register',
  imports: [
    AccountFieldsComponent,
    AuthCardComponent,
    MatButtonModule,
    MatProgressBarModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.page.html',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

  protected readonly form = createAccountForm();
  protected readonly view = signal<View>({ kind: 'loading' });
  protected readonly pending = signal(false);
  protected readonly formError = signal<string | null>(null);

  constructor() {
    this.auth
      .lookupInvitation(this.token)
      .subscribe((lookup) =>
        this.view.set(
          lookup.ok
            ? { kind: 'form', invitedBy: lookup.invitation.invitedBy }
            : { kind: 'unavailable', code: lookup.code },
        ),
      );
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
      .register(this.token, {
        email: value.email.trim(),
        displayName: value.displayName.trim(),
        password: value.password,
        language: this.transloco.getActiveLang() as Lang,
      })
      .subscribe((result) => {
        if (result.ok) {
          void this.router.navigateByUrl('/');
          return;
        }
        for (const [field, code] of Object.entries(result.errors)) {
          if (field !== 'form') {
            this.form.get(field)?.setErrors({ server: code });
          } else if (code?.startsWith('invitation')) {
            // Used, expired or revoked since the page opened.
            this.view.set({ kind: 'unavailable', code });
          } else {
            this.formError.set(code ?? null);
          }
        }
        this.pending.set(false);
      });
  }
}
