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
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';

/**
 * Adds a baby, or edits the baby given as sheet data; opened with `SheetService`, closes with the
 * added or updated baby.
 */
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
  /** Null when adding. */
  protected readonly baby = inject<Baby | null>(SHEET_DATA, { optional: true });

  readonly form = createBabyForm(this.baby ?? undefined);
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
    const fields = babyFields(this.form);
    const saved = this.baby ? this.babies.update(this.baby.id, fields) : this.babies.create(fields);
    saved.subscribe((result) => {
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
    const wording = this.baby ? 'discardEdit' : 'discard';
    const t = (key: string) => this.transloco.translate(`babies.${wording}.${key}`);
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: { title: t('title'), text: t('text'), confirm: t('confirm'), cancel: t('cancel') },
      })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => this.sheetRef.close());
  }
}
