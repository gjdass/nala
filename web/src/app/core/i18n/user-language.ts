import {
  EnvironmentProviders,
  effect,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../auth/auth.service';

/** Once signed in, the app shows the user's preferred language; signed-out screens keep the browser's. */
export function provideUserLanguage(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      const auth = inject(AuthService);
      const transloco = inject(TranslocoService);
      effect(() => {
        const language = auth.state()?.user?.language;
        if (language) {
          transloco.setActiveLang(language);
        }
      });
    }),
  ]);
}
