import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { translocoTesting } from '../../testing/transloco-testing';
import { DurationPipe } from './duration';

describe('DurationPipe', () => {
  let transloco: TranslocoService;
  let pipe: DurationPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
    pipe = TestBed.runInInjectionContext(() => new DurationPipe());
  });

  it('formats seconds in English, leaving out zero parts', () => {
    expect(pipe.transform(0)).toBe('0s');
    expect(pipe.transform(45)).toBe('45s');
    expect(pipe.transform(8 * 60 + 30)).toBe('8m 30s');
    expect(pipe.transform(8 * 60)).toBe('8m');
    expect(pipe.transform(3600 + 5 * 60 + 12)).toBe('1h 5m');
    expect(pipe.transform(2 * 3600 + 20)).toBe('2h');
  });

  it('rounds down to whole seconds', () => {
    expect(pipe.transform(45.9)).toBe('45s');
  });

  it('formats in French and follows a language change', () => {
    transloco.setActiveLang('fr');

    expect(pipe.transform(45)).toBe('45 s');
    expect(pipe.transform(8 * 60 + 30)).toBe('8 min 30 s');
    expect(pipe.transform(3600 + 5 * 60)).toBe('1 h 5 min');
    expect(pipe.transform(2 * 3600)).toBe('2 h');
  });
});
