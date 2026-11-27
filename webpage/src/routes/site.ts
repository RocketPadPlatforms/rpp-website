import { NextFunction, Request, Response, Router } from "express";
import path from "path";
import { ASSETS_DIR } from "../config/paths";
import { detectLocale, LOCALES } from "../i18n";
import { renderSitemap } from "../seo/sitemap";
import { viewLocals } from "./context";
import { LEGACY_REDIRECTS, pagePath, PAGES } from "./pages";

const routes = Router();

// "/" is the only URL that depends on the visitor: it sends them to the
// language their browser prefers. It must never be cached as if it were
// universal, or one visitor's language would be served to the next.
routes.get("/", (req: Request, res: Response) => {
  res.vary("Accept-Language");
  res.set("Cache-Control", "private, no-cache");
  res.redirect(302, pagePath(PAGES[0], detectLocale(req)));
});

for (const page of PAGES) {
  for (const locale of LOCALES) {
    routes.get(pagePath(page, locale), (_req: Request, res: Response) => {
      res.render(page.view[locale], viewLocals(locale, page, page.id));
    });
  }
}

for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
  routes.get(from, (_req: Request, res: Response) => res.redirect(301, to));
}

// The platform composer is a React bundle built by Vite into
// assets/composer/ (see vite.config.mts), not a Handlebars view: Vite emits
// hashed asset filenames and owns the HTML that references them. It also
// deliberately does not use the shared main.hbs layout - it takes the whole
// viewport and must not inherit the marketing nav, footer or cosmos.css.
routes.get("/composer", (_req: Request, res: Response, next: NextFunction) => {
  res.sendFile(path.join(ASSETS_DIR, "composer", "index.html"), (err) => {
    if (err) {
      next(err);
    }
  });
});

// Served inline, not as a download: res.download() would set
// Content-Disposition: attachment.
routes.get(
  "/robots.txt",
  (_req: Request, res: Response, next: NextFunction) => {
    res.sendFile(path.join(ASSETS_DIR, "robots.txt"), (err) => {
      if (err) {
        next(err);
      }
    });
  },
);

// Generated from the page table, so a new page or language cannot be left out.
routes.get("/sitemap.xml", (_req: Request, res: Response) => {
  res.type("application/xml").send(renderSitemap());
});

export default routes;
