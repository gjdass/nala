import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { BabySheetResult } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { SheetService } from '../../../shared/ui/sheet/sheet.service';
import { BabySheetComponent } from '../baby-sheet/baby-sheet.component';

/**
 * The screen of a family without a baby yet (spec 03): an empty state inviting to add one, opening the
 * baby sheet; the saved baby becomes the selected one. Shown by home and History.
 */
@Component({
  selector: 'nala-no-baby',
  imports: [EmptyStateComponent, MatButtonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './no-baby.component.html',
  styles: ':host { display: block; }',
})
export class NoBabyComponent {
  private readonly sheet = inject(SheetService);
  private readonly store = inject(SelectedBabyService);

  protected addBaby(): void {
    this.sheet.open<BabySheetComponent, BabySheetResult>(BabySheetComponent).subscribe((result) => {
      if (result && 'saved' in result) {
        this.store.add(result.saved);
      }
    });
  }
}
