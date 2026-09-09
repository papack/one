import { jsx } from "../jsx";
import { Box } from "./box";
import type { BoxProps } from "./box";

/** Positions an element relative to the viewport. */
export interface FixedPropertiesInterface extends BoxProps {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  zIndex?: string;
}

export function Fixed(p: FixedPropertiesInterface) {
  const {
    top,
    right,
    bottom,
    left,
    zIndex,
    style: customStyle,
    children,
    ...attrs
  } = p;

  return (
    <Box
      {...attrs}
      style={{
        position: "fixed",
        top,
        right,
        bottom,
        left,
        zIndex,
        ...customStyle,
      }}
    >
      {children}
    </Box>
  );
}
