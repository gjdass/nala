import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * A banner drawing attention to a situation (e.g. "Still feeding?", spec 05): an icon, a title and
 * a text on a container colour, with an optional text-button action. Texts are translated by the
 * caller.
 */
@Component({
  selector: 'nala-banner',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './banner.component.html',
  styleUrl: './banner.component.scss',
  host: { role: 'status' },
})
export class BannerComponent {
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly text = input('');
  /** No action without a label. */
  readonly actionLabel = input('');
  readonly action = output();
}
