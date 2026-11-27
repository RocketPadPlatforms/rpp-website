import { useCallback, useEffect, useRef, useState } from "react";
import { useComposer } from "../engine/useComposer";
import { Palette } from "./Palette";
import { Canvas, type CanvasHandle } from "./Canvas";
import { ExportBar } from "./ExportBar";
import { ComposeDrawer } from "./ComposeDrawer";
import type { PlatformData } from "../data/types";
import { RPP, FONTS } from "./theme";

function selectionIsCoreOnly(
  selection: Set<string>,
  coreIds: string[],
): boolean {
  if (selection.size !== coreIds.length) return false;
  for (const id of coreIds) {
    if (!selection.has(id)) return false;
  }
  return true;
}

// The composer has an English UI, so it links the English pages; "/" lets the
// homepage pick the visitor's language. target="_top" because the homepage
// embeds this page in an iframe, and a link followed inside the frame would
// load the whole site into it. The legal links are required on every page.
export const SITE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/en/faq", label: "FAQ" },
  { href: "/en/legal-notice", label: "Legal Notice" },
  { href: "/en/privacy", label: "Privacy" },
] as const;

function SiteLinks() {
  return (
    <nav
      aria-label="Rocket Pad Platforms"
      className="flex items-center gap-4 text-xs"
    >
      {SITE_LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_top"
          className="rpp-site-link"
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

export function App({ platform }: { platform: PlatformData }) {
  const composer = useComposer(platform);
  const [composeOpen, setComposeOpen] = useState(false);
  const canvasRef = useRef<CanvasHandle>(null);

  const handleWorkloadPaletteClick = useCallback((compId: string) => {
    canvasRef.current?.openWorkloadAdd(compId);
  }, []);

  useEffect(() => {
    // Also when a share link was present but sanitised down to nothing: the
    // visitor is looking at an empty canvas either way.
    if (selectionIsCoreOnly(composer.selection, composer.coreIds)) {
      setComposeOpen(true);
    }
    // Only run on mount — "canvas empty on arrival" is a one-shot check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="h-screen flex flex-col"
      style={{
        background: RPP.bg,
        color: RPP.textPrimary,
        fontFamily: FONTS.body,
      }}
    >
      <header
        className="shrink-0 px-6 py-3 flex items-center justify-between border-b"
        style={{ borderColor: RPP.border, background: RPP.bg }}
      >
        <div>
          <h1
            className="text-lg font-extrabold"
            style={{ color: RPP.textPrimary, letterSpacing: "0.02em" }}
          >
            <span style={{ color: RPP.mainBlue }}>Rocket Pad Platform</span>{" "}
            Composer
          </h1>
          <p className="text-xs" style={{ color: RPP.textDim }}>
            Build your platform by dragging modules from the palette into the
            canvas.
          </p>
        </div>
        <div className="flex items-center gap-5">
          <SiteLinks />
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="rpp-btn rpp-btn--primary"
          >
            Presets &amp; import
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside
          className="w-1/3 shrink-0 flex flex-col min-h-0 border-r"
          style={{ borderColor: RPP.border, background: RPP.bgMuted }}
        >
          <Palette
            composer={composer}
            onWorkloadClick={handleWorkloadPaletteClick}
          />
          <ExportBar composer={composer} />
        </aside>

        <Canvas ref={canvasRef} composer={composer} />
      </div>

      <ComposeDrawer
        composer={composer}
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
      />
    </div>
  );
}
