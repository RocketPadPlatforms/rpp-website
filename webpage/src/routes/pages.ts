import { Locale, LOCALES } from "../i18n";

export type PageId = "home" | "faq" | "imprint" | "privacy";
export type NavSlot = "header" | "footer";

export interface Page {
  id: PageId;
  /** Path below the locale prefix; "" is the locale's homepage. */
  path: Record<Locale, string>;
  /** Handlebars view per locale. Shared templates use the same name twice. */
  view: Record<Locale, string>;
  /**
   * Where the page is linked from on every page. The header and footer are
   * rendered from this, so a page in this table cannot end up reachable only
   * through the sitemap. The homepage is linked from the logo instead.
   */
  nav: NavSlot[];
}

/**
 * The single source of truth for the localised pages. It drives the routes,
 * the navigation, the language switch, the hreflang alternates and the
 * sitemap - add a page here and all of those pick it up.
 *
 * Copy lives in src/locales/<lang>.json under pages.<id> (title, description,
 * nav label). The legal pages are prose that is reviewed as a whole, so they
 * are separate templates per language rather than one template full of keys.
 */
export const PAGES: readonly Page[] = [
  {
    id: "home",
    path: { de: "", en: "" },
    view: { de: "index", en: "index" },
    nav: []
  },
  {
    id: "faq",
    path: { de: "/faq", en: "/faq" },
    view: { de: "faq", en: "faq" },
    nav: ["header", "footer"]
  },
  {
    id: "imprint",
    path: { de: "/impressum", en: "/legal-notice" },
    view: { de: "legal/de/impressum", en: "legal/en/legal-notice" },
    nav: ["footer"]
  },
  {
    id: "privacy",
    path: { de: "/datenschutz", en: "/privacy" },
    view: { de: "legal/de/datenschutz", en: "legal/en/privacy" },
    nav: ["footer"]
  }
];

export function pageById(id: PageId): Page {
  const page = PAGES.find((candidate) => candidate.id === id);
  if (!page) {
    throw new Error(`Unknown page "${id}"`);
  }
  return page;
}

/** Site-relative URL of a page in a locale, e.g. "/en/legal-notice". */
export function pagePath(page: Page, locale: Locale): string {
  return `/${locale}${page.path[locale]}`;
}

/** Every localised URL, for the sitemap and the crawl test. */
export function allPagePaths(): string[] {
  return PAGES.flatMap((page) => LOCALES.map((locale) => pagePath(page, locale)));
}

/**
 * Old URLs that must keep their ranking. The six per-market landing pages were
 * German and were folded into sections of the homepage; the legal pages and
 * the FAQ moved under the /de prefix.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/impressum": "/de/impressum",
  "/datenschutz": "/de/datenschutz",
  "/info/faq": "/de/faq",
  "/cloud": "/de#pillars",
  "/devops": "/de#consultancy",
  "/kubernetes": "/de#pillars",
  "/platform": "/de#product",
  "/software": "/de#consultancy",
  "/training": "/de#consultancy"
};
