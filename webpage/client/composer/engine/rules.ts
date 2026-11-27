import type { PlatformData } from "../data/types";

/**
 * Compute which components are excluded based on current selection.
 * Returns Map<excludedId, name of the component that excludes it>.
 */
export function getExcluded(
  selection: Set<string>,
  platform: PlatformData,
): Map<string, string> {
  const excluded = new Map<string, string>();

  for (const id of selection) {
    const comp = platform.components.get(id);
    if (!comp) continue;

    for (const ref of comp.rules.excludes) {
      excluded.set(ref, comp.name);
    }
  }

  return excluded;
}

/**
 * Compute which components are suggested based on current selection.
 * Returns Set of suggested component IDs.
 */
export function getSuggested(
  selection: Set<string>,
  platform: PlatformData,
): Set<string> {
  const suggested = new Set<string>();

  for (const id of selection) {
    const comp = platform.components.get(id);
    if (!comp) continue;

    for (const ref of comp.rules.suggests) {
      suggested.add(ref);
    }
  }

  return suggested;
}

/**
 * Get IDs of all core components (always selected, can't deselect).
 */
export function getCoreComponentIds(platform: PlatformData): string[] {
  return [...platform.components.values()]
    .filter((c) => c.core)
    .map((c) => c.id);
}
