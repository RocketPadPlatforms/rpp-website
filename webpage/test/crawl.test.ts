import type { Application } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

process.env.NODE_ENV = "development";
process.env.APP_ROOT = ".";
process.env.LOG_LEVEL = "silent";

// Needs the composer to be built (`npm test` runs build:composer first), since
// /composer is part of the crawl.

const SITE = "https://rocketpadplatforms.de";
const START = ["/de", "/en"];

interface Crawl {
  /** Pages that answered 200 with HTML, with their internal links. */
  pages: Map<string, string[]>;
  /** Every internal URL that answered something other than 200 or a redirect. */
  broken: Map<string, number>;
}

let app: Application;
let crawl: Crawl;

/** Internal link targets in a page, without fragment or query. */
function internalLinks(html: string): string[] {
  const links = new Set<string>();
  for (const [, href] of html.matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    const path = href.split("#")[0].split("?")[0] || "/";
    links.add(path);
  }
  return [...links];
}

/**
 * Follows every internal link from the homepages, the way a crawler that only
 * reads links (never the sitemap) would, including through redirects.
 */
async function crawlSite(): Promise<Crawl> {
  const pages = new Map<string, string[]>();
  const broken = new Map<string, number>();
  const seen = new Set<string>();
  const queue = [...START];

  while (queue.length > 0) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);

    const res = await request(app).get(path);
    if (res.status >= 300 && res.status < 400) {
      const location = String(res.headers.location).split("#")[0];
      if (location.startsWith("/")) queue.push(location);
      continue;
    }
    if (
      res.status !== 200 ||
      !/text\/html/.test(res.headers["content-type"] ?? "")
    ) {
      if (res.status !== 200) broken.set(path, res.status);
      continue;
    }

    const links = internalLinks(res.text);
    pages.set(path, links);
    // Assets are checked for reachability, not crawled into.
    queue.push(...links);
  }

  return { pages, broken };
}

async function sitemapPaths(): Promise<string[]> {
  const res = await request(app).get("/sitemap.xml");
  return [...res.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) =>
    loc.replace(SITE, ""),
  );
}

beforeAll(async () => {
  const { createApp } = await import("../src/config/express");
  app = createApp();
  crawl = await crawlSite();
});

describe("crawl from the homepages", () => {
  it("reaches every page in the sitemap through links - no orphans", async () => {
    const orphans = (await sitemapPaths()).filter(
      (path) => !crawl.pages.has(path),
    );
    expect(orphans).toEqual([]);
  });

  it("finds no indexable page that the sitemap leaves out", async () => {
    const listed = new Set(await sitemapPaths());
    const unlisted = [...crawl.pages.keys()].filter(
      (path) => !listed.has(path),
    );
    expect(unlisted).toEqual([]);
  });

  it("follows no internal link to an error", () => {
    expect(Object.fromEntries(crawl.broken)).toEqual({});
  });

  it("links the Impressum and the privacy policy from every page", () => {
    for (const [path, links] of crawl.pages) {
      expect(
        links.some((l) => l === "/de/impressum" || l === "/en/legal-notice"),
        `${path} links the Impressum`,
      ).toBe(true);
      expect(
        links.some((l) => l === "/de/datenschutz" || l === "/en/privacy"),
        `${path} links the privacy policy`,
      ).toBe(true);
    }
  });

  it("links every translated page from its counterpart", () => {
    const pairs = [
      ["/de", "/en"],
      ["/de/faq", "/en/faq"],
      ["/de/impressum", "/en/legal-notice"],
      ["/de/datenschutz", "/en/privacy"],
    ];
    for (const [de, en] of pairs) {
      expect(crawl.pages.get(de), de).toContain(en);
      expect(crawl.pages.get(en), en).toContain(de);
    }
  });

  it("links the FAQ from the header and the contact section, not only the footer", async () => {
    for (const [home, faq] of [
      ["/de", "/de/faq"],
      ["/en", "/en/faq"],
    ]) {
      const html = (await request(app).get(home)).text;
      const count = html.split(`href="${faq}"`).length - 1;
      // desktop nav, mobile nav, contact section, footer
      expect(count, home).toBeGreaterThanOrEqual(4);
    }
  });
});
