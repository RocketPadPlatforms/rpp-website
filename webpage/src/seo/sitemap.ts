import { statSync } from "fs";
import path from "path";
import { absoluteUrl } from "../config/site";
import { VIEWS_DIR } from "../config/paths";
import { Locale, LOCALES } from "../i18n";
import { Page, pagePath, PAGES } from "../routes/pages";
import { alternateLinks } from "./alternates";

// Pages outside the localised table that should still be indexed. The
// composer has a single, English UI.
const EXTRA_PATHS = ["/composer"];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mtime(file: string): number {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * lastmod is the newest of the files a page is rendered from: its view, the
 * shared layout and the locale's copy. That keeps it honest without anyone
 * having to remember to bump a date by hand.
 */
function lastModified(page: Page, locale: Locale): string | undefined {
  const newest = Math.max(
    mtime(path.join(VIEWS_DIR, `${page.view[locale]}.hbs`)),
    mtime(path.join(VIEWS_DIR, "layouts", "main.hbs")),
    mtime(path.join(__dirname, "..", "locales", `${locale}.json`))
  );
  return newest > 0 ? new Date(newest).toISOString() : undefined;
}

export function renderSitemap(): string {
  const entries: string[] = [];

  for (const page of PAGES) {
    for (const locale of LOCALES) {
      const lastmod = lastModified(page, locale);
      const links = alternateLinks(page)
        .map(
          (link) =>
            `    <xhtml:link rel="alternate" hreflang="${link.hreflang}" href="${escapeXml(link.href)}"/>`
        )
        .join("\n");

      entries.push(
        [
          "  <url>",
          `    <loc>${escapeXml(absoluteUrl(pagePath(page, locale)))}</loc>`,
          ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
          links,
          "  </url>"
        ].join("\n")
      );
    }
  }

  for (const extra of EXTRA_PATHS) {
    entries.push(["  <url>", `    <loc>${escapeXml(absoluteUrl(extra))}</loc>`, "  </url>"].join("\n"));
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    "</urlset>",
    ""
  ].join("\n");
}
