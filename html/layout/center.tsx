import { jsx } from "../../jsx";
import { Flex } from "./flex";
import type { FlexPropertiesInterface } from "./flex";

/** Centers children on both axes using flexbox. */
export interface CenterPropertiesInterface extends FlexPropertiesInterface {}

export function Center(p: CenterPropertiesInterface) {
  const { children, ...attrs } = p;

  return <Flex {...attrs} ai={p.ai ?? "center"} jc={p.jc ?? "center"}>{children}</Flex>;
}
