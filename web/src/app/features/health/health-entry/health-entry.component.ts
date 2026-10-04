import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DosePipe } from '../../../core/health-entries/dose';
import { HealthEntry } from '../../../core/health-entries/health-entry.models';
import { EntryListItemComponent } from '../../../shared/ui/entry-list-item/entry-list-item.component';

/**
 * A health entry as an entry list item (spec 09), in the Health card and history: the
 * Health icon, its time and name ("2:30 PM · Paracetamol"), then its dose and notes ("2.5 ml ·
 * with food"), whichever exist. Tapping it emits `open`.
 */
@Component({
  selector: 'nala-health-entry',
  imports: [EntryListItemComponent, DosePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = healthEntry();
    <nala-entry-list-item
      icon="medical_services"
      [time]="m.time"
      [label]="m.name"
      [summary]="summary(m | nalaDose, m.notes)"
      (open)="open.emit()"
    />
  `,
})
export class HealthEntryComponent {
  readonly healthEntry = input.required<HealthEntry>();
  readonly open = output<void>();

  /** The dose and the notes, those present, joined. */
  protected summary(dose: string, notes: string | null): string {
    return [dose, notes ?? ''].filter((part) => part !== '').join(' · ');
  }
}
