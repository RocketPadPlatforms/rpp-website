# rocketpadplatforms.de

The Rocket Pad Platforms website: an Express + TypeScript server rendering
Handlebars templates, deployed to Kubernetes.

The homepage is a single scrolling story with anchored sections - `#pillars`,
`#modules`, `#product`, `#consultancy`, `#team`, `#contact` - plus an FAQ,
the legal pages and the composer at `/composer`.

## Languages and URLs

The site is bilingual. German lives under `/de`, English under `/en`:

| German            | English            |
| ----------------- | ------------------ |
| `/de`             | `/en`              |
| `/de/faq`         | `/en/faq`          |
| `/de/impressum`   | `/en/legal-notice` |
| `/de/datenschutz` | `/en/privacy`      |

`/` redirects (302, `Vary: Accept-Language`) to the language the browser
prefers; without a German preference, and for crawlers that send no
`Accept-Language`, it picks English. Every other URL is fixed, so both
languages can be indexed. The English legal pages are convenience translations;
the German ones are legally binding. The composer has an English UI only.

Old URLs redirect permanently: `/impressum`, `/datenschutz` and `/info/faq` to
their `/de` versions, and the six retired per-market landing pages (`/cloud`,
`/devops`, `/kubernetes`, `/platform`, `/software`, `/training`, all German)
to the homepage section that replaced them. A trailing slash redirects to the
URL without it.

### How pages are wired

`webpage/src/routes/pages.ts` is the single source of truth: one entry per page
with its path and view per language and where it is linked (`header`,
`footer`). The routes, the header and footer links, the language switch, the
hreflang alternates and `/sitemap.xml` are all generated from it, so a page
cannot end up reachable only through the sitemap. `test/crawl.test.ts` checks
that by following every link from `/de` and `/en`.

To add a page: add it to `PAGES`, create the view (one shared template, or one
per language like the legal pages), and add `pages.<id>.title`,
`pages.<id>.description` and, if it is in the nav, `pages.<id>.nav` to both
locale files.

### Copy and translations

All visible text lives in `webpage/src/locales/de.json` and `en.json`. Templates
use `{{t "home.hero.lead"}}` (escaped) or `{{{t "faq.items.0.a"}}}` for the few
strings that carry markup, and `{{#each (tdata "faq.items")}}` for lists. A
missing key throws while rendering, and a test fails if the two files do not
have exactly the same keys.

### SEO

Every localised page carries a canonical URL, hreflang alternates (`de`, `en`,
`x-default`), Open Graph and Twitter tags, and a JSON-LD graph (organisation,
website, team, page; plus `ProfessionalService` on the homepage and `FAQPage`
on the FAQ). Absolute URLs come from `SITE_URL`
(default `https://rocketpadplatforms.de`), never from the request's Host
header. The JSON-LD is a non-executable `application/ld+json` block, so the
strict CSP does not need to allow it. The share image is
`webpage/assets/img/og-default.png` (1200x630).

`www.` plus the `SITE_URL` host (`www.rocketpadplatforms.de`) redirects
permanently to the same path on `SITE_URL`, so the site has one host. The app
does this itself rather than the ingress; `/healthz` is exempt.

## Design

The visual system - the "cosmos" look - lives entirely in
`webpage/assets/css/cosmos.css`, built on the brand palette:

| Token               | Hex       | Role                     |
| ------------------- | --------- | ------------------------ |
| `--color-universum` | `#0d304f` | the ground               |
| `--color-hue`       | `#77c6c0` | brand, links, highlights |
| `--color-zuendung`  | `#e8736d` | accent, the ignition     |
| `--color-rakete`    | `#efefef` | neutral surface          |
| `--color-platform`  | `#b5c2d3` | structure, borders       |

Components reference the semantic aliases (`--color-primary`, `--color-accent`,
`--color-border`, `--t1`/`--t2`/`--t3`), never the raw values, so the palette can
be retuned in one place.

Fonts (Josefin Sans, Open Sans, JetBrains Mono, Raleway) are self-hosted from
`webpage/assets/fonts/`. Nothing is loaded from a third party, which is both a
GDPR and a Content-Security-Policy requirement: the CSP allows no inline script
or style and **no external origin at all**. Adding an inline `style="..."`, an
`onclick`, or a Google Fonts link will be blocked by the browser and caught by
the test suite.

## The platform composer

The interactive composer at `/composer` is a React 19 SPA that lives in this
repository and is served by this app. It used to be a separate project deployed
to Vercel and embedded as a third-party iframe; that meant an external origin in
the CSP, a Google Fonts request, and a second deploy target that could break on
its own. All three are gone.

| Path                       | What it is                                                              |
| -------------------------- | ----------------------------------------------------------------------- |
| `webpage/client/composer/` | The SPA - `ui/` components, `engine/` state and rules, `data/loader.ts` |
| `webpage/platform/`        | The catalog: layers, components and presets as declarative YAML/JSON    |
| `webpage/vite.config.mts`  | Builds the bundle and bakes the catalog                                 |
| `webpage/assets/composer/` | Build output. Generated, gitignored                                     |

The modules section of the landing page still embeds it in an iframe, loaded
only on click (`assets/js/cosmos.js`), so the bundle costs nothing to visitors
who never open it. It is framed rather than inlined because the composer owns
the full viewport and keeps its state in `location.hash`, which would otherwise
collide with the page's `#pillars`/`#modules` anchor navigation.

`npm run build:composer` compiles `client/composer/` into
`assets/composer/` and, in the same step, runs the catalog loader over
`platform/` to emit `assets/composer/platform.json`. The browser fetches that
static file, so no YAML is parsed at runtime and there is no route behind it.

### Editing the catalog

Platform capabilities are changed through Git, not a UI. Add a component by
creating `webpage/platform/components/<layer>/<name>.yaml`:

```yaml
kind: Component
id: compute.google # must be <layer>.<name>
name: Google
layer: compute
type: cloud
description: Google Cloud Platform
rules:
  excludes: [kubernetes.aks] # selecting this makes those unavailable
  suggests: [kubernetes.gke] # ...and auto-selects those
```

Layers live in `platform/layers.yaml` as multi-document YAML and unlock
sequentially by `position`; `select: single` layers evict siblings. A component
marked `core: true` is always selected and cannot be removed.

The loader validates the whole catalog against the JSON Schemas in
`platform/schemas/` and beyond them: ID format, that each component sits in
its layer's folder, layer positions, that every rule target exists, and that
every preset loads without the composer dropping part of it. It **throws at
build time**, so a malformed catalog fails `npm run build` rather than the
page. `npm test` also loads the real catalog, so both checks cover it.

Every way into the composer's state - a share link, a pasted config, a preset,
a removal - goes through `engine/sanitize.ts`, which keeps the selection to
what the composer itself could have produced.

## Run in development

Requires Node 24 (see `webpage/.nvmrc`). Either run it directly:

```
cd webpage
npm ci
npm run dev
```

The site is then on localhost:8080. `npm run dev` compiles once, then watches:
`tsc --watch` recompiles TypeScript and `node --watch` restarts the server.
Views and stylesheets are read straight from the working tree, so editing them
needs no rebuild - just a browser refresh.

Or in a container:

```
cd webpage
docker compose -f docker-compose.dev.yml up -d
```

That serves the page on localhost:8100 and exposes the Node inspector on 9229.

## Editing content

Text changes go into `webpage/src/locales/*.json` - always both languages. The
markup lives in `webpage/views/index.hbs` and the shared chrome (nav, footer,
`<head>`) in `webpage/views/layouts/main.hbs`. Anchors in the layout are
absolute (`/de#pillars`), because the layout is also used by the subpages.

## Checks

Run from `webpage/`. CI runs the same four in the `verify` stage, before the
image is built.

```
npm run lint        # oxlint over src, tools and client
npm run typecheck   # tsc --noEmit for both the server and the composer
npm run build       # clean -> tsc -> vite build -> copy-assets, output in dist/
npm test            # vitest: server route/regression suite + composer suite
```

## Run in production

The image is deployed to Kubernetes with the chart in `chart/`. To build and run
it locally:

```
cd webpage
docker build -t rocketpadplatforms-website .
docker run --rm -p 8080:8080 --env-file .env rocketpadplatforms-website
```

The container runs as the unprivileged `node` user under tini, serves `/healthz`
for the Kubernetes probes, and shuts down on SIGTERM without dropping in-flight
requests. See `example.env` for the supported environment variables.
