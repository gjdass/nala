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
import { provideOfflineQueue } from './core/offline/offline-queue.service';
import { SECTIONS } from './core/sections/section.models';
import { ThemeService } from './core/theme/theme.service';
import { DIAPER_SECTION } from './features/diaper/diaper.section';
import { GROWTH_SECTION } from './features/growth/growth.section';
import { HEALTH_SECTION } from './features/health/health.section';
import { FEED_SECTION } from './features/feed/feed.section';
import { PUMP_SECTION } from './features/pump/pump.section';
import { SLEEP_SECTION } from './features/sleep/sleep.section';
import { provideFeedTimers } from './features/feed/feed-timers';
import { providePumpTimers } from './features/pump/pump-timers';
import { provideSleepTimers } from './features/sleep/sleep-timers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideNalaI18n(pickInitialLang(navigator.languages)),
    provideUserLanguage(),
    provideNalaDates(),
    provideNalaIcons(),
    {
      provide: SECTIONS,
      useValue: [
        FEED_SECTION,
        SLEEP_SECTION,
        DIAPER_SECTION,
        PUMP_SECTION,
        GROWTH_SECTION,
        HEALTH_SECTION,
      ],
    },
    provideFeedTimers(),
    provideSleepTimers(),
    providePumpTimers(),
    provideOfflineQueue(),
    provideAppInitializer(() => void inject(ThemeService)),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
