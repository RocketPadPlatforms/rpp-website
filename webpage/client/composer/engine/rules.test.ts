import { describe, it, expect } from "vitest";
import { getExcluded, getSuggested, getCoreComponentIds } from "./rules";
import { loadPlatform } from "../data/loader";
import path from "path";

const PLATFORM_DIR = path.resolve(
  import.meta.dirname,
  "../__fixtures__/platform/valid"
);
const platform = loadPlatform(PLATFORM_DIR);

describe("getExcluded", () => {
  it("returns empty map when nothing selected", () => {
    const excluded = getExcluded(new Set(), platform);
    expect(excluded.size).toBe(0);
  });

  it("excludes kubernetes.aks when compute.google selected", () => {
    const excluded = getExcluded(new Set(["compute.google"]), platform);
    expect(excluded.has("kubernetes.aks")).toBe(true);
    expect(excluded.get("kubernetes.aks")).toContain("Google");
  });

  it("excludes storage and metal-lb when kubernetes.gke selected", () => {
    const excluded = getExcluded(new Set(["kubernetes.gke"]), platform);
    expect(excluded.has("providers.metal-lb")).toBe(true);
    expect(excluded.has("providers.longhorn")).toBe(true);
    expect(excluded.has("providers.ceph")).toBe(true);
  });

  it("excludes cloud-lb when kubernetes.talos selected", () => {
    const excluded = getExcluded(new Set(["kubernetes.talos"]), platform);
    expect(excluded.has("providers.cloud-lb")).toBe(true);
  });

  it("accumulates exclusions from multiple selections", () => {
    const excluded = getExcluded(
      new Set(["compute.hetzner", "kubernetes.talos"]),
      platform
    );
    expect(excluded.has("kubernetes.gke")).toBe(true);
    expect(excluded.has("kubernetes.aks")).toBe(true);
    expect(excluded.has("providers.cloud-lb")).toBe(true);
  });
});

describe("getSuggested", () => {
  it("returns empty set when nothing selected", () => {
    const suggested = getSuggested(new Set(), platform);
    expect(suggested.size).toBe(0);
  });

  it("suggests kubernetes.gke when compute.google selected", () => {
    const suggested = getSuggested(new Set(["compute.google"]), platform);
    expect(suggested.has("kubernetes.gke")).toBe(true);
  });

  it("suggests providers.metal-lb when kubernetes.talos selected", () => {
    const suggested = getSuggested(new Set(["kubernetes.talos"]), platform);
    expect(suggested.has("providers.metal-lb")).toBe(true);
  });
});

describe("getCoreComponentIds", () => {
  it("returns iam, gitops, ssl as core", () => {
    const cores = getCoreComponentIds(platform);
    expect(cores.sort()).toEqual([
      "rpp-base.gitops",
      "rpp-base.iam",
      "rpp-base.ssl",
    ]);
  });
});
