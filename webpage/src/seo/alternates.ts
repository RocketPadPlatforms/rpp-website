import { absoluteUrl } from "../config/site";
import { FALLBACK_LOCALE, LOCALES } from "../i18n";
import { Page, pagePath } from "../routes/pages";

export interface AlternateLink {
  hreflang: string;
  href: string;
}

/**
 * hreflang alternates for a page: one per locale plus x-default. For the
 * homepage x-default is "/", which picks the language from the browser - the
 * pattern Google documents for auto-redirecting locale selectors. Every other
 * page has no selector, so x-default is its fallback-language version.
 */
export function alternateLinks(page: Page): AlternateLink[] {
  const xDefault = page.id === "home" ? "/" : pagePath(page, FALLBACK_LOCALE);

  return [
    ...LOCALES.map((locale) => ({
      hreflang: locale,
      href: absoluteUrl(pagePath(page, locale))
    })),
    { hreflang: "x-default", href: absoluteUrl(xDefault) }
  ];
}
