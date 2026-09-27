import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

/** A titled group of settings (Account, Appearance, Admin…), shown as a card on the settings page. */
@Component({
  selector: 'nala-settings-section',
  imports: [MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-section.component.html',
  styleUrl: './settings-section.component.scss',
})
export class SettingsSectionComponent {
  readonly title = input.required<string>();
}
