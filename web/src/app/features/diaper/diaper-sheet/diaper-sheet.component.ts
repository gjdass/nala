import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import {
  DIAPER_COLORS,
  DIAPER_CONSISTENCIES,
  Diaper,
  DiaperColor,
  DiaperConsistency,
  DiaperFields,
} from '../../../core/diapers/diaper.models';
import { DiaperService } from '../../../core/diapers/diaper.service';
import { applyServerErrors } from '../../../core/http/apply-server-errors';
import { notInFuture } from '../../../core/time/not-in-future';
import { ChipChoiceRowComponent } from '../../../shared/ui/chip-choice-row/chip-choice-row.component';
import { ChipTogglesRowComponent } from '../../../shared/ui/chip-toggles-row/chip-toggles-row.component';
import { EntryAuditComponent } from '../../../shared/ui/entry-audit/entry-audit.component';
import { EntrySheetComponent } from '../../../shared/ui/entry-sheet/entry-sheet.component';
import {
  EntrySheetData,
  EntrySheetResult,
} from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { NotesRowComponent, notesControl } from '../../../shared/ui/notes-row/notes-row.component';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { SwitchRowComponent } from '../../../shared/ui/switch-row/switch-row.component';
import { TimeRowComponent } from '../../../shared/ui/time-row/time-row.component';

/** Form-level codes with their own message; anything else is "unknown". */
const FORM_ERRORS = ['diaperNotFound', 'babyNotFound'];

const toggle = (value: boolean) => new FormControl(value, { nonNullable: true });

/**
 * The Diaper sheet (spec 07), adding a diaper for the selected baby or editing the one it was opened
 * with: time (now by default), Wet and Dirty as two independent toggle chips (neither is a dry
 * diaper), the diaper-rash switch, and notes. No timer: Save is the only action, and × discards the
 * form. While Dirty is on, optional Colour (with colour dots) and Consistency chip rows; turning Dirty
 * off clears them, and a diaper that isn't dirty is saved without them. Closes with the saved diaper, or the id of the deleted one; offline, with `queued` once the
 * change is kept on the device.
 */
@Component({
  selector: 'nala-diaper-sheet',
  imports: [
    ChipChoiceRowComponent,
    ChipTogglesRowComponent,
    EntryAuditComponent,
    EntrySheetComponent,
    NotesRowComponent,
    SwitchRowComponent,
    TimeRowComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diaper-sheet.component.html',
  styleUrl: './diaper-sheet.component.scss',
})
export class DiaperSheetComponent {
  private readonly diapers = inject(DiaperService);
  private readonly sheetRef = inject<SheetRef<EntrySheetResult<Diaper>>>(SheetRef);
  private readonly store = inject(SelectedBabyService);
  /** Null when adding. */
  protected readonly diaper = inject<EntrySheetData<Diaper>>(SHEET_DATA).entry;
  /** Kept across attempts, so saving again after a failure can't add the diaper twice. */
  private readonly id = crypto.randomUUID();

  /** Wet and Dirty, each its own toggle chip. */
  protected readonly type = {
    wet: toggle(this.diaper?.wet ?? false),
    dirty: toggle(this.diaper?.dirty ?? false),
  };

  readonly form = new FormGroup({
    time: new FormControl<Date | null>(this.diaper ? new Date(this.diaper.time) : new Date(), [
      Validators.required,
      notInFuture(),
    ]),
    ...this.type,
    rash: toggle(this.diaper?.rash ?? false),
    color: new FormControl<DiaperColor | null>(this.diaper?.color ?? null),
    consistency: new FormControl<DiaperConsistency | null>(this.diaper?.consistency ?? null),
    notes: notesControl(this.diaper?.notes ?? ''),
  });

  protected readonly colors = DIAPER_COLORS;
  protected readonly consistencies = DIAPER_CONSISTENCIES;
  /** The dirty details show only while Dirty is on. */
  protected readonly dirty = toSignal(this.type.dirty.valueChanges, {
    initialValue: this.type.dirty.value,
  });

  protected readonly edited = !!this.diaper && this.diaper.updatedAt !== this.diaper.createdAt;
  /** Saving or deleting. */
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  /** Turning Dirty off clears its details. */
  constructor() {
    this.type.dirty.valueChanges.pipe(takeUntilDestroyed()).subscribe((dirty) => {
      if (!dirty) {
        this.form.patchValue({ color: null, consistency: null });
      }
    });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const fields = this.fields();
    const request = this.diaper
      ? this.diapers.update(this.diaper.id, fields)
      : this.diapers.create(this.store.selected()!.id, fields, this.id);
    request.subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.sheetRef.close(result.queued ? { queued: true } : { saved: result.entry });
        return;
      }
      this.showFormError(applyServerErrors(this.form, result.errors));
    });
  }

  protected delete(): void {
    const diaper = this.diaper!;
    this.saving.set(true);
    this.formError.set(null);
    this.diapers.delete(diaper.id).subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.sheetRef.close(result.queued ? { queued: true } : { deleted: diaper.id });
      } else {
        this.showFormError(result.errors['form'] ?? 'unknown');
      }
    });
  }

  private showFormError(code: string | null): void {
    this.formError.set(code === null ? null : FORM_ERRORS.includes(code) ? code : 'unknown');
  }

  /** Call only on a valid form. */
  private fields(): DiaperFields {
    const value = this.form.getRawValue();
    return {
      time: value.time!.toISOString(),
      wet: value.wet,
      dirty: value.dirty,
      rash: value.rash,
      color: value.dirty ? value.color : null,
      consistency: value.dirty ? value.consistency : null,
      notes: value.notes.trim() || null,
    };
  }
}
