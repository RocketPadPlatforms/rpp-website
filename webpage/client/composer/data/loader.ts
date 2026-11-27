import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import path from "path";
import * as yaml from "js-yaml";
import Ajv2020 from "ajv/dist/2020.js";
import type {
  RawLayer,
  RawComponent,
  Layer,
  Component,
  PlatformData,
  Preset,
  // Explicit extension because vite.config.mts imports this module to bake the
  // catalogue at build time, and Vite's native config loader (a future default)
  // will not resolve an extensionless specifier. Erased at compile time either
  // way, since this is an `import type`.
} from "./types.ts";
import { isWorkload } from "./types.ts";
import { sanitizeEntries } from "../engine/sanitize.ts";
import { getCoreComponentIds } from "../engine/rules.ts";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// The JSON Schemas in platform/schemas/ are the contract for catalogue
// authors; they are enforced here so the build fails on a document that breaks
// them instead of the hand-written checks below silently disagreeing.
const SCHEMA_DIR = path.resolve(import.meta.dirname, "../../../platform/schemas");
const ajv = new Ajv2020({ allErrors: true });
const validators = {
  layer: ajv.compile(readJson(path.join(SCHEMA_DIR, "layer.schema.json"))),
  component: ajv.compile(readJson(path.join(SCHEMA_DIR, "component.schema.json"))),
  preset: ajv.compile(readJson(path.join(SCHEMA_DIR, "preset.schema.json"))),
};

function readJson(file: string): object {
  return JSON.parse(readFileSync(file, "utf-8"));
}

function schemaErrors(
  kind: keyof typeof validators,
  label: string,
  doc: unknown,
): string[] {
  const validate = validators[kind];
  if (validate(doc)) return [];
  return (validate.errors ?? []).map(
    (e) => `${label}: ${e.instancePath || "/"} ${e.message ?? "is invalid"}`,
  );
}

/**
 * Load and validate platform data from a directory.
 *
 * @param platformDir - Path to the platform/ directory
 * @param layersFile  - Override layers filename (for testing invalid fixtures)
 * @param componentFile - If provided, load only this single component file (for testing)
 */
export function loadPlatform(
  platformDir: string,
  layersFile = "layers.yaml",
  componentFile?: string
): PlatformData {
  const layers = loadLayers(path.join(platformDir, layersFile));
  const layerMap = new Map(layers.map((l) => [l.id, l]));

  const componentsDir = path.join(platformDir, "components");
  const rawComponents = componentFile
    ? [{ dir: "compute", doc: loadSingleComponent(path.join(componentsDir, "compute", componentFile)) }]
    : loadAllComponents(componentsDir);

  const components = new Map<string, Component>();
  const errors: string[] = [];

  for (const { dir, doc: raw } of rawComponents) {
    // Validate ID format: layer.component
    if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(raw.id)) {
      errors.push(`Invalid component ID format: "${raw.id}"`);
      continue;
    }

    // A component in an unknown layer used to be skipped silently, which
    // made a typo in `layer:` look like a missing module in the composer.
    const layerId = raw.id.split(".")[0];
    if (!layerMap.has(raw.layer)) {
      errors.push(`Component "${raw.id}" names unknown layer "${raw.layer}"`);
      continue;
    }

    // components/<layer>/ is how authors find a component; keep it truthful.
    if (dir !== raw.layer) {
      errors.push(
        `Component "${raw.id}" is in components/${dir}/ but belongs to layer "${raw.layer}"`
      );
      continue;
    }

    // Validate layer field matches ID prefix
    if (raw.layer !== layerId) {
      errors.push(
        `Component "${raw.id}" layer field "${raw.layer}" doesn't match ID prefix "${layerId}"`
      );
      continue;
    }

    // Validate no duplicate IDs
    if (components.has(raw.id)) {
      errors.push(`Duplicate component ID: "${raw.id}"`);
      continue;
    }

    const component: Component = {
      id: raw.id,
      name: raw.name,
      layer: raw.layer,
      type: raw.type,
      description: raw.description,
      core: raw.core ?? false,
      rules: {
        excludes: raw.rules?.excludes ?? [],
        suggests: raw.rules?.suggests ?? [],
      },
    };

    components.set(raw.id, component);
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join("\n"));
  }

  // Validate rule references point to existing components
  for (const comp of components.values()) {
    const allRefs = [...comp.rules.excludes, ...comp.rules.suggests];
    for (const ref of allRefs) {
      if (!components.has(ref)) {
        errors.push(
          `Component "${comp.id}" references unknown component "${ref}"`
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join("\n"));
  }

  // Build resolved layers with components attached, sorted by position
  const resolvedLayers: Layer[] = layers
    .toSorted((a, b) => a.position - b.position)
    .map((l) => ({
      ...l,
      components: [...components.values()].filter((c) => c.layer === l.id),
    }));

  const data: PlatformData = { layers: resolvedLayers, components, presets: [] };
  data.presets = loadPresets(platformDir, data);
  return data;
}

function loadLayers(filePath: string): RawLayer[] {
  const content = readFileSync(filePath, "utf-8");
  const docs = yaml.loadAll(content) as RawLayer[];

  const errors: string[] = [];
  docs.forEach((doc, i) => {
    errors.push(...schemaErrors("layer", `Layer #${i + 1} (${doc?.id ?? "unknown"})`, doc));
  });
  for (const doc of docs) {
    if (doc.kind !== "Layer") {
      errors.push(`Expected kind "Layer", got "${doc.kind}"`);
    }
    if (!doc.id || !doc.name || doc.position === undefined || !doc.select) {
      errors.push(
        `Layer "${doc.id ?? "unknown"}" missing required fields (need: id, name, position, select)`
      );
    }
    if (doc.select && !["single", "multi"].includes(doc.select)) {
      errors.push(
        `Layer "${doc.id}" has invalid select value: "${doc.select}"`
      );
    }
  }

  // The engine walks layers by position and treats position 0 as the root,
  // so ids and positions must be unique and positions contiguous from 0.
  const layerIds = docs.map((d) => d.id);
  for (const dup of new Set(layerIds.filter((id, i) => layerIds.indexOf(id) !== i))) {
    errors.push(`Duplicate layer id "${dup}"`);
  }
  const positions = docs.map((d) => d.position).toSorted((a, b) => a - b);
  if (positions.some((pos, i) => pos !== i)) {
    errors.push(
      `Layer positions must be unique and contiguous from 0, got [${positions.join(", ")}]`
    );
  }

  // unlocksAfter must name a layer that sits lower in the stack, so the
  // unlock/expand passes can resolve it in a single ordered sweep.
  const byId = new Map(docs.map((d) => [d.id, d]));
  for (const doc of docs) {
    if (doc.unlocksAfter === undefined) continue;
    const target = byId.get(doc.unlocksAfter);
    if (!target) {
      errors.push(
        `Layer "${doc.id}" references unknown layer "${doc.unlocksAfter}" in unlocksAfter`
      );
      continue;
    }
    if (target.position >= doc.position) {
      errors.push(
        `Layer "${doc.id}" (position ${doc.position}) cannot unlock after "${doc.unlocksAfter}" (position ${target.position}) — it must sit lower`
      );
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join("\n"));
  }

  return docs;
}

function loadSingleComponent(filePath: string): RawComponent {
  const content = readFileSync(filePath, "utf-8");
  const doc = yaml.load(content) as RawComponent;
  const invalid = schemaErrors("component", path.basename(filePath), doc);
  // The ID format has its own, more specific error further down.
  const relevant = invalid.filter((e) => !e.includes("/id must match pattern"));
  if (relevant.length > 0) {
    throw new ValidationError(relevant.join("\n"));
  }
  if (doc.kind !== "Component") {
    throw new ValidationError(`Expected kind "Component", got "${doc.kind}"`);
  }
  if (!doc.id || !doc.name || !doc.layer || !doc.type || !doc.description) {
    throw new ValidationError(
      `Component "${doc.id ?? "unknown"}" missing required fields`
    );
  }
  return doc;
}

function loadAllComponents(componentsDir: string): { dir: string; doc: RawComponent }[] {
  const components: { dir: string; doc: RawComponent }[] = [];

  for (const layerDir of readdirSync(componentsDir)) {
    const layerPath = path.join(componentsDir, layerDir);
    if (!statSync(layerPath).isDirectory()) continue;

    for (const file of readdirSync(layerPath)) {
      if (!file.endsWith(".yaml")) continue;
      components.push({ dir: layerDir, doc: loadSingleComponent(path.join(layerPath, file)) });
    }
  }

  return components;
}

/** Identity of a preset entry, for comparing it before and after sanitising. */
function entryKey(e: Preset["components"][number]): string {
  return isWorkload(e) ? `${e.type}#${e.id}` : e;
}

function loadPresets(platformDir: string, platform: PlatformData): Preset[] {
  const presetsDir = path.join(platformDir, "presets");
  if (!existsSync(presetsDir) || !statSync(presetsDir).isDirectory()) {
    return [];
  }

  const coreIds = getCoreComponentIds(platform);
  const presets: Preset[] = [];
  const errors: string[] = [];

  for (const file of readdirSync(presetsDir).toSorted()) {
    if (!file.endsWith(".json")) continue;
    const raw = JSON.parse(readFileSync(path.join(presetsDir, file), "utf-8"));

    // An invalid preset used to be dropped silently.
    const invalid = schemaErrors("preset", `Preset ${file}`, raw);
    if (invalid.length > 0) {
      errors.push(...invalid);
      continue;
    }

    // A preset must survive the same sanitising a pasted config goes through
    // unchanged (bar the core components that are always added). Otherwise
    // the composer silently drops part of it on load - which is how a Hetzner
    // preset shipped with a storage provider Talos excludes.
    const components = raw.components as Preset["components"];
    const kept = new Set(sanitizeEntries(components, platform, coreIds).map(entryKey));
    const dropped = components.filter((e) => !kept.has(entryKey(e)));
    if (dropped.length > 0) {
      errors.push(
        `Preset ${file} contains entries the composer would drop: ${dropped.map(entryKey).join(", ")}`
      );
      continue;
    }

    presets.push({
      id: file.replace(/\.json$/, ""),
      name: raw.name,
      description: raw.description,
      components,
    });
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join("\n"));
  }
  return presets;
}
