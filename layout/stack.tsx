import { jsx } from "../jsx";
import { Flex } from "./flex";
import type { FlexPropertiesInterface } from "./flex";

/** Vertical flex layout primitive. */
export interface StackPropertiesInterface extends FlexPropertiesInterface {}

export function Stack(p: StackPropertiesInterface) {
  const { children, ...attrs } = p;

  return (
    <Flex {...attrs} flxDirection={p.flxDirection ?? "column"}>
      {children}
    </Flex>
  );
}
