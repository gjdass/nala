import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DosePipe } from '../../../core/health-entries/dose';
import { HealthEntry } from '../../../core/health-entries/health-entry.models';
import { TemperaturePipe } from '../../../core/health-entries/temperature';
import { EntryListItemComponent } from '../../../shared/ui/entry-list-item/entry-list-item.component';

/**
 * A health entry as an entry list item (spec 09), in the Health card and history: the Health icon,
 * its time and name ("2:30 PM · Paracetamol"), or its temperature without a name ("2:30 PM ·
 * 38.5 °C"), then its dose, its temperature (only under a name) and notes ("2.5 ml · 38.5 °C · with
 * food"), whichever exist. Tapping it emits `open`.
 */
@Component({
  selector: 'nala-health-entry',
  imports: [EntryListItemComponent, DosePipe, TemperaturePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = healthEntry();
    @let temperature = m.temperature | nalaTemperature;
    <nala-entry-list-item
      icon="medical_services"
      [time]="m.time"
      [label]="m.name ?? temperature"
      [summary]="summary(m | nalaDose, m.name === null ? '' : temperature, m.notes)"
      (open)="open.emit()"
    />
  `,
})
export class HealthEntryComponent {
  readonly healthEntry = input.required<HealthEntry>();
  readonly open = output<void>();

  /** The dose, the temperature and the notes, those present, joined. */
  protected summary(dose: string, temperature: string, notes: string | null): string {
    return [dose, temperature, notes ?? ''].filter((part) => part !== '').join(' · ');
  }
}
