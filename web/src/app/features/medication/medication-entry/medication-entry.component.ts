import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MedicationDosePipe } from '../../../core/medications/medication-dose';
import { Medication } from '../../../core/medications/medication.models';
import { EntryListItemComponent } from '../../../shared/ui/entry-list-item/entry-list-item.component';

/**
 * A medication dose as an entry list item (spec 09), in the medication card and history: the
 * medication icon, its time and name ("2:30 PM · Paracetamol"), then its dose and notes ("2.5 ml ·
 * with food"), whichever exist. Tapping it emits `open`.
 */
@Component({
  selector: 'nala-medication-entry',
  imports: [EntryListItemComponent, MedicationDosePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = medication();
    <nala-entry-list-item
      icon="medication"
      [time]="m.time"
      [label]="m.name"
      [summary]="summary(m | nalaMedicationDose, m.notes)"
      (open)="open.emit()"
    />
  `,
})
export class MedicationEntryComponent {
  readonly medication = input.required<Medication>();
  readonly open = output<void>();

  /** The dose and the notes, those present, joined. */
  protected summary(dose: string, notes: string | null): string {
    return [dose, notes ?? ''].filter((part) => part !== '').join(' · ');
  }
}
