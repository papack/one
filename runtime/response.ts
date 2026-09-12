import { swap } from "./swap";

export async function handleResponse(
  source: Element,
  response: Response,
): Promise<void> {
  const location = response.headers.get("runtime-location");
  if (location) {
    window.location.assign(location);
    return;
  }
  const html = await response.text();
  swap(source, html);
  const pushUrl = response.headers.get("runtime-push-url");
  const replaceUrl = response.headers.get("runtime-replace-url");
  if (pushUrl) history.pushState(null, "", pushUrl);
  if (replaceUrl) history.replaceState(null, "", replaceUrl);
}
