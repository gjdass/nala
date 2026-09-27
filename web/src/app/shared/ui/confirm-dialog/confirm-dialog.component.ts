import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

/** Texts already translated by the caller. */
export interface ConfirmDialogData {
  title: string;
  text: string;
  confirm: string;
  cancel: string;
}

/** A Material confirmation dialog; closes with `true` when confirmed, `false` when cancelled. */
@Component({
  selector: 'nala-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<ConfirmDialogComponent, boolean>>(MatDialogRef);
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);

  protected close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}
