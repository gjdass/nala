import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { filter, take } from 'rxjs';
import { AdminUser } from '../../../core/admin/admin.models';
import { AdminService } from '../../../core/admin/admin.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { MemberListItemComponent } from '../../../shared/ui/member-list-item/member-list-item.component';

const SNACK_DURATION = 3000;

/** The admin's users list with disable / re-enable. Only rendered for the admin. */
@Component({
  selector: 'nala-admin-users',
  imports: [MatButtonModule, MatListModule, MemberListItemComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent {
  private readonly admin = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly loadError = signal<string | null>(null);

  constructor() {
    this.admin.users().subscribe((result) => {
      if (result.ok) {
        this.users.set(result.users);
      } else {
        this.loadError.set(result.errors['form'] ?? 'unknown');
      }
    });
  }

  /** In the language the app shows, e.g. "Sep 20, 2026, 10:30 AM". */
  protected lastActive(iso: string): string {
    return new Intl.DateTimeFormat(this.lang(), { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  }

  /** Re-enabling is immediate; disabling asks first, since the user is logged out everywhere. */
  protected toggle(user: AdminUser): void {
    if (user.isDisabled) {
      this.setDisabled(user, false);
    } else {
      this.confirmDisable(user);
    }
  }

  private confirmDisable(user: AdminUser): void {
    const name = { name: user.displayName };
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: this.transloco.translate('settings.admin.disableTitle', name),
          text: this.transloco.translate('settings.admin.disableText', name),
          confirm: this.transloco.translate('settings.admin.confirm'),
          cancel: this.transloco.translate('settings.admin.cancel'),
        },
      })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => this.setDisabled(user, true));
  }

  private setDisabled(user: AdminUser, disabled: boolean): void {
    this.admin.setDisabled(user.id, disabled).subscribe((result) => {
      if (result.ok) {
        this.users.update((users) => users.map((u) => (u.id === result.user.id ? result.user : u)));
        const done = disabled ? 'settings.admin.disabledDone' : 'settings.admin.enabledDone';
        this.notify(done, { name: user.displayName });
      } else {
        this.notify(`auth.errors.form.${result.errors['form'] ?? 'unknown'}`);
      }
    });
  }

  private notify(key: string, params = {}): void {
    this.transloco
      .selectTranslate(key, params)
      .pipe(take(1))
      .subscribe((message) => this.snackBar.open(message, undefined, { duration: SNACK_DURATION }));
  }
}
