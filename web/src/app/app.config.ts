import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { provideNalaDates } from './core/i18n/date-locale';
import { provideNalaI18n } from './core/i18n/i18n.providers';
import { provideNalaIcons } from './core/icons/icons.providers';
import { pickInitialLang } from './core/i18n/initial-lang';
import { provideUserLanguage } from './core/i18n/user-language';
import { ThemeService } from './core/theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideNalaI18n(pickInitialLang(navigator.languages)),
    provideUserLanguage(),
    provideNalaDates(),
    provideNalaIcons(),
    provideAppInitializer(() => void inject(ThemeService)),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
