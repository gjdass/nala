import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

const STORAGE_KEY = 'nala.theme';

const COLOR_SCHEME: Record<ThemeMode, string> = {
  light: 'light',
  dark: 'dark',
  system: 'light dark',
};

const isThemeMode = (value: unknown): value is ThemeMode =>
  (THEME_MODES as readonly unknown[]).includes(value);

/**
 * Light / dark / system theme, persisted per device. The global theme emits its colours
 * with light-dark(), so switching only sets `color-scheme` on <html>.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage;
  private readonly current = signal<ThemeMode>(this.readStored());

  readonly mode = this.current.asReadonly();

  constructor() {
    this.apply(this.current());
  }

  setMode(mode: ThemeMode): void {
    this.current.set(mode);
    this.apply(mode);
    try {
      this.storage?.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage unavailable (private mode, blocked): the choice lasts for this session only.
    }
  }

  private apply(mode: ThemeMode): void {
    this.root.style.colorScheme = COLOR_SCHEME[mode];
  }

  private readStored(): ThemeMode {
    try {
      const stored = this.storage?.getItem(STORAGE_KEY);
      return isThemeMode(stored) ? stored : 'system';
    } catch {
      return 'system';
    }
  }
}
