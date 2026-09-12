# `@papack/one/runtime`

`@papack/one/runtime` is a small client-side hypermedia runtime for `one`. Your server renders HTML; the runtime requests that HTML in the browser and inserts it into the page. Behaviour is declared with `data-*` attributes, so there is no client-side template system.

Each interaction follows one simple model:

> request -> HTML response -> target -> swap

## Installation and startup

bundle it with esbuild and youe can served it as a browser asset. Start it once in your client entry point:

```ts
import { runtime } from "@papack/one/runtime";
runtime();
```

The runtime waits for the document if necessary and is safe to call more than once.

## Requests

Use one of these attributes to make an HTML request:

| Attribute                | HTTP method |
| ------------------------ | ----------- |
| `data-get="/users"`      | `GET`       |
| `data-post="/users"`     | `POST`      |
| `data-put="/users/1"`    | `PUT`       |
| `data-patch="/users/1"`  | `PATCH`     |
| `data-delete="/users/1"` | `DELETE`    |

The response is interpreted as HTML. An element without an HTTP data attribute does not make a hypermedia request. The exception is `data-swap="remove"`, which can remove an element without a request.

```html
<button data-get="/users" data-target="content">Load users</button>
<div id="content"></div>
```

## Targets

`data-target` identifies the element that receives the response by element ID without a leading `#`.

```html
<button data-get="/users" data-target="content">Load users</button>
<main id="content"></main>
```

If `data-target` is omitted, the triggering element itself is the target. When an ID cannot be found, no swap is performed.

## Swaps

Set `data-swap` to control how the response HTML is inserted. The default is `outer`.

| Value     | Result                                           |
| --------- | ------------------------------------------------ |
| `inner`   | Replace the target's contents.                   |
| `outer`   | Replace the target element itself.               |
| `append`  | Insert at the end of the target.                 |
| `prepend` | Insert at the beginning of the target.           |
| `before`  | Insert immediately before the target.            |
| `after`   | Insert immediately after the target.             |
| `remove`  | Remove the target. The response body is ignored. |

For example, a server-rendered todo can be removed after a successful DELETE request:

```html
<button data-delete="/todos/42" data-target="todo-42" data-swap="remove">
  Delete
</button>
```

`data-swap="remove"` also works without an HTTP attribute:

```html
<button data-target="notice" data-swap="remove">Dismiss</button>
<p id="notice">Saved.</p>
```

## Triggers

Use `data-trigger` to choose when an element is activated:

| Value        | Activation                                    |
| ------------ | --------------------------------------------- |
| `click`      | The element is clicked.                       |
| `hover`      | The pointer enters the element.               |
| `input`      | The element emits an input event.             |
| `scroll-end` | A scrollable element reaches its bottom edge. |
| `submit`     | A form is submitted.                          |

Buttons and links default to `click`; forms default to `submit`. Other elements need an explicit trigger.

```html
<input data-get="/search" data-trigger="input" data-target="results" />
<div id="results"></div>
```

## Forms

Forms keep their native HTML semantics. Use `action`, `method`, and `enctype` as usual; add a runtime attribute such as `data-target` or `data-swap` to let the runtime intercept submission.

```html
<form action="/users" method="post" data-target="users" data-swap="append">
  <input name="name" required />
  <button type="submit">Create</button>
</form>

<ul id="users"></ul>
```

The runtime creates a `FormData` object from the form.

- `GET` form data is appended as query parameters.
- `POST`, `PUT`, and `PATCH` data is sent as the request body.
- `multipart/form-data` is preserved, so file uploads work.
- Native browser validation runs before the runtime sees a `submit` event.

On validation or application errors, the server can return the form again with its error messages as HTML.

## Server-sent events

Add `data-sse` to open an `EventSource` connection. Every SSE message must contain HTML and is processed with the same target and swap rules as a regular response. SSE connections are opened directly when the runtime starts.

```html
<ul data-sse="/messages" data-swap="append"></ul>
```

Each message from `/messages` is appended to the list.

## Response headers

The server can control navigation and browser history through response headers. Header names are case-insensitive, as with all HTTP headers.

| Header                | Behaviour                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `runtime-location`    | Performs a full-page navigation. No HTML swap is performed.                                      |
| `runtime-push-url`    | Performs the normal swap, then adds a history entry with `history.pushState()`.                  |
| `runtime-replace-url` | Performs the normal swap, then replaces the current history entry with `history.replaceState()`. |

For example, a server response can update a page fragment and then change the address bar without reloading the page:

```http
runtime-push-url: /users?page=2
```

Use `runtime-location` when the server requires a real document navigation, such as after an authentication flow.
