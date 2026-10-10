import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { BabyAgePipe } from '../../../core/babies/baby-age.pipe';
import { Baby } from '../../../core/babies/baby.models';
import { Family } from '../../../core/families/family.models';

/**
 * The app's top bar: the selected baby (name + age), or the current family's name when it has no baby, and the
 * Nala brand on the right. The switcher menu is there when the user has several families (babies grouped under
 * their family's name, "No baby yet" for a family without one) or when their one family has several babies.
 * Nothing but the brand for a user in no family. Settings is a bottom navigation destination.
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
  /** The user's families, in order. */
  readonly families = input<Family[]>([]);
  /** The current family. */
  readonly family = input<Family | null>(null);
  /** Every family's babies. */
  readonly babies = input<Baby[]>([]);
  readonly selected = input<Baby | null>(null);
  readonly babySelected = output<string>();
  /** A family without a baby, chosen from its "No baby yet" item. */
  readonly familySelected = output<string>();

  protected readonly groups = computed(() =>
    this.families().map((family) => ({
      family,
      babies: this.babies().filter((b) => b.familyId === family.id),
    })),
  );
  protected readonly hasSwitcher = computed(
    () => this.families().length > 1 || this.babies().length > 1,
  );
}
