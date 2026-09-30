import { App } from "../app";
import { FaviconController } from "./favicon";
import { HomeController } from "./home";
import { StylesheetController } from "./stylesheet";
import { PdfSampleController } from "./pdf-sample/controller";

export class FeaturesController {
  private constructor() {}
  public static async create(p: { app: App }) {
    await FaviconController.create({ app: p.app });
    await StylesheetController.create({ app: p.app });
    await HomeController.create({ app: p.app });
    await PdfSampleController.create({ app: p.app });
  }
}
