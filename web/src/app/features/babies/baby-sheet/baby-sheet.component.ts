import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { Baby } from '../../../core/babies/baby.models';
import { BabyService } from '../../../core/babies/baby.service';
import {
  BabyFormComponent,
  babyFields,
  createBabyForm,
} from '../../../shared/ui/baby-form/baby-form.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { SheetHeaderComponent } from '../../../shared/ui/sheet-header/sheet-header.component';
import { SheetRef } from '../../../shared/ui/sheet/sheet-ref';

/** Adds a baby; opened with `SheetService`, closes with the added baby. */
@Component({
  selector: 'nala-baby-sheet',
  imports: [BabyFormComponent, SheetHeaderComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './baby-sheet.component.html',
  styleUrl: './baby-sheet.component.scss',
})
export class BabySheetComponent {
  private readonly babies = inject(BabyService);
  private readonly sheetRef = inject<SheetRef<Baby>>(SheetRef);
  private readonly dialog = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);

  readonly form = createBabyForm();
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly invalid = toSignal(this.form.statusChanges.pipe(map((s) => s !== 'VALID')), {
    initialValue: this.form.invalid,
  });

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    this.babies.create(babyFields(this.form)).subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.sheetRef.close(result.baby);
        return;
      }
      const { form, ...fields } = result.errors;
      for (const [field, code] of Object.entries(fields)) {
        const control = this.form.get(field);
        control?.setErrors({ server: code });
        control?.markAsTouched();
      }
      if (form || Object.keys(fields).length === 0) {
        this.formError.set(form ?? 'unknown');
      }
    });
  }

  /** Asks before discarding what was entered. */
  protected close(): void {
    if (!this.form.dirty) {
      this.sheetRef.close();
      return;
    }
    const t = (key: string) => this.transloco.translate(`babies.discard.${key}`);
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: { title: t('title'), text: t('text'), confirm: t('confirm'), cancel: t('cancel') },
      })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => this.sheetRef.close());
  }
}
