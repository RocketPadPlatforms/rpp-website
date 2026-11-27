import type { PlatformOutput, SelectionEntry, WorkloadInstance } from "../data/types";
import { isWorkload } from "../data/types";

/**
 * Drop blank title/description so an untitled workload serialises to just
 * {type, id}. Keeps share URLs short and makes the encoding of a given
 * selection stable no matter how platform/ text changes.
 */
function slimWorkload(w: WorkloadInstance): WorkloadInstance {
  const slim: WorkloadInstance = { type: w.type, id: w.id };
  if (w.title) slim.title = w.title;
  if (w.description) slim.description = w.description;
  return slim;
}

export function buildOutput(entries: SelectionEntry[]): PlatformOutput {
  const strings: string[] = [];
  const workloads: WorkloadInstance[] = [];
  for (const e of entries) {
    if (isWorkload(e)) workloads.push(slimWorkload(e));
    else strings.push(e);
  }
  strings.sort();
  workloads.sort((a, b) => a.id.localeCompare(b.id));
  return {
    schema: "v1",
    components: [...strings, ...workloads],
  };
}

function parseShareShape(raw: string): SelectionEntry[] | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !json ||
    typeof json !== "object" ||
    (json as { schema?: unknown }).schema !== "v1" ||
    !Array.isArray((json as { components?: unknown }).components)
  ) {
    return null;
  }
  const seenIds = new Set<string>();
  const entries: SelectionEntry[] = [];
  for (const item of (json as { components: unknown[] }).components) {
    if (typeof item === "string") {
      entries.push(item);
      continue;
    }
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { type?: unknown }).type === "string" &&
      typeof (item as { id?: unknown }).id === "string"
    ) {
      const obj = item as {
        type: string;
        id: string;
        title?: unknown;
        description?: unknown;
      };
      if (seenIds.has(obj.id)) return null;
      seenIds.add(obj.id);
      // title/description are optional: absent in payloads written since the
      // catalog defaults stopped being baked in, present in older ones.
      const parsed: WorkloadInstance = { type: obj.type, id: obj.id };
      if (typeof obj.title === "string" && obj.title) parsed.title = obj.title;
      if (typeof obj.description === "string" && obj.description) {
        parsed.description = obj.description;
      }
      entries.push(parsed);
      continue;
    }
    return null;
  }
  return entries;
}

export function decodeComposeJSON(raw: string): SelectionEntry[] | null {
  return parseShareShape(raw);
}

/**
 * Share fragments are URL-safe base64 of the UTF-8 JSON. Plain btoa() only
 * takes Latin-1, so a workload titled "Café €" or "支払い" made it throw and
 * the Share button silently did nothing.
 */
export function encodeShareURL(entries: SelectionEntry[]): string {
  const bytes = new TextEncoder().encode(JSON.stringify(buildOutput(entries)));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShareURL(fragment: string): SelectionEntry[] {
  if (!fragment) return [];
  try {
    // Accepts the URL-safe alphabet and links shared before it, which used
    // standard base64 with padding.
    const standard = fragment.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(standard + "=".repeat((4 - (standard.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    let raw: string;
    try {
      raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      // Old links were Latin-1, which is not always valid UTF-8.
      raw = binary;
    }
    return parseShareShape(raw) ?? [];
  } catch {
    return [];
  }
}
