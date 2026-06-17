import translations from "~/generated/translations.json";

/**
 * Substitutes `{placeholder}` tokens in a message with the given values.
 * Note: simple interpolation only — not full ICU MessageFormat (no plurals,
 * select, etc.). Reach for `intl-messageformat` if those are ever needed.
 */
function interpolate(
  message: string,
  values: Record<string, string | number>
) {
  return message.replace(/\{(\w+)\}/g, (_, key) =>
    values[key] !== undefined ? String(values[key]) : `{${key}}`
  );
}

export function useTranslations(locale: keyof typeof translations) {
  return {
    t<K extends keyof (typeof translations)[typeof locale]>(
      key: K,
      values?: Record<string, string | number>
    ) {
      const message = translations[locale][key];
      return values ? interpolate(message, values) : message;
    },
    n: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
    d: (value: Date | string, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, options).format(new Date(value)),
  };
}
