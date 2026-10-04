import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { diaperType } from '../../../core/diapers/diaper';
import { Diaper } from '../../../core/diapers/diaper.models';
import { EntryListItemComponent } from '../../../shared/ui/entry-list-item/entry-list-item.component';

/**
 * A diaper as an entry list item (spec 07), in the diaper card and history: the diaper icon, its time
 * and type ("2:30 PM · Wet + dirty", "Dry"), then its details ("Green · Soft · Rash", those present),
 * or its notes when it has none. Tapping it emits `open`.
 */
@Component({
  selector: 'nala-diaper-entry',
  imports: [EntryListItemComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let d = diaper();
    @let color = d.color ? ('diaper.color.' + d.color | transloco) : null;
    @let consistency = d.consistency ? ('diaper.consistency.' + d.consistency | transloco) : null;
    @let rash = d.rash ? ('diaper.card.rash' | transloco) : null;
    <nala-entry-list-item
      icon="baby_changing_station"
      [time]="d.time"
      [label]="'diaper.type.' + type() | transloco"
      [summary]="summary([color, consistency, rash], d.notes)"
      (open)="open.emit()"
    />
  `,
})
export class DiaperEntryComponent {
  readonly diaper = input.required<Diaper>();
  readonly open = output<void>();

  protected readonly type = computed(() => diaperType(this.diaper()));

  /** The details present, joined; the notes when there are none. */
  protected summary(details: (string | null)[], notes: string | null): string {
    const present = details.filter((detail) => detail !== null);
    return present.length > 0 ? present.join(' · ') : (notes ?? '');
  }
}
