import type { Application } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

process.env.NODE_ENV = "development";
process.env.APP_ROOT = ".";
process.env.LOG_LEVEL = "silent";

const SITE = "https://rocketpadplatforms.de";
const PAGES = [
  "/de",
  "/en",
  "/de/faq",
  "/en/faq",
  "/de/impressum",
  "/en/legal-notice",
  "/de/datenschutz",
  "/en/privacy",
];

let app: Application;

beforeAll(async () => {
  const { createApp } = await import("../src/config/express");
  app = createApp();
});

function jsonLdOf(html: string): { "@graph": Array<Record<string, unknown>> } {
  const match = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  expect(match, "JSON-LD block").not.toBeNull();
  return JSON.parse(match![1]);
}

function byType(graph: Array<Record<string, unknown>>, type: string) {
  return graph.filter((node) => node["@type"] === type);
}

describe("head metadata", () => {
  it.each(PAGES)(
    "%s has a self-referencing canonical on the public origin",
    async (path) => {
      const res = await request(app).get(path).set("Host", "staging.internal");
      expect(res.text).toContain(
        `<link rel="canonical" href="${SITE}${path}">`,
      );
      expect(res.text).not.toContain("staging.internal");
    },
  );

  it.each(PAGES)("%s has its own title and description", async (path) => {
    const res = await request(app).get(path);
    const title = res.text.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = res.text.match(
      /<meta name="description" content="([^"]+)">/,
    )?.[1];
    expect(title).toBeTruthy();
    expect(description!.length).toBeGreaterThan(50);
  });

  it("titles and descriptions are unique across pages", async () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const path of PAGES) {
      const res = await request(app).get(path);
      titles.add(res.text.match(/<title>([^<]+)<\/title>/)![1]);
      descriptions.add(
        res.text.match(/<meta name="description" content="([^"]+)">/)![1],
      );
    }
    expect(titles.size).toBe(PAGES.length);
    expect(descriptions.size).toBe(PAGES.length);
  });

  it("the homepage lists both languages and x-default as alternates", async () => {
    const res = await request(app).get("/de");
    expect(res.text).toContain(
      `<link rel="alternate" hreflang="de" href="${SITE}/de">`,
    );
    expect(res.text).toContain(
      `<link rel="alternate" hreflang="en" href="${SITE}/en">`,
    );
    expect(res.text).toContain(
      `<link rel="alternate" hreflang="x-default" href="${SITE}/">`,
    );
  });

  it("subpages pair their translations, with English as x-default", async () => {
    const res = await request(app).get("/de/impressum");
    expect(res.text).toContain(`hreflang="en" href="${SITE}/en/legal-notice"`);
    expect(res.text).toContain(
      `hreflang="x-default" href="${SITE}/en/legal-notice"`,
    );
  });

  it("Open Graph and Twitter tags are present and localised", async () => {
    const res = await request(app).get("/de");
    expect(res.text).toContain(`<meta property="og:url" content="${SITE}/de">`);
    expect(res.text).toContain(
      `<meta property="og:image" content="${SITE}/assets/img/og-default.png">`,
    );
    expect(res.text).toContain('<meta property="og:locale" content="de_DE">');
    expect(res.text).toContain(
      '<meta property="og:locale:alternate" content="en_US">',
    );
    expect(res.text).toContain(
      '<meta name="twitter:card" content="summary_large_image">',
    );
  });

  it("the share image is served", async () => {
    const res = await request(app).get("/assets/img/og-default.png");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
  });

  it("error pages carry no canonical", async () => {
    const res = await request(app).get("/en/nope");
    expect(res.text).not.toContain('rel="canonical"');
  });
});

describe("structured data", () => {
  it.each(PAGES)(
    "%s carries parseable JSON-LD with the organisation",
    async (path) => {
      const graph = jsonLdOf((await request(app).get(path)).text)["@graph"];
      const [org] = byType(graph, "Organization");
      expect(org.legalName).toBe("Rocket Pad Platforms GmbH");
      expect(org).not.toHaveProperty("vatID");
      expect(byType(graph, "WebSite")).toHaveLength(1);
    },
  );

  it("people are listed with the managing director first and localised job titles", async () => {
    const graph = jsonLdOf((await request(app).get("/de")).text)["@graph"];
    const people = byType(graph, "Person");
    expect(people.map((person) => person.name)).toEqual([
      "Kilian Mehringer",
      "Alexander Weidemann",
    ]);
    expect(people[0].jobTitle).toBe(
      "Geschäftsführer · Cloud Engineer · DevOps Engineer",
    );
    expect(people[1].jobTitle).toBe("Kubernetes Engineer · Platform Engineer");
  });

  it("the homepage describes the professional service", async () => {
    const graph = jsonLdOf((await request(app).get("/en")).text)["@graph"];
    expect(byType(graph, "ProfessionalService")).toHaveLength(1);
  });

  it.each(["/de/faq", "/en/faq"])(
    "%s exposes every visible question as FAQPage",
    async (path) => {
      const html = (await request(app).get(path)).text;
      const [faq] = byType(jsonLdOf(html)["@graph"], "FAQPage");
      const questions = (faq.mainEntity as Array<{ name: string }>).map(
        (q) => q.name,
      );
      const visible = [
        ...html.matchAll(/<summary><h2>([^<]+)<\/h2><\/summary>/g),
      ].map((m) => m[1]);
      expect(questions.length).toBeGreaterThan(0);
      expect(questions).toEqual(visible);
    },
  );
});

describe("composer page", () => {
  it("has a canonical, a description and social tags", async () => {
    const res = await request(app).get("/composer");
    expect(res.text).toContain(`<link rel="canonical" href="${SITE}/composer"`);
    expect(res.text).toMatch(/<meta\s+name="description"/);
    expect(res.text).toContain('property="og:image"');
    expect(res.text).toContain('rel="icon"');
  });

  it("has a noscript fallback with a heading and links back into the site", async () => {
    const res = await request(app).get("/composer");
    const noscript =
      res.text.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? "";
    expect(noscript).toContain("<h1>");
    for (const href of [
      "/en",
      "/en/faq",
      "/en/legal-notice",
      "/en/privacy",
      "/de/impressum",
      "/de/datenschutz",
    ]) {
      expect(noscript).toContain(`href="${href}"`);
    }
  });

  it("its HTML has one URL: the asset path redirects to /composer", async () => {
    const res = await request(app).get("/assets/composer/index.html");
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe("/composer");
    expect((await request(app).get("/assets/composer/")).status).not.toBe(200);
  });
});

describe("caching", () => {
  it("fingerprinted composer assets are immutable", async () => {
    const html = (await request(app).get("/composer")).text;
    const script = html.match(
      /src="(\/assets\/composer\/assets\/[^"]+\.js)"/,
    )![1];
    const res = await request(app).get(script);
    expect(res.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("other assets are cached for a day", async () => {
    const res = await request(app).get("/assets/css/cosmos.css");
    expect(res.headers["cache-control"]).toBe("public, max-age=86400");
  });
});

describe("www redirect", () => {
  const WWW = "www.rocketpadplatforms.de";

  it("sends www to the apex domain, keeping path and query", async () => {
    const res = await request(app).get("/en/faq?a=1").set("Host", WWW);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(`${SITE}/en/faq?a=1`);
  });

  it("sends the www homepage straight to the apex, not through the language selector", async () => {
    const res = await request(app).get("/").set("Host", WWW);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(`${SITE}/`);
  });

  it("drops a trailing slash in the same hop", async () => {
    const res = await request(app).get("/de/faq/").set("Host", WWW);
    expect(res.headers.location).toBe(`${SITE}/de/faq`);
  });

  it("uses the forwarded host the ingress passes on", async () => {
    const res = await request(app)
      .get("/de")
      .set("Host", "web.svc.cluster.local")
      .set("X-Forwarded-Host", WWW);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(`${SITE}/de`);
  });

  it("keeps the method of non-GET requests with a 308", async () => {
    const res = await request(app).post("/en").set("Host", WWW);
    expect(res.status).toBe(308);
  });

  it("cannot be steered to another host", async () => {
    const res = await request(app).get("//evil.example/").set("Host", WWW);
    expect(res.headers.location).toBe(`${SITE}/evil.example`);
  });

  it.each([
    "rocketpadplatforms.de",
    "staging.rocketpadplatforms.de",
    "localhost",
  ])("leaves %s alone", async (host) => {
    const res = await request(app).get("/en").set("Host", host);
    expect(res.status).toBe(200);
  });

  it("never redirects the health check", async () => {
    const res = await request(app).get("/healthz").set("Host", WWW);
    expect(res.status).toBe(200);
  });
});

describe("sitemap", () => {
  it("lists every localised page with its alternates, plus the composer", async () => {
    const res = await request(app).get("/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/xml/);
    const locs = [...res.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (m) => m[1],
    );
    expect(locs).toEqual(
      expect.arrayContaining([...PAGES, "/composer"].map((p) => `${SITE}${p}`)),
    );
    expect(locs).toHaveLength(PAGES.length + 1);
    expect(res.text).toContain(
      `<xhtml:link rel="alternate" hreflang="en" href="${SITE}/en/privacy"/>`,
    );
    expect(res.text).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}T/);
  });

  it("does not list the redirecting / or any legacy URL", async () => {
    const res = await request(app).get("/sitemap.xml");
    expect(res.text).not.toContain(`<loc>${SITE}/</loc>`);
    expect(res.text).not.toContain("/info/faq");
  });

  it("robots.txt points at it", async () => {
    const res = await request(app).get("/robots.txt");
    expect(res.text).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });
});
