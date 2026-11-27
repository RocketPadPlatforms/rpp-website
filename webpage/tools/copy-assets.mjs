import { cpSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Places the non-compiled parts of the app next to the compiled output, so that
// `dist/` is a self-contained deployable: dist/app.js + dist/views + dist/assets.
//
// Each target is removed first. The previous implementation shelled out to
// `cp -R assets dist/assets`, which nests into dist/assets/assets whenever the
// directory already exists - only `clean` running first kept that from biting.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

for (const dir of ["views", "assets"]) {
  const target = path.join(dist, dir);
  rmSync(target, { recursive: true, force: true });
  cpSync(path.join(root, dir), target, {
    recursive: true,
    // Vite's sourcemaps stay in the working tree for debugging; they are not
    // shipped (see build.sourcemap in vite.config.mts).
    filter: (source) => !source.endsWith(".map"),
  });
  console.log(`copied ${dir} -> dist/${dir}`);
}
