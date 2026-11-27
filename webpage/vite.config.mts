import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
// Explicit .ts extension: Vite's native config loader, which becomes the
// default in a future major, will not resolve an extensionless specifier here.
import { loadPlatform } from "./client/composer/data/loader.ts";

// Vite bundles this config together with its local imports before running it,
// using bundler-style resolution - which is why importing the loader directly
// works here despite its extensionless relative imports.

// The platform catalog is declarative YAML under platform/. It is baked into a
// single static JSON at build time, exactly as the old Bun build.ts did, so the
// browser never parses YAML and the server needs no route behind it. A
// malformed catalog now fails the build rather than the page: loadPlatform
// throws ValidationError.
function bakePlatform(): Plugin {
  // npm always runs scripts with the package directory as cwd, and this config
  // sets `root` to the composer instead - so resolve against cwd, not root.
  const platformDir = path.resolve(process.cwd(), "platform");

  return {
    name: "rpp-bake-platform",
    buildStart() {
      const platform = loadPlatform(platformDir);
      this.emitFile({
        type: "asset",
        fileName: "platform.json",
        source: JSON.stringify({
          layers: platform.layers,
          // The client rehydrates this back into a Map.
          components: Object.fromEntries(platform.components),
          presets: platform.presets
        })
      });
    }
  };
}

export default defineConfig({
  root: "client/composer",

  // Emitted asset URLs have to resolve under the Express static mount at
  // /assets (see src/config/express.ts).
  base: "/assets/composer/",

  plugins: [tailwindcss(), bakePlatform()],

  build: {
    // Written into assets/ rather than dist/ so that copy-assets carries it
    // into dist/ like every other asset, and so `npm run dev` (which serves
    // assets/ straight from the working tree via APP_ROOT=.) picks it up too.
    outDir: path.resolve(process.cwd(), "assets/composer"),
    // outDir sits outside `root`, so Vite would refuse to clear it unless we
    // say so explicitly.
    emptyOutDir: true,

    // These keep the output CSP-clean: the site serves script-src 'self' /
    // style-src 'self' with no 'unsafe-inline', so nothing may be inlined into
    // the HTML and sourcemaps must stay external.
    assetsInlineLimit: 0,
    // Maps are written for local debugging but not referenced from the
    // bundle, and copy-assets leaves them out of dist/, so the deployed site
    // does not publish the composer's source.
    sourcemap: "hidden",

    // Must stay false. With CSS code splitting on, the CSS reached through a
    // dynamic import is inlined into the JS chunk and injected at runtime via a
    // created <style> element - which style-src 'self' blocks silently. There
    // are no dynamic imports today, but this closes the trapdoor for whoever
    // adds the first React.lazy call.
    cssCodeSplit: false,
    // Single entry, no dynamic imports: the modulepreload polyfill would be
    // dead weight, and it works by injecting markup.
    modulePreload: false
  }
});
