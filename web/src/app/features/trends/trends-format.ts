/** A count, whole on a day and with one decimal as an average ("6.4"), in the language's digits. */
export function formatCount(value: number, lang: string): string {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(value);
}

/** A volume in ml, rounded to a whole number ("720 ml"). */
export function formatMl(value: number, lang: string): string {
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(value)} ml`;
}
