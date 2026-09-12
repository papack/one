import { swap } from "./swap";

export function installSse(root: Document = document): void {
  for (const element of root.querySelectorAll<HTMLElement>("[data-sse]")) {
    const url = element.dataset.sse;
    if (!url || element.dataset.runtimeSseConnected === "true") continue;
    element.dataset.runtimeSseConnected = "true";
    const source = new EventSource(url);
    source.addEventListener("message", (event) => swap(element, event.data));
  }
}
