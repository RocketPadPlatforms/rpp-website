import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Palette } from "./Palette";
import type { ComposerState } from "../engine/useComposer";
import type { PlatformData } from "../data/types";

function makePlatform(): PlatformData {
  const layers = [
    {
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
          description: "Amazon Web Services",
          core: false,
          rules: { excludes: [], suggests: [] },
        },
        {
          id: "compute.gcp",
          name: "GCP",
          layer: "compute",
          type: "cloud",
          description: "Google Cloud Platform",
          core: false,
          rules: { excludes: [], suggests: [] },
        },
      ],
    },
    {
      id: "kubernetes",
      name: "Kubernetes",
      position: 1,
      select: "single" as const,
      components: [
        {
          id: "kubernetes.eks",
          name: "EKS",
          layer: "kubernetes",
          type: "managed",
          description: "Elastic Kubernetes Service",
          core: false,
          rules: { excludes: [], suggests: [] },
        },
      ],
    },
  ];
  return {
    layers,
    components: new Map([
      ...layers[0]!.components.map((c) => [c.id, c] as const),
      ...layers[1]!.components.map((c) => [c.id, c] as const),
    ]),
    presets: [],
  };
}

function makeComposer(overrides: Partial<ComposerState> = {}): ComposerState {
  const platform = makePlatform();
  return {
    platform,
    selection: new Set(),
    toggle: () => {},
    excluded: new Map(),
    suggested: new Set(),
    output: { schema: "v1", components: [] },
    coreIds: [],
    unlockedLayers: new Set(["compute"]),
    isLayerUnlocked: () => true,
    expandedLayers: new Set(["compute"]),
    isLayerExpanded: () => true,
    shareURL: () => "",
    reset: () => {},
    hydrateFromJSON: () => false,
    ...overrides,
  } as ComposerState;
}

describe("Palette", () => {
  afterEach(() => cleanup());
  it("renders each component as a draggable card", () => {
    render(<Palette composer={makeComposer()} />);
    const aws = screen.getByText("AWS").closest("[draggable]");
    expect(aws).not.toBeNull();
    expect(aws!.getAttribute("draggable")).toBe("true");
  });

  it("calls toggle when a component card is clicked", () => {
    let lastId = null as string | null;
    const composer = makeComposer({ toggle: (id: string) => { lastId = id; } });
    render(<Palette composer={composer} />);
    fireEvent.click(screen.getByText("AWS").closest("[draggable]") as HTMLElement);
    expect(lastId as string).toBe("compute.aws");
  });

  it("cards are keyboard-operable buttons", () => {
    const toggled: string[] = [];
    render(<Palette composer={makeComposer({ toggle: (id: string) => toggled.push(id) })} />);
    const aws = screen.getByRole("button", { name: /Add AWS/ });
    expect(aws.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(aws, { key: "Enter" });
    fireEvent.keyDown(aws, { key: " " });
    expect(toggled).toEqual(["compute.aws", "compute.aws"]);
  });

  it("an excluded card says why and ignores activation", () => {
    const toggled: string[] = [];
    const composer = makeComposer({
      excluded: new Map([["compute.gcp", "AWS"]]),
      toggle: (id: string) => toggled.push(id),
    });
    render(<Palette composer={composer} />);
    const gcp = screen.getByRole("button", { name: "Add GCP (incompatible with AWS)" });
    expect(gcp.getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(gcp, { key: "Enter" });
    fireEvent.click(gcp);
    expect(toggled).toEqual([]);
  });

  it("marks disabled cards as not draggable", () => {
    const composer = makeComposer({
      excluded: new Map([["compute.gcp", "blocked by AWS"]]),
    });
    render(<Palette composer={composer} />);
    const gcp = screen.getByText("GCP").closest("[draggable]") as HTMLElement;
    expect(gcp.getAttribute("draggable")).toBe("false");
    expect(gcp.className).toContain("rpp-pal-card--disabled");
  });

  it("hides component cards for collapsed layers, shows snapped count", () => {
    const composer = makeComposer({
      isLayerExpanded: (id: string) => id === "compute",
      expandedLayers: new Set(["compute"]),
      selection: new Set(["compute.aws"]),
    });
    render(<Palette composer={composer} />);
    // Compute layer components are visible
    expect(screen.getByText("GCP")).toBeTruthy();
    // Kubernetes layer header is visible but components are hidden
    expect(screen.getByText("Kubernetes")).toBeTruthy();
    expect(screen.queryByText("EKS")).toBeNull();
    // Snapped count shown
    expect(screen.getByText("0 snapped")).toBeTruthy();
  });
});
