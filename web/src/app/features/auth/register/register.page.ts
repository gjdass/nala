import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Invitation } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { CurrentFamilyService } from '../../../core/families/current-family.service';
import { Lang } from '../../../core/i18n/initial-lang';
import { AuthCardComponent } from '../../../shared/ui/auth-card/auth-card.component';
import {
  AccountFieldsComponent,
  createAccountForm,
} from '../account-fields/account-fields.component';

type View =
  | { kind: 'loading' }
  /** Signed out: create an account from the invitation. */
  | { kind: 'form'; invitation: Invitation }
  /** Signed in: accept the invitation with the current account. */
  | { kind: 'accept'; invitation: Invitation }
  /** The link can't be used: `code` is a form error (`invitationExpired`…, or `unknown` when offline). */
  | { kind: 'unavailable'; code: string };

/**
 * Opened from an invitation link. Signed out: creates the account (or logs in and comes back here); signed in: accepts
 * the invitation with the current account. Either way the invitation is consumed, then the app opens.
 */
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
  private readonly families = inject(CurrentFamilyService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  protected readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

  protected readonly form = createAccountForm();
  protected readonly view = signal<View>({ kind: 'loading' });
  protected readonly pending = signal(false);
  protected readonly formError = signal<string | null>(null);

  constructor() {
    this.auth.lookupInvitation(this.token).subscribe((lookup) => {
      if (!lookup.ok) {
        this.view.set({ kind: 'unavailable', code: lookup.code });
        return;
      }
      const kind = this.auth.state()?.user ? 'accept' : 'form';
      this.view.set({ kind, invitation: lookup.invitation });
    });
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
          } else {
            this.showFormError(code);
          }
        }
        this.pending.set(false);
      });
  }

  /** Joins the family with the current account, then opens the app on it. */
  protected accept(): void {
    if (this.pending()) {
      return;
    }
    this.pending.set(true);
    this.formError.set(null);
    this.auth.acceptInvitation(this.token).subscribe((result) => {
      if (result.ok) {
        this.families.select(result.familyId);
        void this.router.navigateByUrl('/');
        return;
      }
      this.showFormError(result.errors['form']);
      this.pending.set(false);
    });
  }

  /** Leaves the invitation unused. */
  protected notNow(): void {
    void this.router.navigateByUrl('/');
  }

  private showFormError(code: string | undefined): void {
    if (code?.startsWith('invitation')) {
      // Used, expired or revoked since the page opened.
      this.view.set({ kind: 'unavailable', code });
    } else {
      this.formError.set(code ?? null);
    }
  }
}
