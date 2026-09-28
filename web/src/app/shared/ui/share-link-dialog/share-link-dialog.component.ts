import { Clipboard } from '@angular/cdk/clipboard';
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';

/** Texts already translated by the caller. */
export interface ShareLinkDialogData {
  title: string;
  text: string;
  url: string;
}

const SNACK_DURATION = 3000;

/**
 * Hands a one-time link over (reset link, invitation): shows it read-only, copies it, and opens the device's share sheet
 * when there is one.
 */
@Component({
  selector: 'nala-share-link-dialog',
  imports: [MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './share-link-dialog.component.html',
  styleUrl: './share-link-dialog.component.scss',
})
export class ShareLinkDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<ShareLinkDialogComponent>>(MatDialogRef);
  private readonly clipboard = inject(Clipboard);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly navigator = inject(DOCUMENT).defaultView?.navigator;

  protected readonly data = inject<ShareLinkDialogData>(MAT_DIALOG_DATA);
  protected readonly canShare = typeof this.navigator?.share === 'function';

  protected copy(): void {
    this.notify(this.clipboard.copy(this.data.url) ? 'shareLink.copied' : 'shareLink.copyFailed');
  }

  protected share(): void {
    // Rejected when the user dismisses the share sheet: nothing to report.
    this.navigator!.share({ title: this.data.title, url: this.data.url }).catch(() => undefined);
  }

  protected close(): void {
    this.dialogRef.close();
  }

  private notify(key: string): void {
    this.transloco
      .selectTranslate(key)
      .pipe(take(1))
      .subscribe((message) => this.snackBar.open(message, undefined, { duration: SNACK_DURATION }));
  }
}
