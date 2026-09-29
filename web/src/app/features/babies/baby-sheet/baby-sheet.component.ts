import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { Baby, BabySheetResult } from '../../../core/babies/baby.models';
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
import {
  TypeToConfirmDialogComponent,
  TypeToConfirmDialogData,
} from '../../../shared/ui/type-to-confirm-dialog/type-to-confirm-dialog.component';

/**
 * Adds a baby, or edits the baby given as sheet data; opened with `SheetService`, closes with the
 * added or updated baby, or, when the admin deletes it, its id.
 */
@Component({
  selector: 'nala-baby-sheet',
  imports: [BabyFormComponent, MatButtonModule, SheetHeaderComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './baby-sheet.component.html',
  styleUrl: './baby-sheet.component.scss',
})
export class BabySheetComponent {
  private readonly babies = inject(BabyService);
  private readonly sheetRef = inject<SheetRef<BabySheetResult>>(SheetRef);
  private readonly dialog = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);
  /** Null when adding. */
  protected readonly baby = inject<Baby | null>(SHEET_DATA, { optional: true });
  private readonly auth = inject(AuthService);
  protected readonly canDelete = computed(
    () => !!this.baby && (this.auth.state()?.user?.isAdmin ?? false),
  );

  readonly form = createBabyForm(this.baby ?? undefined);
  /** Saving or deleting. */
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
        this.sheetRef.close({ saved: result.baby });
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

  /** Admin only: asks to type the baby's name, then deletes it. */
  protected delete(): void {
    const baby = this.baby!;
    const t = (key: string) =>
      this.transloco.translate(`babies.delete.${key}`, { name: baby.name });
    this.dialog
      .open<TypeToConfirmDialogComponent, TypeToConfirmDialogData, boolean>(
        TypeToConfirmDialogComponent,
        {
          data: {
            title: t('title'),
            text: t('text'),
            label: t('label'),
            expected: baby.name,
            confirm: t('confirm'),
            cancel: t('cancel'),
          },
        },
      )
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => {
        this.saving.set(true);
        this.formError.set(null);
        this.babies.delete(baby.id).subscribe((result) => {
          this.saving.set(false);
          if (result.ok) {
            this.sheetRef.close({ deleted: baby.id });
          } else {
            this.formError.set(result.errors['form'] ?? 'unknown');
          }
        });
      });
  }
}
