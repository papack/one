import { jsx } from "../../jsx";
import { Box } from "./box";
import type { BoxProps } from "./box";

/** Sticks an element within its scroll container. */
export interface StickyPropertiesInterface extends BoxProps {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  zIndex?: string;
}

export function Sticky(p: StickyPropertiesInterface) {
  const { top, right, bottom, left, zIndex, style: customStyle, children, ...attrs } = p;

  return (
    <Box
      {...attrs}
      style={{ position: "sticky", top, right, bottom, left, zIndex, ...customStyle }}
    >
      {children}
    </Box>
  );
}
