import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  afterEach(() => cleanup());

  it("shows on mouse enter after delay", async () => {
    render(
      <Tooltip label="GKE" description="Google Kubernetes Engine" delayMs={0}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    fireEvent.mouseEnter(trigger);
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByRole("tooltip")).toBeTruthy();
    expect(screen.getByText("Google Kubernetes Engine")).toBeTruthy();
  });

  it("hides on mouse leave after grace period", async () => {
    render(
      <Tooltip label="GKE" description="desc" delayMs={0}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    fireEvent.mouseEnter(trigger);
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByRole("tooltip")).toBeTruthy();

    fireEvent.mouseLeave(trigger);
    await new Promise((r) => setTimeout(r, 150));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows on focus", async () => {
    render(
      <Tooltip label="GKE" description="desc" delayMs={0}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    fireEvent.focus(trigger);
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByRole("tooltip")).toBeTruthy();
  });

  it("hides on blur", async () => {
    render(
      <Tooltip label="GKE" description="desc" delayMs={0}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    fireEvent.focus(trigger);
    await new Promise((r) => setTimeout(r, 10));
    fireEvent.blur(trigger);
    await new Promise((r) => setTimeout(r, 150));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("hides on Escape key", async () => {
    render(
      <Tooltip label="GKE" description="desc" delayMs={0}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger");
    fireEvent.mouseEnter(trigger);
    await new Promise((r) => setTimeout(r, 10));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("wires aria-describedby to the tooltip id", async () => {
    render(
      <Tooltip label="GKE" description="desc" delayMs={0}>
        <button>Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByText("Trigger") as HTMLButtonElement;
    fireEvent.mouseEnter(trigger);
    await new Promise((r) => setTimeout(r, 10));
    const tip = screen.getByRole("tooltip");
    expect(trigger.getAttribute("aria-describedby")).toBe(tip.id);
  });
});
