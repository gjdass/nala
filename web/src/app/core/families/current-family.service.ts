import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Family } from './family.models';
import { FamilyService } from './family.service';

const STORAGE_KEY = 'nala.family';

/**
 * The user's families and the current one, which the selected baby, new babies and the settings' family sections
 * are for. The choice is remembered per device; a family the user is no longer in falls back to the first one.
 */
@Injectable({ providedIn: 'root' })
export class CurrentFamilyService {
  private readonly api = inject(FamilyService);
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage;
  private readonly list = signal<Family[] | null>(null);
  private readonly storedId = signal<string | null>(null);

  /** Null until loaded. */
  readonly families = this.list.asReadonly();
  /** Null until loaded, or when the user is in no family. */
  readonly current = computed(() => {
    const families = this.list() ?? [];
    return families.find((f) => f.id === this.storedId()) ?? families[0] ?? null;
  });
  readonly loadError = signal(false);

  /** Loads the families and restores this device's choice; a failed load keeps what was there. */
  refresh(): void {
    this.api.list().subscribe((result) => {
      if (result.ok) {
        this.storedId.set(this.readStored());
        this.loadError.set(false);
        this.list.set(result.families);
      } else {
        this.loadError.set(true);
      }
    });
  }

  select(familyId: string): void {
    this.storedId.set(familyId);
    try {
      this.storage?.setItem(STORAGE_KEY, familyId);
    } catch {
      // Storage unavailable (private mode, blocked): the choice lasts for this session only.
    }
  }

  /** Whether the user is the family admin of `familyId` (false for a family they aren't in). */
  isAdminOf(familyId: string): boolean {
    return this.list()?.find((f) => f.id === familyId)?.isAdmin ?? false;
  }

  private readStored(): string | null {
    try {
      return this.storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }
}
