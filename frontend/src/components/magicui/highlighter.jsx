// Magic UI - Highlighter (JSX port)
// Source: https://magicui.design/r/highlighter.json
import { useLayoutEffect, useRef } from "react";
import { useInView } from "motion/react";
import { annotate } from "rough-notation";

export function Highlighter({
  children,
  action = "highlight",
  color = "#ffd1dc",
  strokeWidth = 1.5,
  animationDuration = 600,
  iterations = 2,
  padding = 2,
  multiline = true,
  isView = false,
}) {
  const elementRef = useRef(null);
  const isInView = useInView(elementRef, { once: true, margin: "-10%" });
  const shouldShow = !isView || isInView;

  useLayoutEffect(() => {
    const el = elementRef.current;
    let annotation = null;
    let ro = null;
    if (shouldShow && el) {
      const cfg = { type: action, color, strokeWidth, animationDuration, iterations, padding, multiline };
      annotation = annotate(el, cfg);
      annotation.show();
      ro = new ResizeObserver(() => { annotation.hide(); annotation.show(); });
      ro.observe(el);
      ro.observe(document.body);
    }
    return () => { annotation?.remove(); ro?.disconnect(); };
  }, [shouldShow, action, color, strokeWidth, animationDuration, iterations, padding, multiline]);

  return (
    <span ref={elementRef} className="relative inline-block bg-transparent">
      {children}
    </span>
  );
}

export default Highlighter;
