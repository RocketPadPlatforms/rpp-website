import { useCallback, useRef, useState } from "react";
import {
  WORKLOAD_DESCRIPTION_MAX,
  WORKLOAD_TITLE_MAX,
} from "../engine/sanitize";
import { useModalFocus } from "./a11y";
import { RPP, LAYER_COLORS, FONTS } from "./theme";

interface WorkloadModalProps {
  type: string;
  typeName: string;
  mode: "add" | "edit";
  initialTitle?: string;
  initialDescription?: string;
  defaultDescription: string;
  onSave: (title: string, description: string) => void;
  onRemove?: () => void;
  onCancel: () => void;
}

const accentColor = LAYER_COLORS.workload;

export function WorkloadModal({
  type: _type,
  typeName,
  mode,
  initialTitle = "",
  initialDescription = "",
  defaultDescription,
  onSave,
  onRemove,
  onCancel,
}: WorkloadModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const titleRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Focus starts in the title, stays inside the dialog, returns on close.
  useModalFocus(panelRef, onCancel, titleRef);

  const save = useCallback(() => {
    // Blank stays blank — the catalog description is shown as a placeholder and
    // resolved at render time, never copied into the stored instance.
    onSave(title.trim(), description.trim());
  }, [title, description, onSave]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        save();
      }
    },
    [save],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${mode === "add" ? "Add" : "Edit"} ${typeName} Workload`}
      className="fixed inset-0 flex items-center justify-center backdrop-blur-[2px]"
      style={{ background: "rgba(0,0,0,0.5)", zIndex: 50 }}
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        className="rounded-xl shadow-2xl w-[420px] max-w-[90vw] overflow-hidden"
        style={{
          background: RPP.bgMuted,
          color: RPP.textPrimary,
          fontFamily: FONTS.body,
          border: `1px solid ${RPP.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full" style={{ background: accentColor }} />

        <div className="px-5 pt-4 pb-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: accentColor,
                boxShadow: `0 0 8px ${accentColor}66`,
              }}
            />
            <h2
              className="font-extrabold uppercase tracking-wider text-sm"
              style={{ color: RPP.textPrimary }}
            >
              {mode === "add" ? "Add" : "Edit"} {typeName} Workload
            </h2>
          </div>

          <div className="space-y-3">
            <label className="block space-y-1">
              <span
                className="text-[0.65rem] font-semibold uppercase tracking-wide"
                style={{ color: RPP.textDim }}
              >
                Title
              </span>
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={onKeyDown}
                maxLength={WORKLOAD_TITLE_MAX}
                placeholder="Title (optional)"
                className="w-full rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1"
                style={{
                  background: RPP.bg,
                  color: RPP.textPrimary,
                  border: `1px solid ${RPP.border}`,
                  fontFamily: FONTS.body,
                  // @ts-expect-error -- CSS custom property for focus ring
                  "--tw-ring-color": accentColor + "88",
                }}
              />
            </label>

            <label className="block space-y-1">
              <span
                className="text-[0.65rem] font-semibold uppercase tracking-wide"
                style={{ color: RPP.textDim }}
              >
                Description
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={onKeyDown}
                maxLength={WORKLOAD_DESCRIPTION_MAX}
                placeholder={defaultDescription || "Description (optional)"}
                rows={4}
                className="w-full rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1"
                style={{
                  background: RPP.bg,
                  color: RPP.textPrimary,
                  border: `1px solid ${RPP.border}`,
                  fontFamily: FONTS.body,
                  resize: "vertical",
                  // @ts-expect-error -- CSS custom property for focus ring
                  "--tw-ring-color": accentColor + "88",
                }}
              />
            </label>
          </div>

          <div
            className="flex items-center justify-between pt-2 border-t"
            style={{ borderColor: RPP.border }}
          >
            <div>
              {mode === "edit" && onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold transition-opacity hover:opacity-80"
                  style={{ background: RPP.warning, color: "#fff" }}
                >
                  Remove
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-1.5 rounded-lg text-sm transition-colors hover:brightness-125"
                style={{
                  background: "transparent",
                  color: RPP.textDim,
                  border: `1px solid ${RPP.border}`,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                className="px-4 py-1.5 rounded-lg text-sm font-bold transition-opacity hover:opacity-90"
                style={{ background: RPP.mainBlue, color: RPP.bg }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
