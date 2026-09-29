import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { Baby } from '../../core/babies/baby.models';
import { SelectedBabyService } from '../../core/babies/selected-baby.service';
import { HealthService, HealthStatus } from '../../core/health/health.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { SheetService } from '../../shared/ui/sheet/sheet.service';
import { TopAppBarComponent } from '../../shared/ui/top-app-bar/top-app-bar.component';
import { BabySheetComponent } from '../babies/baby-sheet/baby-sheet.component';

/** The top bar with the selected baby; until the family has a baby, only the invitation to add one. */
@Component({
  selector: 'nala-home',
  imports: [EmptyStateComponent, MatButtonModule, MatCardModule, TopAppBarComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly health$: Observable<HealthStatus | 'loading'> = inject(HealthService).check();
  private readonly sheet = inject(SheetService);

  protected readonly status = toSignal(this.health$, { initialValue: 'loading' });

  protected readonly store = inject(SelectedBabyService);

  constructor() {
    this.store.refresh();
  }

  protected addBaby(): void {
    this.sheet.open<BabySheetComponent, Baby>(BabySheetComponent).subscribe((baby) => {
      if (baby) {
        this.store.add(baby);
      }
    });
  }
}
