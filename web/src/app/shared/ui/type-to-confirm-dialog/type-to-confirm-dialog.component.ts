import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/** Texts already translated by the caller; `expected` is what must be typed. */
export interface TypeToConfirmDialogData {
  title: string;
  text: string;
  label: string;
  expected: string;
  confirm: string;
  cancel: string;
}

/**
 * Confirms a destructive action by typing a text (e.g. the name of what is deleted), matched with
 * surrounding spaces ignored and case kept. Closes with `true` when confirmed, `false` when cancelled.
 */
@Component({
  selector: 'nala-type-to-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './type-to-confirm-dialog.component.html',
  styleUrl: './type-to-confirm-dialog.component.scss',
})
export class TypeToConfirmDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<TypeToConfirmDialogComponent, boolean>>(MatDialogRef);
  protected readonly data = inject<TypeToConfirmDialogData>(MAT_DIALOG_DATA);

  protected readonly typed = signal('');
  protected readonly matches = computed(() => this.typed().trim() === this.data.expected);

  protected close(confirmed: boolean): void {
    if (confirmed && !this.matches()) {
      return;
    }
    this.dialogRef.close(confirmed);
  }
}
