export type SwapMode = "inner" | "outer" | "append" | "prepend" | "before" | "after" | "remove";

const swapModes = new Set<SwapMode>(["inner", "outer", "append", "prepend", "before", "after", "remove"]);

export function targetFor(source: Element): Element | null {
  const targetId = source.getAttribute("data-target");
  return targetId ? document.getElementById(targetId) : source;
}

export function swapFor(source: Element): SwapMode {
  const value = source.getAttribute("data-swap") as SwapMode | null;
  return value && swapModes.has(value) ? value : "outer";
}

export function swap(source: Element, html: string): boolean {
  const target = targetFor(source);
  if (!target) return false;
  const mode = swapFor(source);
  if (mode === "remove") {
    target.remove();
    return true;
  }
  if (mode === "inner") {
    target.innerHTML = html;
    return true;
  }
  const fragment = document.createRange().createContextualFragment(html);
  switch (mode) {
    case "outer": target.replaceWith(fragment); break;
    case "append": target.append(fragment); break;
    case "prepend": target.prepend(fragment); break;
    case "before": target.before(fragment); break;
    case "after": target.after(fragment); break;
  }
  return true;
}
