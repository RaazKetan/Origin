// Magic UI — Animated Theme Toggler (JSX port, controlled mode)
// Source: https://magicui.design/r/animated-theme-toggler.json
import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { flushSync } from "react-dom";

const cn = (...xs) => xs.filter(Boolean).join(" ");

function polygonCollapsed(cx, cy, n) {
  return `polygon(${Array.from({ length: n }, () => `${cx}px ${cy}px`).join(", ")})`;
}

function getThemeTransitionClipPaths(variant, cx, cy, maxRadius, vw, vh) {
  switch (variant) {
    case "circle":
      return [`circle(0px at ${cx}px ${cy}px)`, `circle(${maxRadius}px at ${cx}px ${cy}px)`];
    case "square": {
      const half = Math.max(Math.max(cx, vw - cx), Math.max(cy, vh - cy)) * 1.05;
      const end = [
        `${cx - half}px ${cy - half}px`, `${cx + half}px ${cy - half}px`,
        `${cx + half}px ${cy + half}px`, `${cx - half}px ${cy + half}px`,
      ].join(", ");
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`];
    }
    case "diamond": {
      const R = maxRadius * Math.SQRT2;
      const end = [`${cx}px ${cy - R}px`, `${cx + R}px ${cy}px`, `${cx}px ${cy + R}px`, `${cx - R}px ${cy}px`].join(", ");
      return [polygonCollapsed(cx, cy, 4), `polygon(${end})`];
    }
    default:
      return [`circle(0px at ${cx}px ${cy}px)`, `circle(${maxRadius}px at ${cx}px ${cy}px)`];
  }
  // ponytail: only circle/square/diamond ported, add more variants when used
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  variant = "circle",
  fromCenter = false,
  theme,
  onThemeChange,
  ...props
}) => {
  const isControlled = theme !== undefined;
  const [internalIsDark, setInternalIsDark] = useState(false);
  const isDark = isControlled ? theme === "dark" : internalIsDark;
  const buttonRef = useRef(null);

  useEffect(() => {
    if (isControlled) return;
    const update = () => setInternalIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [isControlled]);

  const toggleTheme = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    let x, y;
    if (fromCenter) { x = vw / 2; y = vh / 2; }
    else {
      const r = button.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    const maxRadius = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));

    const apply = () => {
      const next = !isDark;
      if (isControlled) onThemeChange?.(next ? "dark" : "light");
      else {
        document.documentElement.classList.toggle("dark");
        setInternalIsDark(next);
        localStorage.setItem("theme", next ? "dark" : "light");
      }
    };

    if (typeof document.startViewTransition !== "function") { apply(); return; }

    const clipPath = getThemeTransitionClipPaths(variant, x, y, maxRadius, vw, vh);
    const root = document.documentElement;
    root.dataset.magicuiThemeVt = "active";
    root.style.setProperty("--magicui-theme-toggle-vt-duration", `${duration}ms`);
    root.style.setProperty("--magicui-theme-vt-clip-from", clipPath[0]);
    const cleanup = () => {
      delete root.dataset.magicuiThemeVt;
      root.style.removeProperty("--magicui-theme-toggle-vt-duration");
      root.style.removeProperty("--magicui-theme-vt-clip-from");
    };

    const t = document.startViewTransition(() => flushSync(apply));
    t?.finished?.finally?.(cleanup);
    t?.ready?.then?.(() => {
      document.documentElement.animate({ clipPath }, {
        duration, easing: "ease-in-out", fill: "forwards",
        pseudoElement: "::view-transition-new(root)",
      });
    });
  }, [variant, fromCenter, duration, isDark, isControlled, onThemeChange]);

  return (
    <button type="button" ref={buttonRef} onClick={toggleTheme} className={cn(className)} {...props}>
      {isDark ? <Sun /> : <Moon />}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
};

export default AnimatedThemeToggler;
