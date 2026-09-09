import { jsx } from "../jsx";
import { Absolute } from "./absolute";
import { Relative } from "./relative";
import type { BoxProps } from "./box";

/** Creates a scrollable container that fills its parent. */
export interface ScrollPropertiesInterface extends BoxProps {}

export function Scroll(p: ScrollPropertiesInterface) {
  const { style: customStyle, children, ...attrs } = p;

  return (
    <Relative s="100%">
      <Absolute
        {...attrs}
        top="0"
        right="0"
        bottom="0"
        left="0"
        style={{ overflow: "auto", ...customStyle }}
      >
        {children}
      </Absolute>
    </Relative>
  );
}
