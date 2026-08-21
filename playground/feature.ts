import { AppType } from "../main.js";

export class Feat {
  private app: AppType;

  constructor(p: { app: AppType }) {
    this.app = p.app;
  }

  public async init() {
    this.app.router.add("GET", "/", async () => {
      return new Response("Hello World!");
    });
  }
}
