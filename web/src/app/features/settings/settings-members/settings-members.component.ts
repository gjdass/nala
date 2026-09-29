import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { filter, take } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { Member } from '../../../core/members/member.models';
import { MemberService } from '../../../core/members/member.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { MemberListItemComponent } from '../../../shared/ui/member-list-item/member-list-item.component';

const SNACK_DURATION = 3000;

/** The family's members; the admin can remove any of them but themselves, after confirming. */
@Component({
  selector: 'nala-settings-members',
  imports: [MatButtonModule, MatListModule, MemberListItemComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-members.component.html',
  styleUrl: './settings-members.component.scss',
})
export class SettingsMembersComponent {
  private readonly members = inject(MemberService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly auth = inject(AuthService);

  protected readonly list = signal<Member[]>([]);
  protected readonly loadError = signal(false);
  protected readonly isAdmin = computed(() => this.auth.state()?.user?.isAdmin ?? false);

  constructor() {
    this.load();
    this.members.changed$.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  protected remove(member: Member): void {
    const name = { name: member.displayName };
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: this.transloco.translate('members.removeTitle', name),
          text: this.transloco.translate('members.removeText', name),
          confirm: this.transloco.translate('members.confirm'),
          cancel: this.transloco.translate('members.cancel'),
        },
      })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => this.removeConfirmed(member));
  }

  private removeConfirmed(member: Member): void {
    this.members.remove(member.id).subscribe((result) => {
      if (result.ok) {
        this.list.update((list) => list.filter((m) => m.id !== member.id));
        this.notify('members.removed', { name: member.displayName });
      } else {
        this.notify(`auth.errors.form.${result.errors['form'] ?? 'unknown'}`);
      }
    });
  }

  private load(): void {
    this.members.list().subscribe((result) => {
      this.loadError.set(!result.ok);
      if (result.ok) {
        this.list.set(result.members);
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
