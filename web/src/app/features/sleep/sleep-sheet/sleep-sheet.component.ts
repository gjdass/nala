import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { Sleep, SleepFields } from '../../../core/sleeps/sleep.models';
import { SleepService } from '../../../core/sleeps/sleep.service';
import { SleepSyncService } from '../../../core/sleeps/sleep-sync.service';
import { DurationPipe } from '../../../core/time/duration';
import { TimeSincePipe } from '../../../core/time/time-since';
import { BannerComponent } from '../../../shared/ui/banner/banner.component';
import { EntryAuditComponent } from '../../../shared/ui/entry-audit/entry-audit.component';
import { EntrySheetComponent } from '../../../shared/ui/entry-sheet/entry-sheet.component';
import { EntrySheetData } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { LiveEntrySheet } from '../../../shared/ui/entry-sheet/live-entry-sheet';
import { FormRowComponent } from '../../../shared/ui/form-row/form-row.component';
import { NotesRowComponent } from '../../../shared/ui/notes-row/notes-row.component';
import { SHEET_DATA } from '../../../shared/ui/sheet/sheet-ref';
import { TimeRowComponent } from '../../../shared/ui/time-row/time-row.component';
import { TimerComponent } from '../../../shared/ui/timer/timer.component';
import { STILL_SLEEPING_AFTER_MS } from '../sleep-duration';

/**
 * The Sleep sheet (spec 06): a single timer, the start time (now by default), the end time, the
 * duration between them, and notes, for the selected baby's sleep or the one it was opened with.
 * While live, the End time row reads "Sleeping…"; a sleep live for more than 12 hours shows "Still
 * sleeping?". The timer, Save, Delete, × and following other devices are the shared
 * `LiveEntrySheet` (spec 04 Timers).
 */
@Component({
  selector: 'nala-sleep-sheet',
  imports: [
    BannerComponent,
    DurationPipe,
    EntryAuditComponent,
    EntrySheetComponent,
    FormRowComponent,
    NotesRowComponent,
    TimeRowComponent,
    TimeSincePipe,
    TimerComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sleep-sheet.component.html',
  styleUrl: './sleep-sheet.component.scss',
})
export class SleepSheetComponent {
  /** Null when adding. */
  private readonly entry = inject<EntrySheetData<Sleep>>(SHEET_DATA).entry;

  protected readonly sheet = new LiveEntrySheet<Sleep, SleepFields>({
    entry: this.entry,
    babyId: this.entry?.babyId ?? inject(SelectedBabyService).selected()?.id,
    api: inject(SleepService),
    sync: inject(SleepSyncService),
    inProgressCode: 'sleepInProgress',
    formErrors: ['sleepNotFound', 'babyNotFound'],
    deletedElsewhere: 'sleep.sheet.deletedElsewhere',
    stillLiveAfterMs: STILL_SLEEPING_AFTER_MS,
  });

  readonly form = new FormGroup({
    startTime: this.sheet.startTime,
    endTime: this.sheet.endTime,
    notes: this.sheet.notes,
  });

  constructor() {
    this.sheet.connect(this.form);
  }

  protected save(): void {
    this.sheet.save();
  }
}
