import { EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';

/** `mat-icon` ligatures render with Material Symbols Outlined, bundled with the app (see `styles/_typography.scss`). */
export function provideNalaIcons(): EnvironmentProviders {
  return provideAppInitializer(() => {
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
  });
}
