import { describe, it, expect, afterEach, vi, type Mock } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ComposeDrawer } from "./ComposeDrawer";

afterEach(cleanup);

function makeComposer(
  overrides: Partial<ReturnType<typeof baseComposer>> = {},
) {
  return { ...baseComposer(), ...overrides };
}

function baseComposer() {
  return {
    hydrateFromJSON: vi.fn(() => true),
    platform: {
      layers: [],
      components: new Map(),
      presets: [
        {
          id: "gcp-managed",
          name: "GCP Managed",
          description: "Fully managed GCP platform with GKE",
          components: [
            "compute.google",
            "kubernetes.gke",
            "providers.cloud-lb",
          ],
        },
      ],
    },
  } as unknown as import("../engine/useComposer").ComposerState & {
    hydrateFromJSON: Mock;
  };
}

describe("ComposeDrawer", () => {
  it("renders nothing when open is false", () => {
    const composer = makeComposer();
    const { container } = render(
      <ComposeDrawer composer={composer} open={false} onClose={() => {}} />,
    );
    expect(container.querySelector("[data-compose-drawer]")).toBeNull();
  });

  it("renders framing copy and inputs when open", () => {
    const composer = makeComposer();
    render(
      <ComposeDrawer composer={composer} open={true} onClose={() => {}} />,
    );

    expect(screen.getByText(/Start from one of our presets/i)).toBeTruthy();
    expect(screen.getByLabelText(/paste json/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^compose$/i })).toBeTruthy();
  });

  it("does not render the description textarea", () => {
    const composer = makeComposer();
    render(
      <ComposeDrawer composer={composer} open={true} onClose={() => {}} />,
    );
    expect(screen.queryByLabelText(/^description$/i)).toBeNull();
  });

  it("disables Compose button when JSON textarea is empty", () => {
    const composer = makeComposer();
    render(
      <ComposeDrawer composer={composer} open={true} onClose={() => {}} />,
    );
    const btn = screen.getByRole("button", {
      name: /^compose$/i,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("calls hydrateFromJSON and onClose on successful compose", () => {
    const hydrate = vi.fn(() => true);
    const onClose = vi.fn(() => {});
    const composer = makeComposer({ hydrateFromJSON: hydrate } as any);

    render(<ComposeDrawer composer={composer} open={true} onClose={onClose} />);
    const textarea = screen.getByLabelText(
      /paste json/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: {
        value: '{"schema":"v1","components":["compute.google"]}',
      },
    });

    const btn = screen.getByRole("button", { name: /^compose$/i });
    fireEvent.click(btn);

    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows inline error and keeps drawer open on parse failure", () => {
    const hydrate = vi.fn(() => false);
    const onClose = vi.fn(() => {});
    const composer = makeComposer({ hydrateFromJSON: hydrate } as any);

    render(<ComposeDrawer composer={composer} open={true} onClose={onClose} />);
    const textarea = screen.getByLabelText(
      /paste json/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "garbage" } });

    fireEvent.click(screen.getByRole("button", { name: /^compose$/i }));

    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/could not read that json/i)).toBeTruthy();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn(() => {});
    const composer = makeComposer();
    render(<ComposeDrawer composer={composer} open={true} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders preset cards when open", () => {
    const composer = makeComposer();
    render(
      <ComposeDrawer composer={composer} open={true} onClose={() => {}} />,
    );
    expect(screen.getByText("GCP Managed")).toBeTruthy();
    expect(
      screen.getByText("Fully managed GCP platform with GKE"),
    ).toBeTruthy();
  });

  it("clicking a preset calls hydrateFromJSON and closes drawer", () => {
    const hydrate = vi.fn(() => true);
    const onClose = vi.fn(() => {});
    const composer = makeComposer({ hydrateFromJSON: hydrate } as any);

    render(<ComposeDrawer composer={composer} open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("GCP Managed"));

    expect(hydrate).toHaveBeenCalledTimes(1);
    const arg = (hydrate as any).mock.calls[0][0] as string;
    const parsed = JSON.parse(arg);
    expect(parsed.schema).toBe("v1");
    expect(parsed.components).toContain("compute.google");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("ComposeDrawer as a dialog", () => {
  it("is a labelled modal dialog that takes focus", () => {
    render(
      <ComposeDrawer
        composer={makeComposer() as never}
        open
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog", {
      name: "Compose your platform",
    });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("closes on Escape and hands focus back", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const { rerender } = render(
      <ComposeDrawer
        composer={makeComposer() as never}
        open
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    rerender(
      <ComposeDrawer
        composer={makeComposer() as never}
        open={false}
        onClose={onClose}
      />,
    );
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
