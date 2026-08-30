import { jsx } from "../../jsx";
import { Box } from "./box";
import type { BoxProps } from "./box";

/** Positions an element absolutely within its nearest positioned ancestor. */
export interface AbsolutePropertiesInterface extends BoxProps {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

export function Absolute(p: AbsolutePropertiesInterface) {
  const {
    top,
    right,
    bottom,
    left,
    style: customStyle,
    children,
    ...attrs
  } = p;

  return (
    <Box
      {...attrs}
      style={{ position: "absolute", top, right, bottom, left, ...customStyle }}
    >
      {children}
    </Box>
  );
}
