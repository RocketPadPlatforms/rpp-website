import { useId, useRef, useState } from "react";
import type { ComposerState } from "../engine/useComposer";
import type { SelectionEntry } from "../data/types";
import { useModalFocus } from "./a11y";
import { RPP, FONTS } from "./theme";

const FRAMING_COPY =
  "Start from one of our presets, or paste a config you exported earlier to pick up where you left off.";

export interface ComposeDrawerProps {
  composer: ComposerState;
  open: boolean;
  onClose: () => void;
}

export function ComposeDrawer({ composer, open, onClose }: ComposeDrawerProps) {
  // The dialog mounts only while open, so its focus handling runs per opening.
  return open ? <OpenDrawer composer={composer} onClose={onClose} /> : null;
}

function OpenDrawer({ composer, onClose }: Omit<ComposeDrawerProps, "open">) {
  const [jsonInput, setJsonInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  useModalFocus(panelRef, onClose);

  const presets = composer.platform.presets;

  function handleCompose() {
    setError(null);
    const ok = composer.hydrateFromJSON(jsonInput);
    if (!ok) {
      setError(
        "Could not read that JSON. Double-check the format and try again.",
      );
      return;
    }
    setJsonInput("");
    onClose();
  }

  function handlePreset(components: SelectionEntry[]) {
    const json = JSON.stringify({ schema: "v1", components });
    const ok = composer.hydrateFromJSON(json);
    if (ok) onClose();
  }

  return (
    <div
      data-compose-drawer
      className="fixed inset-0 z-50 flex"
      style={{ fontFamily: FONTS.body }}
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="flex-1"
        style={{ background: "rgba(8,14,24,0.6)" }}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-[480px] max-w-full h-full flex flex-col shadow-2xl"
        style={{
          background: RPP.bgMuted,
          color: RPP.textPrimary,
          borderLeft: `1px solid ${RPP.border}`,
        }}
      >
        <header
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: RPP.border }}
        >
          <h2
            id={titleId}
            className="text-sm font-bold"
            style={{ color: RPP.mainBlue }}
          >
            Compose your platform
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rpp-btn rpp-btn--ghost"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <p
            className="text-xs leading-relaxed"
            style={{ color: RPP.textSecondary }}
          >
            {FRAMING_COPY}
          </p>

          {presets.length > 0 && (
            <div className="space-y-1.5">
              <span
                className="text-xs font-semibold"
                style={{ color: RPP.textDim }}
              >
                Load preset
              </span>
              <p className="text-[0.65rem]" style={{ color: RPP.textDim }}>
                Pick a starting point — you can modify it later.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePreset(preset.components)}
                    className="rpp-preset text-left rounded p-2 transition-colors"
                  >
                    <div
                      className="text-xs font-semibold"
                      style={{ color: RPP.textPrimary }}
                    >
                      {preset.name}
                    </div>
                    <div
                      className="text-[0.65rem] mt-0.5"
                      style={{ color: RPP.textDim }}
                    >
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TODO: restore the "compose from description" textarea once the
              natural-language composer is ready. See "Temporarily disabled
              features" in webpage/README.md for the full checklist. */}

          <label className="block space-y-1">
            <span
              className="text-xs font-semibold"
              style={{ color: RPP.textDim }}
            >
              Paste JSON
            </span>
            <textarea
              aria-label="Paste JSON"
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                if (error) setError(null);
              }}
              rows={8}
              placeholder='{"schema":"v1","components":["compute.google","kubernetes.gke"]}'
              className="w-full rounded p-2 text-xs"
              style={{
                background: RPP.bg,
                color: RPP.textPrimary,
                border: `1px solid ${RPP.border}`,
                fontFamily: FONTS.mono,
              }}
            />
          </label>

          {error && (
            <p role="alert" className="text-xs" style={{ color: RPP.warning }}>
              {error}
            </p>
          )}
        </div>

        <footer
          className="shrink-0 px-4 py-3 border-t flex justify-end gap-2"
          style={{ borderColor: RPP.border, background: RPP.bg }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rpp-btn rpp-btn--ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCompose}
            disabled={jsonInput.trim().length === 0}
            className="rpp-btn rpp-btn--primary"
          >
            Compose
          </button>
        </footer>
      </aside>
    </div>
  );
}
