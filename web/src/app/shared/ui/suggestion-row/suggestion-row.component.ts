import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';

/** A suggestion under a field (e.g. "Use last breast milk amount: 90 ml?") with Yes, emitting `accept`. */
@Component({
  selector: 'nala-suggestion-row',
  imports: [MatButtonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suggestion-row.component.html',
  styleUrl: './suggestion-row.component.scss',
})
export class SuggestionRowComponent {
  readonly text = input.required<string>();
  readonly accept = output();
}
