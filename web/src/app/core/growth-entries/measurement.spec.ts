import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import en from '../../../../public/i18n/en.json';
import { translocoTesting } from '../../testing/transloco-testing';
import { MeasurementPipe, gramsToKg, isoDate, kgToGrams, localDate } from './measurement';

describe('measurement helpers', () => {
  it('converts kg typed in the sheet to whole grams, and back', () => {
    expect(kgToGrams(4.25)).toBe(4250);
    expect(kgToGrams(4.123)).toBe(4123);
    expect(kgToGrams(0.3)).toBe(300);
    expect(kgToGrams(1.005)).toBe(1005);
    expect(gramsToKg(4250)).toBe(4.25);
  });

  it('reads a yyyy-MM-dd date as its local midnight, and writes it back', () => {
    expect(localDate('2026-09-28')).toEqual(new Date(2026, 8, 28));
    expect(isoDate(new Date(2026, 8, 28))).toBe('2026-09-28');
    expect(isoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('MeasurementPipe', () => {
  let transloco: TranslocoService;
  let pipe: MeasurementPipe;
  // The no-break space before the unit is folded, like the card and list tests read it.
  const show = (value: number | null, unit: 'g' | 'cm') =>
    pipe.transform(value, unit).replace(/\s+/g, ' ');

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
    pipe = TestBed.runInInjectionContext(() => new MeasurementPipe());
  });

  it('shows a weight in kg with 3 decimals', () => {
    expect(en.growth.unit.kg).toBe('{{value}}\u00a0kg');
    expect(show(4250, 'g')).toBe('4.250 kg');
    expect(show(4000, 'g')).toBe('4.000 kg');
  });

  it('shows a length in cm with 1 decimal', () => {
    expect(show(55.5, 'cm')).toBe('55.5 cm');
    expect(show(38, 'cm')).toBe('38.0 cm');
  });

  it('shows nothing without a value', () => {
    expect(pipe.transform(null, 'g')).toBe('');
  });

  it('formats in French', () => {
    transloco.setActiveLang('fr');

    expect(show(4250, 'g')).toBe('4,250 kg');
    expect(show(55.5, 'cm')).toBe('55,5 cm');
  });
});
