import { pickInitialLang } from './initial-lang';

describe('pickInitialLang', () => {
  it('picks fr for ["fr-CA", "en"]', () => {
    expect(pickInitialLang(['fr-CA', 'en'])).toBe('fr');
  });

  it('picks en for ["en-GB"]', () => {
    expect(pickInitialLang(['en-GB'])).toBe('en');
  });

  it('picks the first supported language for ["de-DE", "fr"]', () => {
    expect(pickInitialLang(['de-DE', 'fr'])).toBe('fr');
  });

  it('falls back to en for ["de-DE"]', () => {
    expect(pickInitialLang(['de-DE'])).toBe('en');
  });

  it('falls back to en for []', () => {
    expect(pickInitialLang([])).toBe('en');
  });
});
