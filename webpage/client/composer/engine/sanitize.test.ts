import { describe, it, expect } from "vitest";
import path from "path";
import { loadPlatform } from "../data/loader";
import { isWorkload, type SelectionEntry } from "../data/types";
import { getCoreComponentIds } from "./rules";
import { computeUnlockedLayers, sanitizeEntries } from "./sanitize";

const platform = loadPlatform(
  path.resolve(import.meta.dirname, "../__fixtures__/platform/valid"),
);
const core = getCoreComponentIds(platform);

const STACK = ["compute.google", "kubernetes.gke", "providers.cloud-lb"];

function run(entries: SelectionEntry[]) {
  return sanitizeEntries(entries, platform, core);
}

function strings(entries: SelectionEntry[]) {
  return entries.filter((e): e is string => !isWorkload(e)).toSorted();
}

describe("sanitizeEntries", () => {
  it("always adds the core components", () => {
    expect(strings(run([]))).toEqual([...core].toSorted());
  });

  it("drops unknown components", () => {
    expect(run([...STACK, "nope.nothing"])).not.toContain("nope.nothing");
  });

  it("de-duplicates plain ids", () => {
    const out = run([...STACK, "compute.google"]);
    expect(out.filter((e) => e === "compute.google")).toHaveLength(1);
  });

  it("keeps only the first entry of a single-select layer", () => {
    const out = run(["compute.google", "compute.hetzner", "kubernetes.gke"]);
    expect(out).toContain("compute.google");
    expect(out).not.toContain("compute.hetzner");
  });

  it("drops components whose layer is locked, transitively", () => {
    // No compute: kubernetes, providers and everything above stay locked.
    const out = run([
      "kubernetes.gke",
      "providers.cloud-lb",
      "rpp-base.observability",
    ]);
    expect(strings(out)).toEqual([...core].toSorted());
  });

  it("drops what an exclusion invalidates, and what was built on it", () => {
    // Talos excludes cloud-lb; with cloud-lb gone the provider layer has no
    // selection, so rpp-base's optional module and the workloads go too.
    const out = run([
      "compute.google",
      "kubernetes.talos",
      "providers.cloud-lb",
      "rpp-base.observability",
      { type: "workload.api", id: "workload.api-1" },
    ]);
    expect(out).not.toContain("providers.cloud-lb");
    expect(out).not.toContain("rpp-base.observability");
    expect(out.filter(isWorkload)).toEqual([]);
  });

  it("only accepts workload-layer components as instances, and vice versa", () => {
    const out = run([
      ...STACK,
      "workload.api",
      { type: "compute.google", id: "sneaky" },
      { type: "workload.api", id: "workload.api-1" },
    ]);
    expect(out).not.toContain("workload.api");
    expect(out.filter(isWorkload)).toEqual([
      { type: "workload.api", id: "workload.api-1" },
    ]);
  });

  it.each(['x"] , body', "UPPER", "", "a".repeat(65), "../etc"])(
    "refuses the workload id %j",
    (id) => {
      const out = run([...STACK, { type: "workload.api", id }]);
      expect(out.filter(isWorkload)).toEqual([]);
    },
  );

  it("drops duplicate workload ids", () => {
    const out = run([
      ...STACK,
      { type: "workload.api", id: "workload.api-1", title: "A" },
      { type: "workload.api", id: "workload.api-1", title: "B" },
    ]);
    expect(out.filter(isWorkload)).toEqual([
      { type: "workload.api", id: "workload.api-1", title: "A" },
    ]);
  });

  it("truncates overlong workload text", () => {
    const [w] = run([
      ...STACK,
      { type: "workload.api", id: "w-1", title: "t".repeat(500) },
    ]).filter(isWorkload);
    expect(w.title!.length).toBe(80);
  });
});

describe("computeUnlockedLayers", () => {
  it("does not unlock layers above rpp-base just because core components exist", () => {
    const unlocked = computeUnlockedLayers(new Set(core), platform);
    expect([...unlocked]).toEqual(["compute"]);
  });

  it("unlocks the whole stack once each gate has a selection", () => {
    const unlocked = computeUnlockedLayers(
      new Set([...core, ...STACK]),
      platform,
    );
    expect([...unlocked].toSorted()).toEqual(
      [
        "additional",
        "compute",
        "kubernetes",
        "providers",
        "rpp-base",
        "workload",
      ].toSorted(),
    );
  });
});
