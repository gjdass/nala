import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { map, startWith } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { pumpTotalMl } from '../../../core/pumps/pump';
import { PUMP_VOLUME_MAX_ML, Pump, PumpFields } from '../../../core/pumps/pump.models';
import { PumpService } from '../../../core/pumps/pump.service';
import { PumpSyncService } from '../../../core/pumps/pump-sync.service';
import { DurationPipe } from '../../../core/time/duration';
import { TimeSincePipe } from '../../../core/time/time-since';
import { BannerComponent } from '../../../shared/ui/banner/banner.component';
import { EntryAuditComponent } from '../../../shared/ui/entry-audit/entry-audit.component';
import { EntrySheetComponent } from '../../../shared/ui/entry-sheet/entry-sheet.component';
import { EntrySheetData } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { LiveEntrySheet } from '../../../shared/ui/entry-sheet/live-entry-sheet';
import { FormRowComponent } from '../../../shared/ui/form-row/form-row.component';
import { NotesRowComponent } from '../../../shared/ui/notes-row/notes-row.component';
import { NumberFieldsRowComponent } from '../../../shared/ui/number-fields-row/number-fields-row.component';
import { SHEET_DATA } from '../../../shared/ui/sheet/sheet-ref';
import { TimeRowComponent } from '../../../shared/ui/time-row/time-row.component';
import { TimerComponent } from '../../../shared/ui/timer/timer.component';
import { STILL_PUMPING_AFTER_MS } from '../pump-duration';

/** An optional volume: a whole number of ml, 0–500. */
const volume = (ml: number | null) =>
  new FormControl<number | null>(ml, [
    Validators.min(0),
    Validators.max(PUMP_VOLUME_MAX_ML),
    Validators.pattern(/^\d+$/),
  ]);

/**
 * The Pump sheet (spec 08): a single timer, the start time (now by default), the end time ("Pumping…"
 * while live), the duration between them, Left ml and Right ml side by side (optional, 0–500, typed
 * and saved at any time, also while live), the total once a side has a volume, and notes, for the
 * selected baby's session or the one it was opened with. A session live for more than 1 hour shows
 * "Still pumping?". The timer, Save, Delete, × and following other devices (volumes included) are the
 * shared `LiveEntrySheet` (spec 04 Timers).
 */
@Component({
  selector: 'nala-pump-sheet',
  imports: [
    BannerComponent,
    DurationPipe,
    EntryAuditComponent,
    EntrySheetComponent,
    FormRowComponent,
    NotesRowComponent,
    NumberFieldsRowComponent,
    TimeRowComponent,
    TimeSincePipe,
    TimerComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pump-sheet.component.html',
  styleUrl: './pump-sheet.component.scss',
})
export class PumpSheetComponent {
  /** Null when adding. */
  private readonly entry = inject<EntrySheetData<Pump>>(SHEET_DATA).entry;

  protected readonly sheet = new LiveEntrySheet<Pump, PumpFields>({
    entry: this.entry,
    babyId: this.entry?.babyId ?? inject(SelectedBabyService).selected()?.id,
    api: inject(PumpService),
    sync: inject(PumpSyncService),
    inProgressCode: 'pumpInProgress',
    formErrors: ['pumpNotFound', 'babyNotFound'],
    deletedElsewhere: 'pump.sheet.deletedElsewhere',
    stillLiveAfterMs: STILL_PUMPING_AFTER_MS,
  });

  private readonly leftMl = volume(this.entry?.leftMl ?? null);
  private readonly rightMl = volume(this.entry?.rightMl ?? null);

  readonly form = new FormGroup({
    startTime: this.sheet.startTime,
    endTime: this.sheet.endTime,
    leftMl: this.leftMl,
    rightMl: this.rightMl,
    notes: this.sheet.notes,
  });

  protected readonly maxMl = PUMP_VOLUME_MAX_ML;

  private readonly volumes = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => ({ leftMl: ml(this.leftMl.value), rightMl: ml(this.rightMl.value) })),
    ),
    { requireSync: true },
  );
  /** Left + right; null while neither side has a volume. */
  protected readonly total = computed(() => pumpTotalMl(this.volumes()));

  constructor() {
    this.sheet.connect(this.form, {
      values: (pump) => ({ leftMl: pump.leftMl, rightMl: pump.rightMl }),
      follow: (pump) => {
        if (this.leftMl.pristine) {
          this.leftMl.setValue(pump.leftMl);
        }
        if (this.rightMl.pristine) {
          this.rightMl.setValue(pump.rightMl);
        }
      },
    });
  }

  protected save(): void {
    this.sheet.save({
      ...this.sheet.fields(),
      leftMl: ml(this.leftMl.value),
      rightMl: ml(this.rightMl.value),
    });
  }
}

/** A typed volume; an emptied number field may hold null or an empty string. */
function ml(value: number | string | null): number | null {
  return value === null || value === '' ? null : Number(value);
}
