import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

/**
 * Centered, phone-first card shared by the auth screens (setup, login, register, reset).
 * Content goes in the card body; elements marked `authCardActions` go in the card actions.
 */
@Component({
  selector: 'nala-auth-card',
  imports: [MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-card.component.html',
  styleUrl: './auth-card.component.scss',
})
export class AuthCardComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
