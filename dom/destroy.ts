import { runUnmounts } from "./lifecycle";

export function destroy(root: Node): void {
  while (root.firstChild) destroy(root.firstChild);

  if (root instanceof Element) runUnmounts(root);
  root.parentNode?.removeChild(root);
}
