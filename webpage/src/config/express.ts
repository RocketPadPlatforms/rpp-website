import compression from "compression";
import cors from "cors";
import express, {
  Application,
  json,
  NextFunction,
  Request,
  Response,
  urlencoded,
} from "express";
import { create } from "express-handlebars";
import helmet from "helmet";
import { Server } from "http";
import path from "path";
import { pinoHttp } from "pino-http";
import routesAPI from "../api/routes";
import {
  detectLocale,
  Locale,
  localeFromPath,
  lookup,
  translate,
} from "../i18n";
import { viewLocals } from "../routes/context";
import routes from "../routes/site";
import logger from "./logger";
import { SITE_URL } from "./site";
import { ASSETS_DIR, VIEWS_DIR } from "./paths";

// Cross-origin requests are refused unless an origin is explicitly allowlisted.
// This used to be a hardcoded empty array, which made the delegate below dead
// code: every cross-origin request was denied, and requests with no Origin
// header fell through to cors' `origin: '*'` default.
const allowlist = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

type CorsCallback = (err: Error | null, options: { origin: boolean }) => void;

const corsOptionsDelegate = (req: Request, callback: CorsCallback) => {
  const origin = req.header("Origin");

  if (!origin) {
    callback(null, { origin: false });
    return;
  }

  const isDomainAllowed =
    allowlist.indexOf(origin) !== -1 || process.env.NODE_ENV === "development";

  callback(null, { origin: isDomainAllowed });
};

interface HelperOptions {
  fn: (context: unknown) => string;
  inverse: (context: unknown) => string;
  hash: Record<string, unknown>;
  data: { root: { lang?: Locale } };
}

/** The locale a template is being rendered in, as set by viewLocals(). */
function renderLocale(options: HelperOptions): Locale {
  const lang = options.data.root.lang;
  if (!lang) {
    throw new Error("Template rendered without a `lang` local");
  }
  return lang;
}

/**
 * A path with repeated leading slashes collapsed and trailing ones removed.
 * Collapsing the leading ones matters: stripping only the trailing slash from
 * "//evil.example/" would produce the protocol-relative "//evil.example".
 */
function normalisePath(pathname: string): string {
  return `/${pathname.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function queryOf(req: Request): string {
  const queryStart = req.originalUrl.indexOf("?");
  return queryStart === -1 ? "" : req.originalUrl.slice(queryStart);
}

/** Redirects /en/ to /en, so every page has exactly one URL. */
function stripTrailingSlash(req: Request, res: Response, next: NextFunction) {
  if (
    (req.method !== "GET" && req.method !== "HEAD") ||
    req.path === "/" ||
    !req.path.endsWith("/")
  ) {
    next();
    return;
  }
  res.redirect(301, normalisePath(req.path) + queryOf(req));
}

/**
 * www.<site> serves the same pages as <site>, which Search Console reports as
 * duplicates. Send it to the canonical host in a single hop, trailing slash
 * included. The target is always SITE_URL, never the request's own host, so
 * this cannot be turned into an open redirect, and only that one hostname is
 * matched - staging and internal hosts are left alone.
 *
 * GET/HEAD get a 301; anything else a 308 so the method and body survive.
 * /healthz is exempt so probes never depend on which Host they send.
 */
const WWW_HOST = `www.${new URL(SITE_URL).hostname}`;

function redirectWww(req: Request, res: Response, next: NextFunction) {
  if (req.hostname !== WWW_HOST || req.path === "/healthz") {
    next();
    return;
  }
  const status = req.method === "GET" || req.method === "HEAD" ? 301 : 308;
  res.redirect(status, `${SITE_URL}${normalisePath(req.path)}${queryOf(req)}`);
}

/** Error pages follow the path's language, or the browser's outside /de and /en. */
function errorLocale(req: Request): Locale {
  return localeFromPath(req.path) ?? detectLocale(req);
}

export function createApp(): Application {
  const app: Application = express();

  // Request logging needs the real client IP, which arrives in X-Forwarded-For
  // from the ingress rather than on the socket.
  app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));

  // Before anything else: a www request should not pay for rendering,
  // compression or logging of a page it is about to leave.
  app.use(redirectWww);

  // Set template engine to handlebars. extname is explicit: the views are .hbs
  // but express-handlebars' own default is .handlebars, and the layout used to
  // resolve only because those two defaults happened not to collide.
  const hbs = create({
    extname: ".hbs",
    defaultLayout: "main",
    layoutsDir: path.join(VIEWS_DIR, "layouts"),
    helpers: {
      // {{t "home.hero.title"}} escapes; {{{t "faq.items.0.a"}}} is for the
      // few strings that carry markup. Locale files are trusted content - no
      // request data is ever interpolated into them.
      t(key: string, options: HelperOptions) {
        return translate(renderLocale(options), key, options.hash);
      },
      // Structured copy (lists, FAQ entries) for {{#each}}.
      tdata(key: string, options: HelperOptions) {
        const value = lookup(renderLocale(options), key);
        if (value === undefined) {
          throw new Error(`Missing translation data for "${key}"`);
        }
        return value;
      },
    },
  });
  app.engine(".hbs", hbs.engine);
  app.set("view engine", ".hbs");
  // Without this, Express resolves views against process.cwd(), which only
  // worked because WORKDIR happened to be the directory holding views/.
  app.set("views", VIEWS_DIR);

  // Middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // No 'unsafe-inline' anywhere: the templates carry no inline scripts,
          // no on* handlers and no style attributes, and the fonts are served
          // from this origin. Keep it that way - reintroducing any of those
          // means weakening this policy.
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          fontSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          // The platform composer is embedded on demand from the modules
          // section. It used to be a third-party iframe on Vercel, which had to
          // be allowlisted here; it is now built into this app and served from
          // /composer, so 'self' covers it and no external origin is needed.
          frameSrc: ["'self'"],
          objectSrc: ["'none'"],
          // 'self', not 'none': the composer at /composer is embedded in an
          // iframe by the modules section, and 'none' forbids framing even by
          // this same origin - which would render that iframe blank with only a
          // console violation to show for it. 'self' still blocks every
          // third-party embed, which is the actual clickjacking threat.
          frameAncestors: ["'self'"],
        },
      },
      // The site is served over TLS by the ingress; let it own HSTS.
      strictTransportSecurity: false,
    }),
  );
  app.use(compression());
  app.use(pinoHttp({ logger }));
  app.use(cors(corsOptionsDelegate));
  app.use(json({ limit: "64kb" }));
  app.use(urlencoded({ extended: false, limit: "64kb" }));
  // The composer's HTML must have exactly one public URL.
  app.get("/assets/composer/index.html", (_req: Request, res: Response) =>
    res.redirect(301, "/composer"),
  );
  app.use(
    "/assets",
    express.static(ASSETS_DIR, {
      // No directory listings standing in for pages, e.g. /assets/composer/
      // serving the composer a second time.
      index: false,
      setHeaders(res, filePath) {
        // Vite fingerprints everything under assets/composer/assets/, so a
        // changed file always gets a new URL and can be cached forever. The
        // rest keeps stable names and gets a day.
        const hashed = filePath.includes(
          `${path.sep}composer${path.sep}assets${path.sep}`,
        );
        res.setHeader(
          "Cache-Control",
          hashed
            ? "public, max-age=31536000, immutable"
            : "public, max-age=86400",
        );
      },
    }),
  );

  // Liveness/readiness target. Deliberately cheap: no template rendering, no
  // filesystem access, so a probe cannot be starved by a slow render.
  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.use(stripTrailingSlash);

  app.use("/", routes);

  // Router V1
  app.use("/api", routesAPI);

  // Anything that reached this point matched no route.
  app.use((req: Request, res: Response) => {
    if (req.path.startsWith("/api")) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }

    res.status(404).render("404", {
      ...viewLocals(errorLocale(req), undefined, "notFound"),
      noindex: true,
    });
  });

  // Express identifies error middleware by arity, so `next` has to stay in the
  // signature even though it is unused. Express 5 routes rejected promises from
  // async handlers here automatically.
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err, url: req.originalUrl }, "unhandled request error");

    if (res.headersSent) {
      return;
    }

    // API clients get JSON, not a rendered error page.
    if (req.path.startsWith("/api")) {
      res.status(500).json({ error: "INTERNAL_ERROR" });
      return;
    }

    res.status(500).render("500", {
      ...viewLocals(errorLocale(req), undefined, "error"),
      noindex: true,
    });
  });

  return app;
}

function initExpress(): Server {
  const app = createApp();
  const PORT = Number(process.env.PORT ?? 8080);

  const server = app.listen(PORT, () =>
    logger.info(`Server started on port ${PORT}`),
  );

  // Kubernetes sends SIGTERM and then SIGKILLs after the grace period. Without
  // this the pod drops in-flight requests on every rolling update.
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, closing server`);
    server.close(() => {
      logger.info("Express server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
}

export default initExpress;
