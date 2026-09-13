import { App } from "../app";
import { HomeController } from "./home";

export class FeaturesController {
  private constructor() {}
  public static async create(p: { app: App }) {
    await HomeController.create({ app: p.app });
  }
}
