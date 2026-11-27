import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { BLUEPRINT } from "./theme";

type Side = "right" | "left" | "top" | "bottom";

interface TooltipProps {
  label: string;
  description?: string;
  reason?: { kind: "excluded" | "suggested" | "core"; by?: string };
  children: ReactElement;
  side?: Side;
  delayMs?: number;
}

interface Position {
  top: number;
  left: number;
  side: Side;
}

const GRACE_MS = 100;
const TOOLTIP_GAP = 8;

export function Tooltip({
  label,
  description,
  reason,
  children,
  side = "right",
  delayMs = 200,
}: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position>({ top: 0, left: 0, side });

  const clearTimers = () => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    showTimer.current = null;
    hideTimer.current = null;
  };

  const show = useCallback(() => {
    clearTimers();
    showTimer.current = setTimeout(() => setOpen(true), delayMs);
  }, [delayMs]);

  const hide = useCallback(() => {
    clearTimers();
    hideTimer.current = setTimeout(() => setOpen(false), GRACE_MS);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearTimers();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tooltipRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const tip = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let chosen: Side = side;
    if (side === "right" && trigger.right + TOOLTIP_GAP + tip.width > vw) {
      chosen = "left";
    } else if (side === "left" && trigger.left - TOOLTIP_GAP - tip.width < 0) {
      chosen = "right";
    } else if (side === "top" && trigger.top - TOOLTIP_GAP - tip.height < 0) {
      chosen = "bottom";
    } else if (
      side === "bottom" &&
      trigger.bottom + TOOLTIP_GAP + tip.height > vh
    ) {
      chosen = "top";
    }

    let top = 0;
    let left = 0;
    switch (chosen) {
      case "right":
        top = trigger.top + trigger.height / 2 - tip.height / 2;
        left = trigger.right + TOOLTIP_GAP;
        break;
      case "left":
        top = trigger.top + trigger.height / 2 - tip.height / 2;
        left = trigger.left - TOOLTIP_GAP - tip.width;
        break;
      case "top":
        top = trigger.top - TOOLTIP_GAP - tip.height;
        left = trigger.left + trigger.width / 2 - tip.width / 2;
        break;
      case "bottom":
        top = trigger.bottom + TOOLTIP_GAP;
        left = trigger.left + trigger.width / 2 - tip.width / 2;
        break;
    }

    top = Math.max(8, Math.min(top, vh - tip.height - 8));
    left = Math.max(8, Math.min(left, vw - tip.width - 8));

    setPos({ top, left, side: chosen });
  }, [open, side, label, description]);

  if (!isValidElement(children)) {
    throw new Error("Tooltip expects a single valid React element as child");
  }

  const existingProps = children.props as Record<string, unknown>;

  const enhanced = cloneElement(
    children as ReactElement<Record<string, unknown>>,
    {
      ref: (node: HTMLElement | null) => {
        triggerRef.current = node;
      },
      "aria-describedby": open ? id : undefined,
      onMouseEnter: (e: React.MouseEvent) => {
        show();
        (
          existingProps.onMouseEnter as
            ((e: React.MouseEvent) => void) | undefined
        )?.(e);
      },
      onMouseLeave: (e: React.MouseEvent) => {
        hide();
        (
          existingProps.onMouseLeave as
            ((e: React.MouseEvent) => void) | undefined
        )?.(e);
      },
      onFocus: (e: React.FocusEvent) => {
        show();
        (
          existingProps.onFocus as ((e: React.FocusEvent) => void) | undefined
        )?.(e);
      },
      onBlur: (e: React.FocusEvent) => {
        hide();
        (existingProps.onBlur as ((e: React.FocusEvent) => void) | undefined)?.(
          e,
        );
      },
    } as Record<string, unknown>,
  );

  const tooltipNode: ReactNode = open
    ? createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          id={id}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            background: BLUEPRINT.tooltipBg,
            color: BLUEPRINT.tooltipText,
            padding: "0.55rem 0.8rem",
            borderRadius: "0.5rem",
            maxWidth: "18rem",
            boxShadow: "0 8px 24px rgba(56, 63, 81, 0.22)",
            fontSize: "0.78rem",
            fontWeight: 500,
            pointerEvents: "none",
            zIndex: 9999,
            lineHeight: 1.45,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.85rem",
              marginBottom: description || reason ? "0.25rem" : 0,
            }}
          >
            {label}
          </div>
          {description && <div>{description}</div>}
          {reason && (
            <div
              style={{
                marginTop: "0.35rem",
                color: BLUEPRINT.accent,
                fontSize: "0.65rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
              }}
            >
              {reason.kind === "excluded" &&
                reason.by &&
                `Incompatible with ${reason.by}`}
              {reason.kind === "suggested" &&
                reason.by &&
                `Suggested by ${reason.by}`}
              {reason.kind === "core" && "Required — always included"}
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {enhanced}
      {tooltipNode}
    </>
  );
}
