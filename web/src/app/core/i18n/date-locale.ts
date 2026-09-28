import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { DateAdapter, provideNativeDateAdapter } from '@angular/material/core';
import { TranslocoService } from '@jsverse/transloco';

/** Material's date adapter, formatting dates (datepicker) in the language the app shows. */
export function provideNalaDates(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideNativeDateAdapter(),
    provideEnvironmentInitializer(() => {
      const adapter = inject(DateAdapter);
      inject(TranslocoService).langChanges$.subscribe((lang) => adapter.setLocale(lang));
    }),
  ]);
}
