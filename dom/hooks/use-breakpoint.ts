// use-breakpoint.ts
import { signal, type ReadFn } from "../signal";
import { breakpoint } from "../../style/breakpoint";

export type BreakpointName = keyof typeof breakpoint;

function detectBreakpoint(width: number): BreakpointName {
  if (width >= breakpoint.large) return "large";
  if (width >= breakpoint.desktop) return "desktop";
  if (width >= breakpoint.laptop) return "laptop";
  if (width >= breakpoint.tablet) return "tablet";
  return "mobile";
}

// initial value from real window
const [breakepoint, write] = signal<BreakpointName>(
  detectBreakpoint(window.innerWidth),
);

// attach resize listener once
let last = breakepoint();

window.addEventListener("resize", () => {
  const next = detectBreakpoint(window.innerWidth);
  if (next !== last) {
    last = next;
    write(() => next);
  }
});

export function useBreakpoint(): ReadFn<BreakpointName> {
  return breakepoint;
}
