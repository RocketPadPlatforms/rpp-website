import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Canvas } from "./Canvas";
import type { ComposerState } from "../engine/useComposer";
import type { PlatformData, SelectionEntry } from "../data/types";
import { useComposer } from "../engine/useComposer";

afterEach(() => cleanup());

function makePlatform(): PlatformData {
  const compute = {
    id: "compute",
    name: "Compute",
    position: 0,
    select: "single" as const,
    components: [
      {
        id: "compute.aws",
        name: "AWS",
        layer: "compute",
        type: "cloud",
        description: "",
        core: false,
        rules: { excludes: [], suggests: [] },
      },
    ],
  };
  const k8s = {
    id: "kubernetes",
    name: "Kubernetes",
    position: 1,
    select: "single" as const,
    components: [
      {
        id: "kubernetes.eks",
        name: "EKS",
        layer: "kubernetes",
        type: "k8s",
        description: "",
        core: false,
        rules: { excludes: [], suggests: [] },
      },
    ],
  };
  return {
    layers: [compute, k8s],
    components: new Map([
      ...compute.components.map((c) => [c.id, c] as const),
      ...k8s.components.map((c) => [c.id, c] as const),
    ]),
    presets: [],
  };
}

function makeComposer(
  selected: string[],
  unlocked: string[],
  toggle: (id: string) => void = () => {},
): ComposerState {
  return {
    platform: makePlatform(),
    entries: selected as SelectionEntry[],
    selection: new Set(selected),
    toggle,
    addWorkload: () => "",
    updateWorkload: () => {},
    removeEntry: () => {},
    excluded: new Map(),
    suggested: new Set(),
    output: { schema: "v1", components: selected },
    coreIds: [],
    unlockedLayers: new Set(unlocked),
    isLayerUnlocked: (id) => unlocked.includes(id),
    expandedLayers: new Set(unlocked),
    isLayerExpanded: (id) => unlocked.includes(id),
    shareURL: () => "",
    reset: () => {},
    hydrateFromJSON: () => false,
  } as ComposerState;
}

function makeWorkloadPlatform(): PlatformData {
  const workloadLayer = {
    id: "workload",
    name: "Custom Workload",
    position: 0,
    select: "multi" as const,
    components: [
      {
        id: "workload.api",
        name: "API",
        layer: "workload",
        type: "service",
        description: "API service workload",
        core: false,
        rules: { excludes: [], suggests: [] },
      },
    ],
  };
  return {
    layers: [workloadLayer],
    components: new Map(
      workloadLayer.components.map((c) => [c.id, c] as const),
    ),
    presets: [],
  };
}

function TestHost() {
  const platform = makeWorkloadPlatform();
  const composer = useComposer(platform);
  return <Canvas composer={composer} />;
}

describe("Canvas", () => {
  it("renders a drop zone for every layer", () => {
    render(<Canvas composer={makeComposer([], ["compute"])} />);
    expect(screen.getByTestId("drop-zone-compute")).toBeDefined();
    expect(screen.getByTestId("drop-zone-kubernetes")).toBeDefined();
  });

  it("shows locked placeholder for expanded locked layers", () => {
    const composer = makeComposer([], ["compute"]);
    // Force kubernetes to be expanded (visible) but still locked
    composer.isLayerExpanded = () => true;
    composer.expandedLayers = new Set(["compute", "kubernetes"]);
    render(<Canvas composer={composer} />);
    const zone = screen.getByTestId("drop-zone-kubernetes");
    expect(zone.textContent).toContain("Complete previous layer first");
  });

  it("calls toggle when dropping a draggable onto an unlocked layer", () => {
    let called = null as string | null;
    const composer = makeComposer([], ["compute"], (id: string) => {
      called = id;
    });
    render(<Canvas composer={composer} />);
    const zone = screen.getByTestId("drop-zone-compute");

    const store = new Map<string, string>();
    store.set("text/plain", "compute.aws");
    const dataTransfer = {
      getData: (k: string) => store.get(k) ?? "",
      setData: (k: string, v: string) => {
        store.set(k, v);
      },
      dropEffect: "move",
      effectAllowed: "move",
    } as unknown as DataTransfer;

    fireEvent.dragOver(zone, { dataTransfer });
    fireEvent.drop(zone, { dataTransfer });
    expect(called as string).toBe("compute.aws");
  });

  it("ignores drops onto locked layers", () => {
    let called = null as string | null;
    const composer = makeComposer([], ["compute"], (id: string) => {
      called = id;
    });
    render(<Canvas composer={composer} />);
    const zone = screen.getByTestId("drop-zone-kubernetes");

    const store = new Map<string, string>();
    store.set("text/plain", "kubernetes.eks");
    const dataTransfer = {
      getData: (k: string) => store.get(k) ?? "",
      setData: (k: string, v: string) => {
        store.set(k, v);
      },
      dropEffect: "move",
      effectAllowed: "move",
    } as unknown as DataTransfer;

    fireEvent.dragOver(zone, { dataTransfer });
    fireEvent.drop(zone, { dataTransfer });
    expect(called).toBeNull();
  });

  it("renders selected components as canvas cards with data-wire attribute", () => {
    render(
      <Canvas
        composer={makeComposer(["compute.aws"], ["compute", "kubernetes"])}
      />,
    );
    const card = document.querySelector('[data-wire="compute.aws"]');
    expect(card).not.toBeNull();
  });

  it("renders compute drop zone after kubernetes (bottom-up order)", () => {
    render(<Canvas composer={makeComposer([], ["compute"])} />);
    const zones = screen.getAllByTestId(/^drop-zone-/);
    const ids = zones.map((z) => z.getAttribute("data-testid"));
    expect(ids).toEqual(["drop-zone-kubernetes", "drop-zone-compute"]);
  });

  it("renders collapsed layer as single dimmed row when not expanded", () => {
    const composer = makeComposer([], ["compute"]);
    composer.isLayerExpanded = (id) => id === "compute";
    composer.expandedLayers = new Set(["compute"]);
    render(<Canvas composer={composer} />);
    const k8sZone = screen.getByTestId("drop-zone-kubernetes");
    expect(k8sZone.textContent).toContain("Kubernetes");
    expect(k8sZone.textContent).toContain("0 snapped");
    // Should NOT contain the full drop prompt
    expect(k8sZone.textContent).not.toContain("Drag or click");
    expect(k8sZone.textContent).not.toContain("Complete previous");
  });

  it("renders expanded layer with full content", () => {
    const composer = makeComposer(["compute.aws"], ["compute", "kubernetes"]);
    composer.isLayerExpanded = () => true;
    composer.expandedLayers = new Set(["compute", "kubernetes"]);
    render(<Canvas composer={composer} />);
    const computeZone = screen.getByTestId("drop-zone-compute");
    expect(
      computeZone.querySelector('[data-wire="compute.aws"]'),
    ).not.toBeNull();
  });
});

describe("Canvas workload drop flow", () => {
  it("opens WorkloadModal when a workload component is dropped", () => {
    render(<TestHost />);
    const dropZone = screen.getByTestId("drop-zone-workload");
    const dt = {
      getData: (_k: string) => "workload.api",
      types: ["text/plain"],
    } as unknown as DataTransfer;
    fireEvent.drop(dropZone, { dataTransfer: dt });
    expect(screen.getByText(/Add API Workload/i)).toBeTruthy();
  });

  it("cancel leaves selection unchanged", () => {
    render(<TestHost />);
    const dropZone = screen.getByTestId("drop-zone-workload");
    const dt = {
      getData: (_k: string) => "workload.api",
      types: ["text/plain"],
    } as unknown as DataTransfer;
    fireEvent.drop(dropZone, { dataTransfer: dt });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    // No instance card rendered
    expect(screen.queryByText(/API #1/)).toBeNull();
  });

  it("save adds a workload instance card labelled '<typeName> #1'", () => {
    render(<TestHost />);
    const dropZone = screen.getByTestId("drop-zone-workload");
    const dt = {
      getData: (_k: string) => "workload.api",
      types: ["text/plain"],
    } as unknown as DataTransfer;
    fireEvent.drop(dropZone, { dataTransfer: dt });
    const textarea = screen.getByPlaceholderText(
      /API service workload/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "billing" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByText(/API #1/)).toBeTruthy();
  });

  it("untitled card shows the type once, not again as a description line", () => {
    render(<TestHost />);
    const dt = {
      getData: (_k: string) => "workload.api",
      types: ["text/plain"],
    } as unknown as DataTransfer;
    fireEvent.drop(screen.getByTestId("drop-zone-workload"), {
      dataTransfer: dt,
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    // The fallback label already reads "API #1"; a bare "API" line underneath
    // would just repeat the type and read as a second description.
    const card = document.querySelector("[data-wire='workload.api-1']");
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain("API #1");
    expect(
      [...(card?.querySelectorAll("div") ?? [])].some(
        (d) => d.textContent?.trim() === "API",
      ),
    ).toBe(false);
  });

  it("titled card shows the type as an eyebrow above the custom title", () => {
    render(<TestHost />);
    const dt = {
      getData: (_k: string) => "workload.api",
      types: ["text/plain"],
    } as unknown as DataTransfer;
    fireEvent.drop(screen.getByTestId("drop-zone-workload"), {
      dataTransfer: dt,
    });
    fireEvent.change(screen.getByPlaceholderText(/Title/i), {
      target: { value: "Billing" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    const card = document.querySelector("[data-wire='workload.api-1']");
    const lines = [...(card?.querySelectorAll("div") ?? [])]
      .map((d) => d.textContent?.trim())
      .filter((t) => t === "API" || t === "Billing");
    // Type first, then the user's title.
    expect(lines).toEqual(["API", "Billing"]);
  });
});
