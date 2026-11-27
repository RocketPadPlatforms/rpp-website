import type { Application } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

// Both must be set before src/config/express is imported: paths.ts and
// logger.ts read process.env at module scope.
process.env.APP_ROOT = "."; // serve views/ and assets/ from the working tree
process.env.LOG_LEVEL = "silent"; // keep request logs out of the test report

let app: Application;

beforeAll(async () => {
  const { createApp } = await import("../src/config/express");
  app = createApp();
});

describe("health and api", () => {
  it("GET /healthz returns ok", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /api returns ok", async () => {
    const res = await request(app).get("/api");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("pages", () => {
  it.each([
    "/de",
    "/en",
    "/de/faq",
    "/en/faq",
    "/de/impressum",
    "/en/legal-notice",
    "/de/datenschutz",
    "/en/privacy",
    "/composer",
  ])("GET %s renders", async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain("<title>");
  });

  it.each(["/de", "/en"])(
    "the landing page %s renders the cosmos sections",
    async (path) => {
      const res = await request(app).get(path);
      for (const id of [
        "pillars",
        "modules",
        "product",
        "consultancy",
        "team",
        "contact",
      ]) {
        expect(res.text).toContain(`id="${id}"`);
      }
      expect(res.text).toContain("cm-sky");
    },
  );

  it("every page links the legally required Impressum and Datenschutz in its language", async () => {
    for (const path of ["/de", "/de/faq", "/de/datenschutz"]) {
      const res = await request(app).get(path);
      expect(res.text).toContain('href="/de/impressum"');
      expect(res.text).toContain('href="/de/datenschutz"');
    }
    for (const path of ["/en", "/en/faq", "/en/privacy"]) {
      const res = await request(app).get(path);
      expect(res.text).toContain('href="/en/legal-notice"');
      expect(res.text).toContain('href="/en/privacy"');
    }
  });
});

// The composer is a React bundle built by Vite into assets/composer/, served
// from this origin instead of the third-party Vercel deployment it used to be
// embedded from. These assertions need `npm run build:composer` to have run;
// the build does that before `npm test` in CI.
describe("the platform composer", () => {
  it("GET /composer serves the standalone shell, not the site layout", async () => {
    const res = await request(app).get("/composer");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain('id="root"');
    // The composer owns the whole viewport, so it must not inherit main.hbs -
    // which would have injected the marketing nav and cosmos.css over Tailwind.
    expect(res.text).not.toContain("cm-nav");
    expect(res.text).not.toContain("cosmos.css");
  });

  it("the shell references its bundle and stylesheet from this origin", async () => {
    const res = await request(app).get("/composer");
    // Vite hashes the filenames, so match the directory rather than the name.
    expect(res.text).toMatch(/src="\/assets\/composer\/assets\/[^"]+\.js"/);
    expect(res.text).toMatch(/href="\/assets\/composer\/assets\/[^"]+\.css"/);
  });

  it("the composer page carries no inline script, handler or style either", async () => {
    const res = await request(app).get("/composer");
    expect(res.text).not.toMatch(/on(click|load|error|submit)=/);
    expect(res.text).not.toMatch(/\sstyle="/);
    expect(res.text).not.toMatch(
      /<script(?![^>]*\ssrc=)(?![^>]*type="application\/ld\+json")/,
    );
  });

  it("the composer references no third-party font or asset host", async () => {
    const res = await request(app).get("/composer");
    expect(res.text).not.toContain("fonts.googleapis.com");
    expect(res.text).not.toContain("fonts.gstatic.com");
    expect(res.text).not.toContain("vercel.app");
  });

  it("the baked platform catalogue is served as JSON", async () => {
    const res = await request(app).get("/assets/composer/platform.json");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(Array.isArray(res.body.layers)).toBe(true);
    // 6 layers and 23 components in platform/ at the time of the migration.
    expect(res.body.layers.length).toBeGreaterThanOrEqual(6);
    expect(Object.keys(res.body.components).length).toBeGreaterThanOrEqual(20);
    expect(res.body.presets.length).toBeGreaterThanOrEqual(4);
  });

  it("the landing page embeds the composer from this origin", async () => {
    const res = await request(app).get("/en");
    expect(res.text).toContain('data-embed="/composer"');
    expect(res.text).not.toContain("rpp-platform-composer.vercel.app");
  });
});

describe("static files", () => {
  it("GET /robots.txt is served inline, not as a download", async () => {
    const res = await request(app).get("/robots.txt");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.headers["content-disposition"]).toBeUndefined();
  });

  it("GET /sitemap.xml is served as xml", async () => {
    const res = await request(app).get("/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/xml/);
  });

  it("the self-hosted fonts are reachable", async () => {
    for (const font of [
      "josefin-sans-latin",
      "open-sans-latin",
      "jetbrains-mono-latin",
      // Raleway is the composer's face, self-hosted like the other three so the
      // composer makes no request to fonts.googleapis.com.
      "raleway-latin",
    ]) {
      const res = await request(app).get(`/assets/fonts/${font}.woff2`);
      expect(res.status).toBe(200);
    }
  });

  it("the stylesheet and behaviour script are reachable", async () => {
    expect((await request(app).get("/assets/css/cosmos.css")).status).toBe(200);
    expect((await request(app).get("/assets/js/cosmos.js")).status).toBe(200);
  });
});

describe("retired and moved pages", () => {
  // These were in the published sitemap and the old navigation. They must keep
  // their ranking by redirecting, not 404. The landing pages were German.
  it.each([
    ["/cloud", "/de#pillars"],
    ["/devops", "/de#consultancy"],
    ["/kubernetes", "/de#pillars"],
    ["/platform", "/de#product"],
    ["/software", "/de#consultancy"],
    ["/training", "/de#consultancy"],
    ["/impressum", "/de/impressum"],
    ["/datenschutz", "/de/datenschutz"],
    ["/info/faq", "/de/faq"],
  ])("GET %s redirects permanently to %s", async (from, to) => {
    const res = await request(app).get(from);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(to);
  });
});

describe("security headers", () => {
  it("answers cross-origin requests without CORS headers", async () => {
    const res = await request(app)
      .get("/en")
      .set("Origin", "https://example.com");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("the CSP allows no inline script or style", async () => {
    const res = await request(app).get("/en");
    const csp = res.headers["content-security-policy"];
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it("the CSP frames the composer from this origin and no third party", async () => {
    const res = await request(app).get("/en");
    const csp = res.headers["content-security-policy"];
    // The composer used to be a third-party iframe on Vercel and had to be
    // allowlisted by origin. It is now built into this app and served from
    // /composer, so 'self' covers it.
    expect(csp).toContain("frame-src 'self'");
    // 'self' rather than 'none': 'none' would block this origin from framing
    // its own /composer page, which is exactly what the modules section does.
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toContain("vercel.app");
  });

  it("the rendered page contains no inline script, handler or style", async () => {
    const res = await request(app).get("/en");
    expect(res.text).not.toMatch(/on(click|load|error|submit)=/);
    expect(res.text).not.toMatch(/\sstyle="/);
    // The only src-less script allowed is the JSON-LD data block, which
    // browsers never execute and CSP therefore does not govern.
    expect(res.text).not.toMatch(
      /<script(?![^>]*\ssrc=)(?![^>]*type="application\/ld\+json")/,
    );
  });

  it("no third-party font or asset host is referenced", async () => {
    const res = await request(app).get("/en");
    expect(res.text).not.toContain("fonts.googleapis.com");
    expect(res.text).not.toContain("fonts.gstatic.com");
  });
});

describe("regressions", () => {
  it("GET an unknown page returns 404 instead of hanging", async () => {
    const res = await request(app).get("/does-not-exist").timeout(2000);
    expect(res.status).toBe(404);
  });

  it("unknown /api routes return JSON, not an HTML error page", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});
