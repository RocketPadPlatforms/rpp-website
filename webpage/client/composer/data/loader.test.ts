import { describe, it, expect } from "vitest";
import { loadPlatform, ValidationError } from "./loader";
import path from "path";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";

const VALID = path.resolve(import.meta.dirname, "../__fixtures__/platform/valid");
const INVALID = path.resolve(import.meta.dirname, "../__fixtures__/platform/invalid");
const NO_PRESETS = path.resolve(import.meta.dirname, "../__fixtures__/platform/no-presets");

describe("loadPlatform", () => {
  it("loads valid platform data", () => {
    const data = loadPlatform(VALID);
    expect(data.layers).toHaveLength(6);
    expect(data.layers[0].id).toBe("compute");
    expect(data.layers[0].position).toBe(0);
    expect(data.layers[0].select).toBe("single");
    expect(data.layers[5].id).toBe("workload");
  });

  it("attaches components to their layers", () => {
    const data = loadPlatform(VALID);
    const compute = data.layers.find((l) => l.id === "compute")!;
    expect(compute.components).toHaveLength(4);
    expect(compute.components.map((c) => c.id).sort()).toEqual([
      "compute.amazon",
      "compute.baremetal",
      "compute.google",
      "compute.hetzner",
    ]);
  });

  it("resolves component rules", () => {
    const data = loadPlatform(VALID);
    const google = data.components.get("compute.google")!;
    expect(google.rules.excludes).toContain("kubernetes.aks");
    expect(google.rules.suggests).toContain("kubernetes.gke");
  });

  it("marks core components", () => {
    const data = loadPlatform(VALID);
    const iam = data.components.get("rpp-base.iam")!;
    expect(iam.core).toBe(true);
    const obs = data.components.get("rpp-base.observability")!;
    expect(obs.core).toBe(false);
  });

  it("sorts layers by position", () => {
    const data = loadPlatform(VALID);
    const positions = data.layers.map((l) => l.position);
    expect(positions).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("populates the components map with all 23 components", () => {
    const data = loadPlatform(VALID);
    expect(data.components.size).toBe(23);
  });

  it("throws on missing required layer field", () => {
    expect(() =>
      loadPlatform(INVALID, "layers-missing-field.yaml")
    ).toThrow(ValidationError);
  });

  it("throws when unlocksAfter names a layer that does not exist", () => {
    expect(() =>
      loadPlatform(INVALID, "layers-unknown-unlocks-after.yaml")
    ).toThrow(/unknown layer "nope"/);
  });

  it("throws when unlocksAfter points at a layer higher in the stack", () => {
    // The unlock/expand passes sweep layers in order, so the gating layer must
    // already have been resolved by the time we reach the layer it gates.
    expect(() =>
      loadPlatform(INVALID, "layers-backwards-unlocks-after.yaml")
    ).toThrow(/must sit lower/);
  });

  it("carries unlocksAfter through to the resolved layer", () => {
    const workload = loadPlatform(VALID).layers.find((l) => l.id === "workload");
    expect(workload?.unlocksAfter).toBe("providers");
  });

  it("throws on invalid component ID format", () => {
    expect(() =>
      loadPlatform(INVALID, "layers.yaml", "bad-id.yaml")
    ).toThrow(ValidationError);
  });

  it("loads preset files from the presets directory", () => {
    const data = loadPlatform(VALID);
    expect(data.presets.length).toBeGreaterThanOrEqual(1);
    const gcp = data.presets.find((p) => p.id === "gcp-managed");
    expect(gcp).toBeDefined();
    expect(gcp!.name).toBe("GCP Managed");
    expect(gcp!.description).toBe("Fully managed GCP platform with GKE");
    expect(gcp!.components).toEqual([
      "compute.google",
      "kubernetes.gke",
      "providers.cloud-lb",
    ]);
  });

  it("returns empty presets array when no presets directory exists", () => {
    const data = loadPlatform(NO_PRESETS);
    expect(data.presets).toEqual([]);
  });
});

/** A writable copy of the valid fixture, for tests that break one file. */
function scratchPlatform(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "rpp-platform-"));
  cpSync(VALID, dir, { recursive: true });
  return dir;
}

describe("loadPlatform rejects what used to slip through", () => {
  it("a component naming an unknown layer", () => {
    const dir = scratchPlatform();
    writeFileSync(
      path.join(dir, "components/compute/ghost.yaml"),
      "kind: Component\nid: compute.ghost\nname: Ghost\nlayer: computer\ntype: cloud\ndescription: typo\n",
    );
    expect(() => loadPlatform(dir)).toThrow(/unknown layer "computer"/);
  });

  it("a component filed in another layer's folder", () => {
    const dir = scratchPlatform();
    writeFileSync(
      path.join(dir, "components/compute/misfiled.yaml"),
      "kind: Component\nid: providers.misfiled\nname: Misfiled\nlayer: providers\ntype: x\ndescription: x\n",
    );
    expect(() => loadPlatform(dir)).toThrow(/components\/compute\/ but belongs to layer "providers"/);
  });

  it("a component property the schema does not know", () => {
    const dir = scratchPlatform();
    writeFileSync(
      path.join(dir, "components/compute/extra.yaml"),
      "kind: Component\nid: compute.extra\nname: Extra\nlayer: compute\ntype: x\ndescription: x\ncolour: red\n",
    );
    expect(() => loadPlatform(dir)).toThrow(/must NOT have additional properties/);
  });

  it("a preset the composer would partly drop", () => {
    const dir = scratchPlatform();
    writeFileSync(
      path.join(dir, "presets/broken.json"),
      JSON.stringify({
        schema: "v1",
        name: "Broken",
        description: "Talos excludes cloud-lb",
        components: ["compute.hetzner", "kubernetes.talos", "providers.cloud-lb"],
      }),
    );
    expect(() => loadPlatform(dir)).toThrow(/broken.json contains entries the composer would drop: providers.cloud-lb/);
  });

  it("a malformed preset instead of skipping it", () => {
    const dir = scratchPlatform();
    writeFileSync(path.join(dir, "presets/nameless.json"), JSON.stringify({ schema: "v1", components: [] }));
    expect(() => loadPlatform(dir)).toThrow(/Preset nameless.json/);
  });

  it("duplicate layer positions", () => {
    const dir = scratchPlatform();
    const layers = readFileSync(path.join(dir, "layers.yaml"), "utf-8").replace("position: 2", "position: 1");
    writeFileSync(path.join(dir, "layers.yaml"), layers);
    expect(() => loadPlatform(dir)).toThrow(/unique and contiguous/);
  });
});

// The fixtures keep engine tests independent of product edits; this one makes
// sure the catalogue that actually ships is consistent.
describe("the shipped platform catalogue", () => {
  const SHIPPED = path.resolve(import.meta.dirname, "../../../platform");

  it("loads, and every preset applies unchanged", () => {
    const data = loadPlatform(SHIPPED);
    expect(data.presets.length).toBeGreaterThanOrEqual(4);
    expect(data.components.size).toBeGreaterThanOrEqual(20);
  });

  it("names every component uniquely", () => {
    const names = [...loadPlatform(SHIPPED).components.values()].map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
