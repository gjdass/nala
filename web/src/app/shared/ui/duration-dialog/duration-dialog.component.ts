import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import {
  DurationFieldComponent,
  durationGroup,
  durationSeconds,
} from '../duration-field/duration-field.component';

/** The title is already translated by the caller; `seconds` is the duration shown first. */
export interface DurationDialogData {
  title: string;
  seconds: number;
}

/**
 * A Material dialog to type a duration (minutes and seconds); closes with it in seconds on OK, or
 * with nothing on Cancel.
 */
@Component({
  selector: 'nala-duration-dialog',
  imports: [DurationFieldComponent, MatButtonModule, MatDialogModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './duration-dialog.component.html',
})
export class DurationDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<DurationDialogComponent, number | undefined>>(MatDialogRef);
  protected readonly data = inject<DurationDialogData>(MAT_DIALOG_DATA);
  protected readonly group = durationGroup(this.data.seconds);
  protected readonly invalid = toSignal(
    this.group.statusChanges.pipe(map((status) => status !== 'VALID')),
    { initialValue: this.group.invalid },
  );

  protected ok(): void {
    if (this.group.valid) {
      this.dialogRef.close(durationSeconds(this.group));
    }
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
