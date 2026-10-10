import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
import { BabyAgePipe } from '../../../core/babies/baby-age.pipe';
import { Baby, BabySheetResult } from '../../../core/babies/baby.models';
import { BabyService } from '../../../core/babies/baby.service';
import { byBirthDate } from '../../../core/babies/selected-baby.service';
import { CurrentFamilyService } from '../../../core/families/current-family.service';
import { SheetService } from '../../../shared/ui/sheet/sheet.service';
import { BabySheetComponent } from '../../babies/baby-sheet/baby-sheet.component';

/** The current family's babies (name + age), added, edited and deleted (family admin) through the baby sheet. */
@Component({
  selector: 'nala-settings-babies',
  imports: [BabyAgePipe, MatButtonModule, MatIconModule, MatListModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-babies.component.html',
  styleUrl: './settings-babies.component.scss',
})
export class SettingsBabiesComponent {
  private readonly sheet = inject(SheetService);
  private readonly families = inject(CurrentFamilyService);
  /** Every family's babies, as listed by the API and changed here. */
  private readonly all = signal<Baby[]>([]);

  protected readonly babies = computed(() => {
    const familyId = this.families.current()?.id;
    return this.all().filter((b) => b.familyId === familyId);
  });
  protected readonly loadError = signal(false);

  constructor() {
    inject(BabyService)
      .list()
      .subscribe((result) => {
        if (result.ok) {
          this.all.set(result.babies);
        } else {
          this.loadError.set(true);
        }
      });
  }

  protected add(): void {
    this.sheet.open<BabySheetComponent, BabySheetResult>(BabySheetComponent).subscribe((result) => {
      if (result && 'saved' in result) {
        this.all.update((babies) => byBirthDate([...babies, result.saved]));
      }
    });
  }

  protected edit(baby: Baby): void {
    this.sheet
      .open<BabySheetComponent, BabySheetResult>(BabySheetComponent, baby)
      .subscribe((result) => {
        if (!result) {
          return;
        }
        if ('deleted' in result) {
          this.all.update((babies) => babies.filter((b) => b.id !== result.deleted));
        } else {
          const updated = result.saved;
          this.all.update((babies) =>
            byBirthDate(babies.map((b) => (b.id === updated.id ? updated : b))),
          );
        }
      });
  }
}
