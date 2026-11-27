import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import path from "path";
import { loadPlatform } from "../data/loader";
import { useComposer } from "./useComposer";
import type { WorkloadInstance } from "../data/types";
import { isWorkload } from "../data/types";

// Engine behaviour is tested against the fixture platform, not the shipped one,
// so product changes to platform/ cannot break these tests. Same as rules.test.ts.
const PLATFORM_DIR = path.resolve(
  import.meta.dirname,
  "../__fixtures__/platform/valid",
);
const platform = loadPlatform(PLATFORM_DIR);

function ids(set: Set<string>): string[] {
  return [...set].sort();
}

describe("useComposer selection engine", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("starts with only core components selected", () => {
    const { result } = renderHook(() => useComposer(platform));
    expect(ids(result.current.selection)).toEqual(
      ids(new Set(result.current.coreIds)),
    );
  });

  it("selecting compute.google auto-suggests kubernetes.gke", () => {
    const { result } = renderHook(() => useComposer(platform));
    act(() => result.current.toggle("compute.google"));
    expect(result.current.selection.has("compute.google")).toBe(true);
    expect(result.current.selection.has("kubernetes.gke")).toBe(true);
  });

  it("selecting kubernetes.talos after compute.google evicts kubernetes.gke", () => {
    const { result } = renderHook(() => useComposer(platform));
    act(() => result.current.toggle("compute.google"));
    act(() => result.current.toggle("kubernetes.talos"));

    expect(result.current.selection.has("kubernetes.talos")).toBe(true);
    expect(result.current.selection.has("kubernetes.gke")).toBe(false);
    expect(result.current.selection.has("compute.google")).toBe(true);
  });

  it("after selecting talos, provider and rpp-base layers are unlocked", () => {
    const { result } = renderHook(() => useComposer(platform));
    act(() => result.current.toggle("compute.google"));
    act(() => result.current.toggle("kubernetes.talos"));

    expect(result.current.isLayerUnlocked("providers")).toBe(true);
    expect(result.current.isLayerUnlocked("rpp-base")).toBe(true);
  });

  it("selecting kubernetes.talos auto-suggests providers.metal-lb", () => {
    const { result } = renderHook(() => useComposer(platform));
    act(() => result.current.toggle("compute.google"));
    act(() => result.current.toggle("kubernetes.talos"));

    expect(result.current.selection.has("providers.metal-lb")).toBe(true);
  });

  it("core components cannot be deselected", () => {
    const { result } = renderHook(() => useComposer(platform));
    const core = result.current.coreIds[0];
    act(() => result.current.toggle(core));
    expect(result.current.selection.has(core)).toBe(true);
  });

  it("toggling a component in a locked layer has no effect", () => {
    const { result } = renderHook(() => useComposer(platform));
    const before = new Set(result.current.selection);
    act(() => result.current.toggle("providers.metal-lb"));
    expect(ids(result.current.selection)).toEqual(ids(before));
  });
});

describe("useComposer hydrateFromJSON", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("replaces selection with parsed components and re-adds core", () => {
    const { result } = renderHook(() => useComposer(platform));
    const raw = JSON.stringify({
      schema: "v1",
      components: ["compute.google", "kubernetes.gke"],
    });

    let ok = false;
    act(() => {
      ok = result.current.hydrateFromJSON(raw);
    });

    expect(ok).toBe(true);
    expect(result.current.selection.has("compute.google")).toBe(true);
    expect(result.current.selection.has("kubernetes.gke")).toBe(true);
    for (const coreId of result.current.coreIds) {
      expect(result.current.selection.has(coreId)).toBe(true);
    }
  });

  it("returns false and leaves selection unchanged on malformed JSON", () => {
    const { result } = renderHook(() => useComposer(platform));
    const before = ids(result.current.selection);

    let ok = true;
    act(() => {
      ok = result.current.hydrateFromJSON("totally not json");
    });

    expect(ok).toBe(false);
    expect(ids(result.current.selection)).toEqual(before);
  });

  it("drops unknown component IDs silently", () => {
    const { result } = renderHook(() => useComposer(platform));
    const raw = JSON.stringify({
      schema: "v1",
      components: ["compute.google", "definitely.not.real"],
    });

    let ok = false;
    act(() => {
      ok = result.current.hydrateFromJSON(raw);
    });

    expect(ok).toBe(true);
    expect(result.current.selection.has("compute.google")).toBe(true);
    expect(result.current.selection.has("definitely.not.real")).toBe(false);
  });
});

describe("addWorkload + removeEntry", () => {
  it("addWorkload assigns sequential ids per type", () => {
    const p = loadPlatform(PLATFORM_DIR);
    const { result } = renderHook(() => useComposer(p));

    let id1 = "";
    let id2 = "";
    let id3 = "";
    act(() => {
      id1 = result.current.addWorkload("workload.api", "", "first");
    });
    act(() => {
      id2 = result.current.addWorkload("workload.api", "", "second");
    });
    act(() => {
      id3 = result.current.addWorkload("workload.app", "", "web");
    });

    expect(id1).toBe("workload.api-1");
    expect(id2).toBe("workload.api-2");
    expect(id3).toBe("workload.app-1");

    const instances = result.current.entries.filter(isWorkload);
    expect(instances).toHaveLength(3);
  });

  it("removeEntry by instance id removes only that instance", () => {
    const p = loadPlatform(PLATFORM_DIR);
    const { result } = renderHook(() => useComposer(p));

    act(() => {
      result.current.addWorkload("workload.api", "", "a");
    });
    act(() => {
      result.current.addWorkload("workload.api", "", "b");
    });
    act(() => {
      result.current.removeEntry("workload.api-1");
    });

    const workloads = result.current.entries.filter(isWorkload);
    expect(workloads.map((w: WorkloadInstance) => w.id)).toEqual([
      "workload.api-2",
    ]);
    // type is still present in selection
    expect(result.current.selection.has("workload.api")).toBe(true);
  });

  it("removing last instance of a type removes the type from selection set", () => {
    const p = loadPlatform(PLATFORM_DIR);
    const { result } = renderHook(() => useComposer(p));

    act(() => {
      result.current.addWorkload("workload.api", "", "only");
    });
    expect(result.current.selection.has("workload.api")).toBe(true);
    act(() => {
      result.current.removeEntry("workload.api-1");
    });
    expect(result.current.selection.has("workload.api")).toBe(false);
  });

  it("reuses number of highest deleted (gap fill is not done for interior)", () => {
    const p = loadPlatform(PLATFORM_DIR);
    const { result } = renderHook(() => useComposer(p));

    act(() => {
      result.current.addWorkload("workload.api", "", "");
    });
    act(() => {
      result.current.addWorkload("workload.api", "", "");
    });
    act(() => {
      result.current.addWorkload("workload.api", "", "");
    });
    // delete highest (-3)
    act(() => {
      result.current.removeEntry("workload.api-3");
    });
    let next = "";
    act(() => {
      next = result.current.addWorkload("workload.api", "", "");
    });
    expect(next).toBe("workload.api-3"); // highest was removed → reused
  });

  it("two adds in the same tick get distinct ids", () => {
    // Minting ids from a state closure gave both calls the same number.
    // Duplicate ids make parseShareShape reject the whole payload, so the
    // share URL would decode to nothing and silently empty the canvas.
    const p = loadPlatform(PLATFORM_DIR);
    const { result } = renderHook(() => useComposer(p));

    let first = "";
    let second = "";
    act(() => {
      first = result.current.addWorkload("workload.api", "", "");
      second = result.current.addWorkload("workload.api", "", "");
    });

    expect(first).toBe("workload.api-1");
    expect(second).toBe("workload.api-2");

    const stored = result.current.entries.filter(isWorkload).map((w) => w.id);
    expect(stored).toEqual(["workload.api-1", "workload.api-2"]);
    // The returned ids must be the ones actually stored.
    expect(stored).toEqual([first, second]);
  });

  it("stores only user intent, leaving blank fields off the instance", () => {
    const p = loadPlatform(PLATFORM_DIR);
    const { result } = renderHook(() => useComposer(p));

    act(() => {
      result.current.addWorkload("workload.api", "", "");
    });

    const [w] = result.current.entries.filter(isWorkload);
    expect(w).toEqual({ type: "workload.api", id: "workload.api-1" });
  });
});

/**
 * Minimum selection that opens the workload layer. hydrateFromJSON drops
 * entries sitting in a locked layer, so a config carrying workloads must carry
 * this chain too. Note there is deliberately no `additional` module here:
 * workloads gate on providers, same as RPP Base.
 */
function selectStackUpToWorkloads(result: {
  current: ReturnType<typeof useComposer>;
}) {
  act(() => result.current.toggle("compute.google")); // auto-suggests kubernetes.gke
  act(() => result.current.toggle("providers.cloud-lb"));
}

describe("workload layer unlock", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("opens together with rpp-base, without any additional module", () => {
    const p = loadPlatform(PLATFORM_DIR);
    const { result } = renderHook(() => useComposer(p));

    expect(result.current.isLayerUnlocked("workload")).toBe(false);

    act(() => result.current.toggle("compute.google"));
    expect(result.current.isLayerUnlocked("workload")).toBe(false);

    act(() => result.current.toggle("providers.cloud-lb"));
    // Same gate as rpp-base — picking an optional add-on is not a prerequisite.
    expect(result.current.isLayerUnlocked("rpp-base")).toBe(true);
    expect(result.current.isLayerUnlocked("workload")).toBe(true);
    expect(result.current.selection.has("additional.s3-storage")).toBe(false);
  });

  it("a workload-carrying config imports without an additional module", () => {
    const p = loadPlatform(PLATFORM_DIR);
    const { result } = renderHook(() => useComposer(p));

    const raw = JSON.stringify({
      schema: "v1",
      components: [
        "compute.google",
        "kubernetes.gke",
        "providers.cloud-lb",
        { type: "workload.api", id: "workload.api-1", title: "Billing" },
      ],
    });

    act(() => {
      result.current.hydrateFromJSON(raw);
    });

    expect(result.current.entries.filter(isWorkload)).toEqual([
      { type: "workload.api", id: "workload.api-1", title: "Billing" },
    ]);
  });
});

describe("workload share/import round trip", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("survives an export/import round trip with and without a title", () => {
    const p = loadPlatform(PLATFORM_DIR);
    const { result } = renderHook(() => useComposer(p));

    selectStackUpToWorkloads(result);
    act(() => {
      result.current.addWorkload("workload.api", "Billing", "invoices");
    });
    act(() => {
      result.current.addWorkload("workload.api", "", "");
    });

    const before = result.current.entries.filter(isWorkload);
    expect(before).toHaveLength(2);

    const fresh = renderHook(() => useComposer(p));
    act(() => {
      fresh.result.current.hydrateFromJSON(
        JSON.stringify(result.current.output),
      );
    });

    expect(fresh.result.current.entries.filter(isWorkload)).toEqual(before);
  });

  it("keeps the share fragment free of catalog text for untitled workloads", () => {
    const p = loadPlatform(PLATFORM_DIR);
    const { result } = renderHook(() => useComposer(p));

    selectStackUpToWorkloads(result);
    act(() => {
      result.current.addWorkload("workload.api", "", "");
    });

    const fragment = result.current.shareURL().split("#")[1];
    expect(atob(fragment)).not.toContain("API service workload");
  });

  it("imports an older payload that baked the catalog description in", () => {
    const p = loadPlatform(PLATFORM_DIR);
    const { result } = renderHook(() => useComposer(p));

    const legacy = JSON.stringify({
      schema: "v1",
      components: [
        "compute.google",
        "kubernetes.gke",
        "providers.cloud-lb",
        {
          type: "workload.api",
          id: "workload.api-1",
          title: "",
          description: "API service workload",
        },
      ],
    });

    let ok = false;
    act(() => {
      ok = result.current.hydrateFromJSON(legacy);
    });

    expect(ok).toBe(true);
    const [w] = result.current.entries.filter(isWorkload);
    expect(w.id).toBe("workload.api-1");
    expect(w.description).toBe("API service workload");
  });
});

describe("removal, suggestions and share links", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("removing the compute provider takes everything built on it along", () => {
    const { result } = renderHook(() => useComposer(platform));
    selectStackUpToWorkloads(result);
    act(() => {
      result.current.addWorkload("workload.api", "Billing", "");
    });

    act(() => result.current.toggle("compute.google"));

    expect(ids(result.current.selection)).toEqual(
      ids(new Set(result.current.coreIds)),
    );
    expect(
      result.current.output.components.filter((c) => typeof c !== "string"),
    ).toEqual([]);
  });

  it("removeEntry cascades the same way as toggling off", () => {
    const { result } = renderHook(() => useComposer(platform));
    selectStackUpToWorkloads(result);
    act(() => result.current.removeEntry("providers.cloud-lb"));
    expect(result.current.selection.has("kubernetes.gke")).toBe(true);
    expect(result.current.isLayerUnlocked("rpp-base")).toBe(false);
  });

  it("a removed suggestion does not come back when something unrelated is added", () => {
    const { result } = renderHook(() => useComposer(platform));
    act(() => result.current.toggle("compute.google"));
    act(() => result.current.toggle("kubernetes.talos")); // suggests providers.metal-lb
    act(() => result.current.toggle("providers.longhorn"));
    expect(result.current.selection.has("providers.metal-lb")).toBe(true);

    act(() => result.current.toggle("providers.metal-lb")); // the user says no
    act(() => result.current.toggle("rpp-base.observability"));

    expect(result.current.selection.has("providers.metal-lb")).toBe(false);
    expect(result.current.selection.has("rpp-base.observability")).toBe(true);
  });

  it("additional modules stay locked until the stack below them is chosen", () => {
    const { result } = renderHook(() => useComposer(platform));
    expect(result.current.isLayerUnlocked("additional")).toBe(false);
    act(() => result.current.toggle("additional.s3-storage"));
    expect(result.current.selection.has("additional.s3-storage")).toBe(false);
  });

  it("a hostile share link is sanitised instead of reaching the canvas", () => {
    const payload = {
      schema: "v1",
      components: [
        "compute.google",
        "compute.hetzner",
        "kubernetes.gke",
        "providers.cloud-lb",
        { type: "workload.api", id: 'x"]' },
        { type: "compute.amazon", id: "sneaky" },
      ],
    };
    window.location.hash = btoa(JSON.stringify(payload));
    const { result } = renderHook(() => useComposer(platform));

    expect(result.current.selection.has("compute.hetzner")).toBe(false);
    expect(result.current.selection.has("compute.amazon")).toBe(false);
    expect(result.current.entries.filter(isWorkload)).toEqual([]);
    for (const coreId of result.current.coreIds) {
      expect(result.current.selection.has(coreId)).toBe(true);
    }
  });
});

describe("useComposer isLayerExpanded", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("compute is always expanded", () => {
    const { result } = renderHook(() => useComposer(platform));
    expect(result.current.isLayerExpanded("compute")).toBe(true);
  });

  it("kubernetes is collapsed when no non-core compute selection", () => {
    const { result } = renderHook(() => useComposer(platform));
    expect(result.current.isLayerExpanded("kubernetes")).toBe(false);
  });

  it("kubernetes expands after selecting compute.google", () => {
    const { result } = renderHook(() => useComposer(platform));
    act(() => result.current.toggle("compute.google"));
    expect(result.current.isLayerExpanded("kubernetes")).toBe(true);
  });

  it("providers expands after selecting compute + kubernetes", () => {
    const { result } = renderHook(() => useComposer(platform));
    act(() => result.current.toggle("compute.google"));
    // kubernetes.gke is auto-suggested
    expect(result.current.isLayerExpanded("providers")).toBe(true);
  });

  it("rpp-base stays collapsed until providers has a non-core selection", () => {
    const { result } = renderHook(() => useComposer(platform));
    act(() => result.current.toggle("compute.google"));
    // gke auto-suggested, providers not yet selected
    expect(result.current.isLayerExpanded("rpp-base")).toBe(false);
    act(() => result.current.toggle("providers.cloud-lb"));
    expect(result.current.isLayerExpanded("rpp-base")).toBe(true);
  });

  it("core selections in rpp-base expand the additional layer", () => {
    const { result } = renderHook(() => useComposer(platform));
    act(() => result.current.toggle("compute.google"));
    act(() => result.current.toggle("providers.cloud-lb"));
    expect(result.current.isLayerExpanded("rpp-base")).toBe(true);
    expect(result.current.isLayerExpanded("additional")).toBe(true);
  });
});
