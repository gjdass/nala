import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
import { BabyAgePipe } from '../../../core/babies/baby-age.pipe';
import { Baby } from '../../../core/babies/baby.models';
import { BabyService } from '../../../core/babies/baby.service';
import { SheetService } from '../../../shared/ui/sheet/sheet.service';
import { BabySheetComponent } from '../../babies/baby-sheet/baby-sheet.component';

/** Oldest first, like the API; ties keep their order (creation). */
const byBirthDate = (babies: Baby[]) =>
  [...babies].sort((a, b) => a.birthDate.localeCompare(b.birthDate));

/** The family's babies (name + age), added and edited through the baby sheet. */
@Component({
  selector: 'nala-settings-babies',
  imports: [BabyAgePipe, MatButtonModule, MatIconModule, MatListModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-babies.component.html',
  styleUrl: './settings-babies.component.scss',
})
export class SettingsBabiesComponent {
  private readonly sheet = inject(SheetService);

  protected readonly babies = signal<Baby[]>([]);
  protected readonly loadError = signal(false);

  constructor() {
    inject(BabyService)
      .list()
      .subscribe((result) => {
        if (result.ok) {
          this.babies.set(result.babies);
        } else {
          this.loadError.set(true);
        }
      });
  }

  protected add(): void {
    this.sheet.open<BabySheetComponent, Baby>(BabySheetComponent).subscribe((added) => {
      if (added) {
        this.babies.update((babies) => byBirthDate([...babies, added]));
      }
    });
  }

  protected edit(baby: Baby): void {
    this.sheet.open<BabySheetComponent, Baby>(BabySheetComponent, baby).subscribe((updated) => {
      if (updated) {
        this.babies.update((babies) =>
          byBirthDate(babies.map((b) => (b.id === updated.id ? updated : b))),
        );
      }
    });
  }
}
