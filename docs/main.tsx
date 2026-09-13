import { App } from "./app";
import { FeaturesController } from "./features";

async function main() {
  const app = await App.create();

  await FeaturesController.create({ app });

  app.router.listen(3000, () => {
    console.log("Server listen on port 3000");
  });
}
main();
