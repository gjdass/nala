import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CurrentFamilyService } from '../families/current-family.service';
import { Baby } from './baby.models';
import { BabyService } from './baby.service';

const STORAGE_KEY = 'nala.baby';

/** Oldest first, like the API; ties keep their order (creation). */
export const byBirthDate = (babies: Baby[]) =>
  [...babies].sort((a, b) => a.birthDate.localeCompare(b.birthDate));

/**
 * The family's babies and the one the app shows. The selection is remembered per device;
 * when the remembered baby no longer exists, the first one is shown.
 */
@Injectable({ providedIn: 'root' })
export class SelectedBabyService {
  private readonly api = inject(BabyService);
  private readonly families = inject(CurrentFamilyService);
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage;
  private readonly list = signal<Baby[] | null>(null);
  private readonly storedId = signal<string | null>(null);

  /** Null until loaded. */
  readonly babies = this.list.asReadonly();
  readonly loadError = signal(false);
  readonly selected = computed(() => {
    const babies = this.list() ?? [];
    return babies.find((b) => b.id === this.storedId()) ?? babies[0] ?? null;
  });

  /**
   * Loads the babies, and the families along with them, and restores this device's choice. A baby that
   * didn't change stays the same object, so reloading leaves the selected baby (and what follows it) as it was.
   */
  refresh(): void {
    this.families.refresh();
    this.api.list().subscribe((result) => {
      if (result.ok) {
        const known = new Map((this.list() ?? []).map((b) => [b.id, b]));
        const same = (a: Baby, b: Baby | undefined) => JSON.stringify(a) === JSON.stringify(b);
        this.storedId.set(this.readStored());
        this.loadError.set(false);
        this.list.set(
          result.babies.map((baby) =>
            same(baby, known.get(baby.id)) ? known.get(baby.id)! : baby,
          ),
        );
      } else {
        this.loadError.set(true);
      }
    });
  }

  select(id: string): void {
    this.storedId.set(id);
    try {
      this.storage?.setItem(STORAGE_KEY, id);
    } catch {
      // Storage unavailable (private mode, blocked): the choice lasts for this session only.
    }
  }

  add(baby: Baby): void {
    this.list.update((babies) => byBirthDate([...(babies ?? []), baby]));
  }

  /** Puts back a baby edited elsewhere (e.g. from the Growth Birth item). */
  update(baby: Baby): void {
    this.list.update((babies) =>
      byBirthDate((babies ?? []).map((b) => (b.id === baby.id ? baby : b))),
    );
  }

  /** Drops a deleted baby; when it was the selected one, the first one left is shown. */
  remove(id: string): void {
    this.list.update((babies) => (babies ?? []).filter((b) => b.id !== id));
  }

  private readStored(): string | null {
    try {
      return this.storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }
}
