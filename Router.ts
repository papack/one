import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

type HandlerType = (req: Request) => Promise<Response>;

export class Router {
  private server: Server;
  private routes: Map<string, HandlerType> = new Map();
  private notFoundHandler: HandlerType;
  private internalServerErrorHandler: HandlerType;

  constructor(p: { notFound: HandlerType; internalServerError: HandlerType }) {
    this.notFoundHandler = p.notFound;
    this.internalServerErrorHandler = p.internalServerError;

    this.server = createServer((req, res) => {
      this.handleRequest(req, res);
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(`http://${req.headers.host}${req.url}`);

    const request = new Request(url, {
      method: req.method,
    });

    try {
      const handler =
        this.routes.get(`${req.method} ${url.pathname}`) ??
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
    } catch {
      const response = await this.internalServerErrorHandler(request);

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
