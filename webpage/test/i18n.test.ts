import type { Application } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import de from "../src/locales/de.json";
import en from "../src/locales/en.json";

process.env.NODE_ENV = "development";
process.env.APP_ROOT = ".";
process.env.LOG_LEVEL = "silent";

let app: Application;

beforeAll(async () => {
  const { createApp } = await import("../src/config/express");
  app = createApp();
});

/** Every leaf path in a locale file, e.g. "home.hero.title" or "faq.items.0.q". */
function keyPaths(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object") {
    return [prefix];
  }
  return Object.entries(node).flatMap(([key, value]) =>
    keyPaths(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe("locale files", () => {
  it("German and English define exactly the same keys", () => {
    expect(keyPaths(de).sort()).toEqual(keyPaths(en).sort());
  });

  it("no translation is left empty", () => {
    for (const dictionary of [de, en]) {
      for (const key of keyPaths(dictionary)) {
        const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dictionary);
        expect(value, key).not.toBe("");
      }
    }
  });
});

describe("language selection at /", () => {
  it.each([
    ["de-DE,de;q=0.9,en;q=0.8", "/de"],
    ["de", "/de"],
    ["en-US,en;q=0.9", "/en"],
    ["en-GB,de;q=0.5", "/en"],
    ["fr-FR,fr;q=0.9", "/en"]
  ])("Accept-Language %s goes to %s", async (header, target) => {
    const res = await request(app).get("/").set("Accept-Language", header);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(target);
  });

  it("a request without Accept-Language (a crawler) gets English", async () => {
    const res = await request(app).get("/");
    expect(res.headers.location).toBe("/en");
  });

  it("the redirect is never cached as universal", async () => {
    const res = await request(app).get("/").set("Accept-Language", "de");
    expect(res.headers.vary).toMatch(/Accept-Language/i);
    expect(res.headers["cache-control"]).toMatch(/private/);
  });
});

describe("localised pages", () => {
  it.each([
    ["/de", "de"],
    ["/en", "en"],
    ["/de/impressum", "de"],
    ["/en/legal-notice", "en"]
  ])("%s declares lang=%s", async (path, lang) => {
    const res = await request(app).get(path);
    expect(res.text).toContain(`<html lang="${lang}">`);
  });

  it("the language switch points at the same page in the other language", async () => {
    const res = await request(app).get("/en/legal-notice");
    expect(res.text).toMatch(/<a href="\/de\/impressum" hreflang="de"/);
    expect(res.text).toMatch(/<a href="\/en\/legal-notice" hreflang="en"[^>]*aria-current="true"/);
  });

  it("the German homepage is German and the English one English", async () => {
    expect((await request(app).get("/de")).text).toContain("die wirklich Ihnen gehört.");
    expect((await request(app).get("/en")).text).toContain("you actually own.");
  });

  it("the English legal pages say the German version is binding and link to it", async () => {
    const notice = await request(app).get("/en/legal-notice");
    expect(notice.text).toContain('href="/de/impressum"');
    expect(notice.text).toContain("legally binding");
    const privacy = await request(app).get("/en/privacy");
    expect(privacy.text).toContain('href="/de/datenschutz"');
    expect(privacy.text).toContain("legally binding");
  });
});

describe("team and managing director", () => {
  it.each([
    ["/de", "Geschäftsführer · Cloud Engineer · DevOps Engineer"],
    ["/en", "Managing Director · Cloud Engineer · DevOps Engineer"]
  ])("%s lists Kilian first, as managing director", async (path, kilianRole) => {
    const res = await request(app).get(path);
    const kilian = res.text.indexOf("Kilian Mehringer");
    const alexander = res.text.indexOf("Alexander Weidemann");
    expect(kilian).toBeGreaterThan(-1);
    expect(alexander).toBeGreaterThan(kilian);
    expect(res.text).toContain(kilianRole);
    expect(res.text).toContain("Kubernetes Engineer · Platform Engineer");
  });

  it("role descriptions are separated by · only", () => {
    for (const dictionary of [de, en]) {
      expect(dictionary.home.team.kilianRole).not.toContain("/");
      expect(dictionary.home.team.alexanderRole).not.toContain("/");
    }
  });

  it("both legal notices name the managing director", async () => {
    expect((await request(app).get("/de/impressum")).text).toContain("Geschäftsführer: Kilian Mehringer");
    expect((await request(app).get("/en/legal-notice")).text).toContain("Managing Director: Kilian Mehringer");
  });
});

describe("canonical URLs", () => {
  it("a trailing slash redirects to the URL without it, keeping the query", async () => {
    const res = await request(app).get("/en/faq/?a=1");
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe("/en/faq?a=1");
  });

  it("the trailing-slash redirect cannot be turned into an open redirect", async () => {
    const res = await request(app).get("//evil.example/");
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe("/evil.example");
  });
});

describe("error pages", () => {
  it("a 404 under /de is German and not indexable", async () => {
    const res = await request(app).get("/de/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.text).toContain('<html lang="de">');
    expect(res.text).toContain('<meta name="robots" content="noindex">');
  });

  it("a 404 outside /de and /en follows the browser language", async () => {
    const res = await request(app).get("/nope").set("Accept-Language", "de");
    expect(res.text).toContain('<html lang="de">');
  });
});
