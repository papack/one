import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { Readable } from "node:stream";

type HandlerType = (req: Request) => Promise<Response>;
type NodeRequestInit = RequestInit & { duplex: "half" };

class RequestBodyTooLargeError extends Error {}

export class Router {
  private server: Server;
  private routes: Map<string, HandlerType> = new Map();
  private notFoundHandler: HandlerType;
  private internalServerErrorHandler: HandlerType;
  private maxBodySize: number;

  constructor(p: {
    notFound: HandlerType;
    internalServerError: HandlerType;
    maxBodySize?: number;
  }) {
    this.notFoundHandler = p.notFound;
    this.internalServerErrorHandler = p.internalServerError;

    const maxBodySize = p.maxBodySize ?? 1024 * 1024;

    if (!Number.isSafeInteger(maxBodySize) || maxBodySize < 0) {
      throw new Error("maxBodySize must be a non-negative integer");
    }

    this.maxBodySize = maxBodySize;

    this.server = createServer((req, res) => {
      this.handleRequest(req, res);
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(`http://${req.headers.host}${req.url}`);
    const method = req.method ?? "GET";
    const headers = new Headers();
    const contentLength = req.headers["content-length"];

    if (
      typeof contentLength === "string" &&
      Number(contentLength) > this.maxBodySize
    ) {
      req.resume();
      res.statusCode = 413;
      res.end("PAYLOAD_TOO_LARGE");
      return;
    }

    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        for (const headerValue of value) {
          headers.append(key, headerValue);
        }
      } else if (value !== undefined) {
        headers.set(key, value);
      }
    }

    const requestInit: NodeRequestInit = {
      method,
      headers,
      body:
        method === "GET" || method === "HEAD"
          ? undefined
          : this.createBodyStream(req),
      duplex: "half",
    };
    const request = new Request(url, requestInit);

    try {
      const handler =
        this.routes.get(`${method} ${url.pathname}`) ??
        this.notFoundHandler;

      const response = await handler(request);

      res.statusCode = response.status;

      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      if (!response.body) {
        res.end();
        return;
      }

      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        res.write(Buffer.from(value));
      }

      res.end();
    } catch (error) {
      const response =
        error instanceof RequestBodyTooLargeError
          ? new Response("PAYLOAD_TOO_LARGE", { status: 413 })
          : await this.internalServerErrorHandler(request);

      res.statusCode = response.status;

      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      if (!response.body) {
        res.end();
        return;
      }

      const reader = response.body.getReader();

      for (;;) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        res.write(Buffer.from(value));
      }

      res.end();
    }
  }

  private createBodyStream(req: IncomingMessage): ReadableStream<Uint8Array> {
    let size = 0;
    const maxBodySize = this.maxBodySize;
    const body = Readable.toWeb(req) as unknown as ReadableStream<Uint8Array>;

    return body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          size += chunk.byteLength;

          if (size > maxBodySize) {
            throw new RequestBodyTooLargeError();
          }

          controller.enqueue(chunk);
        },
      }),
    );
  }

  public async add(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    handler: HandlerType,
  ) {
    this.routes.set(`${method} ${path}`, handler);
  }

  public listen(port: number, cb?: () => void) {
    this.server.listen(port, cb);
  }
}
