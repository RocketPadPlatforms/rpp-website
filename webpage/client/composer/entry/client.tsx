import { createRoot } from "react-dom/client";
import { App } from "../ui/App";
import { ComposerError, ErrorBoundary } from "../ui/ErrorBoundary";
import type { PlatformData, Component, Preset } from "../data/types";
import "../index.css";

// The catalog is baked out of platform/*.yaml at build time by the
// bake-platform plugin in vite.config.mts, and served as a static asset - so
// there is no runtime YAML parsing and no server route behind this.
const PLATFORM_URL = "/assets/composer/platform.json";

async function loadPlatformData(): Promise<PlatformData> {
  const res = await fetch(PLATFORM_URL);
  if (!res.ok) {
    throw new Error(`Failed to load platform data (${res.status})`);
  }
  const raw = await res.json();

  // Rehydrate the components Map from the plain object
  return {
    layers: raw.layers,
    components: new Map<string, Component>(Object.entries(raw.components)),
    presets: (raw.presets ?? []) as Preset[],
  };
}

const root = createRoot(document.getElementById("root")!);

loadPlatformData().then(
  (platform) =>
    root.render(
      <ErrorBoundary>
        <App platform={platform} />
      </ErrorBoundary>,
    ),
  // Network errors and bad JSON used to reject unhandled and leave an empty page.
  () => root.render(<ComposerError message="The module catalogue could not be loaded. Please try again." />),
);
