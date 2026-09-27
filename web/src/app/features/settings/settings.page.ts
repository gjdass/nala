import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormGroupDirective,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';
import { AccountService } from '../../core/account/account.service';
import { FieldErrors } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { LANGS, Lang } from '../../core/i18n/initial-lang';
import { THEME_MODES, ThemeMode, ThemeService } from '../../core/theme/theme.service';
import { SettingsSectionComponent } from '../../shared/ui/settings-section/settings-section.component';
import { displayName, errorCode, newPassword } from '../auth/auth.validators';

const SNACK_DURATION = 3000;

/** Account (display name, language, password), appearance (theme) and logout. */
@Component({
  selector: 'nala-settings',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink,
    SettingsSectionComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  private readonly account = inject(AccountService);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);

  protected readonly langs = LANGS;
  protected readonly themeModes = THEME_MODES;
  protected readonly language = computed(() => this.auth.state()?.user?.language);
  protected readonly themeMode = this.theme.mode;

  protected readonly profileForm = new FormGroup({
    displayName: new FormControl(this.auth.state()?.user?.displayName ?? '', {
      nonNullable: true,
      validators: displayName,
    }),
  });
  protected readonly passwordForm = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
    newPassword: new FormControl('', { nonNullable: true, validators: newPassword }),
  });
  protected readonly savingProfile = signal(false);
  protected readonly changingPassword = signal(false);

  protected errorOf(form: FormGroup, field: string): string | null {
    return errorCode(form.get(field)!);
  }

  protected saveProfile(): void {
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid || this.savingProfile()) {
      return;
    }
    this.savingProfile.set(true);
    const name = this.profileForm.getRawValue().displayName.trim();
    this.account.update({ displayName: name }).subscribe((result) => {
      this.savingProfile.set(false);
      if (result.ok) {
        this.notify('settings.saved');
      } else {
        this.showErrors(this.profileForm, result.errors);
      }
    });
  }

  protected setLanguage(change: MatButtonToggleChange): void {
    const saved = this.language();
    this.account.update({ language: change.value as Lang }).subscribe((result) => {
      if (result.ok) {
        // The app switches to the new language right after this; confirm in it already.
        this.notify('settings.saved', change.value as Lang);
      } else {
        change.source.buttonToggleGroup!.value = saved;
        this.notify('auth.errors.form.unknown');
      }
    });
  }

  protected changePassword(formDirective: FormGroupDirective): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.changingPassword()) {
      return;
    }
    this.changingPassword.set(true);
    this.account.changePassword(this.passwordForm.getRawValue()).subscribe((result) => {
      this.changingPassword.set(false);
      if (result.ok) {
        formDirective.resetForm();
        this.notify('settings.password.changed');
      } else {
        this.showErrors(this.passwordForm, result.errors);
      }
    });
  }

  protected setTheme(mode: ThemeMode): void {
    this.theme.setMode(mode);
  }

  protected logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => this.notify('auth.errors.form.unknown'),
    });
  }

  /** Field codes go under their field; anything else is a snackbar. */
  private showErrors(form: FormGroup, errors: FieldErrors): void {
    for (const [field, code] of Object.entries(errors)) {
      const control = form.get(field);
      if (control) {
        control.setErrors({ server: code });
      } else {
        this.notify(`auth.errors.form.${code}`);
      }
    }
  }

  /** Waits for the language's translations to be loaded. */
  private notify(key: string, lang = this.transloco.getActiveLang()): void {
    this.transloco
      .selectTranslate(key, {}, lang)
      .pipe(take(1))
      .subscribe((message) => this.snackBar.open(message, undefined, { duration: SNACK_DURATION }));
  }
}
