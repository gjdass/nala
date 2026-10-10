import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';
import { AdminUser } from '../../../core/admin/admin.models';
import { AdminService } from '../../../core/admin/admin.service';
import { DateTimePipe, formatDateTime } from '../../../core/i18n/date-time';
import { MemberListItemComponent } from '../../../shared/ui/member-list-item/member-list-item.component';
import {
  ShareLinkDialogComponent,
  ShareLinkDialogData,
} from '../../../shared/ui/share-link-dialog/share-link-dialog.component';

const SNACK_DURATION = 3000;

/** The instance admin's accounts list (no family data) with reset links. Only rendered for them. */
@Component({
  selector: 'nala-admin-users',
  imports: [
    DateTimePipe,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MemberListItemComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent {
  private readonly admin = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly origin = inject(DOCUMENT).location.origin;

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly loadError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  /** A new one-time link, handed over through the share dialog; the user's earlier links stop working. */
  protected resetLink(user: AdminUser): void {
    this.admin.createResetLink(user.id).subscribe((result) => {
      if (!result.ok) {
        this.notify(`auth.errors.form.${result.errors['form'] ?? 'unknown'}`);
        return;
      }
      const name = user.displayName;
      this.dialog.open<ShareLinkDialogComponent, ShareLinkDialogData>(ShareLinkDialogComponent, {
        data: {
          title: this.transloco.translate('settings.admin.resetLinkTitle', { name }),
          text: this.transloco.translate('settings.admin.resetLinkText', {
            name,
            date: formatDateTime(result.link.expiresAt, this.transloco.getActiveLang()),
          }),
          url: `${this.origin}/reset/${result.link.token}`,
        },
      });
    });
  }

  private load(): void {
    this.admin.users().subscribe((result) => {
      this.loadError.set(result.ok ? null : (result.errors['form'] ?? 'unknown'));
      if (result.ok) {
        this.users.set(result.users);
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
