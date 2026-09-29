import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { formatDateTime } from '../../../core/i18n/date-time';
import { PendingInvitation } from '../../../core/invitations/invitation.models';
import { InvitationService } from '../../../core/invitations/invitation.service';
import { MemberService } from '../../../core/members/member.service';
import { InvitationListItemComponent } from '../../../shared/ui/invitation-list-item/invitation-list-item.component';
import {
  ShareLinkDialogComponent,
  ShareLinkDialogData,
} from '../../../shared/ui/share-link-dialog/share-link-dialog.component';
import { InviteEmailDialogComponent } from '../invite-email-dialog/invite-email-dialog.component';

const SNACK_DURATION = 3000;

/** Refusals with their own message; anything else is the generic error. */
const REVOKE_ERRORS = ['invitationUsed', 'invitationExpired', 'invitationUnknown'];

/**
 * Invite someone (a link handed over through the share dialog, or emailed when SMTP is configured), and the pending
 * invitations, each revocable.
 */
@Component({
  selector: 'nala-settings-invitations',
  imports: [InvitationListItemComponent, MatButtonModule, MatListModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-invitations.component.html',
  styleUrl: './settings-invitations.component.scss',
})
export class SettingsInvitationsComponent {
  private readonly invitations = inject(InvitationService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly origin = inject(DOCUMENT).location.origin;
  private readonly auth = inject(AuthService);

  protected readonly pending = signal<PendingInvitation[]>([]);
  protected readonly loadError = signal(false);
  protected readonly creating = signal(false);
  protected readonly smtpEnabled = computed(() => this.auth.state()?.smtpEnabled ?? false);

  constructor() {
    this.load();
    // Removing or disabling a member revokes their pending invitations.
    inject(MemberService)
      .changed$.pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
  }

  protected invite(): void {
    if (this.creating()) {
      return;
    }
    this.creating.set(true);
    this.invitations.create().subscribe((result) => {
      this.creating.set(false);
      if (!result.ok) {
        this.notify('auth.errors.form.unknown');
        return;
      }
      const { token, expiresAt } = result.invitation;
      const lang = this.transloco.getActiveLang();
      this.dialog.open<ShareLinkDialogComponent, ShareLinkDialogData>(ShareLinkDialogComponent, {
        data: {
          title: this.transloco.translate('invitations.shareTitle'),
          text: this.transloco.translate('invitations.shareText', {
            date: formatDateTime(expiresAt, lang),
          }),
          url: `${this.origin}/invite/${token}`,
        },
      });
      this.load();
    });
  }

  protected inviteByEmail(): void {
    this.dialog
      .open<InviteEmailDialogComponent, void, string>(InviteEmailDialogComponent)
      .afterClosed()
      .subscribe((email) => {
        if (email) {
          this.notify('invitations.emailSent', { email });
          this.load();
        }
      });
  }

  /** Immediate: a new link is easy to make. */
  protected revoke(invitation: PendingInvitation): void {
    this.invitations.revoke(invitation.id).subscribe((result) => {
      if (result.ok) {
        this.pending.update((list) => list.filter((i) => i.id !== invitation.id));
        this.notify('invitations.revoked');
        return;
      }
      const code = result.errors['form'] ?? 'unknown';
      if (REVOKE_ERRORS.includes(code)) {
        // It is no longer pending: show the list as it now is.
        this.notify(`invitations.errors.${code}`);
        this.load();
      } else {
        this.notify('auth.errors.form.unknown');
      }
    });
  }

  private load(): void {
    this.invitations.pending().subscribe((result) => {
      this.loadError.set(!result.ok);
      if (result.ok) {
        this.pending.set(result.invitations);
      }
    });
  }

  private notify(key: string, params?: Record<string, string>): void {
    this.transloco
      .selectTranslate(key, params)
      .pipe(take(1))
      .subscribe((message) => this.snackBar.open(message, undefined, { duration: SNACK_DURATION }));
  }
}
