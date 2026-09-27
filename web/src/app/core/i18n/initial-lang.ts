export const LANGS = ['en', 'fr'] as const;
export type Lang = (typeof LANGS)[number];

const isLang = (value: string): value is Lang => (LANGS as readonly string[]).includes(value);

/** First supported language among the browser's preferences, falling back to English. */
export function pickInitialLang(browserLangs: readonly string[]): Lang {
  return browserLangs.map((tag) => tag.split('-')[0].toLowerCase()).find(isLang) ?? 'en';
}
