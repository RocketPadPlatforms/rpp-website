import { absoluteUrl, SITE_URL } from "../config/site";
import { Locale, LOCALES, translate } from "../i18n";
import { alternateLinks } from "../seo/alternates";
import { jsonLd } from "../seo/jsonld";
import { NavSlot, Page, pageById, pagePath, PAGES } from "./pages";

export interface NavLink {
  href: string;
  label: string;
}

export interface LanguageLink {
  lang: Locale;
  /** Short label shown in the switch, e.g. "DE". */
  code: string;
  /** The language's own name, e.g. "Deutsch", for screen readers. */
  name: string;
  href: string;
  current: boolean;
}

export interface ViewLocals {
  lang: Locale;
  title: string;
  description: string;
  homePath: string;
  faqPath: string;
  navHeader: NavLink[];
  navFooter: NavLink[];
  languages: LanguageLink[];
  year: number;
  [key: string]: unknown;
}

function navFor(slot: NavSlot, locale: Locale): NavLink[] {
  return PAGES.filter((page) => page.nav.includes(slot)).map((page) => ({
    href: pagePath(page, locale),
    label: translate(locale, `pages.${page.id}.nav`),
  }));
}

/**
 * Template locals shared by every page in a locale. `counterpart` is the page
 * the language switch points at; error pages have no counterpart and switch to
 * the other language's homepage.
 */
export function viewLocals(
  locale: Locale,
  page: Page | undefined,
  copyKey: string,
): ViewLocals {
  const target = page ?? pageById("home");
  const title = translate(locale, `pages.${copyKey}.title`);
  const description = translate(locale, `pages.${copyKey}.description`);

  // Error pages are noindex and get no canonical, alternates or JSON-LD:
  // there is nothing there a search engine should associate with a URL.
  const seo = page
    ? {
        canonical: absoluteUrl(pagePath(page, locale)),
        alternates: alternateLinks(page),
        jsonLd: jsonLd(page, locale, title, description),
      }
    : {};

  return {
    lang: locale,
    title,
    description,
    ...seo,
    siteUrl: SITE_URL,
    ogLocale: translate(locale, "meta.ogLocale"),
    ogLocaleAlternates: LOCALES.filter((other) => other !== locale).map(
      (other) => translate(other, "meta.ogLocale"),
    ),
    ogImageAlt: translate(locale, "meta.ogImageAlt"),
    homePath: pagePath(pageById("home"), locale),
    faqPath: pagePath(pageById("faq"), locale),
    navHeader: navFor("header", locale),
    navFooter: navFor("footer", locale),
    languages: LOCALES.map((other) => ({
      lang: other,
      code: other.toUpperCase(),
      name: translate(other, "meta.languageName"),
      href: pagePath(target, other),
      current: other === locale,
    })),
    year: new Date().getFullYear(),
  };
}
