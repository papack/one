import { Router } from "@papack/one";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "@papack/one/constants";

export class App {
  public router: Router;

  private constructor(p: { router: Router }) {
    this.router = p.router;
  }
  public static async create() {
    //build the router
    const router = new Router({
      notFound: async () => {
        return new Response("NOT FOUND", { status: NOT_FOUND });
      },
      internalServerError: async () => {
        return new Response("INTERNAL SERVER ERROR", {
          status: INTERNAL_SERVER_ERROR,
        });
      },
    });

    //create new instance
    const app = new App({ router });
    return app;
  }
}
