import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { translocoTesting } from '../../testing/transloco-testing';
import { DosePipe } from './dose';

describe('DosePipe', () => {
  let transloco: TranslocoService;
  let pipe: DosePipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
    pipe = TestBed.runInInjectionContext(() => new DosePipe());
  });

  it('writes the amount with its unit', () => {
    expect(pipe.transform({ amount: 2.5, unit: 'ml' })).toBe('2.5 ml');
    expect(pipe.transform({ amount: 120, unit: 'mg' })).toBe('120 mg');
    expect(pipe.transform({ amount: 10, unit: 'drops' })).toBe('10 drops');
    expect(pipe.transform({ amount: 2, unit: 'dose' })).toBe('2 doses');
    expect(pipe.transform({ amount: 0.25, unit: 'dose' })).toBe('0.25 doses');
  });

  it('uses the singular for exactly 1 drop or dose', () => {
    expect(pipe.transform({ amount: 1, unit: 'drops' })).toBe('1 drop');
    expect(pipe.transform({ amount: 1, unit: 'dose' })).toBe('1 dose');
    expect(pipe.transform({ amount: 1, unit: 'ml' })).toBe('1 ml');
  });

  it('is empty without an amount', () => {
    expect(pipe.transform({ amount: null, unit: null })).toBe('');
  });

  it('writes French with a decimal comma and follows a language change', () => {
    transloco.setActiveLang('fr');

    expect(pipe.transform({ amount: 2.5, unit: 'ml' })).toBe('2,5 ml');
    expect(pipe.transform({ amount: 10, unit: 'drops' })).toBe('10 gouttes');
    expect(pipe.transform({ amount: 1, unit: 'drops' })).toBe('1 goutte');
    expect(pipe.transform({ amount: 1, unit: 'dose' })).toBe('1 dose');
  });
});
