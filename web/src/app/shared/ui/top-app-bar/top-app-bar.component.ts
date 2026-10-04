import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { BabyAgePipe } from '../../../core/babies/baby-age.pipe';
import { Baby } from '../../../core/babies/baby.models';

/**
 * The app's top bar: the selected baby (name + age), a switcher menu when the family has
 * several babies, and the Nala brand on the right. Settings is a bottom navigation destination.
 */
@Component({
  selector: 'nala-top-app-bar',
  imports: [
    BabyAgePipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule,
    NgTemplateOutlet,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './top-app-bar.component.html',
  styleUrl: './top-app-bar.component.scss',
})
export class TopAppBarComponent {
  readonly babies = input<Baby[]>([]);
  readonly selected = input<Baby | null>(null);
  readonly babySelected = output<string>();
}
