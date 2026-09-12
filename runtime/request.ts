import { handleResponse } from "./response";

const requestAttributes = ["get", "post", "put", "patch", "delete"] as const;
type RequestMethod = Uppercase<(typeof requestAttributes)[number]>;

function requestDetails(element: Element): { method: RequestMethod; url: string } | null {
  for (const attribute of requestAttributes) {
    const url = element.getAttribute(`data-${attribute}`);
    if (url !== null) return { method: attribute.toUpperCase() as RequestMethod, url };
  }
  return null;
}

function encodeFormData(formData: FormData): URLSearchParams {
  const params = new URLSearchParams();
  for (const [name, value] of formData) if (typeof value === "string") params.append(name, value);
  return params;
}

export async function request(element: Element): Promise<boolean> {
  const details = requestDetails(element);
  if (!details) return false;
  const response = await fetch(details.url, { method: details.method });
  await handleResponse(element, response);
  return true;
}

export async function submit(form: HTMLFormElement): Promise<void> {
  const method = (form.method || "get").toUpperCase();
  const formData = new FormData(form);
  let url = form.action || window.location.href;
  const init: RequestInit = { method };
  if (method === "GET") {
    const parsedUrl = new URL(url, window.location.href);
    for (const [name, value] of formData) if (typeof value === "string") parsedUrl.searchParams.append(name, value);
    url = parsedUrl.href;
  } else if (form.enctype === "multipart/form-data") {
    init.body = formData;
  } else if (form.enctype === "text/plain") {
    init.body = Array.from(formData, ([name, value]) => `${name}=${value}`).join("\r\n");
    init.headers = { "Content-Type": "text/plain" };
  } else {
    init.body = encodeFormData(formData);
  }
  const response = await fetch(url, init);
  await handleResponse(form, response);
}
