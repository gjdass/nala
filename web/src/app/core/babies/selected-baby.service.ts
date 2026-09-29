import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
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

  /** Loads the babies and restores this device's choice. */
  refresh(): void {
    this.api.list().subscribe((result) => {
      if (result.ok) {
        this.storedId.set(this.readStored());
        this.loadError.set(false);
        this.list.set(result.babies);
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

  private readStored(): string | null {
    try {
      return this.storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }
}
