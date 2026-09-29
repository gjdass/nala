import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatListModule } from '@angular/material/list';

/**
 * One row of an entry sheet (spec 04): an M3 list item with the label as headline and the current
 * value or action as trailing text; tapping it emits `activate`. With `interactive` off, it shows
 * projected `[rowTrailing]` content (e.g. a switch) instead. `[rowEditor]` content (the Material
 * control that edits the value) sits under the item, followed by `error` when there is one.
 */
@Component({
  selector: 'nala-form-row',
  imports: [MatListModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form-row.component.html',
  styleUrl: './form-row.component.scss',
})
export class FormRowComponent {
  readonly label = input.required<string>();
  readonly value = input('');
  readonly error = input<string | null>(null);
  readonly interactive = input(true);
  readonly activate = output();
}
