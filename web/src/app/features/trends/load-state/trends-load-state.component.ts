import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * The loading states of a Trends section (spec 12): a spinner until its days are loaded, an error with
 * Try again when they can't be, else the projected cards. Takes no box of its own: the cards stay
 * children of the section's layout.
 */
@Component({
  selector: 'nala-trends-load-state',
  imports: [MatButtonModule, MatProgressSpinnerModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trends-load-state.component.html',
  styleUrl: './trends-load-state.component.scss',
})
export class TrendsLoadStateComponent {
  readonly error = input(false);
  readonly loaded = input(false);
  readonly retry = output();
}
