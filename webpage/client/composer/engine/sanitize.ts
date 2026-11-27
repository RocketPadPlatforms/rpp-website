import type { Layer, PlatformData, SelectionEntry } from "../data/types";
import { isWorkload } from "../data/types";
import { getExcluded } from "./rules";

/**
 * Workload instance ids end up in share URLs, the exported JSON and DOM
 * attribute selectors (see Canvas' wire layout). Anything outside this
 * alphabet - a quote above all - could break those, so it is refused at the
 * door rather than escaped everywhere it is used.
 */
export const WORKLOAD_ID_PATTERN = /^[a-z0-9][a-z0-9.-]{0,63}$/;

/** Longest title / description a workload may carry, so share URLs stay sane. */
export const WORKLOAD_TITLE_MAX = 80;
export const WORKLOAD_DESCRIPTION_MAX = 280;

export function typeOf(entry: SelectionEntry): string {
  return isWorkload(entry) ? entry.type : entry;
}

export function toTypeSet(entries: SelectionEntry[]): Set<string> {
  const s = new Set<string>();
  for (const e of entries) s.add(typeOf(e));
  return s;
}

/**
 * The layer that gates `layer`: its declared `unlocksAfter`, else the one
 * directly below it. Lets a layer sit high in the stack without inheriting the
 * layer below it as a prerequisite.
 */
export function gatingLayer(layer: Layer, platform: PlatformData): Layer | undefined {
  if (layer.unlocksAfter !== undefined) {
    return platform.layers.find((l) => l.id === layer.unlocksAfter);
  }
  return platform.layers.find((l) => l.position === layer.position - 1);
}

/**
 * A layer is unlocked when its gating layer is itself unlocked and holds a
 * selection. The check is transitive: core components keep rpp-base
 * "selected" at all times, so a one-level check would unlock everything above
 * it before a compute provider was even chosen. Layers are sorted by position
 * and gates always sit lower (the loader enforces both), so one ordered sweep
 * resolves every layer.
 */
export function computeUnlockedLayers(selection: Set<string>, platform: PlatformData): Set<string> {
  const unlocked = new Set<string>();
  for (const layer of platform.layers) {
    if (layer.position === 0) {
      unlocked.add(layer.id);
      continue;
    }
    const gate = gatingLayer(layer, platform);
    if (gate && unlocked.has(gate.id) && gate.components.some((c) => selection.has(c.id))) {
      unlocked.add(layer.id);
    }
  }
  return unlocked;
}

/**
 * Brings any list of entries - a share link, a pasted JSON, a preset, or the
 * state after a removal - into a state the composer could have produced
 * itself:
 *
 * - unknown component types are dropped;
 * - workload-layer components only as {type, id} instances with a safe,
 *   unique id; every other component only as a plain id, once;
 * - core components are always present;
 * - single-select layers keep their first entry only;
 * - excluded (non-core) components are dropped;
 * - anything in a layer that is no longer unlocked is dropped, repeated until
 *   nothing changes - removing a compute provider takes the kubernetes and
 *   provider choices built on it along.
 */
export function sanitizeEntries(
  entries: readonly SelectionEntry[],
  platform: PlatformData,
  coreIds: readonly string[],
): SelectionEntry[] {
  const layerById = new Map(platform.layers.map((l) => [l.id, l]));
  const seenIds = new Set<string>();
  const seenWorkloadIds = new Set<string>();
  const filledSingleLayers = new Set<string>();

  let next: SelectionEntry[] = [];
  for (const entry of entries) {
    const comp = platform.components.get(typeOf(entry));
    if (!comp) continue;
    const isWorkloadLayer = comp.layer === "workload";

    if (isWorkload(entry)) {
      if (!isWorkloadLayer) continue;
      if (!WORKLOAD_ID_PATTERN.test(entry.id) || seenWorkloadIds.has(entry.id)) continue;
      seenWorkloadIds.add(entry.id);
      const instance: SelectionEntry = { type: entry.type, id: entry.id };
      if (entry.title) instance.title = entry.title.slice(0, WORKLOAD_TITLE_MAX);
      if (entry.description) instance.description = entry.description.slice(0, WORKLOAD_DESCRIPTION_MAX);
      next.push(instance);
      continue;
    }

    if (isWorkloadLayer || seenIds.has(entry)) continue;
    const layer = layerById.get(comp.layer);
    if (layer?.select === "single") {
      if (filledSingleLayers.has(layer.id)) continue;
      filledSingleLayers.add(layer.id);
    }
    seenIds.add(entry);
    next.push(entry);
  }

  for (const c of coreIds) {
    if (!seenIds.has(c)) next.push(c);
  }

  const isCore = (e: SelectionEntry) => !isWorkload(e) && coreIds.includes(e);

  // Exclusions and locking feed each other (dropping an excluded provider can
  // lock the layers above it), so iterate to a fixed point. Every pass either
  // removes an entry or stops, so this terminates.
  for (;;) {
    const types = toTypeSet(next);
    const excluded = getExcluded(types, platform);
    const unlocked = computeUnlockedLayers(types, platform);

    const kept = next.filter((e) => {
      if (isCore(e)) return true;
      const id = typeOf(e);
      if (!isWorkload(e) && excluded.has(id)) return false;
      const comp = platform.components.get(id);
      return comp !== undefined && unlocked.has(comp.layer);
    });

    if (kept.length === next.length) return kept;
    next = kept;
  }
}
