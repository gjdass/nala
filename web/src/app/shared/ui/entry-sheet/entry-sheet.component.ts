import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Observable, filter, map, startWith, switchMap } from 'rxjs';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../confirm-dialog/confirm-dialog.component';
import { SheetHeaderComponent } from '../sheet-header/sheet-header.component';
import { SHEET_DATA, SheetRef } from '../sheet/sheet-ref';
import { EntrySheetData } from './entry-sheet.models';

/**
 * The frame of every add / edit sheet of a section (spec 04), wrapping the kind's rows: header in
 * the section colour with ×, the kind title and Save (disabled while `form` is invalid, saving or
 * `saveDisabled`), and, when editing (or `deletable`), a Delete action. × asks before discarding
 * changes (then closes, or runs `discard`); Delete asks before emitting. The kind's sheet saves or deletes, then closes itself
 * through `SheetRef`.
 */
@Component({
  selector: 'nala-entry-sheet',
  imports: [MatButtonModule, SheetHeaderComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entry-sheet.component.html',
  styleUrl: './entry-sheet.component.scss',
})
export class EntrySheetComponent {
  private readonly sheetRef = inject(SheetRef);
  private readonly dialog = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);
  protected readonly data = inject<EntrySheetData>(SHEET_DATA);

  readonly form = input.required<AbstractControl>();
  readonly saving = input(false);
  /** Keeps Save off even with a valid form (e.g. a breastfeed with both sides at 0 s). */
  readonly saveDisabled = input(false);
  /** Whether Delete is offered; by default when editing an entry. */
  readonly deletable = input<boolean | null>(null);
  /**
   * What × does once confirmed (or at once without changes), instead of closing: the kind's sheet then
   * closes itself (e.g. after deleting the entry a timer's Start created, spec 04 Timers).
   */
  readonly discard = input<(() => void) | null>(null);
  readonly save = output();
  readonly delete = output();

  protected readonly canDelete = computed(() => this.deletable() ?? !!this.data.entry);

  protected readonly invalid = toSignal(
    toObservable(this.form).pipe(
      switchMap((form) => form.statusChanges.pipe(startWith(form.status))),
      map((status) => status !== 'VALID'),
    ),
    { initialValue: true },
  );

  /** Asks before discarding what was entered. */
  protected close(): void {
    const discard = () => (this.discard() ?? (() => this.sheetRef.close()))();
    if (!this.form().dirty) {
      discard();
      return;
    }
    this.confirm('discard').subscribe(discard);
  }

  protected confirmDelete(): void {
    this.confirm('delete').subscribe(() => this.delete.emit());
  }

  private confirm(wording: 'discard' | 'delete'): Observable<boolean> {
    const t = (key: string) => this.transloco.translate(`entrySheet.${wording}.${key}`);
    return this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: { title: t('title'), text: t('text'), confirm: t('confirm'), cancel: t('cancel') },
      })
      .afterClosed()
      .pipe(filter((confirmed): confirmed is true => confirmed === true));
  }
}
