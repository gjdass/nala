import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { translocoTesting } from '../../testing/transloco-testing';
import { TemperaturePipe } from './temperature';

describe('TemperaturePipe', () => {
  let transloco: TranslocoService;
  let pipe: TemperaturePipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
    pipe = TestBed.runInInjectionContext(() => new TemperaturePipe());
  });

  it('writes degrees Celsius with one decimal and a no-break space', () => {
    expect(pipe.transform(38.5)).toBe('38.5 °C');
    expect(pipe.transform(38)).toBe('38.0 °C');
  });

  it('is empty without a temperature', () => {
    expect(pipe.transform(null)).toBe('');
  });

  it('writes French with a decimal comma and follows a language change', () => {
    transloco.setActiveLang('fr');

    expect(pipe.transform(38.5)).toBe('38,5 °C');
  });
});
