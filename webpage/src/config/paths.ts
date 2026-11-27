import path from "path";

/**
 * Single source of truth for the app's on-disk locations.
 *
 * `copy-assets` places views/ and assets/ alongside the compiled
 * output, so the default root is one level up from this module:
 * dist/config/paths.js -> dist/.
 *
 * Set APP_ROOT to serve those directories from elsewhere. `APP_ROOT=.` during
 * development reads them straight from the working tree, so template and
 * stylesheet edits take effect without a rebuild.
 */
const ROOT = path.resolve(process.env.APP_ROOT ?? path.join(__dirname, ".."));

export const ROOT_DIR = ROOT;
export const VIEWS_DIR = path.join(ROOT, "views");
export const ASSETS_DIR = path.join(ROOT, "assets");
