import { useEffect, useRef, useState } from "react";
import type { ComposerState } from "../engine/useComposer";
import { RPP } from "./theme";

type Feedback = "json" | "url" | "error" | null;

export function ExportBar({ composer }: { composer: ComposerState }) {
  const { output, shareURL, reset } = composer;
  const [feedback, setFeedback] = useState<Feedback>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const jsonString = JSON.stringify(output, null, 2);

  useEffect(() => () => clearTimeout(timer.current), []);

  function flash(value: Feedback) {
    clearTimeout(timer.current);
    setFeedback(value);
    timer.current = setTimeout(() => setFeedback(null), 2000);
  }

  function handleExportJSON() {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "platform-config.json";
    a.click();
    // Revoking synchronously can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // The clipboard can be refused (permissions, an iframe without
  // clipboard-write, an insecure context); say so instead of doing nothing.
  async function copy(text: () => string, kind: "json" | "url") {
    try {
      await navigator.clipboard.writeText(text());
      flash(kind);
    } catch {
      flash("error");
    }
  }

  const handleCopyJSON = () => copy(() => jsonString, "json");
  const handleShareURL = () => copy(shareURL, "url");
  const copied = feedback;

  return (
    <div
      className="border-t p-3 flex gap-2 shrink-0 flex-wrap"
      style={{ borderColor: RPP.border, background: RPP.bg }}
    >
      <button
        type="button"
        onClick={handleExportJSON}
        className="rpp-btn rpp-btn--primary"
      >
        Export JSON
      </button>
      <button
        type="button"
        onClick={handleCopyJSON}
        className="rpp-btn rpp-btn--ghost"
      >
        {copied === "json" ? "Copied!" : "Copy JSON"}
      </button>
      <button type="button" onClick={handleShareURL} className="rpp-btn">
        {copied === "url" ? "Link Copied!" : "Share URL"}
      </button>
      <button type="button" onClick={reset} className="rpp-btn rpp-btn--ghost">
        Reset
      </button>
      {/* Announced to screen readers; the button labels above change too. */}
      <span
        role="status"
        className="text-xs self-center"
        style={{ color: RPP.textDim }}
      >
        {feedback === "error"
          ? "Copying failed — your browser blocked clipboard access."
          : ""}
      </span>
    </div>
  );
}
