import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

/**
 * Props that make a non-button element operable like one: focusable, announced
 * as a button, and activated by Enter or Space. The palette and canvas cards
 * hold block layout, which a real <button> may not contain.
 */
export function buttonProps(onActivate: () => void, disabled = false) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-disabled": disabled || undefined,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (!disabled) onActivate();
    },
  };
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal focus handling: moves focus into the dialog (to `initialFocus`, or its
 * first focusable element), keeps Tab and Shift+Tab inside it, closes on
 * Escape, and hands focus back to whatever had it when the dialog opened.
 */
export function useModalFocus(
  container: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocus?: RefObject<HTMLElement | null>,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const root = container.current;
    const focusables = () =>
      root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];

    (initialFocus?.current ?? focusables()[0] ?? root)?.focus();

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !root) return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
    // Runs once per opening; the latest onClose is read through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
