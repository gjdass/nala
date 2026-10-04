import { EnvironmentProviders, Provider } from '@angular/core';
import { SECTIONS } from './core/sections/section.models';
import { appConfig } from './app.config';

describe('appConfig', () => {
  it('registers the built sections, Feed, Sleep then Diaper', () => {
    const provider = (appConfig.providers as (Provider | EnvironmentProviders)[]).find(
      (p): p is { provide: typeof SECTIONS; useValue: { key: string }[] } =>
        typeof p === 'object' && p !== null && 'provide' in p && p.provide === SECTIONS,
    );

    expect(provider?.useValue.map((section) => section.key)).toEqual([
      'feed',
      'sleep',
      'diaper',
      'pump',
    ]);
  });
});
