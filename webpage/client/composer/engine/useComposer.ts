import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type {
  PlatformData,
  PlatformOutput,
  SelectionEntry,
  WorkloadInstance,
} from "../data/types";
import { isWorkload } from "../data/types";
import { getExcluded, getSuggested, getCoreComponentIds } from "./rules";
import {
  computeUnlockedLayers,
  sanitizeEntries,
  toTypeSet,
  WORKLOAD_DESCRIPTION_MAX,
  WORKLOAD_TITLE_MAX,
} from "./sanitize";
import {
  buildOutput,
  encodeShareURL,
  decodeShareURL,
  decodeComposeJSON,
} from "./output";

export interface ComposerState {
  entries: SelectionEntry[];
  selection: Set<string>; // derived set of types present (for rules/unlock/ui compat)
  toggle: (id: string) => void;
  addWorkload: (type: string, title: string, description: string) => string;
  updateWorkload: (id: string, title: string, description: string) => void;
  removeEntry: (key: string) => void;
  reset: () => void;
  excluded: Map<string, string>;
  suggested: Set<string>;
  output: PlatformOutput;
  coreIds: string[];
  unlockedLayers: Set<string>;
  isLayerUnlocked: (layerId: string) => boolean;
  expandedLayers: Set<string>;
  isLayerExpanded: (layerId: string) => boolean;
  shareURL: () => string;
  hydrateFromJSON: (raw: string) => boolean;
  platform: PlatformData;
}

function canAcceptSuggest(
  suggestedId: string,
  current: Set<string>,
  platform: PlatformData,
  unlockedLayers: Set<string>,
): boolean {
  const comp = platform.components.get(suggestedId);
  if (!comp) return false;
  if (!unlockedLayers.has(comp.layer)) return false;
  const layer = platform.layers.find((l) => l.id === comp.layer);
  if (!layer) return false;
  if (layer.select === "single") {
    const alreadySelected = layer.components.some(
      (c) => c.id !== suggestedId && current.has(c.id),
    );
    if (alreadySelected) return false;
  }
  const excluded = getExcluded(current, platform);
  if (excluded.has(suggestedId)) return false;
  return true;
}

/** Build an instance carrying only the fields the user actually filled in. */
function makeWorkload(
  type: string,
  id: string,
  title: string,
  description: string,
): WorkloadInstance {
  const w: WorkloadInstance = { type, id };
  if (title) w.title = title.slice(0, WORKLOAD_TITLE_MAX);
  if (description)
    w.description = description.slice(0, WORKLOAD_DESCRIPTION_MAX);
  return w;
}

function nextInstanceId(entries: SelectionEntry[], type: string): string {
  let max = 0;
  for (const e of entries) {
    if (!isWorkload(e) || e.type !== type) continue;
    const suffix = e.id.slice(type.length + 1); // strip "<type>-"
    const n = parseInt(suffix, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${type}-${max + 1}`;
}

export function useComposer(platform: PlatformData): ComposerState {
  const coreIds = useMemo(() => getCoreComponentIds(platform), [platform]);

  const [entries, setEntries] = useState<SelectionEntry[]>(() => {
    const hash =
      typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (hash) {
      // A share link is untrusted input: it goes through the same checks as
      // a pasted config before it reaches the canvas.
      const decoded = decodeShareURL(hash);
      if (decoded.length > 0)
        return sanitizeEntries(decoded, platform, coreIds);
    }
    return [...coreIds];
  });

  // Mirror of `entries` used to mint workload instance ids. Reading state
  // through a closure let two addWorkload calls in one tick see the same stale
  // list and mint the same id; duplicate ids make parseShareShape reject the
  // whole payload, so the share URL silently decodes to an empty canvas.
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const selection = useMemo(() => toTypeSet(entries), [entries]);

  const excluded = useMemo(
    () => getExcluded(selection, platform),
    [selection, platform],
  );
  const suggested = useMemo(
    () => getSuggested(selection, platform),
    [selection, platform],
  );
  const output = useMemo(() => buildOutput(entries), [entries]);

  const unlockedLayers = useMemo(
    () => computeUnlockedLayers(selection, platform),
    [selection, platform],
  );

  const isLayerUnlocked = useCallback(
    (layerId: string) => unlockedLayers.has(layerId),
    [unlockedLayers],
  );

  // Unlocking is transitive, so "expanded" and "unlocked" are the same set;
  // both names stay because the UI reads them for different purposes.
  const expandedLayers = unlockedLayers;

  const isLayerExpanded = useCallback(
    (layerId: string) => expandedLayers.has(layerId),
    [expandedLayers],
  );

  const toggle = useCallback(
    (id: string) => {
      setEntries((prev) => {
        const comp = platform.components.get(id);
        if (!comp) return prev;

        const prevTypes = toTypeSet(prev);
        const prevUnlocked = computeUnlockedLayers(prevTypes, platform);
        if (!prevUnlocked.has(comp.layer)) return prev;

        // Workload layer toggle from palette is not supported — use addWorkload
        // / removeEntry. Silently ignore.
        if (comp.layer === "workload") return prev;

        let next = [...prev];
        let justAdded = false;

        const alreadyPresent = next.some((e) => !isWorkload(e) && e === id);
        if (alreadyPresent) {
          if (coreIds.includes(id)) return prev;
          next = next.filter((e) => isWorkload(e) || e !== id);
        } else {
          justAdded = true;
          const layer = platform.layers.find((l) => l.id === comp.layer);
          if (layer?.select === "single") {
            const siblingIds = new Set(layer.components.map((c) => c.id));
            next = next.filter((e) => isWorkload(e) || !siblingIds.has(e));
          }
          next.push(id);
        }

        // Suggestions come only from the component just added. Re-applying
        // every selected component's suggestions on each toggle brought back
        // whatever the user had deliberately removed.
        if (justAdded) {
          let nextTypes = toTypeSet(next);
          const nextUnlocked = computeUnlockedLayers(nextTypes, platform);
          for (const s of comp.rules.suggests) {
            if (canAcceptSuggest(s, nextTypes, platform, nextUnlocked)) {
              if (!next.some((e) => !isWorkload(e) && e === s)) next.push(s);
              nextTypes = toTypeSet(next);
            }
          }
        }

        // Drops exclusions, and on removal everything that was built on the
        // removed component.
        return sanitizeEntries(next, platform, coreIds);
      });
    },
    [platform, coreIds],
  );

  const addWorkload = useCallback(
    (type: string, title: string, description: string): string => {
      const comp = platform.components.get(type);
      if (!comp || comp.layer !== "workload") return "";

      const id = nextInstanceId(entriesRef.current, type);
      const instance = makeWorkload(type, id, title, description);
      // Advance the mirror before returning so a second call in the same tick
      // sees this instance and mints a fresh number.
      entriesRef.current = [...entriesRef.current, instance];
      setEntries((prev) => [...prev, instance]);
      return id;
    },
    [platform],
  );

  const updateWorkload = useCallback(
    (id: string, title: string, description: string) => {
      setEntries((prev) =>
        prev.map((e) =>
          isWorkload(e) && e.id === id
            ? makeWorkload(e.type, e.id, title, description)
            : e,
        ),
      );
    },
    [],
  );

  const removeEntry = useCallback(
    (key: string) => {
      setEntries((prev) => {
        // Try workload instance id first
        const hadInstance = prev.some((e) => isWorkload(e) && e.id === key);
        if (hadInstance) {
          return prev.filter((e) => !(isWorkload(e) && e.id === key));
        }
        // Otherwise treat as component id (same path as toggle-off)
        if (coreIds.includes(key)) return prev;
        if (!prev.some((e) => !isWorkload(e) && e === key)) return prev;
        return sanitizeEntries(
          prev.filter((e) => isWorkload(e) || e !== key),
          platform,
          coreIds,
        );
      });
    },
    [platform, coreIds],
  );

  const reset = useCallback(() => {
    setEntries([...coreIds]);
  }, [coreIds]);

  const shareURL = useCallback(() => {
    const base =
      typeof window !== "undefined"
        ? window.location.origin + window.location.pathname
        : "";
    return base + "#" + encodeShareURL(entries);
  }, [entries]);

  const hydrateFromJSON = useCallback(
    (raw: string): boolean => {
      const parsed = decodeComposeJSON(raw);
      if (parsed === null) return false;

      setEntries(sanitizeEntries(parsed, platform, coreIds));

      return true;
    },
    [platform, coreIds],
  );

  return {
    entries,
    selection,
    toggle,
    addWorkload,
    updateWorkload,
    removeEntry,
    reset,
    excluded,
    suggested,
    output,
    coreIds,
    unlockedLayers,
    isLayerUnlocked,
    expandedLayers,
    isLayerExpanded,
    shareURL,
    hydrateFromJSON,
    platform,
  };
}
