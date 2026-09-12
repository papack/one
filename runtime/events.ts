import { request, submit } from "./request";
import { swap, swapFor } from "./swap";

const triggerEvents = [
  "click",
  "hover",
  "input",
  "scroll-end",
  "submit",
] as const;
type Trigger = (typeof triggerEvents)[number];

function triggerFor(element: Element): Trigger | null {
  const trigger = element.getAttribute("data-trigger") as Trigger | null;
  if (trigger && triggerEvents.includes(trigger)) return trigger;
  if (element instanceof HTMLFormElement) return "submit";
  if (
    element instanceof HTMLButtonElement ||
    element instanceof HTMLAnchorElement
  )
    return "click";
  return null;
}

function closestTriggered(
  target: EventTarget | null,
  trigger: Trigger,
): Element | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest("[data-trigger], button, a, form");
  return element && triggerFor(element) === trigger ? element : null;
}

async function activate(element: Element): Promise<void> {
  const hasRequest = ["get", "post", "put", "patch", "delete"].some((method) =>
    element.hasAttribute(`data-${method}`),
  );
  if (swapFor(element) === "remove" && !hasRequest) {
    swap(element, "");
    return;
  }
  await request(element);
}

function hasRuntimeAction(element: Element): boolean {
  return (
    swapFor(element) === "remove" ||
    ["get", "post", "put", "patch", "delete"].some((method) =>
      element.hasAttribute(`data-${method}`),
    )
  );
}

export function installEvents(root: Document = document): void {
  const scrollEndReached = new WeakSet<Element>();

  root.addEventListener("click", (event) => {
    const element = closestTriggered(event.target, "click");
    if (!element) return;
    if (!hasRuntimeAction(element)) return;
    if (
      element instanceof HTMLAnchorElement ||
      element instanceof HTMLButtonElement
    )
      event.preventDefault();
    void activate(element);
  });
  root.addEventListener("input", (event) => {
    const element = closestTriggered(event.target, "input");
    if (element) void activate(element);
  });
  root.addEventListener("mouseover", (event) => {
    const element = closestTriggered(event.target, "hover");
    if (element && !element.contains(event.relatedTarget as Node | null))
      void activate(element);
  });
  root.addEventListener("submit", (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form || triggerFor(form) !== "submit") return;
    if (
      !form.hasAttribute("data-target") &&
      !form.hasAttribute("data-swap") &&
      !form.hasAttribute("data-trigger")
    )
      return;
    event.preventDefault();
    void submit(form);
  });
  root.addEventListener(
    "scroll",
    (event) => {
      const element = closestTriggered(event.target, "scroll-end");
      if (!element) return;

      const isAtEnd =
        element.scrollTop >= element.scrollHeight - element.clientHeight - 1;
      if (!isAtEnd) {
        scrollEndReached.delete(element);
        return;
      }
      if (scrollEndReached.has(element)) return;

      scrollEndReached.add(element);
      void activate(element);
    },
    true,
  );
}
