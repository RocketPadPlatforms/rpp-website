import type { Request } from "express";
import de from "../locales/de.json";
import en from "../locales/en.json";

/**
 * The site is served in German under /de and in English under /en. Each
 * template exists once and pulls its copy from src/locales/<lang>.json through
 * the `t` Handlebars helper, so markup (and its inline SVGs) is never
 * duplicated per language.
 */
export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

// Everyone whose browser prefers neither German nor English - and crawlers,
// which usually send no Accept-Language at all - gets the English site.
export const FALLBACK_LOCALE: Locale = "en";

const dictionaries: Record<Locale, unknown> = { de, en };

export class MissingTranslationError extends Error {
  constructor(locale: Locale, key: string) {
    super(`Missing translation for "${key}" in locale "${locale}"`);
    this.name = "MissingTranslationError";
  }
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Resolves a dotted key ("home.hero.title") to whatever sits there. */
export function lookup(locale: Locale, key: string): unknown {
  let node: unknown = dictionaries[locale];
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object" || !(part in node)) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/**
 * Translates a key and fills `{name}` placeholders from `vars`. A missing key
 * throws rather than rendering the raw key: an untranslated page should fail
 * the test suite, not ship.
 */
export function translate(
  locale: Locale,
  key: string,
  vars: Record<string, unknown> = {}
): string {
  const value = lookup(locale, key);
  if (typeof value !== "string") {
    throw new MissingTranslationError(locale, key);
  }
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

/**
 * Picks the visitor's language from Accept-Language. Only used at "/", which
 * redirects; every /de and /en URL is fixed so both stay crawlable.
 */
export function detectLocale(req: Request): Locale {
  // Without the header, accepts() would hand back the first candidate, which
  // would send every crawler to German regardless of FALLBACK_LOCALE.
  if (!req.get("accept-language")) {
    return FALLBACK_LOCALE;
  }
  const match = req.acceptsLanguages(...LOCALES);
  return isLocale(match) ? match : FALLBACK_LOCALE;
}

/** The locale encoded in a path's first segment, if any. */
export function localeFromPath(path: string): Locale | undefined {
  const first = path.split("/")[1];
  return isLocale(first) ? first : undefined;
}
