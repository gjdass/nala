import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { diaperType } from '../../../core/diapers/diaper';
import { Diaper } from '../../../core/diapers/diaper.models';
import { EntryListItemComponent } from '../../../shared/ui/entry-list-item/entry-list-item.component';

/**
 * A diaper as an entry list item (spec 07), in the diaper card and history: the diaper icon, its time
 * and type ("2:30 PM · Wet + dirty", "Dry"), then its notes. Tapping it emits `open`.
 */
@Component({
  selector: 'nala-diaper-entry',
  imports: [EntryListItemComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nala-entry-list-item
      icon="baby_changing_station"
      [time]="diaper().time"
      [label]="'diaper.type.' + type() | transloco"
      [summary]="diaper().notes ?? ''"
      (open)="open.emit()"
    />
  `,
})
export class DiaperEntryComponent {
  readonly diaper = input.required<Diaper>();
  readonly open = output<void>();

  protected readonly type = computed(() => diaperType(this.diaper()));
}
