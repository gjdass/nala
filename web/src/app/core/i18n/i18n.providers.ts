import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  EnvironmentProviders,
  Injectable,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import {
  Translation,
  TranslocoLoader,
  TranslocoService,
  provideTransloco,
} from '@jsverse/transloco';
import { LANGS, Lang } from './initial-lang';

@Injectable({ providedIn: 'root' })
class HttpTranslationLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string) {
    return this.http.get<Translation>(`i18n/${lang}.json`);
  }
}

export function provideNalaI18n(initialLang: Lang): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideTransloco({
      config: {
        availableLangs: [...LANGS],
        defaultLang: initialLang,
        fallbackLang: 'en',
        missingHandler: { useFallbackTranslation: true },
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: HttpTranslationLoader,
    }),
    provideEnvironmentInitializer(() => {
      const root = inject(DOCUMENT).documentElement;
      inject(TranslocoService).langChanges$.subscribe((lang) => (root.lang = lang));
    }),
  ]);
}
