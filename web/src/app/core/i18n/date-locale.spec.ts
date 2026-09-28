import { TestBed } from '@angular/core/testing';
import { DateAdapter } from '@angular/material/core';
import { TranslocoService } from '@jsverse/transloco';
import { translocoTesting } from '../../testing/transloco-testing';
import { provideNalaDates } from './date-locale';

describe('provideNalaDates', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideNalaDates()],
    });
  });

  it('provides a date adapter in the language the app shows, following changes', () => {
    const adapter = TestBed.inject(DateAdapter);
    const setLocale = vi.spyOn(adapter, 'setLocale');

    TestBed.inject(TranslocoService).setActiveLang('fr');

    expect(setLocale).toHaveBeenLastCalledWith('fr');
  });
});
