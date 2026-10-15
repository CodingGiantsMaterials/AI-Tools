export const languages = ['pl', 'en', 'de', 'es'] as const;
export type Language = typeof languages[number];

export function isLanguage(value: unknown): value is Language {
  return (languages as readonly unknown[]).includes(value);
}

/** Plain text, or a function inserting parameters, for example `(n: number) => \`Track ${n}\``. */
export type Message = string | ((...parameters: never[]) => string);

/**
 * The message shape of an application's reference dictionary. Annotating each other language's
 * dictionary with it makes a missing or unknown key, or a text/parameter mismatch, a compile error.
 */
export type MessagesOf<Reference extends Record<string, Message>> = {
  [Key in keyof Reference]: Reference[Key] extends string ? string : Reference[Key];
};

/** The first supported primary subtag in the browser's preference order (`es-MX` → `es`), otherwise `en`. */
export function browserLanguage(preferences: readonly string[] = navigator.languages): Language {
  for (const tag of preferences) {
    const primary = tag.toLowerCase().split('-')[0];
    if (isLanguage(primary)) return primary;
  }
  return 'en';
}
