import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ComposerState } from "../engine/useComposer";
import { RPP, LAYER_COLORS, FONTS } from "./theme";
import { Tooltip } from "./Tooltip";
import { buttonProps } from "./a11y";
import { isWorkload } from "../data/types";
import type { WorkloadInstance, SelectionEntry } from "../data/types";
import { WorkloadModal } from "./WorkloadModal";

export interface CanvasHandle {
  openWorkloadAdd: (compId: string) => void;
}

interface CanvasProps {
  composer: ComposerState;
}

type ModalState =
  | { mode: "add"; type: string; typeName: string; defaultDescription: string }
  | {
      mode: "edit";
      instance: WorkloadInstance;
      typeName: string;
      defaultDescription: string;
    }
  | null;

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  { composer },
  ref,
) {
  const {
    platform,
    entries,
    selection,
    toggle,
    addWorkload,
    updateWorkload,
    removeEntry,
    coreIds,
    isLayerUnlocked,
    isLayerExpanded,
  } = composer;
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [snapped, setSnapped] = useState<Set<string>>(new Set());
  const [hoveredComp, setHoveredComp] = useState<string | null>(null);
  const [workloadModal, setWorkloadModal] = useState<ModalState>(null);

  const openWorkloadAdd = useCallback(
    (compId: string) => {
      const comp = platform.components.get(compId);
      if (!comp || comp.layer !== "workload") return;
      setWorkloadModal({
        mode: "add",
        type: comp.id,
        typeName: comp.name,
        defaultDescription: comp.description,
      });
    },
    [platform],
  );

  useImperativeHandle(ref, () => ({ openWorkloadAdd }), [openWorkloadAdd]);

  const handleDrop = useCallback(
    (layerId: string, e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      setDropTarget(null);
      if (!id) return;
      const comp = platform.components.get(id);
      if (!comp || comp.layer !== layerId) return;
      if (!isLayerUnlocked(layerId)) return;

      if (comp.layer === "workload") {
        openWorkloadAdd(id);
        return;
      }

      if (selection.has(id)) return;
      toggle(id);
      setSnapped((prev) => {
        const n = new Set(prev);
        n.add(id);
        return n;
      });
      setTimeout(() => {
        setSnapped((prev) => {
          const n = new Set(prev);
          n.delete(id);
          return n;
        });
      }, 500);
    },
    [platform, selection, toggle, isLayerUnlocked, openWorkloadAdd],
  );

  return (
    <div
      ref={containerRef}
      className="rpp-scroll flex-1 min-h-0 overflow-y-auto relative"
      style={{
        background: RPP.bgAlt,
        padding: 20,
        fontFamily: FONTS.body,
      }}
    >
      <CanvasWires
        layers={platform.layers}
        selection={selection}
        entries={entries}
        containerRef={containerRef}
        hoveredComp={hoveredComp}
      />

      <div className="relative flex flex-col gap-4" style={{ zIndex: 1 }}>
        {platform.layers
          .slice()
          .toReversed()
          .map((layer, layerIdx) => {
            const unlocked = isLayerUnlocked(layer.id);
            const color = LAYER_COLORS[layer.id] ?? RPP.textSecondary;
            const selected = layer.components.filter((c) =>
              selection.has(c.id),
            );
            const active = dropTarget === layer.id;
            const expanded = isLayerExpanded(layer.id);

            const isWorkloadLayer = layer.id === "workload";
            const workloadEntries = isWorkloadLayer
              ? entries.filter(isWorkload).filter((w) => {
                  const c = platform.components.get(w.type);
                  return c?.layer === "workload";
                })
              : [];
            const hasContent = isWorkloadLayer
              ? workloadEntries.length > 0
              : selected.length > 0;

            if (!expanded) {
              const snappedCount = isWorkloadLayer
                ? entries.filter(isWorkload).filter((w) => {
                    const c = platform.components.get(w.type);
                    return c?.layer === "workload";
                  }).length
                : layer.components.filter((c) => selection.has(c.id)).length;

              return (
                <div
                  key={layer.id}
                  data-testid={`drop-zone-${layer.id}`}
                  style={{
                    background: RPP.bg,
                    border: `1.5px dashed ${RPP.border}`,
                    borderRadius: 14,
                    padding: "8px 16px",
                    opacity: 0.45,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: snappedCount > 0 ? color : "#2A4060",
                      }}
                    />
                    <span
                      className="text-xs font-extrabold uppercase"
                      style={{
                        color: RPP.textPrimary,
                        letterSpacing: "0.12em",
                      }}
                    >
                      {layer.name}
                    </span>
                    <span
                      className="text-[0.65rem]"
                      style={{ color: RPP.textDim }}
                    >
                      {snappedCount} snapped
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={layer.id}
                data-testid={`drop-zone-${layer.id}`}
                className={`rpp-drop-zone ${active ? "rpp-drop-zone--active" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropTarget(layer.id);
                }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => handleDrop(layer.id, e)}
                style={{
                  background: RPP.bg,
                  border: `1.5px dashed ${hasContent ? color + "77" : RPP.border}`,
                  borderRadius: 14,
                  padding: "12px 16px 36px",
                  minHeight: 74,
                  opacity: unlocked ? 1 : 0.45,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: hasContent ? color : "#2A4060",
                      boxShadow: hasContent ? `0 0 8px ${color}66` : "none",
                      transition: "all 0.3s",
                    }}
                  />
                  <span
                    className="text-xs font-extrabold uppercase"
                    style={{ color: RPP.textPrimary, letterSpacing: "0.12em" }}
                  >
                    {layer.name}
                  </span>
                  {hasContent && (
                    <span
                      className="text-[0.7rem] font-bold"
                      style={{
                        color,
                        textShadow: `0 0 6px ${color}88`,
                      }}
                    >
                      <span aria-hidden="true">✓</span>
                      <span className="sr-only">layer complete</span>
                    </span>
                  )}
                  <span
                    className="text-[0.65rem]"
                    style={{ color: RPP.textDim }}
                  >
                    {isWorkloadLayer
                      ? `${workloadEntries.length}`
                      : layer.select === "single"
                        ? `${selected.length}/1`
                        : `${selected.length}`}{" "}
                    snapped
                  </span>
                </div>

                {!hasContent ? (
                  <div
                    className="text-center text-xs italic py-1"
                    style={{ color: RPP.textDim }}
                  >
                    {unlocked
                      ? "Drag or click modules to snap here"
                      : "Complete previous layer first"}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {isWorkloadLayer
                      ? workloadEntries.map((inst) => {
                          const comp = platform.components.get(inst.type);
                          if (!comp) return null;
                          const suffix = inst.id.slice(inst.type.length + 1);
                          const displayName =
                            inst.title || `${comp.name} #${suffix}`;
                          // Catalog values stand in wherever the user left a
                          // field blank; they are never stored on the instance.
                          const description =
                            inst.description || comp.description;
                          return (
                            <Tooltip
                              key={inst.id}
                              label={displayName}
                              description={description || undefined}
                              side="bottom"
                            >
                              <div
                                data-wire={inst.id}
                                className="rpp-canvas-card"
                                {...buttonProps(() =>
                                  setWorkloadModal({
                                    mode: "edit",
                                    instance: inst,
                                    typeName: comp.name,
                                    defaultDescription: comp.description,
                                  }),
                                )}
                                aria-label={`Edit workload ${displayName}`}
                                onClick={() => {
                                  setWorkloadModal({
                                    mode: "edit",
                                    instance: inst,
                                    typeName: comp.name,
                                    defaultDescription: comp.description,
                                  });
                                }}
                                onMouseEnter={() => setHoveredComp(inst.type)}
                                onMouseLeave={() => setHoveredComp(null)}
                                style={{
                                  background: `linear-gradient(135deg, ${RPP.bgMuted}, ${color}1A)`,
                                  border: `2px solid ${color}`,
                                  borderRadius: 10,
                                  padding: "8px 14px",
                                  minWidth: 130,
                                  boxShadow: `0 2px 10px ${color}1A`,
                                  cursor: "pointer",
                                  position: "relative",
                                }}
                              >
                                {layerIdx > 0 && (
                                  <div
                                    data-connector="top"
                                    style={{
                                      position: "absolute",
                                      top: -4,
                                      left: "50%",
                                      marginLeft: -4,
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      background: color,
                                      border: `2px solid ${RPP.bg}`,
                                      boxShadow: `0 0 6px ${color}55`,
                                    }}
                                  />
                                )}
                                {layerIdx < platform.layers.length - 1 && (
                                  <div
                                    data-connector="bottom"
                                    style={{
                                      position: "absolute",
                                      bottom: -4,
                                      left: "50%",
                                      marginLeft: -4,
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      background: color,
                                      border: `2px solid ${RPP.bg}`,
                                      boxShadow: `0 0 6px ${color}55`,
                                    }}
                                  />
                                )}
                                {/* Type eyebrow — only when a custom title
                                    replaced it; otherwise displayName already
                                    reads "<type> #n" and this would repeat it. */}
                                {inst.title && (
                                  <div
                                    className="text-[0.55rem] font-semibold uppercase tracking-wider"
                                    style={{ color }}
                                  >
                                    {comp.name}
                                  </div>
                                )}
                                <div
                                  className="text-xs font-semibold"
                                  style={{ color: RPP.textPrimary }}
                                >
                                  {displayName}
                                </div>
                                {description && (
                                  <div
                                    className="text-[0.65rem] mt-0.5"
                                    style={{ color: RPP.textDim }}
                                  >
                                    {description}
                                  </div>
                                )}
                              </div>
                            </Tooltip>
                          );
                        })
                      : selected.map((comp) => {
                          const isCore = coreIds.includes(comp.id);
                          const justSnapped = snapped.has(comp.id);
                          return (
                            <Tooltip
                              key={comp.id}
                              label={comp.name}
                              description={comp.description}
                              reason={isCore ? { kind: "core" } : undefined}
                              side="bottom"
                            >
                              <div
                                data-wire={comp.id}
                                className={`rpp-canvas-card ${justSnapped ? "rpp-canvas-card--snap" : ""}`}
                                {...buttonProps(() => toggle(comp.id), isCore)}
                                aria-label={
                                  isCore
                                    ? `${comp.name} (required)`
                                    : `Remove ${comp.name}`
                                }
                                onClick={() => {
                                  if (!isCore) toggle(comp.id);
                                }}
                                onMouseEnter={() => setHoveredComp(comp.id)}
                                onMouseLeave={() => setHoveredComp(null)}
                                style={{
                                  background: `linear-gradient(135deg, ${RPP.bgMuted}, ${color}1A)`,
                                  border: `2px solid ${color}`,
                                  borderRadius: 10,
                                  padding: "8px 14px",
                                  minWidth: 130,
                                  boxShadow: `0 2px 10px ${color}1A`,
                                  cursor: isCore ? "default" : "pointer",
                                  position: "relative",
                                }}
                              >
                                {layerIdx > 0 && (
                                  <div
                                    data-connector="top"
                                    style={{
                                      position: "absolute",
                                      top: -4,
                                      left: "50%",
                                      marginLeft: -4,
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      background: color,
                                      border: `2px solid ${RPP.bg}`,
                                      boxShadow: `0 0 6px ${color}55`,
                                    }}
                                  />
                                )}
                                {layerIdx < platform.layers.length - 1 && (
                                  <div
                                    data-connector="bottom"
                                    style={{
                                      position: "absolute",
                                      bottom: -4,
                                      left: "50%",
                                      marginLeft: -4,
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      background: color,
                                      border: `2px solid ${RPP.bg}`,
                                      boxShadow: `0 0 6px ${color}55`,
                                    }}
                                  />
                                )}
                                <div
                                  className="text-xs font-semibold"
                                  style={{ color: RPP.textPrimary }}
                                >
                                  {comp.name}
                                </div>
                                <div
                                  className="text-[0.65rem] mt-0.5"
                                  style={{ color: RPP.textDim }}
                                >
                                  {comp.description}
                                </div>
                                {isCore && (
                                  <span
                                    className="absolute text-[0.55rem] font-extrabold uppercase"
                                    style={{
                                      top: 6,
                                      right: 8,
                                      color: "#77C6C0",
                                      background: "#77C6C022",
                                      padding: "1px 5px",
                                      borderRadius: 6,
                                    }}
                                  >
                                    core
                                  </span>
                                )}
                              </div>
                            </Tooltip>
                          );
                        })}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {workloadModal?.mode === "add" && (
        <WorkloadModal
          type={workloadModal.type}
          typeName={workloadModal.typeName}
          mode="add"
          defaultDescription={workloadModal.defaultDescription}
          onSave={(title, description) => {
            addWorkload(workloadModal.type, title, description);
            setWorkloadModal(null);
          }}
          onCancel={() => setWorkloadModal(null)}
        />
      )}

      {workloadModal?.mode === "edit" && (
        <WorkloadModal
          key={workloadModal.instance.id}
          type={workloadModal.instance.type}
          typeName={workloadModal.typeName}
          mode="edit"
          initialTitle={workloadModal.instance.title}
          initialDescription={workloadModal.instance.description}
          defaultDescription={workloadModal.defaultDescription}
          onSave={(title, description) => {
            updateWorkload(workloadModal.instance.id, title, description);
            setWorkloadModal(null);
          }}
          onRemove={() => {
            removeEntry(workloadModal.instance.id);
            setWorkloadModal(null);
          }}
          onCancel={() => setWorkloadModal(null)}
        />
      )}
    </div>
  );
});

/** A wire segment: fan-in (source→bundle) or fan-out (bundle→target) */
interface WirePath {
  d: string;
  color: string;
  compId: string;
  pairIds: string[];
  kind: "fan-in" | "fan-out";
}

function CanvasWires({
  layers,
  selection,
  entries,
  containerRef,
  hoveredComp,
}: {
  layers: ComposerState["platform"]["layers"];
  selection: Set<string>;
  entries: SelectionEntry[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  hoveredComp: string | null;
}) {
  const [paths, setPaths] = useState<WirePath[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const recalc = useCallback(() => {
    const box = containerRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const sl = box.scrollLeft;
    const st = box.scrollTop;
    setSize({ w: box.scrollWidth, h: box.scrollHeight });
    const nextPaths: WirePath[] = [];

    const reversed = layers.slice().toReversed();
    for (let i = 0; i < reversed.length - 1; i++) {
      const from = reversed[i + 1]!;
      const to = reversed[i]!;

      const fromIds: string[] =
        from.id === "workload"
          ? entries
              .filter(isWorkload)
              .filter((w) => from.components.some((c) => c.id === w.type))
              .map((w) => w.id)
          : from.components.filter((m) => selection.has(m.id)).map((m) => m.id);
      const toIds: string[] =
        to.id === "workload"
          ? entries
              .filter(isWorkload)
              .filter((w) => to.components.some((c) => c.id === w.type))
              .map((w) => w.id)
          : to.components.filter((m) => selection.has(m.id)).map((m) => m.id);
      if (fromIds.length === 0 || toIds.length === 0) continue;

      const lc = LAYER_COLORS[from.id] ?? RPP.mainBlue;
      const pairIds = [...fromIds, ...toIds];

      const sources: { id: string; x: number; y: number }[] = [];
      for (const fid of fromIds) {
        const el = box.querySelector(
          `[data-wire="${CSS.escape(fid)}"]`,
        ) as HTMLElement | null;
        if (!el) continue;
        const r = el.getBoundingClientRect();
        sources.push({
          id: fid,
          x: r.left + r.width / 2 - rect.left + sl,
          y: r.top - rect.top + st,
        });
      }
      const targets: { id: string; x: number; y: number }[] = [];
      for (const tid of toIds) {
        const el = box.querySelector(
          `[data-wire="${CSS.escape(tid)}"]`,
        ) as HTMLElement | null;
        if (!el) continue;
        const r = el.getBoundingClientRect();
        targets.push({
          id: tid,
          x: r.left + r.width / 2 - rect.left + sl,
          y: r.bottom - rect.top + st,
        });
      }
      if (sources.length === 0 || targets.length === 0) continue;

      for (const s of sources) {
        for (const t of targets) {
          const my = (s.y + t.y) / 2;
          nextPaths.push({
            d: `M${s.x},${s.y} C${s.x},${my} ${t.x},${my} ${t.x},${t.y}`,
            color: lc,
            compId: s.id,
            pairIds,
            kind: "fan-in",
          });
        }
      }
    }
    setPaths(nextPaths);
  }, [layers, selection, entries, containerRef]);

  useEffect(() => {
    recalc();
  }, [recalc]);

  useEffect(() => {
    const id = setTimeout(recalc, 450);
    return () => clearTimeout(id);
  }, [recalc]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => recalc();
    el.addEventListener("scroll", handler);
    window.addEventListener("resize", handler);
    const ro = new ResizeObserver(handler);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
      ro.disconnect();
    };
  }, [containerRef, recalc]);

  if (paths.length === 0) return null;
  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: size.w || "100%",
        height: size.h || "100%",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      {paths.map((p, i) => {
        const pairActive =
          hoveredComp != null && p.pairIds.includes(hoveredComp);
        const isDirectlyHovered = hoveredComp === p.compId;
        const isDimmed = hoveredComp != null && !pairActive;
        const isIdle = hoveredComp == null;
        const glowOpacity =
          isDimmed || isIdle ? 0.04 : isDirectlyHovered ? 0.25 : 0.15;
        const lineOpacity =
          isDimmed || isIdle
            ? 0.08
            : isDirectlyHovered
              ? 0.7
              : pairActive
                ? 0.5
                : 0.4;
        const width = isDirectlyHovered ? 2 : 1.5;

        return (
          <g key={i}>
            <path
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={width + 0.5}
              strokeOpacity={glowOpacity}
            />
            <path
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={width}
              strokeOpacity={lineOpacity}
              strokeDasharray={isDirectlyHovered ? "none" : "6 4"}
            />
          </g>
        );
      })}
    </svg>
  );
}
