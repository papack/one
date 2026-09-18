import { App } from "../app";
import { FaviconController } from "./favicon";
import { HomeController } from "./home";
import { StylesheetController } from "./stylesheet";

export class FeaturesController {
  private constructor() {}
  public static async create(p: { app: App }) {
    await FaviconController.create({ app: p.app });
    await StylesheetController.create({ app: p.app });
    await HomeController.create({ app: p.app });
  }
}
