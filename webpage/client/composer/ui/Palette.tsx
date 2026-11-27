import type { ComposerState } from "../engine/useComposer";
import { Tooltip } from "./Tooltip";
import { buttonProps } from "./a11y";
import { RPP, LAYER_COLORS, FONTS } from "./theme";

interface PaletteProps {
  composer: ComposerState;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  onWorkloadClick?: (id: string) => void;
}

export function Palette({
  composer,
  onDragStart,
  onDragEnd,
  onWorkloadClick,
}: PaletteProps) {
  const {
    platform,
    selection,
    toggle,
    excluded,
    suggested,
    coreIds,
    isLayerUnlocked,
    isLayerExpanded,
  } = composer;

  function findSuggestSource(targetId: string): string | undefined {
    for (const selId of selection) {
      const src = platform.components.get(selId);
      if (src?.rules.suggests.includes(targetId)) return src.name;
    }
    return undefined;
  }

  return (
    <div
      className="rpp-scroll flex-1 min-h-0 overflow-y-auto p-3"
      style={{ background: RPP.bgMuted, fontFamily: FONTS.body }}
    >
      <div
        className="text-[0.7rem] font-extrabold uppercase px-2 py-1 mb-2"
        style={{ color: RPP.textDim, letterSpacing: "0.15em" }}
      >
        Module Palette
      </div>

      {platform.layers.map((layer) => {
        const unlocked = isLayerUnlocked(layer.id);
        const color = LAYER_COLORS[layer.id] ?? RPP.textSecondary;
        const expanded = isLayerExpanded(layer.id);
        const snappedCount = layer.components.filter((c) =>
          selection.has(c.id),
        ).length;

        return (
          <div
            key={layer.id}
            className="mb-3"
            style={{ opacity: expanded ? (unlocked ? 1 : 0.4) : 0.4 }}
          >
            <div
              className="text-[0.65rem] font-extrabold uppercase px-2 mb-1 flex items-center gap-1.5"
              style={{ color, letterSpacing: "0.12em" }}
            >
              <span
                className="inline-block rounded-full"
                style={{ width: 8, height: 8, background: color }}
              />
              {layer.name}
              {layer.select === "single" && expanded && (
                <span
                  className="ml-1 font-medium normal-case"
                  style={{ color: RPP.textDim, letterSpacing: "0.04em" }}
                >
                  (pick one)
                </span>
              )}
              {!expanded && (
                <span
                  className="ml-1 font-medium normal-case text-[0.6rem]"
                  style={{ color: RPP.textDim }}
                >
                  {snappedCount} snapped
                </span>
              )}
            </div>

            {expanded &&
              (() => {
                const unselected = layer.components.filter(
                  (c) => layer.id === "workload" || !selection.has(c.id),
                );

                return (
                  <>
                    {layer.id !== "workload" && unselected.length === 0 && (
                      <div
                        className="italic px-2 py-1 text-[0.65rem]"
                        style={{ color: RPP.textDim }}
                      >
                        All snapped
                      </div>
                    )}

                    {unselected.map((comp) => {
                      const isExcluded = excluded.has(comp.id);
                      const isSuggested = suggested.has(comp.id);
                      const isCore = coreIds.includes(comp.id);
                      const disabled = isExcluded || !unlocked;

                      const reason:
                        | {
                            kind: "excluded" | "suggested" | "core";
                            by?: string;
                          }
                        | undefined = isExcluded
                        ? { kind: "excluded", by: excluded.get(comp.id) }
                        : isCore
                          ? { kind: "core" }
                          : isSuggested
                            ? {
                                kind: "suggested",
                                by: findSuggestSource(comp.id),
                              }
                            : undefined;

                      const activate = () => {
                        if (layer.id === "workload" && onWorkloadClick) {
                          onWorkloadClick(comp.id);
                        } else {
                          toggle(comp.id);
                        }
                      };

                      return (
                        <Tooltip
                          key={comp.id}
                          label={comp.name}
                          description={comp.description}
                          reason={reason}
                          side="right"
                        >
                          <div
                            {...buttonProps(activate, disabled)}
                            aria-label={`Add ${comp.name}${isExcluded ? ` (incompatible with ${excluded.get(comp.id)})` : !unlocked ? " (locked)" : ""}`}
                            className={`rpp-pal-card ${disabled ? "rpp-pal-card--disabled" : ""}`}
                            draggable={!disabled}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", comp.id);
                              e.dataTransfer.effectAllowed = "move";
                              onDragStart?.(comp.id);
                            }}
                            onDragEnd={() => onDragEnd?.()}
                            onClick={() => {
                              if (!disabled) activate();
                            }}
                            style={{
                              padding: "6px 10px",
                              marginBottom: 3,
                              borderRadius: 8,
                              background: RPP.bg,
                              border: `1px solid ${isSuggested ? color : RPP.border}`,
                              borderStyle: isSuggested ? "dashed" : "solid",
                              fontFamily: FONTS.heading,
                              fontSize: 12,
                              fontWeight: 500,
                              color: RPP.textPrimary,
                            }}
                          >
                            {comp.name}
                            <div
                              className="text-[0.65rem] mt-0.5"
                              style={{ color: RPP.textDim }}
                            >
                              {comp.description}
                            </div>
                          </div>
                        </Tooltip>
                      );
                    })}
                  </>
                );
              })()}
          </div>
        );
      })}
    </div>
  );
}
