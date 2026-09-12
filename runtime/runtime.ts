import { installEvents } from "./events";
import { installSse } from "./sse";

let initialized = false;

export function runtime(): void {
  if (initialized || typeof document === "undefined") return;
  initialized = true;
  const initialize = () => { installEvents(); installSse(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
}
