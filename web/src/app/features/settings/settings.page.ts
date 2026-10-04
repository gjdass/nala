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
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';
import { AccountService } from '../../core/account/account.service';
import { FieldErrors } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { LANGS, Lang } from '../../core/i18n/initial-lang';
import { SECTIONS } from '../../core/sections/section.models';
import { THEME_MODES, ThemeMode, ThemeService } from '../../core/theme/theme.service';
import { COMMIT } from '../../core/version/version';
import { SettingsSectionComponent } from '../../shared/ui/settings-section/settings-section.component';
import { displayName, errorCode, newPassword } from '../auth/auth.validators';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { DeleteAccountDialogComponent } from './delete-account-dialog/delete-account-dialog.component';
import { SettingsBabiesComponent } from './settings-babies/settings-babies.component';
import { SettingsInvitationsComponent } from './settings-invitations/settings-invitations.component';
import { SettingsMembersComponent } from './settings-members/settings-members.component';
import { SettingsSectionsComponent } from './settings-sections/settings-sections.component';

const SNACK_DURATION = 3000;

/** Babies, members & invitations, home sections (once a section is built), account (display name, language, password, deletion), admin (admin only), appearance (theme), logout and the version. */
@Component({
  selector: 'nala-settings',
  imports: [
    AdminUsersComponent,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    SettingsBabiesComponent,
    SettingsInvitationsComponent,
    SettingsMembersComponent,
    SettingsSectionComponent,
    SettingsSectionsComponent,
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
  private readonly dialog = inject(MatDialog);

  /** Nothing to order until a section is built. */
  protected readonly hasSections = inject(SECTIONS).length > 0;
  protected readonly langs = LANGS;
  protected readonly themeModes = THEME_MODES;
  protected readonly language = computed(() => this.auth.state()?.user?.language);
  protected readonly isAdmin = computed(() => this.auth.state()?.user?.isAdmin ?? false);
  protected readonly themeMode = this.theme.mode;
  protected readonly commit = COMMIT;

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

  /** The dialog deletes the account; the user is then signed out everywhere. */
  protected deleteAccount(): void {
    this.dialog
      .open<DeleteAccountDialogComponent, void, boolean>(DeleteAccountDialogComponent, {
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          void this.router.navigateByUrl('/login');
          this.notify('settings.delete.done');
        }
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
