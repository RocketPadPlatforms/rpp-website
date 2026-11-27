import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { WorkloadModal } from "./WorkloadModal";

afterEach(cleanup);

const baseProps = {
  type: "workload.api",
  typeName: "API",
  mode: "add" as const,
  defaultDescription: "API service workload",
};

describe("WorkloadModal", () => {
  it("renders header with typeName", () => {
    render(
      <WorkloadModal {...baseProps} onSave={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText(/Add API Workload/i)).toBeTruthy();
  });

  it("Save passes title and description", () => {
    const onSave = vi.fn(() => {});
    render(
      <WorkloadModal {...baseProps} onSave={onSave} onCancel={() => {}} />,
    );
    const titleInput = screen.getByPlaceholderText(
      /Title/i,
    ) as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Billing" } });
    const textarea = screen.getByPlaceholderText(
      /API service workload/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "billing service" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith("Billing", "billing service");
  });

  it("Save with empty description stores blank, not the catalog default", () => {
    // The default is shown as a placeholder and resolved at render time. Baking
    // it into the instance would bloat share URLs and freeze a copy of the
    // catalog text that goes stale when the component is edited.
    const onSave = vi.fn(() => {});
    render(
      <WorkloadModal {...baseProps} onSave={onSave} onCancel={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith("", "");
  });

  it("shows the catalog description as the placeholder", () => {
    render(
      <WorkloadModal {...baseProps} onSave={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByPlaceholderText("API service workload")).toBeTruthy();
  });

  it("trims surrounding whitespace on save", () => {
    const onSave = vi.fn(() => {});
    render(
      <WorkloadModal {...baseProps} onSave={onSave} onCancel={() => {}} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Title/i), {
      target: { value: "  Billing  " },
    });
    fireEvent.change(screen.getByPlaceholderText(/API service workload/i), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith("Billing", "");
  });

  it("Cancel button invokes onCancel", () => {
    const onCancel = vi.fn(() => {});
    render(
      <WorkloadModal {...baseProps} onSave={() => {}} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("ESC key invokes onCancel", () => {
    const onCancel = vi.fn(() => {});
    render(
      <WorkloadModal {...baseProps} onSave={() => {}} onCancel={onCancel} />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("Ctrl+Enter triggers Save", () => {
    const onSave = vi.fn(() => {});
    render(
      <WorkloadModal {...baseProps} onSave={onSave} onCancel={() => {}} />,
    );
    const textarea = screen.getByPlaceholderText(
      /API service workload/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(onSave).toHaveBeenCalledWith("", "hello");
  });

  it("edit mode shows Remove button", () => {
    const onRemove = vi.fn(() => {});
    render(
      <WorkloadModal
        {...baseProps}
        mode="edit"
        initialTitle="My API"
        initialDescription="existing desc"
        onSave={() => {}}
        onRemove={onRemove}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/Edit API Workload/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("add mode has no Remove button", () => {
    render(
      <WorkloadModal {...baseProps} onSave={() => {}} onCancel={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
  });
});
