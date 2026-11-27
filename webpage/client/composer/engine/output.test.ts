import { describe, it, expect } from "vitest";
import {
  buildOutput,
  encodeShareURL,
  decodeShareURL,
  decodeComposeJSON,
} from "./output";
import type { SelectionEntry } from "../data/types";

describe("buildOutput", () => {
  it("produces flat JSON with schema v1 for string-only entries", () => {
    const entries: SelectionEntry[] = [
      "compute.google",
      "kubernetes.gke",
      "providers.cloud-lb",
      "rpp-base.iam",
      "rpp-base.gitops",
      "rpp-base.ssl",
    ];
    const output = buildOutput(entries);
    expect(output.schema).toBe("v1");
    expect(output.components).toHaveLength(6);
    expect(output.components).toContain("compute.google");
  });

  it("sorts strings alphabetically, workload objects after strings by id", () => {
    const entries: SelectionEntry[] = [
      { type: "workload.api", id: "workload.api-2" },
      "compute.google",
      { type: "workload.api", id: "workload.api-1", description: "first" },
      "rpp-base.iam",
    ];
    const output = buildOutput(entries);
    expect(output.components).toEqual([
      "compute.google",
      "rpp-base.iam",
      { type: "workload.api", id: "workload.api-1", description: "first" },
      { type: "workload.api", id: "workload.api-2" },
    ]);
  });

  it("omits blank title and description so untitled workloads stay minimal", () => {
    const entries: SelectionEntry[] = [
      { type: "workload.app", id: "workload.app-1", title: "", description: "" },
    ];
    const [workload] = buildOutput(entries).components;
    expect(workload).toEqual({ type: "workload.app", id: "workload.app-1" });
    expect(Object.keys(workload as object)).not.toContain("title");
    expect(Object.keys(workload as object)).not.toContain("description");
  });

  it("never bakes catalog text in: encoding is stable across platform edits", () => {
    // Two identical selections must encode identically regardless of what the
    // component catalog says, so share URLs stay comparable over time.
    const a: SelectionEntry[] = [{ type: "workload.app", id: "workload.app-1" }];
    const b: SelectionEntry[] = [
      { type: "workload.app", id: "workload.app-1", title: "", description: "" },
    ];
    expect(encodeShareURL(a)).toBe(encodeShareURL(b));
  });
});

describe("decodeComposeJSON", () => {
  it("parses string-only components array", () => {
    const raw = JSON.stringify({
      schema: "v1",
      components: ["compute.google", "rpp-base.iam"],
    });
    const decoded = decodeComposeJSON(raw);
    expect(decoded).toEqual(["compute.google", "rpp-base.iam"]);
  });

  it("parses mixed components array", () => {
    const raw = JSON.stringify({
      schema: "v1",
      components: [
        "compute.google",
        { type: "workload.api", id: "workload.api-1", description: "billing" },
      ],
    });
    const decoded = decodeComposeJSON(raw);
    expect(decoded).toEqual([
      "compute.google",
      { type: "workload.api", id: "workload.api-1", description: "billing" },
    ]);
  });

  it("accepts an object entry with no title or description", () => {
    const raw = JSON.stringify({
      schema: "v1",
      components: [{ type: "workload.api", id: "workload.api-1" }],
    });
    expect(decodeComposeJSON(raw)).toEqual([
      { type: "workload.api", id: "workload.api-1" },
    ]);
  });

  it("still accepts payloads written before defaults stopped being baked in", () => {
    // Older share URLs always carried title/description, with the catalog text
    // copied into description. They must keep decoding.
    const raw = JSON.stringify({
      schema: "v1",
      components: [
        { type: "workload.api", id: "workload.api-1", title: "", description: "API service workload" },
      ],
    });
    expect(decodeComposeJSON(raw)).toEqual([
      { type: "workload.api", id: "workload.api-1", description: "API service workload" },
    ]);
  });

  it("rejects an object entry missing id", () => {
    const raw = JSON.stringify({
      schema: "v1",
      components: [{ type: "workload.api", description: "no id" }],
    });
    expect(decodeComposeJSON(raw)).toBeNull();
  });

  it("rejects duplicate instance ids", () => {
    const raw = JSON.stringify({
      schema: "v1",
      components: [
        { type: "workload.api", id: "workload.api-1", description: "a" },
        { type: "workload.api", id: "workload.api-1", description: "b" },
      ],
    });
    expect(decodeComposeJSON(raw)).toBeNull();
  });

  it("rejects wrong schema", () => {
    const raw = JSON.stringify({ schema: "v2", components: [] });
    expect(decodeComposeJSON(raw)).toBeNull();
  });
});

describe("encodeShareURL / decodeShareURL", () => {
  it("round-trips mixed entries through base64 fragment", () => {
    const entries: SelectionEntry[] = [
      "compute.hetzner",
      { type: "workload.app", id: "workload.app-1", title: "Web", description: "web" },
    ];
    const fragment = encodeShareURL(entries);
    const decoded = decodeShareURL(fragment);
    expect(decoded).toEqual([
      "compute.hetzner",
      { type: "workload.app", id: "workload.app-1", title: "Web", description: "web" },
    ]);
  });

  it("round-trips an untitled workload without inventing fields", () => {
    const entries: SelectionEntry[] = [
      "compute.hetzner",
      { type: "workload.app", id: "workload.app-1" },
    ];
    const decoded = decodeShareURL(encodeShareURL(entries));
    expect(decoded).toEqual(entries);
  });

  it("returns empty array for malformed fragment", () => {
    const decoded = decodeShareURL("not-valid-base64!!!");
    expect(decoded).toEqual([]);
  });

  it.each(["Café €", "Zahlungen — Bestellung", "支払い", "🚀 launch"])(
    "round-trips non-Latin-1 text: %s",
    (title) => {
      const entries: SelectionEntry[] = [{ type: "workload.app", id: "workload.app-1", title }];
      expect(() => encodeShareURL(entries)).not.toThrow();
      expect(decodeShareURL(encodeShareURL(entries))).toEqual(entries);
    },
  );

  it("produces a URL-safe fragment", () => {
    const fragment = encodeShareURL([{ type: "workload.app", id: "workload.app-1", title: "??>>~~ÿ" }]);
    expect(fragment).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("still decodes links shared with the old standard-base64 encoding", () => {
    const legacy = btoa(JSON.stringify({ schema: "v1", components: ["compute.hetzner"] }));
    expect(decodeShareURL(legacy)).toEqual(["compute.hetzner"]);
  });
});
