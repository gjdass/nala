import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** A centered icon, title and text for a screen or area with nothing to show yet, with a projected action. */
@Component({
  selector: 'nala-empty-state',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly text = input('');
}
