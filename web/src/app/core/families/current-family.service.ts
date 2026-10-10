import { Injectable, computed, inject, signal } from '@angular/core';
import { Family } from './family.models';
import { FamilyService } from './family.service';

/**
 * The user's families and the current one, which new babies (and later the settings' family sections) are for.
 * For now the current family is the first one (spec 03 slice 11 adds the device's choice).
 */
@Injectable({ providedIn: 'root' })
export class CurrentFamilyService {
  private readonly api = inject(FamilyService);
  private readonly list = signal<Family[] | null>(null);

  /** Null until loaded. */
  readonly families = this.list.asReadonly();
  /** Null until loaded, or when the user is in no family. */
  readonly current = computed(() => this.list()?.[0] ?? null);

  /** Loads the families; a failed load keeps what was there. */
  refresh(): void {
    this.api.list().subscribe((result) => {
      if (result.ok) {
        this.list.set(result.families);
      }
    });
  }

  /** Whether the user is the family admin of `familyId` (false for a family they aren't in). */
  isAdminOf(familyId: string): boolean {
    return this.list()?.find((f) => f.id === familyId)?.isAdmin ?? false;
  }
}
