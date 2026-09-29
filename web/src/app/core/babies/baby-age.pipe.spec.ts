import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { translocoTesting } from '../../testing/transloco-testing';
import { BabyAgePipe } from './baby-age.pipe';

describe('BabyAgePipe', () => {
  let pipe: BabyAgePipe;
  let transloco: TranslocoService;

  const today = new Date(2026, 8, 28, 9, 0);
  const format = (birthDate: string) => pipe.transform(birthDate, today);

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
    pipe = TestBed.runInInjectionContext(() => new BabyAgePipe());
  });

  it('formats in English, leaving out a zero part', () => {
    expect(format('2026-09-28')).toBe('0 days');
    expect(format('2026-09-27')).toBe('1 day');
    expect(format('2026-09-23')).toBe('5 days');
    expect(format('2026-09-14')).toBe('2 weeks');
    expect(format('2026-09-06')).toBe('3 weeks 1 day');
    expect(format('2026-08-15')).toBe('6 weeks 2 days');
    expect(format('2026-05-18')).toBe('4 months 10 days');
    expect(format('2025-08-28')).toBe('13 months');
  });

  it('formats in French', () => {
    transloco.setActiveLang('fr');

    expect(format('2026-09-27')).toBe('1 jour');
    expect(format('2026-09-14')).toBe('2 semaines');
    expect(format('2026-08-15')).toBe('6 semaines 2 jours');
    expect(format('2026-06-28')).toBe('3 mois');
    expect(format('2026-05-18')).toBe('4 mois 10 jours');
  });

  it('follows a language change', () => {
    expect(format('2026-09-23')).toBe('5 days');

    transloco.setActiveLang('fr');

    expect(format('2026-09-23')).toBe('5 jours');
  });
});
